/**
 * Discord interaction verification.
 *
 * Discord signs every interaction with Ed25519 over
 * `{x-signature-timestamp}{rawBody}` and publishes the matching public key on
 * the application's General Information page. Verification is mandatory, not
 * advisory: Discord will not even accept an interactions URL until the endpoint
 * answers a deliberately mis-signed probe with a non-2xx status, and an
 * endpoint that skipped the check would let anyone who learned the URL drive
 * the message bus.
 *
 * As with the Polar receiver, there is no unverified path. A missing
 * `DISCORD_PUBLIC_KEY` is an outage (`503`), never permission to trust the
 * request.
 */

const TOLERANCE_SECONDS = 300;

export type DiscordVerificationFailure =
  /** No key configured, or a configured key that is not 32 hex-encoded bytes. */
  | "public_key_not_configured"
  | "malformed_public_key"
  | "missing_signature"
  | "malformed_signature"
  | "missing_timestamp"
  | "malformed_timestamp"
  | "timestamp_out_of_tolerance"
  | "signature_mismatch";

export type DiscordVerificationResult =
  | { ok: true; timestamp: number }
  | { ok: false; reason: DiscordVerificationFailure };

/** Failures that mean *we* are misconfigured rather than the caller is wrong. */
export function isConfigurationFailure(
  reason: DiscordVerificationFailure,
): boolean {
  return (
    reason === "public_key_not_configured" || reason === "malformed_public_key"
  );
}

export async function verifyDiscordInteraction(
  rawBody: string,
  headers: Headers,
  publicKeyHex: string | undefined,
  now: Date = new Date(),
): Promise<DiscordVerificationResult> {
  if (!publicKeyHex || publicKeyHex.trim() === "") {
    return { ok: false, reason: "public_key_not_configured" };
  }

  const publicKeyBytes = hexToBytes(publicKeyHex.trim());
  // Ed25519 public keys are exactly 32 bytes; anything else is a pasted-wrong
  // value rather than a forged request.
  if (!publicKeyBytes || publicKeyBytes.byteLength !== 32) {
    return { ok: false, reason: "malformed_public_key" };
  }

  const signatureHex = headers.get("x-signature-ed25519");
  if (!signatureHex) {
    return { ok: false, reason: "missing_signature" };
  }
  const signature = hexToBytes(signatureHex.trim());
  if (!signature || signature.byteLength !== 64) {
    return { ok: false, reason: "malformed_signature" };
  }

  const timestampHeader = headers.get("x-signature-timestamp");
  if (!timestampHeader) {
    return { ok: false, reason: "missing_timestamp" };
  }
  if (!/^\d+$/.test(timestampHeader.trim())) {
    return { ok: false, reason: "malformed_timestamp" };
  }
  const timestamp = Number(timestampHeader.trim());

  // The timestamp is inside the signed message, so a replayed request carries
  // its original timestamp and cannot be back-dated. Rejecting stale ones caps
  // how long a captured interaction stays usable.
  const age = Math.abs(Math.floor(now.getTime() / 1000) - timestamp);
  if (age > TOLERANCE_SECONDS) {
    return { ok: false, reason: "timestamp_out_of_tolerance" };
  }

  const message = new TextEncoder().encode(`${timestampHeader.trim()}${rawBody}`);

  let key: CryptoKey;
  try {
    key = await importEd25519PublicKey(publicKeyBytes);
  } catch {
    return { ok: false, reason: "malformed_public_key" };
  }

  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      { name: key.algorithm.name },
      key,
      signature as BufferSource,
      message as BufferSource,
    );
  } catch {
    valid = false;
  }

  if (!valid) {
    return { ok: false, reason: "signature_mismatch" };
  }
  return { ok: true, timestamp };
}

/**
 * `Ed25519` is the standard WebCrypto name and what current workerd exposes.
 * Older runtimes only accept Cloudflare's original `NODE-ED25519` spelling, so
 * fall back to it rather than failing verification on a naming difference.
 */
async function importEd25519PublicKey(raw: Uint8Array): Promise<CryptoKey> {
  try {
    return await crypto.subtle.importKey(
      "raw",
      raw as BufferSource,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
  } catch {
    return await crypto.subtle.importKey(
      "raw",
      raw as BufferSource,
      { name: "NODE-ED25519", namedCurve: "NODE-ED25519" } as unknown as
        Parameters<typeof crypto.subtle.importKey>[2],
      false,
      ["verify"],
    );
  }
}

function hexToBytes(value: string): Uint8Array | null {
  if (value.length === 0 || value.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(value)) {
    return null;
  }
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
