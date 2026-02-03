/**
 * API route for fetching Robinhood portfolio data
 * Used by the suggested actions to show account status
 */

import { auth } from "@/app/(auth)/auth";
import { getPortfolio, getSession } from "@/lib/robinhood/client";
import { ChatSDKError } from "@/lib/errors";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const robinhoodSession = getSession(session.user.id);

  if (!robinhoodSession) {
    return Response.json(
      { error: "Not connected to Robinhood" },
      { status: 401 }
    );
  }

  try {
    const portfolio = await getPortfolio(session.user.id);
    return Response.json(portfolio);
  } catch (error) {
    console.error("Robinhood portfolio error:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch portfolio",
      },
      { status: 500 }
    );
  }
}
