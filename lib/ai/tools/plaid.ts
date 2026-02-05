/**
 * AI tools for Plaid brokerage integration.
 * Enables the AI to connect to and fetch data from multiple brokerages
 * including IBKR, Schwab, Fidelity, and 100+ others via Plaid.
 */

import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { getPlaidItems } from "@/lib/db/queries";
import {
  formatHoldings,
  getConnectionStatus,
  getInvestmentHoldings,
  getInvestmentTransactions,
  getPortfolio,
} from "@/lib/plaid/client";

type PlaidToolProps = {
  session: Session;
};

/**
 * Tool to initiate Plaid brokerage connection.
 * Returns a special response that triggers the Plaid Link popup on the frontend.
 */
export const plaidConnect = ({ session }: PlaidToolProps) =>
  tool({
    description:
      "Connect to the user's brokerage account via Plaid. Supports IBKR (Interactive Brokers), Schwab, Fidelity, E*TRADE, Vanguard, and 100+ other brokerages. This will open a secure Plaid Link popup for the user to authenticate with their brokerage. Use this when the user wants to connect their brokerage account or when other Plaid tools indicate they are not connected.",
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
        const institutionNames = status.items
          .map((item) => item.institutionName)
          .filter(Boolean)
          .join(", ");

        return {
          success: true,
          message: `Already connected to ${institutionNames || "a brokerage account"}.`,
          connected: true,
          connectedInstitutions: status.items.map((item) => ({
            name: item.institutionName,
            connectedAt: item.createdAt,
          })),
        };
      }

      // Return a special response that the frontend will interpret to open Plaid Link
      return {
        action: "open_plaid_link",
        message:
          "Opening brokerage connection. Please select and authenticate with your brokerage in the secure popup window.",
      };
    },
  });

/**
 * Tool to get portfolio summary from connected brokerages
 */
export const plaidGetPortfolio = ({ session }: PlaidToolProps) =>
  tool({
    description:
      "Get the user's brokerage portfolio summary including total value, cash, and invested value across all connected accounts. Requires the user to be connected to a brokerage via Plaid first.",
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
            "No brokerage accounts connected. Please connect first using the plaidConnect tool.",
          needsConnection: true,
        };
      }

      try {
        const portfolio = await getPortfolio(userId);

        if (!portfolio) {
          return { error: "Could not fetch portfolio information" };
        }

        return {
          totalValue: `$${portfolio.totalValue.toFixed(2)}`,
          investedValue: `$${portfolio.investedValue.toFixed(2)}`,
          cash: `$${portfolio.cash.toFixed(2)}`,
          connectedInstitutions: portfolio.institutions.map((inst) => ({
            name: inst.institutionName || "Unknown",
            accounts: inst.accounts.map((acc) => ({
              name: acc.name,
              type: acc.type,
              subtype: acc.subtype,
              balance: acc.currentBalance
                ? `$${acc.currentBalance.toFixed(2)}`
                : "N/A",
            })),
          })),
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
 * Tool to get investment holdings from connected brokerages
 */
export const plaidGetHoldings = ({ session }: PlaidToolProps) =>
  tool({
    description:
      "Get all investment holdings from the user's connected brokerage accounts, including stocks, ETFs, mutual funds, and options. Shows symbol, quantity, current price, market value, and gain/loss for each position. Requires the user to be connected to a brokerage via Plaid first.",
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
            "No brokerage accounts connected. Please connect first using the plaidConnect tool.",
          needsConnection: true,
        };
      }

      try {
        const holdingsResponse = await getInvestmentHoldings(userId);

        if (!holdingsResponse) {
          return { error: "Could not fetch holdings" };
        }

        // Get institution name for context
        const items = await getPlaidItems({ userId });
        const institutionName = items[0]?.institutionName ?? null;

        const holdings = formatHoldings(holdingsResponse, institutionName);

        if (holdings.length === 0) {
          return {
            message: "No holdings found in your connected accounts.",
            holdings: [],
          };
        }

        // Group by type for better organization
        const stockHoldings = holdings.filter(
          (h) => h.type === "equity" || h.type === "etf"
        );
        const mutualFundHoldings = holdings.filter(
          (h) => h.type === "mutual fund"
        );
        const otherHoldings = holdings.filter(
          (h) =>
            h.type !== "equity" &&
            h.type !== "etf" &&
            h.type !== "mutual fund" &&
            !h.type.includes("cash")
        );

        const formatHolding = (h: (typeof holdings)[0]) => {
          const gainSign =
            h.totalGainLoss !== null && h.totalGainLoss >= 0 ? "+" : "";
          return {
            symbol: h.symbol || "N/A",
            name: h.name || "Unknown",
            quantity: h.quantity,
            currentPrice: `$${h.currentPrice.toFixed(2)}`,
            marketValue: `$${h.marketValue.toFixed(2)}`,
            costBasis: h.costBasis ? `$${h.costBasis.toFixed(2)}` : "N/A",
            totalGainLoss:
              h.totalGainLoss !== null
                ? `${gainSign}$${h.totalGainLoss.toFixed(2)}`
                : "N/A",
            totalGainLossPercent:
              h.totalGainLossPercent !== null
                ? `${gainSign}${h.totalGainLossPercent.toFixed(2)}%`
                : "N/A",
            type: h.type,
          };
        };

        const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);

        return {
          institution: institutionName || "Connected Brokerage",
          holdingCount: holdings.length,
          totalValue: `$${totalValue.toFixed(2)}`,
          stocks:
            stockHoldings.length > 0 ? stockHoldings.map(formatHolding) : [],
          mutualFunds:
            mutualFundHoldings.length > 0
              ? mutualFundHoldings.map(formatHolding)
              : [],
          other:
            otherHoldings.length > 0 ? otherHoldings.map(formatHolding) : [],
        };
      } catch (error) {
        return {
          error:
            error instanceof Error ? error.message : "Failed to fetch holdings",
        };
      }
    },
  });

