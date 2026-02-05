/**
 * Type definitions for Robinhood API responses and internal data structures
 */

// Authentication types
export interface RobinhoodLoginRequest {
  email: string;
  password: string;
  mfaCode?: string;
  challengeId?: string;
}

export interface RobinhoodAuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface RobinhoodMFARequired {
  mfa_required: true;
  challenge_id: string;
  challenge_type: "sms" | "email" | "app";
}

export interface RobinhoodLoginResult {
  success: boolean;
  mfaRequired?: boolean;
  deviceVerificationRequired?: boolean;
  shouldRetry?: boolean;
  challengeId?: string;
  challengeType?: "sms" | "email" | "app" | "prompt";
  error?: string;
}

// Session types
export interface RobinhoodSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  accountId?: string;
  accountUrl?: string;
}

// Account types
export interface RobinhoodAccount {
  url: string;
  portfolio?: string;
  portfolio_cash: string;
  can_downgrade_to_cash: string;
  user: string;
  account_number: string;
  type: string;
  created_at: string;
  updated_at: string;
  deactivated: boolean;
  deposit_halted: boolean;
  withdrawal_halted: boolean;
  only_position_closing_trades: boolean;
  buying_power: string;
  cash_available_for_withdrawal: string;
  cash: string;
  cash_held_for_orders: string;
  uncleared_deposits: string;
  sma: string;
  sma_held_for_orders: string;
  unsettled_funds: string;
  unsettled_debit: string;
  crypto_buying_power: string;
  max_ach_early_access_amount: string;
  cash_balances: null | object;
  margin_balances: RobinhoodMarginBalances | null;
  sweep_enabled: boolean;
  instant_eligibility: object;
  option_level: string | null;
  is_pinnacle_account: boolean;
  rhs_account_number: number;
  state: string;
  active_subscription_id: string | null;
  locked: boolean;
  permanently_deactivated: boolean;
  received_ach_debit_locked: boolean;
  drip_enabled: boolean;
  eligible_for_fractionals: boolean;
  eligible_for_drip: boolean;
  eligible_for_cash_management: boolean;
  cash_management_enabled: boolean;
  option_trading_on_expiration_enabled: boolean;
  cash_held_for_options_collateral: string;
  fractional_position_closing_only: boolean;
  user_id: string;
  rhs_stock_loan_consent_status: string;
}

export interface RobinhoodMarginBalances {
  cash: string;
  cash_available_for_withdrawal: string;
  cash_held_for_dividends: string;
  cash_held_for_nummus_restrictions: string;
  cash_held_for_orders: string;
  cash_held_for_restrictions: string;
  cash_pending_from_options_events: string;
  crypto_buying_power: string;
  day_trade_buying_power: string;
  day_trade_buying_power_held_for_orders: string;
  day_trade_ratio: string;
  day_trades_protection: boolean;
  gold_equity_requirement: string;
  margin_limit: string;
  marked_pattern_day_trader_date: string | null;
  overnight_buying_power: string;
  overnight_buying_power_held_for_orders: string;
  overnight_ratio: string;
  pending_debit_card_debits: string;
  portfolio_cash: string;
  start_of_day_dtbp: string;
  start_of_day_overnight_buying_power: string;
  unallocated_margin_cash: string;
  uncleared_deposits: string;
  uncleared_nummus_deposits: string;
  unsettled_debit: string;
  unsettled_funds: string;
}

// Portfolio types
export interface RobinhoodPortfolio {
  url: string;
  account: string;
  start_date: string;
  market_value: string;
  equity: string;
  extended_hours_market_value: string;
  extended_hours_equity: string;
  extended_hours_portfolio_equity: string;
  last_core_market_value: string;
  last_core_equity: string;
  last_core_portfolio_equity: string;
  excess_margin: string;
  excess_maintenance: string;
  excess_margin_with_uncleared_deposits: string;
  excess_maintenance_with_uncleared_deposits: string;
  equity_previous_close: string;
  portfolio_equity_previous_close: string;
  adjusted_equity_previous_close: string;
  adjusted_portfolio_equity_previous_close: string;
  withdrawable_amount: string;
  unwithdrawable_deposits: string;
  unwithdrawable_grants: string;
}

// Position types
export interface RobinhoodPosition {
  url: string;
  instrument: string;
  instrument_id: string;
  account: string;
  account_number: string;
  average_buy_price: string;
  pending_average_buy_price: string;
  quantity: string;
  intraday_average_buy_price: string;
  intraday_quantity: string;
  shares_available_for_closing_short_position: string;
  shares_held_for_buys: string;
  shares_held_for_sells: string;
  shares_held_for_stock_grants: string;
  shares_held_for_options_collateral: string;
  shares_held_for_options_events: string;
  shares_pending_from_options_events: string;
  shares_available_for_exercise: string;
  updated_at: string;
  created_at: string;
}

