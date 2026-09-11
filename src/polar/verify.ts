/**
 * Standard Webhooks signature verification for Polar deliveries.
 *
 * Polar signs every delivery with the Standard Webhooks scheme:
 *
 *   signature = base64( HMAC_SHA256( key, `${webhook-id}.${webhook-timestamp}.${rawBody}` ) )
 *
 * sent as `webhook-signature: v1,<sig> [v1,<sig> ...]` (several entries while a
 * secret is being rotated).
 *
 * The key derivation depends on when the signing secret was generated. Secrets
 * issued before 2026-09-08 are "Polar HMAC": the literal secret string is
 * base64-encoded before being handed to the signer, so the effective key is the
 * raw UTF-8 bytes of the secret. Secrets issued on or after that instant follow
 * the spec: strip the `whsec_` prefix and base64-decode the remainder. Polar's
 * own SDKs verify against both candidates rather than asking the integrator
 * which era their secret came from, and so do we.
 */

/** Standard Webhooks default replay window. */
export const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

const WHSEC_PREFIX = "whsec_";

export type VerificationFailure =
  | "secret_not_configured"
  | "missing_headers"
  | "invalid_timestamp"
  | "timestamp_out_of_tolerance"
  | "no_matching_signature";

export type VerificationResult =
  | { ok: true; webhookId: string; timestamp: number }
  | { ok: false; reason: VerificationFailure };

/**
 * Verify a delivery. This never falls back to "accept" — a missing or empty
 * secret is reported as `secret_not_configured` so the caller can fail closed
 * instead of trusting an unauthenticated request.
 */
export async function verifyPolarWebhook(
  rawBody: string,
  headers: Headers,
  secret: string | undefined | null,
  now: Date = new Date(),
): Promise<VerificationResult> {
  if (!secret || secret.trim() === "") {
    return { ok: false, reason: "secret_not_configured" };
  }

  const webhookId = headers.get("webhook-id");
  const timestampHeader = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");

  if (!webhookId || !timestampHeader || !signatureHeader) {
    return { ok: false, reason: "missing_headers" };
  }

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp) || !Number.isInteger(timestamp)) {
    return { ok: false, reason: "invalid_timestamp" };
  }

  const skew = Math.abs(Math.floor(now.getTime() / 1000) - timestamp);
  if (skew > TIMESTAMP_TOLERANCE_SECONDS) {
    return { ok: false, reason: "timestamp_out_of_tolerance" };
  }

  const provided = parseSignatureHeader(signatureHeader);
  if (provided.length === 0) {
    return { ok: false, reason: "no_matching_signature" };
  }

  const signedContent = `${webhookId}.${timestamp}.${rawBody}`;
  const expected: string[] = [];
  for (const key of signingKeys(secret)) {
    expected.push(await sign(key, signedContent));
  }

  for (const candidate of provided) {
    for (const valid of expected) {
      if (timingSafeEqual(candidate, valid)) {
        return { ok: true, webhookId, timestamp };
      }
    }
  }

  return { ok: false, reason: "no_matching_signature" };
}

/** The key candidates a Polar secret can legitimately expand to. */
function signingKeys(secret: string): Uint8Array[] {
  const keys: Uint8Array[] = [new TextEncoder().encode(secret)];

  const remainder = secret.startsWith(WHSEC_PREFIX)
    ? secret.slice(WHSEC_PREFIX.length)
    : secret;
  const decoded = lenientBase64Decode(remainder);
  if (decoded && decoded.byteLength > 0) {
    keys.push(decoded);
  }

  return keys;
}

/** `v1,<sig> v1,<sig>` -> `[<sig>, <sig>]`, ignoring unknown versions. */
function parseSignatureHeader(header: string): string[] {
  const signatures: string[] = [];
  for (const part of header.split(" ")) {
    const separator = part.indexOf(",");
    if (separator === -1) {
      continue;
    }
    if (part.slice(0, separator) !== "v1") {
      continue;
    }
    const value = part.slice(separator + 1);
    if (value !== "") {
      signatures.push(value);
    }
  }
  return signatures;
}

async function sign(key: Uint8Array, content: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(content),
  );
  return base64Encode(new Uint8Array(mac));
}

/**
 * Matches the reference `standardwebhooks` decode: tolerate missing padding and
 * do not reject on trailing garbage. Returns null when the input cannot be
 * decoded at all, in which case the candidate key is simply dropped.
 */
function lenientBase64Decode(value: string): Uint8Array | null {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** Length-independent comparison, so a mismatch leaks no position. */
function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}
