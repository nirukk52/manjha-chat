/**
 * Plaid API Client
 *
 * Wrapper around the official Plaid SDK for brokerage account aggregation.
 * Supports multiple brokerages including IBKR, Schwab, Fidelity, etc.
 */

import {
  Configuration,
  CountryCode,
  type InvestmentsHoldingsGetResponse,
  type InvestmentsTransactionsGetResponse,
  type ItemPublicTokenExchangeResponse,
  type LinkTokenCreateResponse,
  PlaidApi,
  PlaidEnvironments,
  Products,
} from "plaid";
import {
  deletePlaidItem,
  getPlaidItemByItemId,
  getPlaidItems,
  savePlaidItem,
} from "@/lib/db/queries";
import type {
  FormattedPlaidHolding,
  FormattedPlaidPortfolio,
  FormattedPlaidTransaction,
  PlaidConnectionStatus,
  PlaidExchangeResult,
} from "./types";

// Initialize Plaid client configuration
const configuration = new Configuration({
  basePath:
    PlaidEnvironments[
      (process.env.PLAID_ENV as keyof typeof PlaidEnvironments) ?? "sandbox"
    ],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

/**
 * Create a Link token for initializing Plaid Link in the frontend.
 * The token is short-lived and used to open the Link flow.
 */
export async function createLinkToken(
  userId: string,
  redirectUri?: string
): Promise<LinkTokenCreateResponse> {
  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: "Manjha Chat",
    products: [Products.Investments],
    country_codes: [CountryCode.Us],
    language: "en",
    redirect_uri: redirectUri,
  });

  return response.data;
}

/**
 * Exchange a public token for an access token after user completes Link.
 * Also fetches institution info and stores the item in the database.
 */
export async function exchangePublicToken(
  userId: string,
  publicToken: string,
  institutionId?: string,
  institutionName?: string
): Promise<PlaidExchangeResult> {
  try {
    const response: { data: ItemPublicTokenExchangeResponse } =
      await plaidClient.itemPublicTokenExchange({
        public_token: publicToken,
      });

    const { access_token: accessToken, item_id: itemId } = response.data;

    // Save to database
    await savePlaidItem({
      userId,
      accessToken,
      itemId,
      institutionId,
      institutionName,
    });

    return {
      success: true,
      itemId,
      institutionId,
      institutionName,
    };
  } catch (error) {
    console.error("Plaid token exchange error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Token exchange failed",
    };
  }
}

/**
 * Get connection status for a user (whether they have any connected items)
 */
export async function getConnectionStatus(
  userId: string
): Promise<PlaidConnectionStatus> {
  const items = await getPlaidItems({ userId });

  return {
    connected: items.length > 0,
    items: items.map((item) => ({
      itemId: item.itemId,
      institutionId: item.institutionId,
      institutionName: item.institutionName,
      createdAt: item.createdAt ?? new Date(),
    })),
  };
}

/**
 * Get investment holdings for all connected accounts
 */
export async function getInvestmentHoldings(
  userId: string
): Promise<InvestmentsHoldingsGetResponse | null> {
  const items = await getPlaidItems({ userId });

  if (items.length === 0) {
    return null;
  }

  // For now, get holdings from the first item
  // In production, you might want to aggregate from all items
  const item = items[0];

  try {
    const response = await plaidClient.investmentsHoldingsGet({
      access_token: item.accessToken,
    });

    return response.data;
  } catch (error) {
    console.error("Failed to get investment holdings:", error);
    throw error;
  }
}

/**
 * Get investment transactions for a date range
 */
export async function getInvestmentTransactions(
  userId: string,
  startDate: string,
  endDate: string
): Promise<InvestmentsTransactionsGetResponse | null> {
  const items = await getPlaidItems({ userId });

  if (items.length === 0) {
    return null;
  }

  const item = items[0];

  try {
    const response = await plaidClient.investmentsTransactionsGet({
      access_token: item.accessToken,
      start_date: startDate,
      end_date: endDate,
    });

    return response.data;
  } catch (error) {
    console.error("Failed to get investment transactions:", error);
    throw error;
  }
}

