"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion } from "framer-motion";
import { memo } from "react";
import type { ChatMessage } from "@/lib/types";
import { Suggestion } from "./elements/suggestion";
import type { VisibilityType } from "./visibility-selector";

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedVisibilityType: VisibilityType;
};

/**
 * Renders suggested actions for the chat input area
 * Shows generic action suggestions to help users get started
 */
function PureSuggestedActions({
  chatId,
  sendMessage,
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
        {suggestedActions.map((action, index) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            initial={{ opacity: 0, y: 20 }}
            key={action.text}
            transition={{ delay: 0.05 * index }}
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

    return true;
  }
);
