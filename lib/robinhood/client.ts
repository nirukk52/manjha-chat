/**
 * Robinhood API Client
 *
 * TypeScript client for the unofficial Robinhood API.
 * Based on: https://github.com/sanko/Robinhood
 *
 * Note: This uses unofficial APIs and may break if Robinhood changes their API.
 */

import {
  deleteRobinhoodSession,
  getRobinhoodSession,
  saveRobinhoodSession,
} from "@/lib/db/queries";
import type {
  FormattedCryptoHolding,
  FormattedOptionPosition,
  FormattedOptionTrade,
  FormattedPortfolio,
  FormattedPosition,
  FormattedQuote,
  RobinhoodAccount,
  RobinhoodConnectionStatus,
  RobinhoodCryptoHolding,
  RobinhoodCryptoQuote,
  RobinhoodInstrument,
  RobinhoodLoginResult,
  RobinhoodOptionInstrument,
  RobinhoodOptionMarketData,
  RobinhoodOptionOrder,
  RobinhoodOptionPosition,
  RobinhoodPaginatedResponse,
  RobinhoodPhoenixAccount,
  RobinhoodPosition,
  RobinhoodQuote,
  RobinhoodSession,
} from "./types";

const ROBINHOOD_API_BASE = "https://api.robinhood.com";
const ROBINHOOD_NUMMUS_BASE = "https://nummus.robinhood.com";
const ROBINHOOD_PHOENIX_BASE = "https://phoenix.robinhood.com";
const ROBINHOOD_CLIENT_ID = "c82SH0WZOsabOXGP2sxqcj34FxkvfnWRZBKlBjFS";

// In-memory device token store (persists device token during login flow only)
// This is fine to be in-memory since it's only used during the login process
const deviceTokenStore = new Map<string, string>();

/**
 * Get or create a device token for a user
 * Device tokens must persist across login attempts for verification to work
 */
function getOrCreateDeviceToken(userId: string): string {
  let token = deviceTokenStore.get(userId);
  if (!token) {
    token = generateDeviceToken();
    deviceTokenStore.set(userId, token);
  }
  return token;
}

/**
 * Clear device token for a user (call after successful login or logout)
 */
function clearDeviceToken(userId: string): void {
  deviceTokenStore.delete(userId);
}

/**
 * Reset device token to force a new verification workflow
 * Exported so it can be called from API routes
 */
export function resetDeviceToken(userId: string): void {
  deviceTokenStore.delete(userId);
}

/**
 * Get stored session for a user from the database
 * Returns the session if valid, undefined if expired or not found
 */
export async function getSession(
  userId: string
): Promise<RobinhoodSession | undefined> {
  const dbSession = await getRobinhoodSession({ userId });

  if (!dbSession) {
    return undefined;
  }

  // Convert database session to RobinhoodSession type
  return {
    accessToken: dbSession.accessToken,
    refreshToken: dbSession.refreshToken ?? undefined,
    accountId: dbSession.accountId ?? undefined,
    accountUrl: dbSession.accountUrl ?? undefined,
    expiresAt: dbSession.expiresAt.getTime(),
  };
}

/**
 * Store session for a user in the database
 */
async function setSession(
  userId: string,
  session: RobinhoodSession
): Promise<void> {
  await saveRobinhoodSession({
    userId,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    accountId: session.accountId,
    accountUrl: session.accountUrl,
    expiresAt: new Date(session.expiresAt),
  });
}

/**
 * Clear session for a user from the database
 */
export async function clearSession(userId: string): Promise<void> {
  await deleteRobinhoodSession({ userId });
}

/**
 * Check if user is connected to Robinhood
 */
