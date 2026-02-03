"use client";

import { CheckCircle2, Link2, Shield, TrendingUp, Wallet } from "lucide-react";
import { Button } from "./ui/button";

// Robinhood brand green
const ROBINHOOD_GREEN = "#00C805";

interface RobinhoodConnectProps {
  onAllow: () => void;
  onDeny: () => void;
  state: "pending" | "approved" | "denied" | "connected";
}

export function RobinhoodConnect({
  onAllow,
  onDeny,
  state,
}: RobinhoodConnectProps) {
  if (state === "connected") {
    return (
      <div className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 p-4 shadow-lg">
        <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-white/20">
            <CheckCircle2 className="size-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Connected to Robinhood</h3>
            <p className="text-sm text-white/80">
              Your account is ready. Ask about your portfolio!
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="w-full rounded-2xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/50">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/50">
            <Link2 className="size-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h3 className="font-medium text-orange-900 dark:text-orange-100">
              Connection Declined
            </h3>
            <p className="text-sm text-orange-700 dark:text-orange-300">
              You can connect your Robinhood account anytime.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
      {/* Header with Robinhood branding */}
      <div
        className="flex items-center gap-3 p-4"
        style={{ backgroundColor: ROBINHOOD_GREEN }}
      >
        <div className="flex size-10 items-center justify-center rounded-full bg-white/20">
          <TrendingUp className="size-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-white">Connect Robinhood</h3>
          <p className="text-sm text-white/80">
            Access your portfolio and trading data
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <Wallet className="mt-0.5 size-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">View Portfolio</p>
            <p className="text-xs text-muted-foreground">
              See your holdings, positions, and performance
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <TrendingUp className="mt-0.5 size-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Get Quotes</p>
            <p className="text-xs text-muted-foreground">
              Real-time stock prices and market data
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 size-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Secure Connection</p>
            <p className="text-xs text-muted-foreground">
              Credentials entered in secure popup, never stored
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      {state === "pending" && (
        <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-4 py-3">
          <Button variant="ghost" size="sm" onClick={onDeny}>
            Not Now
          </Button>
          <Button
            size="sm"
            onClick={onAllow}
            style={{ backgroundColor: ROBINHOOD_GREEN }}
            className="text-white hover:opacity-90"
          >
            Connect
          </Button>
        </div>
      )}

      {state === "approved" && (
        <div className="flex items-center justify-center gap-2 border-t bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            Opening secure login...
          </div>
        </div>
      )}
    </div>
  );
}

export interface RobinhoodPortfolioProps {
  data: {
    totalValue?: string;
    equity?: string;
    cash?: string;
    buyingPower?: string;
    dayChange?: string;
    dayChangePercent?: string;
    error?: string;
  };
}

export function RobinhoodPortfolio({ data }: RobinhoodPortfolioProps) {
  if (data.error) {
    return (
      <div className="w-full rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/50">
        <p className="text-sm text-red-600 dark:text-red-400">{data.error}</p>
      </div>
    );
  }

  const isPositive = data.dayChange?.startsWith("+");

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
      <div
        className="p-4"
        style={{ backgroundColor: ROBINHOOD_GREEN }}
      >
        <p className="text-sm text-white/80">Portfolio Value</p>
        <p className="text-3xl font-bold text-white">{data.totalValue}</p>
        <p
          className={`mt-1 text-sm font-medium ${isPositive ? "text-white" : "text-red-200"}`}
        >
          {data.dayChange} ({data.dayChangePercent}) today
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 p-4">
        <div>
          <p className="text-xs text-muted-foreground">Equity</p>
          <p className="font-semibold">{data.equity}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Cash</p>
          <p className="font-semibold">{data.cash}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">Buying Power</p>
          <p className="font-semibold">{data.buyingPower}</p>
        </div>
      </div>
    </div>
  );
}

