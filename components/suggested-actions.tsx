"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion } from "framer-motion";
import { memo, useEffect, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { Suggestion } from "./elements/suggestion";
import type { VisibilityType } from "./visibility-selector";

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedVisibilityType: VisibilityType;
};

interface RobinhoodStatus {
  connected: boolean;
  portfolio?: {
    totalValue: number;
    dayChange: number;
    dayChangePercent: number;
  };
}

function PureSuggestedActions({ chatId, sendMessage }: SuggestedActionsProps) {
  const [robinhoodStatus, setRobinhoodStatus] = useState<RobinhoodStatus>({
    connected: false,
  });

  useEffect(() => {
    async function checkRobinhoodStatus() {
      try {
        // Check connection status
        const statusRes = await fetch("/api/robinhood");
        const status = await statusRes.json();

        if (status.connected) {
          // Fetch portfolio if connected
          const portfolioRes = await fetch("/api/robinhood/portfolio");
          if (portfolioRes.ok) {
            const portfolio = await portfolioRes.json();
            setRobinhoodStatus({
              connected: true,
              portfolio: {
                totalValue: portfolio.totalValue,
                dayChange: portfolio.dayChange,
                dayChangePercent: portfolio.dayChangePercent,
              },
            });
          } else {
            setRobinhoodStatus({ connected: true });
          }
        }
      } catch {
        // Silently fail - will show default action
      }
    }

    checkRobinhoodStatus();
  }, []);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);

  const formatPercent = (value: number) =>
    `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

  const getRobinhoodAction = () => {
    if (robinhoodStatus.connected && robinhoodStatus.portfolio) {
      const { totalValue, dayChange, dayChangePercent } =
        robinhoodStatus.portfolio;
      const changeColor = dayChange >= 0 ? "text-green-600" : "text-red-600";
      return {
        text: "Show my Robinhood portfolio",
        display: (
          <div className="flex flex-col gap-1">
            <span className="font-medium">Robinhood Connected</span>
            <span className="text-muted-foreground">
              {formatCurrency(totalValue)}{" "}
              <span className={changeColor}>
                ({formatPercent(dayChangePercent)})
              </span>
            </span>
          </div>
        ),
      };
    }
    return {
      text: "One tap, connect my Robinhood account.",
      display: "One tap, connect my Robinhood account.",
    };
  };

  const robinhoodAction = getRobinhoodAction();

  const suggestedActions = [
    robinhoodAction,
    { text: "Write code to demonstrate Dijkstra's algorithm", display: "Write code to demonstrate Dijkstra's algorithm" },
    { text: "Help me write an essay about Silicon Valley", display: "Help me write an essay about Silicon Valley" },
    { text: "What is the weather in San Francisco?", display: "What is the weather in San Francisco?" },
  ];

  return (
    <div
      className="grid w-full gap-2 sm:grid-cols-2"
      data-testid="suggested-actions"
    >
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
