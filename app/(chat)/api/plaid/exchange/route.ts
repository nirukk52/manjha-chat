/**
 * Plaid token exchange endpoint.
 * POST: Exchange public token for access token after user completes Link
 */

import { auth } from "@/app/(auth)/auth";
import { ChatSDKError } from "@/lib/errors";
import { exchangePublicToken } from "@/lib/plaid/client";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const body = await request.json();
    const { publicToken, institutionId, institutionName } = body;

    if (!publicToken) {
      return Response.json(
        { success: false, error: "Public token is required" },
        { status: 400 }
      );
    }

    const result = await exchangePublicToken(
      session.user.id,
      publicToken,
      institutionId,
      institutionName
    );

    return Response.json(result);
  } catch (error) {
    console.error("Plaid token exchange error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Token exchange failed",
      },
      { status: 500 }
    );
  }
}
