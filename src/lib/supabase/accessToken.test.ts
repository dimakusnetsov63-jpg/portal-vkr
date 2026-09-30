import { afterEach, describe, expect, it, vi } from "vitest";
import { clearPortalAccessToken, fetchWithTokenRetry, tokenLifetimeMs } from "./accessToken";

function fakeJwt(payload: object): string {
  const segment = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `header.${segment}.signature`;
}

describe("tokenLifetimeMs", () => {
  it("берёт срок из iat/exp, а не из абсолютного времени", () => {
    expect(tokenLifetimeMs(fakeJwt({ iat: 1000, exp: 1900 }))).toBe(900_000);
  });

  it("возвращает null для нечитаемого токена", () => {
    expect(tokenLifetimeMs("not-a-jwt")).toBeNull();
    expect(tokenLifetimeMs(fakeJwt({ exp: 1900 }))).toBeNull();
    expect(tokenLifetimeMs(fakeJwt({ iat: 1900, exp: 1000 }))).toBeNull();
  });
});

describe("fetchWithTokenRetry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearPortalAccessToken();
  });

  it("при 401 берёт свежий токен и повторяет запрос один раз", async () => {
    const fresh = fakeJwt({ iat: 0, exp: 900 });
    const calls: { url: string; auth: string | null }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/auth/token") {
          return new Response(JSON.stringify({ token: fresh, expires_at: 900 }), { status: 200 });
        }
        calls.push({ url, auth: new Headers(init?.headers).get("Authorization") });
        return new Response("{}", { status: calls.length === 1 ? 401 : 200 });
      }),
    );

    const response = await fetchWithTokenRetry("https://db/rpc/save", {
      method: "POST",
      headers: { Authorization: "Bearer stale" },
      body: "{}",
    });

    expect(response.status).toBe(200);
    expect(calls).toEqual([
      { url: "https://db/rpc/save", auth: "Bearer stale" },
      { url: "https://db/rpc/save", auth: `Bearer ${fresh}` },
    ]);
  });

  it("не повторяет запрос, если ответ не 401", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithTokenRetry("https://db/rpc/save", { method: "POST" });

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