export interface RobinhoodPositionWithDetails extends RobinhoodPosition {
  symbol?: string;
  name?: string;
  currentPrice?: number;
  marketValue?: number;
  totalGainLoss?: number;
  totalGainLossPercent?: number;
}

// Quote types
export interface RobinhoodQuote {
  ask_price: string;
  ask_size: number;
  bid_price: string;
  bid_size: number;
  last_trade_price: string;
  last_extended_hours_trade_price: string | null;
  previous_close: string;
  adjusted_previous_close: string;
  previous_close_date: string;
  symbol: string;
  trading_halted: boolean;
  has_traded: boolean;
  last_trade_price_source: string;
  updated_at: string;
  instrument: string;
  instrument_id: string;
}

// Instrument types
export interface RobinhoodInstrument {
  url: string;
  quote: string;
  fundamentals: string;
  splits: string;
  state: string;
  market: string;
  simple_name: string | null;
  name: string;
  tradeable: boolean;
  tradability: string;
  symbol: string;
  bloomberg_unique: string;
  margin_initial_ratio: string;
  maintenance_ratio: string;
  country: string;
  day_trade_ratio: string;
  list_date: string;
  min_tick_size: string | null;
  type: string;
  tradeable_chain_id: string | null;
  rhs_tradability: string;
  fractional_tradability: string;
  default_collar_fraction: string;
  ipo_access_supports_dsp: boolean;
  ipo_access_cob_deadline: string | null;
  ipo_access_status: string | null;
  ipo_roadshow_url: string | null;
  is_spac: boolean;
  is_test: boolean;
  id: string;
  all_day_tradability: string;
  extended_hours_fractional_tradability: string;
  internal_halt_reason: string;
  internal_halt_details: string;
  internal_halt_sessions: string[];
  internal_halt_start_time: string | null;
  internal_halt_end_time: string | null;
}

// API response wrappers
export interface RobinhoodPaginatedResponse<T> {
  previous: string | null;
  next: string | null;
  results: T[];
}

// Formatted data for display
export interface FormattedPortfolio {
  totalValue: number;
  equity: number;
  cash: number;
  buyingPower: number;
  dayChange: number;
  dayChangePercent: number;
  cryptoBuyingPower?: number;
  optionsBuyingPower?: number;
  stocksEquity?: number;
  cryptoEquity?: number;
}

export interface FormattedPosition {
  symbol: string;
  name: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  dayGainLoss?: number;
  dayGainLossPercent?: number;
}

export interface FormattedQuote {
  symbol: string;
  lastPrice: number;
  change: number;
  changePercent: number;
  bidPrice: number;
  askPrice: number;
  previousClose: number;
  extendedHoursPrice?: number;
  tradingHalted: boolean;
}

// Connection status
export interface RobinhoodConnectionStatus {
  connected: boolean;
  expiresAt?: number;
}

/**
 * Phoenix unified account response
 * Returns aggregated data across all asset types (stocks, crypto, options)
 */
export interface RobinhoodPhoenixAccount {
  account_buying_power: string;
  cash_available_from_instant_deposits: string;
  cash_held_for_currency_orders: string;
  cash_held_for_dividends: string;
  cash_held_for_equity_orders: string;
  cash_held_for_options_collateral: string;
  cash_held_for_orders: string;
  crypto?: {
    equity: string;
    equity_for_display: string;
    equity_previous_close?: string;
  };
  crypto_buying_power?: string;
  equities?: {
    equity: string;
    equity_for_display: string;
    equity_previous_close?: string;
  };
  extended_hours_portfolio_equity: string;
  instant_allocated: string;
  levered_amount: string;
  near_margin_call: boolean;
  options_buying_power?: string;
  portfolio_equity: string;
  portfolio_previous_close: string;
  previous_close: string;
  regular_hours_portfolio_equity: string;
  total_equity: string;
  total_extended_hours_equity: string;
  total_extended_hours_market_value: string;
  total_market_value: string;
  total_regular_hours_equity: string;
  total_regular_hours_market_value: string;
  total_previous_close?: string;
  uninvested_cash: string;
  withdrawable_cash: string;
}

// Crypto types (from nummus.robinhood.com API)
export interface RobinhoodCryptoHolding {
  account_id: string;
  cost_bases: RobinhoodCryptoCostBasis[];
  created_at: string;
  currency: RobinhoodCryptoCurrency;
  id: string;
  quantity: string;
  quantity_available: string;
  quantity_held_for_buy: string;
  quantity_held_for_sell: string;
  updated_at: string;
}

