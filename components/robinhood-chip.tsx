"use client";

import { Loader2 } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Represents the visual state of the Robinhood connection chip
 * Used to determine the chip's appearance and behavior
 */
type ChipStatus =
  | "disconnected"
  | "connected"
  | "sync-needed"
  | "connecting"
  | "verify-needed";

interface PortfolioData {
  totalValue: number;
  dayChangePercent: number;
}

interface RobinhoodChipProps {
  /** Callback when chip is clicked while disconnected - opens login dialog */
  onConnect: () => void;
  /** Callback when chip is clicked while connected - shows portfolio view */
  onShowPortfolio: () => void;
  /** External trigger to refresh status (e.g., after login success) */
  refreshTrigger?: boolean;
}

/**
 * Compact status chip for Robinhood connection
 * Shows status indicator + portfolio value OR action text
 * Click behavior depends on state:
 * - Disconnected/sync-needed/verify-needed: opens login dialog
 * - Connected: shows portfolio view
 */
function PureRobinhoodChip({
  onConnect,
  onShowPortfolio,
  refreshTrigger,
}: RobinhoodChipProps) {
  const [status, setStatus] = useState<ChipStatus>("disconnected");
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);

  // Fetch connection status and portfolio data
  const fetchStatus = useCallback(async () => {
    try {
      const statusRes = await fetch("/api/robinhood");
      const statusData = await statusRes.json();

      if (statusData.connected) {
        // Check if token is about to expire (within 5 minutes)
        if (
          statusData.expiresAt &&
          statusData.expiresAt < Date.now() + 5 * 60 * 1000
        ) {
          setStatus("sync-needed");
          return;
        }

        // Fetch portfolio data
        const portfolioRes = await fetch("/api/robinhood/portfolio");
        if (portfolioRes.ok) {
          const portfolioData = await portfolioRes.json();
          setPortfolio({
            totalValue: portfolioData.totalValue,
            dayChangePercent: portfolioData.dayChangePercent,
          });
          setStatus("connected");
        } else {
          // Connected but can't fetch portfolio - might need sync
          setStatus("sync-needed");
        }
      } else {
        setStatus("disconnected");
        setPortfolio(null);
      }
    } catch {
      setStatus("disconnected");
      setPortfolio(null);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus, refreshTrigger]);

  // Format value as abbreviated currency (e.g., $95.5K)
  const formatCompactCurrency = (value: number): string => {
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  // Format percent with sign
  const formatPercent = (value: number): string =>
    `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

  // Get status indicator dot color
  const getStatusDot = () => {
    switch (status) {
      case "connected":
        return "bg-green-500";
      case "sync-needed":
        return "bg-yellow-500";
      case "verify-needed":
        return "bg-blue-500";
      case "connecting":
        return null; // Show spinner instead
      default:
        return "bg-gray-400";
    }
  };

  // Get chip content based on status
  const getChipContent = () => {
    switch (status) {
      case "connected":
        if (portfolio) {
          const changeColor =
            portfolio.dayChangePercent >= 0 ? "text-green-600" : "text-red-600";
          return (
            <>
              <span className="font-medium">
                {formatCompactCurrency(portfolio.totalValue)}
              </span>
              <span className={cn("font-medium", changeColor)}>
                {formatPercent(portfolio.dayChangePercent)}
              </span>
            </>
          );
        }
        return <span className="text-muted-foreground">Connected</span>;

      case "sync-needed":
        return <span className="text-muted-foreground">Sync</span>;

      case "verify-needed":
        return <span className="text-muted-foreground">Verify</span>;

      case "connecting":
        return (
          <>
            <Loader2 className="size-3 animate-spin" />
            <span className="text-muted-foreground">Connecting</span>
          </>
        );

      default:
        return <span className="text-muted-foreground">Connect Robinhood</span>;
    }
  };

  const statusDot = getStatusDot();

  // Handle click based on connection state
  const handleClick = () => {
    if (status === "connected") {
      onShowPortfolio();
    } else {
      onConnect();
    }
  };

  return (
    <Button
      className="h-7 gap-1.5 rounded-full px-3 text-xs"
      onClick={handleClick}
      size="sm"
      type="button"
      variant="outline"
    >
      {statusDot && (
        <span className={cn("size-1.5 shrink-0 rounded-full", statusDot)} />
      )}
      {getChipContent()}
    </Button>
  );
}

export const RobinhoodChip = memo(PureRobinhoodChip, (prevProps, nextProps) => {
  if (prevProps.refreshTrigger !== nextProps.refreshTrigger) {
    return false;
  }
  return true;
});
