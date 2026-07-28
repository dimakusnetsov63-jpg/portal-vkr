import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/auth/serverSession";
import { signPortalJwt } from "@/lib/auth/jwt";

/**
 * Короткоживущий токен для запросов браузера к данным (PostgREST).
 *
 * Выдаётся только под действующую сессию, поэтому отключённый или вышедший
 * пользователь новый токен не получит, а старый протухнет за 15 минут.
 * Ответ не кэшируется: он привязан к cookie конкретного пользователя.
 */
export async function GET() {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: "Нет действующей сессии" }, { status: 401 });
  }

  let jwt;
  try {
    jwt = await signPortalJwt({
      userId: session.user.id,
      sessionId: session.sessionId,
      role: session.user.role,
    });
  } catch {
    // Чаще всего — не задан SUPABASE_JWT_SECRET. Наружу подробности не
    // отдаём, но и молча «успех» вернуть нельзя: без токена данные не
    // загрузятся, и причину надо видеть.
    return NextResponse.json({ error: "Портал не настроен для выдачи токенов доступа" }, { status: 500 });
  }

  return NextResponse.json(
    { token: jwt.token, expires_at: jwt.expiresAt },
    { headers: { "Cache-Control": "no-store" } },
  );
}
