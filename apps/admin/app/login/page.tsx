import type { Metadata } from "next";

import { APP_NAME } from "@aiwebsite/config";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            A
          </div>
          <h1 className="text-xl font-semibold tracking-tight">AIVEXA</h1>
          <p className="text-sm text-muted-foreground">{APP_NAME}</p>
        </div>
        <LoginForm />
        <p className="text-center text-xs text-muted-foreground">
          Internal tool · Sign-in is by email code only. New team members must be invited by the
          owner.
        </p>
      </div>
    </div>
  );
}
