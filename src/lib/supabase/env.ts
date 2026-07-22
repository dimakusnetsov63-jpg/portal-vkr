function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}. Check your .env.local file.`);
  }
  return value;
}

// NEXT_PUBLIC_* vars must be referenced via static `process.env.X` access so
// Next.js/Turbopack inlines them into the client bundle. Dynamic access like
// `process.env[name]` is NOT replaced and reads as undefined in the browser.
export const supabaseEnv = {
  url: () => requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  publishableKey: () =>
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
};
