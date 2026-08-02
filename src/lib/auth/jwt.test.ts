import { describe, expect, it } from "vitest";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  PORTAL_AUTH_CALLER_ROLE,
  SERVICE_TOKEN_TTL_SECONDS,
  buildJwtHeader,
  buildPortalPayload,
  buildPortalServicePayload,
  encodeJwt,
  signJwt,
} from "./jwt";

/**
 * Что здесь тестируется, а что нет — см. заголовочный комментарий jwt.ts.
 * Коротко: тестируется, что модуль честно строит корректно оформленный
 * ES256-токен. Примет ли этот конкретный токен PostgREST (тот ли `kid`,
 * импортирован ли ключ в Dashboard) — не тестируется здесь и не может быть
 * протестировано без сети; проверяется один раз вручную по
 * docs/ROLLOUT-jwt-signing-keys.md.
 */

function decodeSegment(segment: string): unknown {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/").padEnd(segment.length + ((4 - (segment.length % 4)) % 4), "=");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

describe("buildJwtHeader", () => {
  it("собирает заголовок ES256 с переданным kid", () => {
    expect(buildJwtHeader("test-kid-123")).toEqual({ alg: "ES256", kid: "test-kid-123", typ: "JWT" });
  });
});

describe("buildPortalPayload", () => {
  const now = 1_800_000_000;

  it("переносит userId/sessionId/role во claim'ы sub/sid/portal_role", () => {
    const payload = buildPortalPayload({ userId: "user-1", sessionId: "session-1", role: "head" }, now);
    expect(payload.sub).toBe("user-1");
    expect(payload.sid).toBe("session-1");
    expect(payload.portal_role).toBe("head");
  });

  it("выставляет role/aud=authenticated независимо от роли портала — правами база наделяет по таблице, не по claim'у", () => {
    const payload = buildPortalPayload({ userId: "u", sessionId: "s", role: "recruiter" }, now);
    expect(payload.role).toBe("authenticated");
    expect(payload.aud).toBe("authenticated");
  });

  it("считает exp от переданного времени, а не от Date.now() — функция чистая", () => {
    const payload = buildPortalPayload({ userId: "u", sessionId: "s", role: "head" }, now);
    expect(payload.iat).toBe(now);
    expect(payload.exp).toBe(now + ACCESS_TOKEN_TTL_SECONDS);
  });
});

describe("buildPortalServicePayload", () => {
  const now = 1_800_000_000;

  it("выставляет role=portal_auth_caller и не содержит sub/sid", () => {
    const payload = buildPortalServicePayload(now);
    expect(payload.role).toBe(PORTAL_AUTH_CALLER_ROLE);
    expect(payload.aud).toBe("authenticated");
    expect("sub" in payload).toBe(false);
    expect("sid" in payload).toBe(false);
  });

  it("живёт короче пользовательского токена", () => {
    expect(SERVICE_TOKEN_TTL_SECONDS).toBeLessThan(ACCESS_TOKEN_TTL_SECONDS);
    const payload = buildPortalServicePayload(now);
    expect(payload.exp).toBe(now + SERVICE_TOKEN_TTL_SECONDS);
  });
});

describe("encodeJwt", () => {
  it("даёт две base64url-части без символов, недопустимых в URL", () => {
    const encoded = encodeJwt({ alg: "ES256", kid: "k", typ: "JWT" }, { role: "authenticated" });
    const parts = encoded.split(".");
    expect(parts).toHaveLength(2);
    for (const part of parts) {
      expect(part).not.toMatch(/[+/=]/);
    }
  });

  it("кодирует header и payload так, что оба восстанавливаются декодированием — не теряет и не искажает данные", () => {
    const header = { alg: "ES256" as const, kid: "k-1", typ: "JWT" as const };
    const payload = { role: "authenticated", exp: 123, nested: { a: [1, 2, 3] } };
    const [headerPart, payloadPart] = encodeJwt(header, payload).split(".");
    expect(decodeSegment(headerPart)).toEqual(header);
    expect(decodeSegment(payloadPart)).toEqual(payload);
  });
});

describe("signJwt", () => {
  async function generateTestKeyPair() {
    return crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  }

  async function verify(signingInput: string, signatureB64Url: string, publicKey: CryptoKey): Promise<boolean> {
    const padded = signatureB64Url
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(signatureB64Url.length + ((4 - (signatureB64Url.length % 4)) % 4), "=");
    const signatureBytes = Uint8Array.from(Buffer.from(padded, "base64"));
    return crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      signatureBytes,
      new TextEncoder().encode(signingInput),
    );
  }

  it("производит подпись ES256, проверяемую соответствующим публичным ключом", async () => {
    const { privateKey, publicKey } = await generateTestKeyPair();
    const signingInput = "header-part.payload-part";
    const signature = await signJwt(signingInput, privateKey);
    await expect(verify(signingInput, signature, publicKey)).resolves.toBe(true);
  });

  it("не проходит проверку, если подписанные данные изменились после подписи", async () => {
    const { privateKey, publicKey } = await generateTestKeyPair();
    const signature = await signJwt("original-signing-input", privateKey);
    await expect(verify("tampered-signing-input", signature, publicKey)).resolves.toBe(false);
  });

  it("не проходит проверку чужим публичным ключом", async () => {
    const { privateKey } = await generateTestKeyPair();
    const { publicKey: unrelatedPublicKey } = await generateTestKeyPair();
    const signingInput = "header-part.payload-part";
    const signature = await signJwt(signingInput, privateKey);
    await expect(verify(signingInput, signature, unrelatedPublicKey)).resolves.toBe(false);
  });
});
