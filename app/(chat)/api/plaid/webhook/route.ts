/**
 * Plaid webhook handler endpoint.
 * POST: Receive webhooks from Plaid for data updates
 */

import { getPlaidItemByItemId } from "@/lib/db/queries";
import type { PlaidWebhookPayload } from "@/lib/plaid/types";

export async function POST(request: Request) {
  try {
    const payload: PlaidWebhookPayload = await request.json();

    console.log(
      "Plaid webhook received:",
      payload.webhook_type,
      payload.webhook_code
    );

    // Verify the item exists in our database
    const item = await getPlaidItemByItemId({ itemId: payload.item_id });

    if (!item) {
      console.warn("Webhook received for unknown item:", payload.item_id);
      // Still return 200 to acknowledge receipt
      return Response.json({ received: true });
    }

    // Handle different webhook types
    switch (payload.webhook_type) {
      case "INVESTMENTS_TRANSACTIONS":
        // New investment transactions available
        console.log(
          `Investment transactions update for item ${payload.item_id}:`,
          payload.webhook_code
        );
        // In production, you might want to trigger a background job to fetch new data
        break;

      case "HOLDINGS":
        // Holdings data updated
        console.log(
          `Holdings update for item ${payload.item_id}:`,
          payload.webhook_code
        );
        break;

      case "ITEM":
        // Item status changed (e.g., error, pending expiration)
        console.log(
          `Item status update for ${payload.item_id}:`,
          payload.webhook_code
        );
        if (payload.error) {
          console.error("Item error:", payload.error);
        }
        break;

      default:
        console.log("Unhandled webhook type:", payload.webhook_type);
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("Plaid webhook error:", error);
    // Return 200 anyway to prevent Plaid from retrying
    return Response.json({ received: true, error: "Processing error" });
  }
}
