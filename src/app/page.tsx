import { PortalApp } from "@/components/portal/PortalApp";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <PortalApp initialUserEmail={user?.email ?? null} />;
}
