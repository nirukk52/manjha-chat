/**
 * API route for fetching Robinhood portfolio data
 * Used by the suggested actions to show account status
 */

import { auth } from "@/app/(auth)/auth";
import { ChatSDKError } from "@/lib/errors";
import { getPortfolio, getSession } from "@/lib/robinhood/client";

export async function GET() {
  console.log("Portfolio route called at", new Date().toISOString());

  const session = await auth();

  if (!session?.user?.id) {
    console.log("No user session");
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const robinhoodSession = await getSession(session.user.id);

  if (!robinhoodSession) {
    console.log("No Robinhood session for user", session.user.id);
    return Response.json(
      { error: "Not connected to Robinhood" },
      { status: 401 }
    );
  }

  console.log(
    "Robinhood session found, expires at:",
    robinhoodSession.expiresAt
  );

  try {
    const portfolio = await getPortfolio(session.user.id);
    console.log("Portfolio data:", JSON.stringify(portfolio, null, 2));
    return Response.json(portfolio, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Robinhood portfolio error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch portfolio";
    return Response.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