export interface RobinhoodPositionsProps {
  data: {
    positionCount?: number;
    positions?: Array<{
      symbol: string;
      name: string;
      quantity: number;
      averageCost: string;
      currentPrice: string;
      marketValue: string;
      totalGainLoss: string;
      totalGainLossPercent: string;
    }>;
    message?: string;
    error?: string;
  };
}

export function RobinhoodPositions({ data }: RobinhoodPositionsProps) {
  if (data.error) {
    return (
      <div className="w-full rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/50">
        <p className="text-sm text-red-600 dark:text-red-400">{data.error}</p>
      </div>
    );
  }

  if (data.message || !data.positions?.length) {
    return (
      <div className="w-full rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          {data.message || "No positions found"}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
      <div className="border-b bg-muted/30 px-4 py-3">
        <h3 className="font-semibold">
          Positions ({data.positionCount})
        </h3>
      </div>

      <div className="divide-y">
        {data.positions.map((position) => {
          const isPositive = position.totalGainLoss.startsWith("+");

          return (
            <div
              key={position.symbol}
              className="flex items-center justify-between p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold">{position.symbol}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {position.name}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {position.quantity} shares @ {position.averageCost}
                </p>
              </div>

              <div className="text-right">
                <p className="font-semibold">{position.marketValue}</p>
                <p
                  className={`text-xs font-medium ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                >
                  {position.totalGainLoss} ({position.totalGainLossPercent})
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface RobinhoodQuoteProps {
  data: {
    symbol?: string;
    lastPrice?: string;
    change?: string;
    changePercent?: string;
    bidPrice?: string;
    askPrice?: string;
    previousClose?: string;
    extendedHoursPrice?: string;
    tradingHalted?: boolean;
    error?: string;
  };
}

export function RobinhoodQuote({ data }: RobinhoodQuoteProps) {
  if (data.error) {
    return (
      <div className="w-full rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/50">
        <p className="text-sm text-red-600 dark:text-red-400">{data.error}</p>
      </div>
    );
  }

  const isPositive = data.change?.startsWith("+");

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <h3 className="text-lg font-bold">{data.symbol}</h3>
          {data.tradingHalted && (
            <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              Trading Halted
            </span>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{data.lastPrice}</p>
          <p
            className={`text-sm font-medium ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
          >
            {data.change} ({data.changePercent})
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 p-4">
        <div>
          <p className="text-xs text-muted-foreground">Bid</p>
          <p className="font-medium">{data.bidPrice}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Ask</p>
          <p className="font-medium">{data.askPrice}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Prev Close</p>
          <p className="font-medium">{data.previousClose}</p>
        </div>
        {data.extendedHoursPrice && data.extendedHoursPrice !== "N/A" && (
          <div>
            <p className="text-xs text-muted-foreground">After Hours</p>
            <p className="font-medium">{data.extendedHoursPrice}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export interface RobinhoodAccountProps {
  data: {
    accountNumber?: string;
    buyingPower?: string;
    cash?: string;
    cashAvailableForWithdrawal?: string;
    accountType?: string;
    state?: string;
    error?: string;
  };
}

export function RobinhoodAccount({ data }: RobinhoodAccountProps) {
  if (data.error) {
    return (
      <div className="w-full rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/50">
        <p className="text-sm text-red-600 dark:text-red-400">{data.error}</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
      <div className="border-b bg-muted/30 px-4 py-3">
        <h3 className="font-semibold">Account Information</h3>
        <p className="text-xs text-muted-foreground">
          Account #{data.accountNumber}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 p-4">
        <div>
          <p className="text-xs text-muted-foreground">Buying Power</p>
          <p className="font-semibold">{data.buyingPower}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Cash</p>
          <p className="font-semibold">{data.cash}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Available to Withdraw</p>
          <p className="font-semibold">{data.cashAvailableForWithdrawal}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Account Type</p>
          <p className="font-semibold capitalize">{data.accountType}</p>
        </div>
      </div>
    </div>
  );
}
