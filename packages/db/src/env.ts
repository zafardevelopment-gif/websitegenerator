export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.startsWith("your-") || value.includes("YOUR-PROJECT-REF")) {
    throw new Error(
      `Environment variable ${name} is missing or still a placeholder. ` +
        `Set it in apps/admin/.env.local (see .env.example at the repo root).`
    );
  }
  return value;
}

export function supabaseUrl(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function supabaseAnonKey(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
