import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import {
  getAccount,
  getConnectionStatus,
  getCryptoHoldings,
  getOptionsPositions,
  getPortfolio,
  getPositions,
  getQuote,
  getTodayOptionsOrders,
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

      const status = await getConnectionStatus(userId);

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

      const status = await getConnectionStatus(userId);
      if (!status.connected) {
        return {
          error:
            "Not connected to Robinhood. Please connect first using the robinhoodConnect tool.",
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
          error:
            error instanceof Error ? error.message : "Failed to fetch account",
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

      const status = await getConnectionStatus(userId);
      if (!status.connected) {
        return {
          error:
            "Not connected to Robinhood. Please connect first using the robinhoodConnect tool.",
          needsConnection: true,
        };
      }

      try {
        const portfolio = await getPortfolio(userId);

        const changeSign = portfolio.dayChange >= 0 ? "+" : "";

        return {
          totalValue: `$${portfolio.totalValue.toFixed(2)}`,
          portfolioEquity: `$${portfolio.equity.toFixed(2)}`,
          stocksEquity: portfolio.stocksEquity
            ? `$${portfolio.stocksEquity.toFixed(2)}`
            : undefined,
          cryptoEquity: portfolio.cryptoEquity
            ? `$${portfolio.cryptoEquity.toFixed(2)}`
            : undefined,
          cash: `$${portfolio.cash.toFixed(2)}`,
          buyingPower: `$${portfolio.buyingPower.toFixed(2)}`,
          cryptoBuyingPower: portfolio.cryptoBuyingPower
            ? `$${portfolio.cryptoBuyingPower.toFixed(2)}`
            : undefined,
          dayChange: `${changeSign}$${portfolio.dayChange.toFixed(2)}`,
          dayChangePercent: `${changeSign}${portfolio.dayChangePercent.toFixed(2)}%`,
        };
      } catch (error) {
        return {
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch portfolio",
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

      const status = await getConnectionStatus(userId);
      if (!status.connected) {
        return {
          error:
            "Not connected to Robinhood. Please connect first using the robinhoodConnect tool.",
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
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch positions",
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

/**
 * Tool to get cryptocurrency holdings from Robinhood
 */
export const robinhoodGetCryptoHoldings = ({ session }: RobinhoodToolProps) =>
  tool({
    description:
      "Get all cryptocurrency holdings in the user's Robinhood account, including quantity, average cost, current price, market value, and gain/loss for each crypto position. Requires the user to be connected to Robinhood first.",
    inputSchema: z.object({}),
    needsApproval: true,
    execute: async () => {
      const userId = session.user?.id;
      if (!userId) {
        return { error: "User not authenticated" };
      }

      const status = await getConnectionStatus(userId);
      if (!status.connected) {
        return {
          error:
            "Not connected to Robinhood. Please connect first using the robinhoodConnect tool.",
          needsConnection: true,
        };
      }

      try {
        const holdings = await getCryptoHoldings(userId);

        if (holdings.length === 0) {
          return {
            message: "No cryptocurrency holdings found in your account.",
            holdings: [],
          };
        }

        const formattedHoldings = holdings.map((holding) => {
          const gainSign = holding.totalGainLoss >= 0 ? "+" : "";
          return {
            symbol: holding.symbol,
            name: holding.name,
            quantity: holding.quantity.toFixed(8),
            averageCost: `$${holding.averageCost.toFixed(2)}`,
            currentPrice: `$${holding.currentPrice.toFixed(2)}`,
            marketValue: `$${holding.marketValue.toFixed(2)}`,
            totalGainLoss: `${gainSign}$${holding.totalGainLoss.toFixed(2)}`,
            totalGainLossPercent: `${gainSign}${holding.totalGainLossPercent.toFixed(2)}%`,
          };
        });

        const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);

        return {
          holdingCount: holdings.length,
          totalCryptoValue: `$${totalValue.toFixed(2)}`,
          holdings: formattedHoldings,
        };
      } catch (error) {
        return {
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch crypto holdings",
        };
      }
    },
  });

/**
 * Tool to get options positions from Robinhood
 */
export const robinhoodGetOptionsPositions = ({ session }: RobinhoodToolProps) =>
  tool({
    description:
      "Get all options positions in the user's Robinhood account, including option type (call/put), strike price, expiration date, quantity, and gain/loss for each position. Requires the user to be connected to Robinhood first.",
    inputSchema: z.object({}),
    needsApproval: true,
    execute: async () => {
      const userId = session.user?.id;
      if (!userId) {
        return { error: "User not authenticated" };
      }

      const status = await getConnectionStatus(userId);
      if (!status.connected) {
        return {
          error:
            "Not connected to Robinhood. Please connect first using the robinhoodConnect tool.",
          needsConnection: true,
        };
      }

      try {
        const positions = await getOptionsPositions(userId);

        if (positions.length === 0) {
          return {
            message: "No options positions found in your account.",
            positions: [],
          };
        }

        const formattedPositions = positions.map((pos) => {
          const gainSign = pos.totalGainLoss >= 0 ? "+" : "";
          return {
            symbol: pos.symbol,
            type: `${pos.positionType} ${pos.optionType}`,
            strikePrice: `$${pos.strikePrice.toFixed(2)}`,
            expirationDate: pos.expirationDate,
            quantity: pos.quantity,
            averageCost: `$${pos.averageCost.toFixed(2)}`,
            currentPrice: `$${pos.currentPrice.toFixed(2)}`,
            marketValue: `$${pos.marketValue.toFixed(2)}`,
            totalGainLoss: `${gainSign}$${pos.totalGainLoss.toFixed(2)}`,
            totalGainLossPercent: `${gainSign}${pos.totalGainLossPercent.toFixed(2)}%`,
          };
        });

        const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);

        return {
          positionCount: positions.length,
          totalOptionsValue: `$${totalValue.toFixed(2)}`,
          positions: formattedPositions,
        };
      } catch (error) {
        return {
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch options positions",
        };
      }
    },
  });

/**
 * Tool to get today's options trades from Robinhood
 * Shows all option orders placed today with their execution details
 */
export const robinhoodGetTodayOptionsTrades = ({
  session,
}: RobinhoodToolProps) =>
  tool({
    description:
      "Get all options trades placed today in the user's Robinhood account. Shows each trade with the underlying symbol, option type (call/put), strike price, expiration date, whether it was a buy or sell, quantity, price, and execution status. Requires the user to be connected to Robinhood first.",
    inputSchema: z.object({}),
    needsApproval: true,
    execute: async () => {
      const userId = session.user?.id;
      if (!userId) {
        return { error: "User not authenticated" };
      }

      const status = await getConnectionStatus(userId);
      if (!status.connected) {
        return {
          error:
            "Not connected to Robinhood. Please connect first using the robinhoodConnect tool.",
          needsConnection: true,
        };
      }

      try {
        const trades = await getTodayOptionsOrders(userId);

        if (trades.length === 0) {
          return {
            message: "No options trades found for today.",
            trades: [],
          };
        }

        const formattedTrades = trades.map((trade) => {
          // Format the action description (e.g., "Buy to Open", "Sell to Close")
          const action = `${trade.side === "buy" ? "Buy" : "Sell"} to ${trade.positionEffect === "open" ? "Open" : "Close"}`;

          return {
            symbol: trade.symbol,
            optionDescription: `${trade.symbol} ${trade.expirationDate} $${trade.strikePrice.toFixed(2)} ${trade.optionType.toUpperCase()}`,
            action,
            quantity: trade.quantity,
            price: `$${trade.price.toFixed(2)}`,
            totalValue: `$${trade.totalValue.toFixed(2)}`,
            status: trade.state,
            executedAt: new Date(trade.executedAt).toLocaleString("en-US", {
              timeZone: "America/New_York",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            }),
          };
        });

        // Calculate summary statistics
        const filledTrades = trades.filter((t) => t.state === "filled");
        const totalBuyValue = filledTrades
          .filter((t) => t.side === "buy")
          .reduce((sum, t) => sum + t.totalValue, 0);
        const totalSellValue = filledTrades
          .filter((t) => t.side === "sell")
          .reduce((sum, t) => sum + t.totalValue, 0);

        return {
          tradeCount: trades.length,
          filledCount: filledTrades.length,
          totalBuyValue: `$${totalBuyValue.toFixed(2)}`,
          totalSellValue: `$${totalSellValue.toFixed(2)}`,
          netCashFlow: `${totalSellValue >= totalBuyValue ? "+" : ""}$${(totalSellValue - totalBuyValue).toFixed(2)}`,
          trades: formattedTrades,
        };
      } catch (error) {
        return {
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch today's options trades",
        };
      }
    },
  });
