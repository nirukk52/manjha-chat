"use client";

/**
 * Plaid Link dialog component for connecting brokerage accounts.
 * Uses react-plaid-link to handle the Plaid OAuth flow.
 */

import { Building2, Check, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PlaidLinkOnSuccessMetadata } from "react-plaid-link";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

type LinkStep = "loading" | "ready" | "connecting" | "success" | "error";

interface PlaidLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function PlaidLinkDialog({
  open,
  onOpenChange,
  onSuccess,
}: PlaidLinkDialogProps) {
  const [step, setStep] = useState<LinkStep>("loading");
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [institutionName, setInstitutionName] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  const fetchLinkToken = useCallback(async () => {
    setStep("loading");
    setError(null);

    try {
      const response = await fetch("/api/plaid/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (data.success && data.linkToken) {
        setLinkToken(data.linkToken);
        setStep("ready");
      } else {
        setError(data.error || "Failed to initialize connection");
        setStep("error");
      }
    } catch {
      setError("Connection failed. Please try again.");
      setStep("error");
    }
  }, []);

  // Fetch link token when dialog opens
  useEffect(() => {
    if (open && !hasInitialized.current) {
      hasInitialized.current = true;
      fetchLinkToken();
    }
  }, [open, fetchLinkToken]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setStep("loading");
        setLinkToken(null);
        setError(null);
        setInstitutionName(null);
        hasInitialized.current = false;
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handlePlaidSuccess = useCallback(
    async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      setStep("connecting");
      setInstitutionName(metadata.institution?.name ?? null);

      try {
        const response = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicToken,
            institutionId: metadata.institution?.institution_id,
            institutionName: metadata.institution?.name,
          }),
        });

        const data = await response.json();

        if (data.success) {
          setStep("success");
          setTimeout(() => {
            onSuccess?.();
            onOpenChange(false);
          }, 1500);
        } else {
          setError(data.error || "Failed to connect account");
          setStep("error");
        }
      } catch {
        setError("Connection failed. Please try again.");
        setStep("error");
      }
    },
    [onSuccess, onOpenChange]
  );

  const handlePlaidExit = useCallback(
    (err: { error_message?: string } | null) => {
      if (err) {
        setError(err.error_message || "Connection was cancelled");
        setStep("error");
      }
    },
    []
  );

  const { open: openPlaidLink, ready: plaidReady } = usePlaidLink({
    token: linkToken,
    onSuccess: handlePlaidSuccess,
    onExit: handlePlaidExit,
  });

  const handleOpenPlaidLink = useCallback(() => {
    if (plaidReady) {
      openPlaidLink();
    }
  }, [plaidReady, openPlaidLink]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-blue-500/10">
              <Building2 className="size-4 text-blue-500" />
            </div>
            Connect Brokerage Account
          </DialogTitle>
          <DialogDescription>
            {step === "loading" && "Preparing secure connection..."}
            {step === "ready" &&
              "Connect your brokerage account to sync your portfolio. Supports IBKR, Schwab, Fidelity, and 100+ more."}
            {step === "connecting" &&
              `Connecting to ${institutionName || "your brokerage"}...`}
            {step === "success" &&
              `Successfully connected to ${institutionName || "your brokerage"}!`}
            {step === "error" && "Connection failed."}
          </DialogDescription>
        </DialogHeader>

        {step === "loading" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Initializing secure connection...
            </p>
          </div>
        )}

        {step === "ready" && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <h4 className="mb-2 text-sm font-medium">Supported Brokerages</h4>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded bg-background px-2 py-1">
                  Interactive Brokers
                </span>
                <span className="rounded bg-background px-2 py-1">
                  Charles Schwab
                </span>
                <span className="rounded bg-background px-2 py-1">
                  Fidelity
                </span>
                <span className="rounded bg-background px-2 py-1">E*TRADE</span>
                <span className="rounded bg-background px-2 py-1">
                  Vanguard
                </span>
                <span className="rounded bg-background px-2 py-1">
                  + 100 more
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                onClick={() => onOpenChange(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={!plaidReady}
                onClick={handleOpenPlaidLink}
                type="button"
              >
                {plaidReady ? "Connect Account" : "Loading..."}
              </Button>
            </div>
          </div>
        )}

        {step === "connecting" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="size-8 animate-spin text-blue-500" />
            <p className="text-sm text-muted-foreground">
              Connecting to {institutionName || "your brokerage"}...
            </p>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex size-16 items-center justify-center rounded-full bg-green-500/10">
              <Check className="size-8 text-green-500" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Your {institutionName || "brokerage"} account is now connected.
              You can view your portfolio and holdings.
            </p>
          </div>
        )}

        {step === "error" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <X className="size-4 shrink-0" />
              {error}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                onClick={() => onOpenChange(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button onClick={fetchLinkToken} type="button">
                Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
