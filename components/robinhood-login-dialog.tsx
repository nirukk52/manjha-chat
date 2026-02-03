"use client";

import { Loader2, ShieldCheck, Smartphone, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

type LoginStep =
  | "credentials"
  | "mfa"
  | "device-verification"
  | "success"
  | "error";

interface RobinhoodLoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function RobinhoodLoginDialog({
  open,
  onOpenChange,
  onSuccess,
}: RobinhoodLoginDialogProps) {
  const [step, setStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [challengeType, setChallengeType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      // Small delay to allow animation to complete
      const timer = setTimeout(() => {
        setStep("credentials");
        setEmail("");
        setPassword("");
        setMfaCode("");
        setChallengeId(null);
        setChallengeType(null);
        setError(null);
        setIsLoading(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleCredentialsSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setIsLoading(true);

      try {
        const response = await fetch("/api/robinhood", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "login", email, password }),
        });

        const data = await response.json();

        if (data.success) {
          setStep("success");
          setTimeout(() => {
            onSuccess?.();
            onOpenChange(false);
          }, 1500);
        } else if (data.shouldRetry) {
          // Verification was approved, retry login automatically
          const retryResponse = await fetch("/api/robinhood", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "login", email, password }),
          });
          const retryData = await retryResponse.json();

          if (retryData.success) {
            setStep("success");
            setTimeout(() => {
              onSuccess?.();
              onOpenChange(false);
            }, 1500);
          } else {
            setError(
              retryData.error ||
                "Login failed after verification. Please try again."
            );
          }
        } else if (data.deviceVerificationRequired) {
          // Push notification approval required (no code needed)
          setChallengeId(data.challengeId);
          setStep("device-verification");
        } else if (data.mfaRequired) {
          // MFA code required (SMS, email, or authenticator app)
          setChallengeId(data.challengeId);
          setChallengeType(data.challengeType);
          setStep("mfa");
        } else if (data.error?.includes("device verification")) {
          // Fallback for old error message format
          setStep("device-verification");
        } else {
          setError(
            data.error || "Login failed. Please check your credentials."
          );
        }
      } catch {
        setError("Connection failed. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [email, password, onSuccess, onOpenChange]
  );

  const handleMfaSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setIsLoading(true);

      try {
        const response = await fetch("/api/robinhood", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "login",
            email,
            password,
            mfaCode,
            challengeId,
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
          setError(data.error || "Invalid MFA code. Please try again.");
        }
      } catch {
        setError("Connection failed. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [email, password, mfaCode, challengeId, onSuccess, onOpenChange]
  );

  const handleDeviceVerificationRetry = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    // Helper to delay between retries
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    // Try up to 3 times with increasing delays (Robinhood's servers may need time to propagate)
    const maxRetries = 3;
    const retryDelays = [0, 2000, 3000]; // 0s, 2s, 3s

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        await delay(retryDelays[attempt]);
      }

      try {
        const response = await fetch("/api/robinhood", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "login", email, password }),
        });

        const data = await response.json();

        if (data.success) {
          setIsLoading(false);
          setStep("success");
          setTimeout(() => {
            onSuccess?.();
            onOpenChange(false);
          }, 1500);
          return;
        }

        // If shouldRetry is true, the verification was approved - retry login
        if (data.shouldRetry) {
          const retryResponse = await fetch("/api/robinhood", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "login", email, password }),
          });
          const retryData = await retryResponse.json();

          if (retryData.success) {
            setIsLoading(false);
            setStep("success");
            setTimeout(() => {
              onSuccess?.();
              onOpenChange(false);
            }, 1500);
            return;
          }
          // If retry failed, continue with error handling below
        }

        if (data.mfaRequired) {
          setIsLoading(false);
          setChallengeId(data.challengeId);
          setChallengeType(data.challengeType);
          setStep("mfa");
          return;
        }

        // Check if still needs device verification (either new format or old error)
        const stillPending =
          data.deviceVerificationRequired ||
          data.error?.includes("device verification") ||
          data.error?.includes("approve the login");

        // If not the last attempt and still pending, continue retrying
        if (attempt < maxRetries - 1 && stillPending) {
          continue;
        }

        // Last attempt or different error
        if (stillPending) {
          setError(
            "Verification still pending. Please approve on your Robinhood app, wait a moment, then try again."
          );
        } else {
          setError(data.error || "Login failed. Please try again.");
        }
        setIsLoading(false);
        return;
      } catch {
        if (attempt === maxRetries - 1) {
          setError("Connection failed. Please try again.");
          setIsLoading(false);
        }
      }
    }
  }, [email, password, onSuccess, onOpenChange]);

  const handleRequestNewVerification = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      // Reset device token to get a new verification
      await fetch("/api/robinhood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resetDevice" }),
      });

      // Now try login again - will trigger new verification
      const response = await fetch("/api/robinhood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email, password }),
      });

      const data = await response.json();

      if (data.success) {
        setStep("success");
        setTimeout(() => {
          onSuccess?.();
          onOpenChange(false);
        }, 1500);
      } else if (data.mfaRequired) {
        setChallengeId(data.challengeId);
        setChallengeType(data.challengeType);
        setStep("mfa");
      } else if (data.error?.includes("device verification")) {
        // New verification sent
        setError(null);
      } else {
        setError(data.error || "Login failed. Please try again.");
      }
    } catch {
      setError("Connection failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [email, password, onSuccess, onOpenChange]);

  const getMfaInstructions = () => {
    switch (challengeType) {
      case "sms":
        return "Enter the code sent to your phone via SMS.";
      case "email":
        return "Enter the code sent to your email.";
      default:
        return "Enter the code from your authenticator app.";
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-green-500/10">
              <ShieldCheck className="size-4 text-green-500" />
            </div>
            Connect to Robinhood
          </DialogTitle>
          <DialogDescription>
            {step === "credentials" &&
              "Enter your Robinhood credentials. Your information is only used to authenticate and is never stored."}
            {step === "mfa" && "Two-factor authentication is required."}
            {step === "device-verification" &&
              "Robinhood needs to verify this device."}
            {step === "success" && "Successfully connected to Robinhood!"}
            {step === "error" && "Connection failed."}
          </DialogDescription>
        </DialogHeader>

        {step === "credentials" && (
          <form className="space-y-4" onSubmit={handleCredentialsSubmit}>
            <div className="space-y-2">
              <Label htmlFor="rh-email">Email</Label>
              <Input
                autoComplete="email"
                autoFocus
                disabled={isLoading}
                id="rh-email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                type="email"
                value={email}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rh-password">Password</Label>
              <Input
                autoComplete="current-password"
                disabled={isLoading}
                id="rh-password"
                onChange={(e) => setPassword(e.target.value)}
                required
                type="password"
                value={password}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <X className="size-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                disabled={isLoading}
                onClick={() => onOpenChange(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={isLoading} type="submit">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect"
                )}
              </Button>
            </div>
          </form>
        )}

        {step === "mfa" && (
          <form className="space-y-4" onSubmit={handleMfaSubmit}>
            <div className="space-y-2">
              <Label htmlFor="rh-mfa">Verification Code</Label>
              <p className="text-sm text-muted-foreground">
                {getMfaInstructions()}
              </p>
              <Input
                autoFocus
                className="text-center text-lg tracking-widest"
                disabled={isLoading}
                id="rh-mfa"
                inputMode="numeric"
                maxLength={6}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                pattern="[0-9]*"
                placeholder="000000"
                required
                type="text"
                value={mfaCode}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <X className="size-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                disabled={isLoading}
                onClick={() => {
                  setStep("credentials");
                  setMfaCode("");
                  setError(null);
                }}
                type="button"
                variant="outline"
              >
                Back
              </Button>
              <Button disabled={isLoading || mfaCode.length < 6} type="submit">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify"
                )}
              </Button>
            </div>
          </form>
        )}

        {step === "device-verification" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="flex size-16 items-center justify-center rounded-full bg-blue-500/10">
                <Smartphone className="size-8 text-blue-500" />
              </div>
              <div className="space-y-2 text-center">
                <p className="text-sm text-muted-foreground">
                  Robinhood sent a verification request to your registered
                  device or email.
                </p>
                <p className="text-sm font-medium">
                  Please approve the login, then click Continue.
                </p>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <X className="size-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <div className="flex justify-end gap-2">
                <Button
                  disabled={isLoading}
                  onClick={() => {
                    setStep("credentials");
                    setError(null);
                  }}
                  type="button"
                  variant="outline"
                >
                  Back
                </Button>
                <Button
                  disabled={isLoading}
                  onClick={handleDeviceVerificationRetry}
                  type="button"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </div>
              <button
                className="text-center text-sm text-muted-foreground underline hover:text-foreground disabled:opacity-50"
                disabled={isLoading}
                onClick={handleRequestNewVerification}
                type="button"
              >
                Didn't receive it? Request new verification
              </button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex size-16 items-center justify-center rounded-full bg-green-500/10">
              <ShieldCheck className="size-8 text-green-500" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Your Robinhood account is now connected. You can view your
              portfolio and get real-time quotes.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
