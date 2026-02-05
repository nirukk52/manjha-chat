/**
 * Type definitions for Plaid API responses and internal data structures.
 * Used for brokerage account aggregation (IBKR, Schwab, Fidelity, etc.)
 */

// Connection status for Plaid items
export interface PlaidConnectionStatus {
  connected: boolean;
  items: PlaidConnectedItem[];
}

export interface PlaidConnectedItem {
  itemId: string;
  institutionId: string | null;
  institutionName: string | null;
  createdAt: Date;
}

// Investment holdings from Plaid
export interface PlaidHolding {
  account_id: string;
  security_id: string;
  institution_price: number;
  institution_price_as_of: string | null;
  institution_price_datetime: string | null;
  institution_value: number;
  cost_basis: number | null;
  quantity: number;
  iso_currency_code: string | null;
  unofficial_currency_code: string | null;
  vested_quantity: number | null;
  vested_value: number | null;
}

// Security details from Plaid
export interface PlaidSecurity {
  security_id: string;
  isin: string | null;
  cusip: string | null;
  sedol: string | null;
  institution_security_id: string | null;
  institution_id: string | null;
  proxy_security_id: string | null;
  name: string | null;
  ticker_symbol: string | null;
  is_cash_equivalent: boolean;
  type: string;
  close_price: number | null;
  close_price_as_of: string | null;
  update_datetime: string | null;
  iso_currency_code: string | null;
  unofficial_currency_code: string | null;
  market_identifier_code: string | null;
  sector: string | null;
  industry: string | null;
  option_contract: PlaidOptionContract | null;
}

// Option contract details
export interface PlaidOptionContract {
  contract_type: "call" | "put";
  expiration_date: string;
  strike_price: number;
  underlying_security_id: string;
}

// Account details from Plaid
export interface PlaidAccount {
  account_id: string;
  balances: PlaidAccountBalances;
  mask: string | null;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
}

export interface PlaidAccountBalances {
  available: number | null;
  current: number | null;
  iso_currency_code: string | null;
  limit: number | null;
  unofficial_currency_code: string | null;
}

// Investment transaction from Plaid
export interface PlaidInvestmentTransaction {
  investment_transaction_id: string;
  account_id: string;
  security_id: string | null;
  date: string;
  name: string;
  quantity: number;
  amount: number;
  price: number;
  fees: number | null;
  type: string;
  subtype: string;
  iso_currency_code: string | null;
  unofficial_currency_code: string | null;
}

// Formatted data for display (matching Robinhood pattern)
export interface FormattedPlaidPortfolio {
  totalValue: number;
  cash: number;
  investedValue: number;
  institutions: FormattedInstitution[];
}

export interface FormattedInstitution {
  institutionId: string | null;
  institutionName: string | null;
  accounts: FormattedPlaidAccount[];
}

export interface FormattedPlaidAccount {
  accountId: string;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
}

export interface FormattedPlaidHolding {
  symbol: string | null;
  name: string | null;
  quantity: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number | null;
  totalGainLoss: number | null;
  totalGainLossPercent: number | null;
  type: string;
  accountId: string;
  institutionName: string | null;
}

export interface FormattedPlaidTransaction {
  id: string;
  date: string;
  name: string;
  symbol: string | null;
  quantity: number;
  price: number;
  amount: number;
  fees: number | null;
  type: string;
  subtype: string;
  accountId: string;
}

// Webhook types
export type PlaidWebhookType = "INVESTMENTS_TRANSACTIONS" | "HOLDINGS" | "ITEM";

export interface PlaidWebhookPayload {
  webhook_type: PlaidWebhookType;
  webhook_code: string;
  item_id: string;
  error?: PlaidWebhookError;
}

export interface PlaidWebhookError {
  error_type: string;
  error_code: string;
  error_message: string;
  display_message: string | null;
}

// Link token creation options
export interface PlaidLinkTokenOptions {
  userId: string;
  redirectUri?: string;
}

// Exchange token result
export interface PlaidExchangeResult {
  success: boolean;
  itemId?: string;
  institutionId?: string;
  institutionName?: string;
  error?: string;
}