export async function getConnectionStatus(
  userId: string
): Promise<RobinhoodConnectionStatus> {
  const session = await getSession(userId);
  return {
    connected: !!session,
    expiresAt: session?.expiresAt,
  };
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  accessToken?: string
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${ROBINHOOD_API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Robinhood API error: ${response.status} - ${errorText || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Poll the prompt status endpoint to check if user approved the device verification
 * For "prompt" type challenges (push notification approval)
 */
async function pollPromptStatus(
  challengeId: string,
  maxAttempts = 6,
  delayMs = 2000
): Promise<{ validated: boolean }> {
  const promptUrl = `${ROBINHOOD_API_BASE}/push/${challengeId}/get_prompts_status/`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    try {
      const response = await fetch(promptUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log(
          `Prompt status (attempt ${attempt + 1}):`,
          JSON.stringify(data, null, 2)
        );

        if (data.challenge_status === "validated") {
          return { validated: true };
        }
      }
    } catch (error) {
      console.error(
        `Prompt status poll error (attempt ${attempt + 1}):`,
        error
      );
    }
  }

  return { validated: false };
}

/**
 * Login to Robinhood
 */
export async function login(
  userId: string,
  email: string,
  password: string,
  mfaCode?: string,
  challengeId?: string
): Promise<RobinhoodLoginResult> {
  try {
    // Use persistent device token so verification works across retries
    const deviceToken = getOrCreateDeviceToken(userId);

    const body: Record<string, string> = {
      client_id: ROBINHOOD_CLIENT_ID,
      grant_type: "password",
      password,
      scope: "internal",
      username: email,
      device_token: deviceToken,
    };

    // If MFA code provided, respond to challenge first
    if (mfaCode && challengeId) {
      try {
        // Respond to the challenge endpoint
        const challengeResponse = await fetch(
          `${ROBINHOOD_API_BASE}/challenge/${challengeId}/respond/`,
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ response: mfaCode }),
          }
        );

        const challengeData = await challengeResponse.json();
        console.log(
          "Challenge response:",
          JSON.stringify(challengeData, null, 2)
        );

        // Check if challenge was validated
        if (challengeData.status === "validated" || !challengeData.challenge) {
          // Challenge validated, add header and continue with login
          // The X-ROBINHOOD-CHALLENGE-RESPONSE-ID header tells Robinhood we've responded
        } else if (challengeData.challenge?.remaining_attempts !== undefined) {
          return {
            success: false,
            error: `Invalid code. ${challengeData.challenge.remaining_attempts} attempts remaining.`,
            mfaRequired: true,
            challengeId,
            challengeType: "sms",
          };
        }
      } catch (challengeError) {
        console.error("Challenge response error:", challengeError);
        // Continue anyway and include in login request
      }

      // Include challenge info in login request as fallback
      body.mfa_code = mfaCode;
      body.challenge_id = challengeId;
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Robinhood-API-Version": "1.431.4",
    };

    // Add challenge response header if we've responded to a challenge
    if (challengeId) {
      headers["X-ROBINHOOD-CHALLENGE-RESPONSE-ID"] = challengeId;
    }

    const response = await fetch(`${ROBINHOOD_API_BASE}/oauth2/token/`, {
      method: "POST",
      headers,
      body: new URLSearchParams(body).toString(),
    });

    const data = await response.json();

    // Log the response for debugging (will show in server logs)
    console.log("Robinhood login response status:", response.status);
    console.log(
      "Robinhood login response data:",
      JSON.stringify(data, null, 2)
    );

    // Check if device verification is required (403 with verification_workflow)
    if (data.verification_workflow) {
      const workflowId = data.verification_workflow.id;

      try {
        // Call pathfinder API to initiate the verification workflow
        const pathfinderResponse = await fetch(
          `${ROBINHOOD_API_BASE}/pathfinder/user_machine/`,
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              device_id: deviceToken,
              flow: "suv",
              input: { workflow_id: workflowId },
            }),
          }
        );

        const pathfinderData = await pathfinderResponse.json();
        console.log(
          "Pathfinder response:",
          JSON.stringify(pathfinderData, null, 2)
        );

        if (pathfinderData.id) {
          // Get the inquiry to find the challenge
          const inquiryResponse = await fetch(
            `${ROBINHOOD_API_BASE}/pathfinder/inquiries/${pathfinderData.id}/user_view/`,
            {
              method: "GET",
              headers: {
                Accept: "application/json",
              },
            }
          );

          const inquiryData = await inquiryResponse.json();
          console.log(
            "Inquiry response:",
            JSON.stringify(inquiryData, null, 2)
          );

          // Extract challenge info from the inquiry
          const sheriffChallenge =
            inquiryData?.type_context?.context?.sheriff_challenge;
          const challengeId = sheriffChallenge?.id;
          const challengeType = sheriffChallenge?.type;

          if (challengeId) {
            // Check if it's a "prompt" type (push notification approval)
            if (challengeType === "prompt") {
              // Poll the prompt status endpoint to check if user approved
              const pollResult = await pollPromptStatus(challengeId);

              if (pollResult.validated) {
                // User approved, now we need to continue the workflow
                // Post to inquiries to signal we're ready to continue
                try {
                  await fetch(
                    `${ROBINHOOD_API_BASE}/pathfinder/inquiries/${pathfinderData.id}/user_view/`,
                    {
                      method: "POST",
                      headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        sequence: 0,
                        user_input: { status: "continue" },
                      }),
                    }
                  );
                } catch {
                  // Continue anyway
                }

                // Retry the login - it should work now
                // Return a special flag to indicate we should auto-retry
                return {
                  success: false,
                  shouldRetry: true,
                };
              }

              // User hasn't approved yet, show the device verification screen
              return {
                success: false,
                deviceVerificationRequired: true,
                challengeId,
                error:
                  "Please approve the login on your Robinhood app, then click Continue.",
              };
            }

            // Otherwise it's an MFA code challenge (sms, email, or app)
            return {
              success: false,
              mfaRequired: true,
              challengeId,
              challengeType: challengeType || "sms",
            };
          }
        }
      } catch (pathfinderError) {
        console.error("Pathfinder API error:", pathfinderError);
      }

      // Fallback if pathfinder flow fails
      return {
        success: false,
        error:
          "Robinhood requires device verification. Please check your email or SMS for a verification link from Robinhood, approve the login, then try again.",
      };
    }

    // Check if MFA is required
    if (data.mfa_required || data.challenge) {
      return {
        success: false,
        mfaRequired: true,
        challengeId: data.challenge?.id || data.mfa_required_challenge?.id,
        challengeType: data.challenge?.type || "app",
      };
    }

    // Check for errors
    if (!response.ok || data.error) {
      // Robinhood may return various error fields
      const errorMessage =
        data.error_description ||
        data.detail ||
        data.message ||
        (typeof data.error === "string" ? data.error : null) ||
        "Login failed. Please check your credentials.";
      return {
        success: false,
        error: errorMessage,
      };
    }

    // Success - store session
    if (data.access_token) {
      const session: RobinhoodSession = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      };

      // Fetch account info to store account ID
      try {
        const accounts = await apiRequest<
          RobinhoodPaginatedResponse<RobinhoodAccount>
        >("/accounts/", {}, data.access_token);
        if (accounts.results.length > 0) {
          session.accountId = accounts.results[0].account_number;
          session.accountUrl = accounts.results[0].url;
        }
      } catch {
        // Continue without account info
      }

      await setSession(userId, session);

      // Clear device token after successful login
      clearDeviceToken(userId);

      return {
        success: true,
      };
    }

    return {
      success: false,
      error: "Unexpected response from Robinhood",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Login failed",
    };
  }
}

