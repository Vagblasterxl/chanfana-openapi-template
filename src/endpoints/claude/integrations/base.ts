import { z } from "zod";

export const platforms = z.enum(["discord", "slack", "polar", "github", "manus", "email", "generic"]);
export const routeTargets = z.enum(["inbox", "debate", "preprocessor", "custom"]);
export const dispatchStatuses = z.enum(["pending", "sent", "failed"]);

// ============ SCHEMAS ============
export const createReceiverSchema = z.object({
  name: z.string().min(1),
  platform: platforms,
  secret: z.string().optional(),
  route_to: routeTargets,
  route_channel: z.string().optional(),
  route_config: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createDispatcherSchema = z.object({
  name: z.string().min(1),
  platform: platforms,
  endpoint_url: z.string().url(),
  auth_type: z.enum(["bearer", "bot", "basic", "hmac", "none"]).default("bearer"),
  auth_token: z.string().optional(),
  default_channel: z.string().optional(),
  rate_limit_per_minute: z.number().int().default(60),
  metadata: z.record(z.unknown()).optional(),
});

export const dispatchSchema = z.object({
  content: z.string().min(1),
  destination: z.string().optional(),
  embed: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createBridgeSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  source_type: z.enum(["webhook", "inbox", "debate"]),
  source_filter: z.record(z.unknown()).optional(),
  dest_type: z.enum(["dispatcher", "inbox", "debate", "preprocessor"]),
  dest_name: z.string().min(1),
  dest_config: z.record(z.unknown()).optional(),
  transform: z.enum(["none", "extract", "summarize", "custom"]).default("none"),
  transform_config: z.record(z.unknown()).optional(),
});

// ============ SIGNATURE VERIFICATION (Web Crypto API) ============
async function hmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifySlackSignature(body: string, timestamp: string, signature: string, secret: string): Promise<boolean> {
  const baseString = `v0:${timestamp}:${body}`;
  const hmac = await hmacSha256(secret, baseString);
  const expected = `v0=${hmac}`;
  return signature === expected;
}

export async function verifyPolarSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const hmac = await hmacSha256(secret, body);
  return signature === hmac;
}

export function verifyDiscordSignature(_body: string, _timestamp: string, signature: string, publicKey: string): boolean {
  // Discord uses Ed25519 - requires nacl library for full verification
  // For now, basic presence check - implement full verification with tweetnacl
  return signature.length > 0 && publicKey.length > 0;
}

// ============ PAYLOAD EXTRACTORS ============
export function extractSlackPayload(payload: Record<string, unknown>): { type: string; text: string; user: string; channel: string } {
  const event = payload.event as Record<string, unknown> || payload;
  return {
    type: (event.type as string) || (payload.type as string) || "message",
    text: (event.text as string) || "",
    user: (event.user as string) || (payload.user_id as string) || "unknown",
    channel: (event.channel as string) || (payload.channel_id as string) || "unknown",
  };
}

export function extractDiscordPayload(payload: Record<string, unknown>): { type: string; content: string; author: string; channel: string } {
  return {
    type: (payload.t as string) || "MESSAGE_CREATE",
    content: ((payload.d as Record<string, unknown>)?.content as string) || "",
    author: (((payload.d as Record<string, unknown>)?.author as Record<string, unknown>)?.username as string) || "unknown",
    channel: ((payload.d as Record<string, unknown>)?.channel_id as string) || "unknown",
  };
}

export function extractPolarPayload(payload: Record<string, unknown>): { type: string; data: Record<string, unknown> } {
  return {
    type: (payload.type as string) || "unknown",
    data: (payload.data as Record<string, unknown>) || payload,
  };
}

// ============ OUTBOUND FORMATTERS ============
export function formatSlackMessage(content: string, channel?: string): Record<string, unknown> {
  return {
    channel: channel || "general",
    text: content,
    unfurl_links: false,
  };
}

export function formatDiscordMessage(content: string, embed?: Record<string, unknown>): Record<string, unknown> {
  const msg: Record<string, unknown> = { content };
  if (embed) {
    msg.embeds = [embed];
  }
  return msg;
}

export function formatManusTask(content: string, metadata?: Record<string, unknown>): Record<string, unknown> {
  return {
    task: content,
    mode: "autonomous",
    ...metadata,
  };
}

export function generateWebhookPath(platform: string): string {
  const id = Math.random().toString(36).substr(2, 12);
  return `/hooks/${platform}/${id}`;
}
