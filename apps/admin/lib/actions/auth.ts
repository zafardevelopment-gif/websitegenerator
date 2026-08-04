"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createAdminSupabase } from "@aiwebsite/db/admin";
import { createServerSupabase } from "@aiwebsite/db/server";
import { countUsers } from "@aiwebsite/db/users";

import type { AuthState } from "../auth-state";

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

const otpSchema = z.object({
  email: z.string().trim().toLowerCase().email("Session lost — start again"),
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
});

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

/**
 * Step 1: send a 6-digit OTP.
 * Signup is only allowed for the very first user (they become the owner).
 * Everyone else must already exist in Supabase Auth (owner invites them via
 * Supabase → Authentication → Users → Invite user).
 */
export async function requestOtp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { step: "email", email: "", error: firstIssue(parsed.error), message: null };
  }
  const { email } = parsed.data;

  let isFirstUser: boolean;
  try {
    isFirstUser = (await countUsers(createAdminSupabase())) === 0;
  } catch (e) {
    return {
      step: "email",
      email,
      error: e instanceof Error ? e.message : "Could not reach the database.",
      message: null,
    };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: isFirstUser },
  });

  if (error) {
    const notInvited = /signups not allowed/i.test(error.message);
    return {
      step: "email",
      email,
      error: notInvited
        ? "This email is not on the team. Ask the owner to invite you (Supabase → Authentication → Users → Invite user)."
        : error.message,
      message: null,
    };
  }

  return {
    step: "otp",
    email,
    error: null,
    message: `We sent a 6-digit code to ${email}.`,
  };
}

/** Step 2: verify the OTP and open a session. */
export async function verifyOtp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = otpSchema.safeParse({
    email: formData.get("email"),
    token: formData.get("token"),
  });
  if (!parsed.success) {
    return {
      step: "otp",
      email: String(formData.get("email") ?? ""),
      error: firstIssue(parsed.error),
      message: null,
    };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });

  if (error) {
    return {
      step: "otp",
      email: parsed.data.email,
      error: "Invalid or expired code. Check the latest email or resend the code.",
      message: null,
    };
  }

  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