/**
 * Tool to get recent investment transactions
 */
export const plaidGetTransactions = ({ session }: PlaidToolProps) =>
  tool({
    description:
      "Get recent investment transactions from the user's connected brokerage accounts. Shows buys, sells, dividends, and other activity. Requires the user to be connected to a brokerage via Plaid first.",
    inputSchema: z.object({
      days: z
        .number()
        .optional()
        .default(30)
        .describe(
          "Number of days of transaction history to fetch (default: 30)"
        ),
    }),
    needsApproval: true,
    execute: async ({ days = 30 }) => {
      const userId = session.user?.id;
      if (!userId) {
        return { error: "User not authenticated" };
      }

      const status = await getConnectionStatus(userId);
      if (!status.connected) {
        return {
          error:
            "No brokerage accounts connected. Please connect first using the plaidConnect tool.",
          needsConnection: true,
        };
      }

      try {
        const endDate = new Date().toISOString().split("T")[0];
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];

        const transactionsResponse = await getInvestmentTransactions(
          userId,
          startDate,
          endDate
        );

        if (!transactionsResponse) {
          return { error: "Could not fetch transactions" };
        }

        const { investment_transactions: transactions, securities } =
          transactionsResponse;

        if (transactions.length === 0) {
          return {
            message: `No transactions found in the last ${days} days.`,
            transactions: [],
          };
        }

        const securityMap = new Map(securities.map((s) => [s.security_id, s]));

        const formattedTransactions = transactions.slice(0, 50).map((tx) => {
          const security = tx.security_id
            ? securityMap.get(tx.security_id)
            : null;

          return {
            date: tx.date,
            type: tx.type,
            subtype: tx.subtype,
            name: tx.name,
            symbol: security?.ticker_symbol || "N/A",
            quantity: tx.quantity,
            price: `$${tx.price.toFixed(2)}`,
            amount: `$${Math.abs(tx.amount).toFixed(2)}`,
            fees: tx.fees ? `$${tx.fees.toFixed(2)}` : "N/A",
          };
        });

        return {
          period: `${startDate} to ${endDate}`,
          transactionCount: transactions.length,
          showing: Math.min(transactions.length, 50),
          transactions: formattedTransactions,
        };
      } catch (error) {
        return {
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch transactions",
        };
      }
    },
  });
