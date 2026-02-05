/**
 * Plaid Link token generation endpoint.
 * POST: Create a new Link token for initializing Plaid Link
 */

import { auth } from "@/app/(auth)/auth";
import { ChatSDKError } from "@/lib/errors";
import { createLinkToken } from "@/lib/plaid/client";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { redirectUri } = body;

    const linkToken = await createLinkToken(session.user.id, redirectUri);

    return Response.json({
      success: true,
      linkToken: linkToken.link_token,
      expiration: linkToken.expiration,
    });
  } catch (error) {
    // Extract Plaid-specific error details from Axios error
    let errorMessage = "Failed to create link token";
    let errorCode = "";

    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as {
        response?: {
          data?: {
            error_message?: string;
            error_code?: string;
            display_message?: string;
          };
        };
      };

      const plaidData = axiosError.response?.data;
      if (plaidData) {
        errorCode = plaidData.error_code || "";
        errorMessage =
          plaidData.display_message ||
          plaidData.error_message ||
          "Failed to create link token";

        console.error("Plaid error:", {
          error_code: plaidData.error_code,
          error_message: plaidData.error_message,
          display_message: plaidData.display_message,
        });
      }
    } else {
      console.error("Plaid link token error:", error);
    }

    return Response.json(
      {
        success: false,
        error: errorMessage,
        errorCode,
      },
      { status: 500 }
    );
  }
}