/**
 * Remove an item (disconnect a brokerage account)
 */
export async function removeItem(itemId: string): Promise<boolean> {
  const item = await getPlaidItemByItemId({ itemId });

  if (!item) {
    return false;
  }

  try {
    // Remove from Plaid
    await plaidClient.itemRemove({
      access_token: item.accessToken,
    });

    // Remove from database
    await deletePlaidItem({ itemId });

    return true;
  } catch (error) {
    console.error("Failed to remove Plaid item:", error);
    // Still try to delete from database even if Plaid API fails
    await deletePlaidItem({ itemId });
    return true;
  }
}

/**
 * Format holdings data for display in the UI
 */
export function formatHoldings(
  holdingsResponse: InvestmentsHoldingsGetResponse,
  institutionName: string | null
): FormattedPlaidHolding[] {
  const { holdings, securities } = holdingsResponse;

  // Create a map of security_id to security
  const securityMap = new Map(securities.map((s) => [s.security_id, s]));

  return holdings.map((holding) => {
    const security = securityMap.get(holding.security_id);
    const costBasis = holding.cost_basis;
    const marketValue = holding.institution_value;

    let totalGainLoss: number | null = null;
    let totalGainLossPercent: number | null = null;

    if (costBasis !== null && costBasis > 0) {
      totalGainLoss = marketValue - costBasis;
      totalGainLossPercent = (totalGainLoss / costBasis) * 100;
    }

    return {
      symbol: security?.ticker_symbol ?? null,
      name: security?.name ?? null,
      quantity: holding.quantity,
      currentPrice: holding.institution_price,
      marketValue,
      costBasis,
      totalGainLoss,
      totalGainLossPercent,
      type: security?.type ?? "unknown",
      accountId: holding.account_id,
      institutionName,
    };
  });
}

/**
 * Format transactions data for display
 */
export function formatTransactions(
  transactionsResponse: InvestmentsTransactionsGetResponse
): FormattedPlaidTransaction[] {
  const { investment_transactions: transactions, securities } =
    transactionsResponse;

  const securityMap = new Map(securities.map((s) => [s.security_id, s]));

  return transactions.map((tx) => {
    const security = tx.security_id ? securityMap.get(tx.security_id) : null;

    return {
      id: tx.investment_transaction_id,
      date: tx.date,
      name: tx.name,
      symbol: security?.ticker_symbol ?? null,
      quantity: tx.quantity,
      price: tx.price,
      amount: tx.amount,
      fees: tx.fees,
      type: tx.type,
      subtype: tx.subtype,
      accountId: tx.account_id,
    };
  });
}

/**
 * Get formatted portfolio summary
 */
export async function getPortfolio(
  userId: string
): Promise<FormattedPlaidPortfolio | null> {
  const items = await getPlaidItems({ userId });

  if (items.length === 0) {
    return null;
  }

  let totalValue = 0;
  let totalCash = 0;
  const institutions: FormattedPlaidPortfolio["institutions"] = [];

  for (const item of items) {
    try {
      const response = await plaidClient.investmentsHoldingsGet({
        access_token: item.accessToken,
      });

      const { accounts } = response.data;

      // Calculate totals from accounts
      const formattedAccounts = accounts.map((account) => {
        const currentBalance = account.balances.current ?? 0;
        totalValue += currentBalance;

        // Cash accounts contribute to total cash
        if (
          account.type === "depository" ||
          account.subtype === "cash management"
        ) {
          totalCash += currentBalance;
        }

        return {
          accountId: account.account_id,
          name: account.name,
          officialName: account.official_name,
          type: account.type,
          subtype: account.subtype,
          mask: account.mask,
          currentBalance,
          availableBalance: account.balances.available,
        };
      });

      institutions.push({
        institutionId: item.institutionId,
        institutionName: item.institutionName,
        accounts: formattedAccounts,
      });
    } catch (error) {
      console.error(`Failed to get holdings for item ${item.itemId}:`, error);
      // Continue with other items
    }
  }

  return {
    totalValue,
    cash: totalCash,
    investedValue: totalValue - totalCash,
    institutions,
  };
}