export interface RobinhoodCryptoCostBasis {
  currency_id: string;
  direct_cost_basis: string;
  direct_quantity: string;
  id: string;
  intraday_cost_basis: string;
  intraday_quantity: string;
  marked_cost_basis: string;
  marked_quantity: string;
}

export interface RobinhoodCryptoCurrency {
  brand_color: string;
  code: string;
  id: string;
  increment: string;
  name: string;
  type: string;
}

export interface RobinhoodCryptoQuote {
  ask_price: string;
  bid_price: string;
  high_price: string;
  id: string;
  low_price: string;
  mark_price: string;
  open_price: string;
  symbol: string;
  volume: string;
}

export interface FormattedCryptoHolding {
  symbol: string;
  name: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
}

// Options types
export interface RobinhoodOptionPosition {
  account: string;
  average_price: string;
  chain_id: string;
  chain_symbol: string;
  created_at: string;
  id: string;
  intraday_average_open_price: string;
  intraday_direction: string;
  intraday_quantity: string;
  option: string;
  option_id: string;
  pending_assignment_quantity: string;
  pending_buy_quantity: string;
  pending_exercise_quantity: string;
  pending_expiration_quantity: string;
  pending_expired_quantity: string;
  pending_sell_quantity: string;
  quantity: string;
  trade_value_multiplier: string;
  type: "long" | "short";
  updated_at: string;
}

export interface RobinhoodOptionInstrument {
  chain_id: string;
  chain_symbol: string;
  created_at: string;
  expiration_date: string;
  id: string;
  issue_date: string;
  min_ticks: {
    above_tick: string;
    below_tick: string;
    cutoff_price: string;
  };
  rhs_tradability: string;
  state: string;
  strike_price: string;
  tradability: string;
  type: "call" | "put";
  updated_at: string;
  url: string;
  sellout_datetime: string;
  long_strategy_code: string;
  short_strategy_code: string;
}

export interface RobinhoodOptionMarketData {
  adjusted_mark_price: string;
  ask_price: string;
  ask_size: number;
  bid_price: string;
  bid_size: number;
  break_even_price: string;
  chance_of_profit_long: string;
  chance_of_profit_short: string;
  delta: string;
  gamma: string;
  high_price: string;
  implied_volatility: string;
  instrument: string;
  instrument_id: string;
  last_trade_price: string;
  last_trade_size: number;
  low_price: string;
  mark_price: string;
  open_interest: number;
  previous_close_date: string;
  previous_close_price: string;
  rho: string;
  theta: string;
  updated_at: string;
  vega: string;
  volume: number;
}

export interface FormattedOptionPosition {
  symbol: string;
  optionType: "call" | "put";
  strikePrice: number;
  expirationDate: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  positionType: "long" | "short";
}

/**
 * Robinhood option order response from /options/orders/ endpoint
 * Represents a single options trade/order
 */
export interface RobinhoodOptionOrder {
  id: string;
  ref_id: string;
  account: string;
  direction: "debit" | "credit";
  legs: RobinhoodOptionOrderLeg[];
  premium: string;
  processed_premium: string;
  price: string;
  processed_quantity: string;
  quantity: string;
  pending_quantity: string;
  canceled_quantity: string;
  state:
    | "filled"
    | "confirmed"
    | "cancelled"
    | "pending"
    | "queued"
    | "rejected";
  type: "limit" | "market";
  time_in_force: "gfd" | "gtc" | "ioc" | "opg";
  trigger: "immediate" | "stop";
  chain_id: string;
  chain_symbol: string;
  response_category: string | null;
  opening_strategy: string | null;
  closing_strategy: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * A single leg of an options order (for spreads, there can be multiple legs)
 */
export interface RobinhoodOptionOrderLeg {
  id: string;
  option: string;
  position_effect: "open" | "close";
  ratio_quantity: number;
  side: "buy" | "sell";
  executions: RobinhoodOptionExecution[];
}

/**
 * Execution details for an options order leg
 */
export interface RobinhoodOptionExecution {
  id: string;
  price: string;
  quantity: string;
  settlement_date: string;
  timestamp: string;
}

/**
 * Formatted options trade for display in the UI
 */
export interface FormattedOptionTrade {
  symbol: string;
  optionType: "call" | "put";
  strikePrice: number;
  expirationDate: string;
  side: "buy" | "sell";
  positionEffect: "open" | "close";
  quantity: number;
  price: number;
  totalValue: number;
  state: string;
  executedAt: string;
  orderId: string;
}
