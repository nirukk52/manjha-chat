/**
 * Plaid investment holdings endpoint.
 * GET: Fetch holdings for all connected accounts
 */

import { auth } from "@/app/(auth)/auth";
import { getPlaidItems } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import {
  formatHoldings,
  getInvestmentHoldings,
  getPortfolio,
} from "@/lib/plaid/client";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const url = new URL(request.url);
    const format = url.searchParams.get("format");

    // If portfolio summary requested
    if (format === "portfolio") {
      const portfolio = await getPortfolio(session.user.id);

      if (!portfolio) {
        return Response.json({
          success: false,
          error: "No connected accounts",
          needsConnection: true,
        });
      }

      return Response.json({
        success: true,
        portfolio,
      });
    }

    // Get raw holdings
    const holdings = await getInvestmentHoldings(session.user.id);

    if (!holdings) {
      return Response.json({
        success: false,
        error: "No connected accounts",
        needsConnection: true,
      });
    }

    // Get institution name for formatting
    const items = await getPlaidItems({ userId: session.user.id });
    const institutionName = items[0]?.institutionName ?? null;

    // Format holdings for display
    const formattedHoldings = formatHoldings(holdings, institutionName);

    return Response.json({
      success: true,
      holdings: formattedHoldings,
      accounts: holdings.accounts,
      raw: holdings,
    });
  } catch (error) {
    console.error("Plaid holdings error:", error);
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch holdings",
      },
      { status: 500 }
    );
  }
}
