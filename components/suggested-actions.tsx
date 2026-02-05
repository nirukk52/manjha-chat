"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion } from "framer-motion";
import { Building2, Check } from "lucide-react";
import { memo } from "react";
import type { ChatMessage } from "@/lib/types";
import { Suggestion } from "./elements/suggestion";
import { Button } from "./ui/button";
import type { VisibilityType } from "./visibility-selector";

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedVisibilityType: VisibilityType;
  plaidConnected?: boolean;
  onOpenPlaidLink?: () => void;
};

/**
 * Renders suggested actions for the chat input area.
 * Shows generic action suggestions to help users get started,
 * plus quick connect buttons for brokerage integrations.
 */
function PureSuggestedActions({
  chatId,
  sendMessage,
  plaidConnected,
  onOpenPlaidLink,
}: SuggestedActionsProps) {
  const suggestedActions = [
    {
      text: "Analyze my todays SPX options trade",
      display: "Analyze today's SPX options",
    },
    {
      text: "Help me write an essay about Silicon Valley",
      display: "Help me write an essay about Silicon Valley",
    },
    {
      text: "What is the weather in San Francisco?",
      display: "What is the weather in San Francisco?",
    },
  ];

  return (
    <div className="flex w-full flex-col gap-3" data-testid="suggested-actions">
      <div className="grid w-full gap-2 sm:grid-cols-2">
        {/* IBKR Sync button */}
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          initial={{ opacity: 0, y: 20 }}
          transition={{ delay: 0 }}
        >
          <Button
            className="h-auto w-full whitespace-normal p-3 text-left"
            onClick={() => {
              if (plaidConnected) {
                // If already connected, send a message to view portfolio
                window.history.pushState({}, "", `/chat/${chatId}`);
                sendMessage({
                  role: "user",
                  parts: [
                    { type: "text", text: "Show me my brokerage portfolio" },
                  ],
                });
              } else {
                // If not connected, open Plaid Link
                onOpenPlaidLink?.();
              }
            }}
            variant="outline"
          >
            {plaidConnected ? (
              <span className="flex items-center gap-2">
                <Check className="size-4 text-green-500" />
                Brokerage Connected
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Building2 className="size-4" />
                One-tap IBKR Sync
              </span>
            )}
          </Button>
        </motion.div>

        {suggestedActions.map((action, index) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            initial={{ opacity: 0, y: 20 }}
            key={action.text}
            transition={{ delay: 0.05 * (index + 1) }}
          >
            <Suggestion
              className="h-auto w-full whitespace-normal p-3 text-left"
              onClick={(suggestion) => {
                window.history.pushState({}, "", `/chat/${chatId}`);
                sendMessage({
                  role: "user",
                  parts: [{ type: "text", text: suggestion }],
                });
              }}
              suggestion={action.text}
            >
              {action.display}
            </Suggestion>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }
    if (prevProps.plaidConnected !== nextProps.plaidConnected) {
      return false;
    }

    return true;
  }
);
