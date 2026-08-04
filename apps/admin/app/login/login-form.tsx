"use client";

import * as React from "react";
import { Loader2, Mail } from "lucide-react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  Label,
} from "@aiwebsite/ui";

import { requestOtp, verifyOtp } from "@/lib/actions/auth";
import { INITIAL_AUTH_STATE, type AuthState } from "@/lib/auth-state";

export function LoginForm() {
  const [requestState, requestAction, requestPending] = React.useActionState<AuthState, FormData>(
    requestOtp,
    INITIAL_AUTH_STATE
  );
  const [verifyState, verifyAction, verifyPending] = React.useActionState<AuthState, FormData>(
    verifyOtp,
    INITIAL_AUTH_STATE
  );
  // Let the user go back and change the email after a code was sent.
  const [changingEmail, setChangingEmail] = React.useState(false);

  const otpStep = requestState.step === "otp" && !changingEmail;
  const error = otpStep ? (verifyState.error ?? requestState.error) : requestState.error;

  React.useEffect(() => {
    if (requestState.step === "otp") setChangingEmail(false);
  }, [requestState]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{otpStep ? "Enter your code" : "Sign in"}</CardTitle>
        <CardDescription>
          {otpStep
            ? (requestState.message ?? `Enter the 6-digit code sent to ${requestState.email}.`)
            : "We'll email you a 6-digit one-time code."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!otpStep && (
          <form action={requestAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@aivexa.com"
                defaultValue={requestState.email}
                required
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={requestPending}>
              {requestPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Mail data-testid="mail-icon" />
              )}
              Send code
            </Button>
          </form>
        )}

        {otpStep && (
          <div className="space-y-4">
            <form action={verifyAction} className="space-y-4">
              <input type="hidden" name="email" value={requestState.email} />
              <div className="flex justify-center">
                <InputOTP maxLength={6} name="token" autoFocus>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button type="submit" className="w-full" disabled={verifyPending}>
                {verifyPending && <Loader2 className="animate-spin" />}
                Verify & sign in
              </Button>
            </form>
            <div className="flex items-center justify-between text-sm">
              <form action={requestAction}>
                <input type="hidden" name="email" value={requestState.email} />
                <Button type="submit" variant="link" size="sm" disabled={requestPending}>
                  Resend code
                </Button>
              </form>
              <Button type="button" variant="link" size="sm" onClick={() => setChangingEmail(true)}>
                Use a different email
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
