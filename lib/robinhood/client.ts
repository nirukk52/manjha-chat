/**
 * Robinhood API Client
 *
 * TypeScript client for the unofficial Robinhood API.
 * Based on: https://github.com/sanko/Robinhood
 *
 * Note: This uses unofficial APIs and may break if Robinhood changes their API.
 */

import type {
  FormattedPortfolio,
  FormattedPosition,
  FormattedQuote,
  RobinhoodAccount,
  RobinhoodConnectionStatus,
  RobinhoodInstrument,
  RobinhoodLoginResult,
  RobinhoodPaginatedResponse,
  RobinhoodPortfolio,
  RobinhoodPosition,
  RobinhoodQuote,
  RobinhoodSession,
} from "./types";

const ROBINHOOD_API_BASE = "https://api.robinhood.com";
const ROBINHOOD_CLIENT_ID = "c82SH0WZOsabOXGP2sxqcj34FxkvfnWRZBKlBjFS";

// In-memory session store (keyed by user ID)
const sessionStore = new Map<string, RobinhoodSession>();

// In-memory device token store (persists device token during login flow)
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
 * Get stored session for a user
 */
export function getSession(userId: string): RobinhoodSession | undefined {
  const session = sessionStore.get(userId);
  if (session && session.expiresAt > Date.now()) {
    return session;
  }
  // Session expired, remove it
  if (session) {
    sessionStore.delete(userId);
  }
  return undefined;
}

/**
 * Store session for a user
 */
function setSession(userId: string, session: RobinhoodSession): void {
  sessionStore.set(userId, session);
}

/**
 * Clear session for a user
 */
export function clearSession(userId: string): void {
  sessionStore.delete(userId);
}

/**
 * Check if user is connected to Robinhood
 */
export function getConnectionStatus(userId: string): RobinhoodConnectionStatus {
  const session = getSession(userId);
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
        console.log(`Prompt status (attempt ${attempt + 1}):`, JSON.stringify(data, null, 2));

        if (data.challenge_status === "validated") {
          return { validated: true };
        }
      }
    } catch (error) {
      console.error(`Prompt status poll error (attempt ${attempt + 1}):`, error);
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
        console.log("Challenge response:", JSON.stringify(challengeData, null, 2));

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
    console.log("Robinhood login response data:", JSON.stringify(data, null, 2));

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
        console.log("Pathfinder response:", JSON.stringify(pathfinderData, null, 2));

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
          console.log("Inquiry response:", JSON.stringify(inquiryData, null, 2));

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
        const accounts = await apiRequest<RobinhoodPaginatedResponse<RobinhoodAccount>>(
          "/accounts/",
          {},
          data.access_token
        );
        if (accounts.results.length > 0) {
          session.accountId = accounts.results[0].account_number;
          session.accountUrl = accounts.results[0].url;
        }
      } catch {
        // Continue without account info
      }

      setSession(userId, session);

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
  const session = getSession(userId);

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

  clearSession(userId);
  clearDeviceToken(userId);
  return true;
}

/**
 * Get account information
 */
export async function getAccount(
  userId: string
): Promise<RobinhoodAccount | null> {
  const session = getSession(userId);
  if (!session) {
    throw new Error("Not connected to Robinhood. Please connect first.");
  }

  const accounts = await apiRequest<RobinhoodPaginatedResponse<RobinhoodAccount>>(
    "/accounts/",
    {},
    session.accessToken
  );

  return accounts.results[0] || null;
}

/**
 * Get portfolio information
 */
export async function getPortfolio(userId: string): Promise<FormattedPortfolio> {
  const session = getSession(userId);
  if (!session) {
    throw new Error("Not connected to Robinhood. Please connect first.");
  }

  const account = await getAccount(userId);
  if (!account) {
    throw new Error("No account found");
  }

  // Get portfolio data
  const portfolioUrl = account.url.replace("/accounts/", "/portfolios/");
  const portfolio = await apiRequest<RobinhoodPortfolio>(
    portfolioUrl.replace(ROBINHOOD_API_BASE, ""),
    {},
    session.accessToken
  );

  const equity = Number.parseFloat(portfolio.equity);
  const equityPreviousClose = Number.parseFloat(portfolio.equity_previous_close);
  const dayChange = equity - equityPreviousClose;
  const dayChangePercent =
    equityPreviousClose > 0 ? (dayChange / equityPreviousClose) * 100 : 0;

  return {
    totalValue: equity,
    equity,
    cash: Number.parseFloat(account.cash),
    buyingPower: Number.parseFloat(account.buying_power),
    dayChange,
    dayChangePercent,
  };
}

/**
 * Get all positions
 */
export async function getPositions(userId: string): Promise<FormattedPosition[]> {
  const session = getSession(userId);
  if (!session) {
    throw new Error("Not connected to Robinhood. Please connect first.");
  }

  const positions = await apiRequest<RobinhoodPaginatedResponse<RobinhoodPosition>>(
    "/positions/?nonzero=true",
    {},
    session.accessToken
  );

  const formattedPositions: FormattedPosition[] = [];

  for (const position of positions.results) {
    const quantity = Number.parseFloat(position.quantity);
    if (quantity === 0) continue;

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
    const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

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
  const session = userId ? getSession(userId) : undefined;

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
