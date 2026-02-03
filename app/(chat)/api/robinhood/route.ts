import { auth } from "@/app/(auth)/auth";
import {
  clearSession,
  getConnectionStatus,
  login,
  logout,
  resetDeviceToken,
} from "@/lib/robinhood/client";
import { ChatSDKError } from "@/lib/errors";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const status = getConnectionStatus(session.user.id);

  return Response.json(status);
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const body = await request.json();
    const { action, email, password, mfaCode, challengeId } = body;

    if (action === "login") {
      if (!email || !password) {
        return Response.json(
          { success: false, error: "Email and password are required" },
          { status: 400 }
        );
      }

      const result = await login(
        session.user.id,
        email,
        password,
        mfaCode,
        challengeId
      );

      return Response.json(result);
    }

    if (action === "resetDevice") {
      // Reset device token to force a new verification workflow
      resetDeviceToken(session.user.id);
      return Response.json({ success: true });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Robinhood API error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An error occurred",
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    await logout(session.user.id);
    clearSession(session.user.id);

    return Response.json({ success: true });
  } catch (error) {
    console.error("Robinhood logout error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Logout failed",
      },
      { status: 500 }
    );
  }
}