/**
 * Logout from Robinhood
 */
export async function logout(userId: string): Promise<boolean> {
  const session = await getSession(userId);

  if (session) {
    try {
      // Revoke token
      await fetch(`${ROBINHOOD_API_BASE}/oauth2/revoke_token/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: ROBINHOOD_CLIENT_ID,
          token: session.accessToken,
        }).toString(),
      });
    } catch {
      // Ignore revoke errors
    }
  }

  await clearSession(userId);
  clearDeviceToken(userId);
  return true;
}

/**
 * Get account information
 */
export async function getAccount(
  userId: string
): Promise<RobinhoodAccount | null> {
  const session = await getSession(userId);
  if (!session) {
    throw new Error("Not connected to Robinhood. Please connect first.");
  }

  const accounts = await apiRequest<
    RobinhoodPaginatedResponse<RobinhoodAccount>
  >("/accounts/", {}, session.accessToken);

  return accounts.results[0] || null;
}

/**
 * Get portfolio information using Phoenix unified account API
 * Falls back to manual calculation if Phoenix endpoint fails
 */
export async function getPortfolio(
  userId: string
): Promise<FormattedPortfolio> {
  const session = await getSession(userId);
  if (!session) {
    throw new Error("Not connected to Robinhood. Please connect first.");
  }

  // Try Phoenix unified account API for accurate totals
  const phoenixAccount = await getPhoenixAccount(userId);

  if (phoenixAccount) {
    // Use total_equity for the complete portfolio value (includes stocks, crypto, options, cash)
    const totalEquity = Number.parseFloat(phoenixAccount.total_equity);
    const portfolioEquity = Number.parseFloat(phoenixAccount.portfolio_equity);

    // previous_close is the total account previous close, portfolio_previous_close is just stocks
    // Use total_previous_close if available, otherwise previous_close
    const totalPreviousClose = Number.parseFloat(
      phoenixAccount.total_previous_close ||
        phoenixAccount.previous_close ||
        phoenixAccount.portfolio_previous_close
    );

    const uninvestedCash = Number.parseFloat(phoenixAccount.uninvested_cash);
    const buyingPower = Number.parseFloat(phoenixAccount.account_buying_power);
    const cryptoBuyingPower = Number.parseFloat(
      phoenixAccount.crypto_buying_power || "0"
    );
    const optionsBuyingPower = Number.parseFloat(
      phoenixAccount.options_buying_power || "0"
    );
    const stocksEquity = Number.parseFloat(
      phoenixAccount.equities?.equity || "0"
    );
    const cryptoEquity = Number.parseFloat(
      phoenixAccount.crypto?.equity || "0"
    );

    // Calculate day change based on total equity vs total previous close
    const dayChange = totalEquity - totalPreviousClose;
    const dayChangePercent =
      totalPreviousClose > 0 ? (dayChange / totalPreviousClose) * 100 : 0;

    return {
      totalValue: totalEquity,
      equity: portfolioEquity,
      cash: uninvestedCash,
      buyingPower,
      dayChange,
      dayChangePercent,
      cryptoBuyingPower,
      optionsBuyingPower,
      stocksEquity,
      cryptoEquity,
    };
  }

  // Fallback: Calculate manually from positions + crypto + options

  const account = await getAccount(userId);
  if (!account) {
    throw new Error("No account found");
  }

  const cash = Number.parseFloat(account.cash);
  const buyingPower = Number.parseFloat(account.buying_power);

  // Try to get portfolio equity directly from portfolio endpoint first
  let portfolioEquity: number | null = null;
  let portfolioPreviousClose: number | null = null;
  if (account.portfolio) {
    try {
      const portfolio = await apiRequest<{
        equity: string;
        equity_previous_close: string;
        extended_hours_equity: string;
        market_value: string;
      }>(
        `${account.portfolio}`.replace(ROBINHOOD_API_BASE, ""),
        {},
        session.accessToken
      );
      portfolioEquity = Number.parseFloat(portfolio.equity);
      portfolioPreviousClose = Number.parseFloat(
        portfolio.equity_previous_close
      );
    } catch (error) {
      console.error("Failed to get portfolio equity:", error);
    }
  }

  // Fetch stock positions with real-time quotes (with pagination)
  let allPositions: RobinhoodPosition[] = [];
  let nextUrl: string | null = "/positions/?nonzero=true";

  while (nextUrl) {
    const positions: RobinhoodPaginatedResponse<RobinhoodPosition> =
      await apiRequest<RobinhoodPaginatedResponse<RobinhoodPosition>>(
        nextUrl.replace(ROBINHOOD_API_BASE, ""),
        {},
        session.accessToken
      );
    allPositions = [...allPositions, ...positions.results];
    nextUrl = positions.next;
  }

  let totalStockValue = 0;
  let totalStockPreviousClose = 0;

  for (const position of allPositions) {
    const quantity = Number.parseFloat(position.quantity);
    if (quantity === 0) {
      continue;
    }

    try {
      const instrument = await apiRequest<RobinhoodInstrument>(
        position.instrument.replace(ROBINHOOD_API_BASE, ""),
        {},
        session.accessToken
      );

      const quote = await apiRequest<RobinhoodQuote>(
        `/quotes/${instrument.symbol}/`,
        {},
        session.accessToken
      );

      // robin_stocks logic: use last_extended_hours_trade_price if available
      // This gives the most recent price whether in regular or extended hours
      const lastTradePrice = Number.parseFloat(quote.last_trade_price);
      const extendedHoursPrice = quote.last_extended_hours_trade_price
        ? Number.parseFloat(quote.last_extended_hours_trade_price)
        : null;

      // Use extended hours price if available, otherwise regular price
      const currentPrice = extendedHoursPrice ?? lastTradePrice;
      const previousClose = Number.parseFloat(quote.previous_close);
      const positionValue = quantity * currentPrice;

      totalStockValue += positionValue;
      totalStockPreviousClose += quantity * previousClose;
    } catch (error) {
      console.error("Failed to get quote for position:", error);
    }
  }

  // Fetch crypto holdings value
  let totalCryptoValue = 0;
  try {
    const cryptoHoldings = await getCryptoHoldings(userId);
    for (const holding of cryptoHoldings) {
      totalCryptoValue += holding.marketValue;
    }
  } catch (error) {
    console.error("Crypto fetch error:", error);
    // Crypto may not be enabled for all accounts
  }

  // Fetch options positions value
  let totalOptionsValue = 0;
  try {
    const optionsPositions = await getOptionsPositions(userId);
    for (const option of optionsPositions) {
      totalOptionsValue += option.marketValue;
    }
  } catch (error) {
    console.error("Options fetch error:", error);
    // Options may not be enabled for all accounts
  }

  const totalMarketValue =
    totalStockValue + totalCryptoValue + totalOptionsValue;
  const equity = cash + totalMarketValue;
  const equityPreviousClose = cash + totalStockPreviousClose;
  const dayChange = equity - equityPreviousClose;
  const dayChangePercent =
    equityPreviousClose > 0 ? (dayChange / equityPreviousClose) * 100 : 0;

  return {
    totalValue: equity,
    equity,
    cash,
    buyingPower,
    dayChange,
    dayChangePercent,
    stocksEquity: totalStockValue,
    cryptoEquity: totalCryptoValue,
  };
}

/**
 * Get all positions
 */
export async function getPositions(
  userId: string
): Promise<FormattedPosition[]> {
  const session = await getSession(userId);
  if (!session) {
    throw new Error("Not connected to Robinhood. Please connect first.");
  }

  const positions = await apiRequest<
    RobinhoodPaginatedResponse<RobinhoodPosition>
  >("/positions/?nonzero=true", {}, session.accessToken);

  const formattedPositions: FormattedPosition[] = [];

  for (const position of positions.results) {
    const quantity = Number.parseFloat(position.quantity);
    if (quantity === 0) {
      continue;
    }

    // Get instrument details
    let symbol = "UNKNOWN";
    let name = "Unknown";
    let currentPrice = 0;

    try {
      const instrument = await apiRequest<RobinhoodInstrument>(
        position.instrument.replace(ROBINHOOD_API_BASE, ""),
        {},
        session.accessToken
      );
      symbol = instrument.symbol;
      name = instrument.simple_name || instrument.name;

      // Get current quote
      const quote = await apiRequest<RobinhoodQuote>(
        `/quotes/${symbol}/`,
        {},
        session.accessToken
      );
      currentPrice = Number.parseFloat(quote.last_trade_price);
    } catch {
      // Continue with defaults if instrument/quote fetch fails
    }

    const averageCost = Number.parseFloat(position.average_buy_price);
    const marketValue = quantity * currentPrice;
    const totalCost = quantity * averageCost;
    const totalGainLoss = marketValue - totalCost;
    const totalGainLossPercent =
      totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

    formattedPositions.push({
      symbol,
      name,
      quantity,
      averageCost,
      currentPrice,
      marketValue,
      totalGainLoss,
      totalGainLossPercent,
    });
  }

  return formattedPositions;
}

/**
 * Get quote for a symbol
 */
export async function getQuote(
  symbol: string,
  userId?: string
): Promise<FormattedQuote> {
  const session = userId ? await getSession(userId) : undefined;

  // Quotes can be fetched without auth for basic data
  const quote = await apiRequest<RobinhoodQuote>(
    `/quotes/${symbol.toUpperCase()}/`,
    {},
    session?.accessToken
  );

  const lastPrice = Number.parseFloat(quote.last_trade_price);
  const previousClose = Number.parseFloat(quote.previous_close);
  const change = lastPrice - previousClose;
  const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

  return {
    symbol: quote.symbol,
    lastPrice,
    change,
    changePercent,
    bidPrice: Number.parseFloat(quote.bid_price),
    askPrice: Number.parseFloat(quote.ask_price),
    previousClose,
    extendedHoursPrice: quote.last_extended_hours_trade_price
      ? Number.parseFloat(quote.last_extended_hours_trade_price)
      : undefined,
    tradingHalted: quote.trading_halted,
  };
}

/**
 * Generate a device token for authentication
 */
function generateDeviceToken(): string {
  const chars = "0123456789abcdef";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
    if (i === 7 || i === 11 || i === 15 || i === 19) {
      token += "-";
    }
  }
  return token;
}

/**
 * Make authenticated API request to Nummus (crypto) API
 */
async function nummusApiRequest<T>(
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${ROBINHOOD_NUMMUS_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Robinhood Nummus API error: ${response.status} - ${errorText || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Make authenticated API request to Phoenix (unified account) API
 * This endpoint returns aggregated portfolio data across all asset types
 */
async function phoenixApiRequest<T>(
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "*/*",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "en-US,en;q=0.9",
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Robinhood-API-Version": "1.431.4",
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${ROBINHOOD_PHOENIX_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Robinhood Phoenix API error: ${response.status} - ${errorText || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Get unified account data from Phoenix API
 * Returns aggregated portfolio value including stocks, crypto, and options
 */
export async function getPhoenixAccount(
  userId: string
): Promise<RobinhoodPhoenixAccount | null> {
  const session = await getSession(userId);
  if (!session) {
    throw new Error("Not connected to Robinhood. Please connect first.");
  }

  try {
    return await phoenixApiRequest<RobinhoodPhoenixAccount>(
      "/accounts/unified",
      session.accessToken
    );
  } catch {
    // Phoenix endpoint may not be available, return null to trigger fallback
    return null;
  }
}

/**
 * Get crypto currency pairs to map symbols to trading pair IDs
 * The trading pair ID is needed for quotes, not the currency ID
 */
async function getCryptoPairId(
  symbol: string,
  accessToken: string
): Promise<string | null> {
  try {
    // Use the correct endpoint on nummus.robinhood.com
    const pairs = await nummusApiRequest<{
      results: Array<{
        id: string;
        symbol: string;
        asset_currency: { code: string };
      }>;
    }>("/currency_pairs/", accessToken);

    const pair = pairs.results.find(
      (p) => p.asset_currency.code === symbol || p.symbol === `${symbol}-USD`
    );
    return pair?.id || null;
  } catch (error) {
    console.error(`Failed to get crypto pair for ${symbol}:`, error);
    return null;
  }
}

/**
 * Get crypto holdings from Robinhood
 * Uses the Nummus API for cryptocurrency data
 */
export async function getCryptoHoldings(
  userId: string
): Promise<FormattedCryptoHolding[]> {
  const session = await getSession(userId);
  if (!session) {
    throw new Error("Not connected to Robinhood. Please connect first.");
  }

  const holdings = await nummusApiRequest<{
    results: RobinhoodCryptoHolding[];
  }>("/holdings/", session.accessToken);

  const formattedHoldings: FormattedCryptoHolding[] = [];

  for (const holding of holdings.results) {
    const quantity = Number.parseFloat(holding.quantity);
    if (quantity === 0) {
      continue;
    }

    const symbol = holding.currency.code;
    const name = holding.currency.name;

    // Calculate average cost from cost bases
    let totalCost = 0;
    let totalQuantity = 0;
    for (const costBasis of holding.cost_bases) {
      totalCost += Number.parseFloat(costBasis.direct_cost_basis);
      totalQuantity += Number.parseFloat(costBasis.direct_quantity);
    }
    const averageCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;

    // Get current price - need to use the trading pair ID, not currency ID
    let currentPrice = 0;
    try {
      // First get the trading pair ID for this crypto
      const pairId = await getCryptoPairId(symbol, session.accessToken);

      if (pairId) {
        const quote = await apiRequest<RobinhoodCryptoQuote>(
          `/marketdata/forex/quotes/${pairId}/`,
          {},
          session.accessToken
        );
        currentPrice = Number.parseFloat(quote.mark_price);
      }
    } catch (error) {
      console.error(`Failed to get crypto quote for ${symbol}:`, error);
    }

    const marketValue = quantity * currentPrice;
    const totalGainLoss = marketValue - totalCost;
    const totalGainLossPercent =
      totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

    formattedHoldings.push({
      symbol,
      name,
      quantity,
      averageCost,
      currentPrice,
      marketValue,
      totalGainLoss,
      totalGainLossPercent,
    });
  }

  return formattedHoldings;
}

/**
 * Get options positions from Robinhood
 */
export async function getOptionsPositions(
  userId: string
): Promise<FormattedOptionPosition[]> {
  const session = await getSession(userId);
  if (!session) {
    throw new Error("Not connected to Robinhood. Please connect first.");
  }

  const positions = await apiRequest<
    RobinhoodPaginatedResponse<RobinhoodOptionPosition>
  >("/options/positions/?nonzero=true", {}, session.accessToken);

  const formattedPositions: FormattedOptionPosition[] = [];

  for (const position of positions.results) {
    const quantity = Number.parseFloat(position.quantity);
    if (quantity === 0) {
      continue;
    }

    // Get option instrument details
    let symbol = position.chain_symbol;
    let optionType: "call" | "put" = "call";
    let strikePrice = 0;
    let expirationDate = "";
    let currentPrice = 0;

    try {
      // Fetch option instrument details
      const instrument = await apiRequest<RobinhoodOptionInstrument>(
        position.option.replace(ROBINHOOD_API_BASE, ""),
        {},
        session.accessToken
      );
      symbol = instrument.chain_symbol;
      optionType = instrument.type;
      strikePrice = Number.parseFloat(instrument.strike_price);
      expirationDate = instrument.expiration_date;

      // Get current market data for the option
      try {
        const marketData = await apiRequest<RobinhoodOptionMarketData>(
          `/marketdata/options/?instruments=${position.option}`,
          {},
          session.accessToken
        );
        currentPrice = Number.parseFloat(marketData.mark_price);
      } catch {
        // Try to get from the adjusted mark price endpoint
        try {
          const marketDataArray = await apiRequest<{
            results: RobinhoodOptionMarketData[];
          }>(
            `/marketdata/options/?instruments=${position.option}`,
            {},
            session.accessToken
          );
          if (marketDataArray.results.length > 0) {
            currentPrice = Number.parseFloat(
              marketDataArray.results[0].mark_price
            );
          }
        } catch {
          // Skip if market data fetch fails
        }
      }
    } catch {
      // Continue with defaults if instrument fetch fails
    }

    const averageCost = Number.parseFloat(position.average_price);
    const multiplier =
      Number.parseFloat(position.trade_value_multiplier) || 100;
    const marketValue = quantity * currentPrice * multiplier;
    const totalCost = quantity * averageCost * multiplier;
    const totalGainLoss =
      position.type === "long"
        ? marketValue - totalCost
        : totalCost - marketValue;
    const totalGainLossPercent =
      totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

    formattedPositions.push({
      symbol,
      optionType,
      strikePrice,
      expirationDate,
      quantity,
      averageCost,
      currentPrice,
      marketValue,
      totalGainLoss,
      totalGainLossPercent,
      positionType: position.type,
    });
  }

  return formattedPositions;
}

/**
 * Get today's options orders from Robinhood
 * Returns all option orders placed today, including filled, pending, and cancelled
 */
export async function getTodayOptionsOrders(
  userId: string
): Promise<FormattedOptionTrade[]> {
  const session = await getSession(userId);
  if (!session) {
    throw new Error("Not connected to Robinhood. Please connect first.");
  }

  // Get today's date in YYYY-MM-DD format (Eastern Time for market hours)
  const now = new Date();
  const easternTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const todayStr = easternTime.toISOString().split("T")[0];

  // Fetch all option orders with pagination
  let allOrders: RobinhoodOptionOrder[] = [];
  let nextUrl: string | null = "/options/orders/";

  while (nextUrl) {
    const orders: RobinhoodPaginatedResponse<RobinhoodOptionOrder> =
      await apiRequest<RobinhoodPaginatedResponse<RobinhoodOptionOrder>>(
        nextUrl.replace(ROBINHOOD_API_BASE, ""),
        {},
        session.accessToken
      );
    allOrders = [...allOrders, ...orders.results];
    nextUrl = orders.next;

    // Stop pagination if we've gone past today's orders (they're in reverse chronological order)
    const lastOrder = orders.results.at(-1);
    if (lastOrder) {
      const orderDate = lastOrder.created_at.split("T")[0];
      if (orderDate < todayStr) {
        break;
      }
    }
  }

  // Filter to only today's orders
  const todayOrders = allOrders.filter((order) => {
    const orderDate = order.created_at.split("T")[0];
    return orderDate === todayStr;
  });

  const formattedTrades: FormattedOptionTrade[] = [];

  // Cache for option instrument details to avoid duplicate fetches
  const instrumentCache = new Map<string, RobinhoodOptionInstrument>();

  for (const order of todayOrders) {
    // Process each leg of the order
    for (const leg of order.legs) {
      // Get option instrument details
      let instrument: RobinhoodOptionInstrument | undefined =
        instrumentCache.get(leg.option);

      if (!instrument) {
        try {
          instrument = await apiRequest<RobinhoodOptionInstrument>(
            leg.option.replace(ROBINHOOD_API_BASE, ""),
            {},
            session.accessToken
          );
          instrumentCache.set(leg.option, instrument);
        } catch {
          // Skip if instrument fetch fails
          continue;
        }
      }

      const quantity =
        Number.parseFloat(order.processed_quantity) * leg.ratio_quantity;
      const price = Number.parseFloat(order.price);
      const multiplier = 100; // Standard options multiplier
      const totalValue = quantity * price * multiplier;

      // Determine execution time from executions or fall back to order update time
      let executedAt = order.updated_at;
      if (leg.executions.length > 0) {
        // Use the most recent execution timestamp
        const lastExecution = leg.executions.at(-1);
        if (lastExecution) {
          executedAt = lastExecution.timestamp;
        }
      }

      formattedTrades.push({
        symbol: instrument.chain_symbol,
        optionType: instrument.type,
        strikePrice: Number.parseFloat(instrument.strike_price),
        expirationDate: instrument.expiration_date,
        side: leg.side,
        positionEffect: leg.position_effect,
        quantity,
        price,
        totalValue,
        state: order.state,
        executedAt,
        orderId: order.id,
      });
    }
  }

  // Sort by execution time, most recent first
  formattedTrades.sort(
    (a, b) =>
      new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()
  );

  return formattedTrades;
}
