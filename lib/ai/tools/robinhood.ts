import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import {
  getConnectionStatus,
  getPortfolio,
  getPositions,
  getQuote,
  getAccount,
} from "@/lib/robinhood/client";

type RobinhoodToolProps = {
  session: Session;
};

/**
 * Tool to initiate Robinhood connection.
 * Returns a special response that triggers the login popup on the frontend.
 */
export const robinhoodConnect = ({ session }: RobinhoodToolProps) =>
  tool({
    description:
      "Connect to the user's Robinhood brokerage account. This will open a secure login popup for the user to enter their credentials. Use this when the user wants to connect their Robinhood account or when other Robinhood tools indicate they are not connected.",
    inputSchema: z.object({}),
    needsApproval: true,
    execute: async () => {
      const userId = session.user?.id;
      if (!userId) {
        return {
          error: "User not authenticated",
        };
      }

      const status = getConnectionStatus(userId);

      if (status.connected) {
        return {
          success: true,
          message: "Already connected to Robinhood.",
          connected: true,
        };
      }

      // Return a special response that the frontend will interpret to open the login popup
      return {
        action: "open_robinhood_login",
        message:
          "Opening Robinhood login popup. Please enter your credentials in the secure popup window.",
      };
    },
  });

/**
 * Tool to get account information from Robinhood
 */
export const robinhoodGetAccount = ({ session }: RobinhoodToolProps) =>
  tool({
    description:
      "Get Robinhood account information including buying power, cash balance, and account status. Requires the user to be connected to Robinhood first.",
    inputSchema: z.object({}),
    needsApproval: true,
    execute: async () => {
      const userId = session.user?.id;
      if (!userId) {
        return { error: "User not authenticated" };
      }

      const status = getConnectionStatus(userId);
      if (!status.connected) {
        return {
          error: "Not connected to Robinhood. Please connect first using the robinhoodConnect tool.",
          needsConnection: true,
        };
      }

      try {
        const account = await getAccount(userId);
        if (!account) {
          return { error: "Could not fetch account information" };
        }

        return {
          accountNumber: account.account_number,
          buyingPower: `$${Number.parseFloat(account.buying_power).toFixed(2)}`,
          cash: `$${Number.parseFloat(account.cash).toFixed(2)}`,
          cashAvailableForWithdrawal: `$${Number.parseFloat(account.cash_available_for_withdrawal).toFixed(2)}`,
          accountType: account.type,
          state: account.state,
          instantEligibility: account.instant_eligibility,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Failed to fetch account",
        };
      }
    },
  });

/**
 * Tool to get portfolio summary from Robinhood
 */
export const robinhoodGetPortfolio = ({ session }: RobinhoodToolProps) =>
  tool({
    description:
      "Get the user's Robinhood portfolio summary including total value, equity, cash, buying power, and daily change. Requires the user to be connected to Robinhood first.",
    inputSchema: z.object({}),
    needsApproval: true,
    execute: async () => {
      const userId = session.user?.id;
      if (!userId) {
        return { error: "User not authenticated" };
      }

      const status = getConnectionStatus(userId);
      if (!status.connected) {
        return {
          error: "Not connected to Robinhood. Please connect first using the robinhoodConnect tool.",
          needsConnection: true,
        };
      }

      try {
        const portfolio = await getPortfolio(userId);

        const changeSign = portfolio.dayChange >= 0 ? "+" : "";

        return {
          totalValue: `$${portfolio.totalValue.toFixed(2)}`,
          equity: `$${portfolio.equity.toFixed(2)}`,
          cash: `$${portfolio.cash.toFixed(2)}`,
          buyingPower: `$${portfolio.buyingPower.toFixed(2)}`,
          dayChange: `${changeSign}$${portfolio.dayChange.toFixed(2)}`,
          dayChangePercent: `${changeSign}${portfolio.dayChangePercent.toFixed(2)}%`,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Failed to fetch portfolio",
        };
      }
    },
  });

/**
 * Tool to get all stock positions from Robinhood
 */
export const robinhoodGetPositions = ({ session }: RobinhoodToolProps) =>
  tool({
    description:
      "Get all stock positions in the user's Robinhood portfolio, including quantity, average cost, current price, market value, and gain/loss for each position. Requires the user to be connected to Robinhood first.",
    inputSchema: z.object({}),
    needsApproval: true,
    execute: async () => {
      const userId = session.user?.id;
      if (!userId) {
        return { error: "User not authenticated" };
      }

      const status = getConnectionStatus(userId);
      if (!status.connected) {
        return {
          error: "Not connected to Robinhood. Please connect first using the robinhoodConnect tool.",
          needsConnection: true,
        };
      }

      try {
        const positions = await getPositions(userId);

        if (positions.length === 0) {
          return {
            message: "No open positions found in your portfolio.",
            positions: [],
          };
        }

        const formattedPositions = positions.map((pos) => {
          const gainSign = pos.totalGainLoss >= 0 ? "+" : "";
          return {
            symbol: pos.symbol,
            name: pos.name,
            quantity: pos.quantity,
            averageCost: `$${pos.averageCost.toFixed(2)}`,
            currentPrice: `$${pos.currentPrice.toFixed(2)}`,
            marketValue: `$${pos.marketValue.toFixed(2)}`,
            totalGainLoss: `${gainSign}$${pos.totalGainLoss.toFixed(2)}`,
            totalGainLossPercent: `${gainSign}${pos.totalGainLossPercent.toFixed(2)}%`,
          };
        });

        return {
          positionCount: positions.length,
          positions: formattedPositions,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Failed to fetch positions",
        };
      }
    },
  });

/**
 * Tool to get a stock quote
 * This can work without authentication for basic quote data
 */
export const robinhoodGetQuote = ({ session }: RobinhoodToolProps) =>
  tool({
    description:
      "Get a real-time stock quote for a given symbol. Returns the current price, change, bid/ask prices, and other market data. Can be used without being connected to Robinhood.",
    inputSchema: z.object({
      symbol: z
        .string()
        .describe("Stock ticker symbol (e.g., 'AAPL', 'GOOGL', 'TSLA')"),
    }),
    needsApproval: true,
    execute: async ({ symbol }) => {
      const userId = session.user?.id;

      try {
        const quote = await getQuote(symbol, userId);

        const changeSign = quote.change >= 0 ? "+" : "";

        return {
          symbol: quote.symbol,
          lastPrice: `$${quote.lastPrice.toFixed(2)}`,
          change: `${changeSign}$${quote.change.toFixed(2)}`,
          changePercent: `${changeSign}${quote.changePercent.toFixed(2)}%`,
          bidPrice: `$${quote.bidPrice.toFixed(2)}`,
          askPrice: `$${quote.askPrice.toFixed(2)}`,
          previousClose: `$${quote.previousClose.toFixed(2)}`,
          extendedHoursPrice: quote.extendedHoursPrice
            ? `$${quote.extendedHoursPrice.toFixed(2)}`
            : "N/A",
          tradingHalted: quote.tradingHalted,
        };
      } catch (error) {
        return {
          error:
            error instanceof Error
              ? error.message
              : `Failed to fetch quote for ${symbol}`,
        };
      }
    },
  });
