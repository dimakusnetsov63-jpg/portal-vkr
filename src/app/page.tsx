import { redirect } from "next/navigation";
import { PortalApp } from "@/components/portal/PortalApp";
import { getPortalSession } from "@/lib/auth/serverSession";

export default async function Home() {
  const session = await getPortalSession();

  // До сюда без сессии обычно не доходит — уводит middleware. Проверка
  // оставлена на случай, если портал окажется смонтирован в обход него:
  // страница не должна рендериться «наполовину авторизованной».
  if (!session) redirect("/login");

  return <PortalApp initialUser={session.user} />;
}
