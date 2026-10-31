import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { MemoryTopic } from "./topic-selector";

const validId = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);
function configuration() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const raw = process.env.JARVIS_MEMORY_ENCRYPTION_KEY;
  if (!url || !key || !raw) throw Error("TOPIC_MEMORY_NOT_CONFIGURED");
  const endpoint = new URL(url);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password ||
      endpoint.port || endpoint.pathname !== "/" || endpoint.search || endpoint.hash ||
      !/^[a-z0-9-]+\.supabase\.co$/i.test(endpoint.hostname))
    throw Error("INVALID_MEMORY_ENDPOINT");
  const secret = Buffer.from(raw, "base64");
  if (secret.length !== 32) throw Error("INVALID_MEMORY_KEY");
  return { origin: endpoint.origin, key, secret };
}
function encrypt(value: MemoryTopic, key: Buffer, owner: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(owner + ":" + value.id));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}
function decrypt(ciphertext: string, key: Buffer, owner: string, id: string): MemoryTopic {
  const bytes = Buffer.from(ciphertext, "base64");
  if (bytes.length < 29) throw Error("INVALID_TOPIC_CIPHERTEXT");
  const cipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
  cipher.setAuthTag(bytes.subarray(12, 28));
  cipher.setAAD(Buffer.from(owner + ":" + id));
  const value = JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString("utf8"));
  if (!value || value.id !== id || typeof value.title !== "string" || typeof value.summary !== "string")
    throw Error("INVALID_TOPIC");
  return { id, title: value.title.slice(0, 120), summary: value.summary.slice(0, 800),
    tags: Array.isArray(value.tags) ? value.tags.filter((t: unknown) => typeof t === "string").slice(0, 12) : [],
    sensitive: value.sensitive === true };
}
async function query(method: "GET" | "POST" | "DELETE", owner: string, id?: string, payload?: string, signal?: AbortSignal) {
  if (!validId(owner) || (id && !validId(id))) throw Error("INVALID_TOPIC_IDENTIFIER");
  const c = configuration();
  const url = new URL(c.origin + "/rest/v1/jarvis_memory_topics");
  url.searchParams.set("owner_id", "eq." + owner);
  if (id) url.searchParams.set("topic_id", "eq." + id);
  if (method === "GET") {
    url.searchParams.set("select", "topic_id,encrypted_payload");
    url.searchParams.set("limit", "201");
  }
  const response = await fetch(url, {
    method, redirect: "error", cache: "no-store",
    headers: { apikey: c.key, Authorization: "Bearer " + c.key,
      "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: method === "POST" ? JSON.stringify({ owner_id: owner, topic_id: id, encrypted_payload: payload }) : undefined,
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(4000)]) : AbortSignal.timeout(8000),
  });
  if (!response.ok) throw Error("TOPIC_STORAGE_UNAVAILABLE");
  return { response, secret: c.secret };
}
/** Owner identity must be checked by the authenticated caller; never accept it from a public request. */
export async function readMemoryTopics(owner: string, signal?: AbortSignal): Promise<MemoryTopic[]> {
  const { response, secret } = await query("GET", owner, undefined, undefined, signal);
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.length > 200) throw Error("INVALID_TOPIC_LIST");
  return rows.map((row) => {
    if (!row || typeof row.topic_id !== "string" || !validId(row.topic_id) || typeof row.encrypted_payload !== "string")
      throw Error("INVALID_TOPIC_ROW");
    return decrypt(row.encrypted_payload, secret, owner, row.topic_id);
  });
}
export async function writeMemoryTopic(owner: string, topic: MemoryTopic, signal?: AbortSignal): Promise<void> {
  if (!validId(owner) || !validId(topic.id) || typeof topic.title !== "string" ||
      !topic.title.trim() || topic.title.length > 120 || typeof topic.summary !== "string" ||
      topic.summary.length > 800 || (topic.tags !== undefined &&
      (!Array.isArray(topic.tags) || topic.tags.length > 12 ||
      !topic.tags.every((tag) => typeof tag === "string" && tag.length > 0 && tag.length <= 60))))
    throw Error("INVALID_TOPIC_INPUT");
  const c = configuration();
  const bounded: MemoryTopic = {
    id: topic.id,
    title: topic.title,
    summary: topic.summary,
    tags: topic.tags ? [...topic.tags] : [],
    sensitive: topic.sensitive === true,
  };
  await query("POST", owner, topic.id, encrypt(bounded, c.secret, owner), signal);
}
export async function deleteMemoryTopic(owner: string, id: string, signal?: AbortSignal): Promise<void> {
  await query("DELETE", owner, id, undefined, signal);
}
