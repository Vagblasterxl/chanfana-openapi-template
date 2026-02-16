/**
 * Firebase / Firestore REST API client for Cloudflare Workers.
 * Uses the same Google Service Account JWT auth as the other Google services.
 *
 * Firestore REST API base:
 *   https://firestore.googleapis.com/v1/projects/{projectId}/databases/(default)/documents
 *
 * Set FIREBASE_PROJECT_ID as a var in wrangler, or pass it per-request.
 */

import { getAccessToken, GOOGLE_SCOPES } from "../google/auth";

const FIRESTORE_BASE = "https://firestore.googleapis.com/v1";

export interface FirestoreResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

async function firestoreFetch<T = unknown>(
  saJson: string,
  projectId: string,
  path: string,
  options?: {
    method?: string;
    body?: unknown;
    query?: Record<string, string>;
  },
): Promise<FirestoreResponse<T>> {
  const token = await getAccessToken(saJson, GOOGLE_SCOPES);
  const base = `${FIRESTORE_BASE}/projects/${projectId}/databases/(default)/documents`;
  const url = new URL(`${base}${path}`);

  if (options?.query) {
    for (const [k, v] of Object.entries(options.query)) {
      url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  const init: RequestInit = { method: options?.method || "GET", headers };

  if (options?.body) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  const res = await fetch(url.toString(), init);
  const data: T = await res.json();
  return { ok: res.ok, status: res.status, data };
}

// ---------- Collection CRUD ----------

export function listDocuments(
  saJson: string,
  projectId: string,
  collection: string,
  pageSize?: number,
  pageToken?: string,
) {
  const query: Record<string, string> = {};
  if (pageSize) query.pageSize = String(pageSize);
  if (pageToken) query.pageToken = pageToken;
  return firestoreFetch(saJson, projectId, `/${collection}`, { query });
}

export function getDocument(
  saJson: string,
  projectId: string,
  documentPath: string,
) {
  return firestoreFetch(saJson, projectId, `/${documentPath}`);
}

export function createDocument(
  saJson: string,
  projectId: string,
  collection: string,
  fields: Record<string, unknown>,
  documentId?: string,
) {
  const query: Record<string, string> = {};
  if (documentId) query.documentId = documentId;
  return firestoreFetch(saJson, projectId, `/${collection}`, {
    method: "POST",
    body: { fields: toFirestoreFields(fields) },
    query,
  });
}

export function updateDocument(
  saJson: string,
  projectId: string,
  documentPath: string,
  fields: Record<string, unknown>,
) {
  return firestoreFetch(saJson, projectId, `/${documentPath}`, {
    method: "PATCH",
    body: { fields: toFirestoreFields(fields) },
  });
}

export function deleteDocument(
  saJson: string,
  projectId: string,
  documentPath: string,
) {
  return firestoreFetch(saJson, projectId, `/${documentPath}`, {
    method: "DELETE",
  });
}

// ---------- Firestore value encoding ----------

function toFirestoreValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (typeof value === "boolean") return { booleanValue: value };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === "object") {
    return { mapValue: { fields: toFirestoreFields(value as Record<string, unknown>) } };
  }
  return { stringValue: String(value) };
}

function toFirestoreFields(
  obj: Record<string, unknown>,
): Record<string, Record<string, unknown>> {
  const fields: Record<string, Record<string, unknown>> = {};
  for (const [key, value] of Object.entries(obj)) {
    fields[key] = toFirestoreValue(value);
  }
  return fields;
}
