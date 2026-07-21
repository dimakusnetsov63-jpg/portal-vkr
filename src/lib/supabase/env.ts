function readEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}. Check your .env.local file.`);
  }
  return value;
}

export const supabaseEnv = {
  url: () => readEnv("NEXT_PUBLIC_SUPABASE_URL"),
  publishableKey: () => readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
};
