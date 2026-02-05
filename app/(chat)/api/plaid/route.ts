/**
 * Plaid connection status and item management endpoint.
 * GET: Check connection status
 * DELETE: Remove a connected item
 */

import { auth } from "@/app/(auth)/auth";
import { ChatSDKError } from "@/lib/errors";
import { getConnectionStatus, removeItem } from "@/lib/plaid/client";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const status = await getConnectionStatus(session.user.id);

  return Response.json(status);
}

export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const body = await request.json();
    const { itemId } = body;

    if (!itemId) {
      return Response.json(
        { success: false, error: "Item ID is required" },
        { status: 400 }
      );
    }

    const success = await removeItem(itemId);

    return Response.json({ success });
  } catch (error) {
    console.error("Plaid disconnect error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Disconnect failed",
      },
      { status: 500 }
    );
  }
}
