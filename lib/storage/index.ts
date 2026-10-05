import "server-only";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl as presign } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

/**
 * MinIO (S3-compatible, self-hosted, in-country) — certificates and uploads.
 * All personal data / generated files stay in-country here; never send them to
 * an off-shore service (CLAUDE.md §1).
 *
 * This module is the storage swap boundary: nothing outside lib/storage imports
 * the AWS SDK.
 *
 * Config-gated: when the MINIO_* env vars are absent (e.g. the preview deploy
 * with no in-country VPS), `isStorageConfigured()` is false and callers degrade
 * gracefully — certificates are generated on-demand instead of archived, and
 * lesson attachments are hidden (`isAttachmentStorageConfigured()`).
 */
export interface PutObjectInput {
  key: string;
  body: Uint8Array | Buffer | string;
  contentType?: string;
}

export interface StorageClient {
  putObject(input: PutObjectInput): Promise<{ key: string }>;
  /** Time-limited download URL for an object (e.g. a certificate PDF). */
  getSignedUrl(key: string, ttlSeconds?: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
}

/** Endpoint + credentials present (bucket checked separately per use). */
function hasStorageCredentials(): boolean {
  return Boolean(env.MINIO_ENDPOINT && env.MINIO_ACCESS_KEY && env.MINIO_SECRET_KEY);
}

/** True only when MinIO is fully configured (endpoint + creds + bucket). */
export function isStorageConfigured(): boolean {
  return hasStorageCredentials() && Boolean(env.MINIO_BUCKET);
}

/**
 * True when lesson attachments can be stored: endpoint + creds + a bucket
 * (MINIO_ATTACHMENTS_BUCKET, falling back to MINIO_BUCKET).
 */
export function isAttachmentStorageConfigured(): boolean {
  return hasStorageCredentials() && Boolean(env.MINIO_ATTACHMENTS_BUCKET ?? env.MINIO_BUCKET);
}

/** Bucket holding lesson attachments (originals + rendered slides). */
export function getAttachmentsBucket(): string {
  const bucket = env.MINIO_ATTACHMENTS_BUCKET ?? env.MINIO_BUCKET;
  if (!hasStorageCredentials() || !bucket) {
    throw new Error("lib/storage: attachment storage is not configured (MINIO_* env vars).");
  }
  return bucket;
}

const BUCKET = env.MINIO_BUCKET ?? "";

function internalEndpoint(): string {
  const useSsl = env.MINIO_USE_SSL === true;
  const port = env.MINIO_PORT ?? (useSsl ? 443 : 9000);
  return `${useSsl ? "https" : "http"}://${env.MINIO_ENDPOINT}:${port}`;
}

function makeClient(endpoint: string): S3Client {
  return new S3Client({
    // MinIO ignores the region but the SDK requires one; hosted S3-compatible
    // stores (Neon, AWS) sign with theirs, so it is configurable.
    region: env.MINIO_REGION ?? "us-east-1",
    endpoint,
    forcePathStyle: true, // required by MinIO and Neon Object Storage
    credentials: {
      accessKeyId: env.MINIO_ACCESS_KEY!,
      secretAccessKey: env.MINIO_SECRET_KEY!,
    },
  });
}

let cached: S3Client | null = null;
let cachedPublic: S3Client | null = null;

/** Client for server → MinIO traffic (put/head/get/delete). */
function client(): S3Client {
  if (!hasStorageCredentials()) {
    throw new Error("lib/storage: MinIO is not configured (MINIO_* env vars).");
  }
  if (cached) return cached;
  cached = makeClient(internalEndpoint());
  return cached;
}

/**
 * Client used ONLY to presign URLs that the browser calls. Signing is offline,
 * so this client never opens a connection; its endpoint just decides the host
 * baked into the URL (SigV4 query signatures cover the host, so it must be the
 * one the browser will actually hit).
 */
function publicClient(): S3Client {
  if (!env.MINIO_PUBLIC_URL) return client();
  if (!hasStorageCredentials()) {
    throw new Error("lib/storage: MinIO is not configured (MINIO_* env vars).");
  }
  if (cachedPublic) return cachedPublic;
  cachedPublic = makeClient(env.MINIO_PUBLIC_URL.replace(/\/+$/, ""));
  return cachedPublic;
}

function isNotFound(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  return (
    e.name === "NotFound" ||
    e.name === "NoSuchKey" ||
    e.Code === "NoSuchKey" ||
    e.$metadata?.httpStatusCode === 404
  );
}

export function getStorageClient(): StorageClient {
  const s3 = client();
  return {
    async putObject({ key, body, contentType }) {
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
      return { key };
    },
    async getSignedUrl(key, ttlSeconds = 300) {
      return presign(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
        expiresIn: ttlSeconds,
      });
    },
    async deleteObject(key) {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    },
  };
}

// ── Direct browser uploads + object helpers (lesson attachments) ────────────

export interface PresignedPost {
  /** Form action URL (path-style: {origin}/{bucket}). */
  url: string;
  /** Hidden form fields; append them BEFORE the `file` field. */
  fields: Record<string, string>;
}

/**
 * Presign a browser → bucket multipart POST upload.
 *
 * The policy pins everything the browser could otherwise choose: the exact
 * key (server-generated), the exact Content-Type, and the size window
 * [1, maxBytes]. A tampered request fails at MinIO with 403, before any bytes
 * land.
 */
export async function presignPost(input: {
  bucket?: string;
  key: string;
  contentType: string;
  maxBytes: number;
  ttlSeconds: number;
}): Promise<PresignedPost> {
  const bucket = input.bucket ?? BUCKET;
  const { url, fields } = await createPresignedPost(publicClient(), {
    Bucket: bucket,
    Key: input.key,
    Conditions: [
      ["eq", "$Content-Type", input.contentType],
      ["content-length-range", 1, input.maxBytes],
    ],
    // Every field gets an exact-match condition, and the key is pinned too.
    Fields: { "Content-Type": input.contentType },
    Expires: input.ttlSeconds,
  });
  return { url, fields };
}

/** Object size + content type, or null when the object does not exist. */
export async function headObject(
  key: string,
  bucket: string = BUCKET,
): Promise<{ size: number; contentType: string | null } | null> {
  try {
    const res = await client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { size: res.ContentLength ?? 0, contentType: res.ContentType ?? null };
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

/** Whole object as bytes, or null when it does not exist. */
export async function getObjectBytes(
  key: string,
  bucket: string = BUCKET,
): Promise<Uint8Array | null> {
  try {
    const res = await client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!res.Body) return null;
    return await res.Body.transformToByteArray();
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

/**
 * The first `length` bytes of an object (a ranged GET — for sniffing a file's
 * type without downloading all of it), or null when it does not exist.
 */
export async function getObjectHead(
  key: string,
  length: number,
  bucket: string = BUCKET,
): Promise<Uint8Array | null> {
  try {
    const res = await client().send(
      new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=0-${Math.max(1, length) - 1}` }),
    );
    if (!res.Body) return null;
    return await res.Body.transformToByteArray();
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

/**
 * Delete several keys. Best effort: never throws; returns false when any
 * batch failed (the caller logs and carries on — orphaned bytes are a storage
 * cost, not a correctness problem).
 */
export async function deleteObjects(keys: string[], bucket: string = BUCKET): Promise<boolean> {
  if (keys.length === 0) return true;
  let ok = true;
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    try {
      const res = await client().send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      if (res.Errors && res.Errors.length > 0) ok = false;
    } catch (err) {
      console.error("[storage] deleteObjects failed", err);
      ok = false;
    }
  }
  return ok;
}

/**
 * Delete every object under a prefix (e.g. one attachment's folder). Best
 * effort like deleteObjects. The prefix must end with "/" so a sibling sharing
 * the same leading characters can never match.
 */
export async function deletePrefix(prefix: string, bucket: string = BUCKET): Promise<boolean> {
  if (!prefix.endsWith("/") || prefix.length < 2) {
    throw new Error("lib/storage: deletePrefix needs a non-empty prefix ending in '/'.");
  }
  let ok = true;
  let token: string | undefined;
  try {
    do {
      const page = await client().send(
        new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
      );
      const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [o.Key] : []));
      if (keys.length > 0 && !(await deleteObjects(keys, bucket))) ok = false;
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  } catch (err) {
    console.error("[storage] deletePrefix failed", err);
    return false;
  }
  return ok;
}

/**
 * RFC 6266 / RFC 5987 Content-Disposition for a download: an ASCII-only
 * `filename` fallback plus the exact UTF-8 name in `filename*`. Control
 * characters, quotes and backslashes never reach the header.
 */
export function attachmentDisposition(filename: string): string {
  const cleaned = filename.replace(/[\u0000-\u001f\u007f]/g, "").trim() || "download";
  const ascii =
    cleaned
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7e]/g, "_")
      .replace(/["\\]/g, "_")
      .slice(0, 150) || "download";
  const encoded = encodeURIComponent(cleaned).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/**
 * Stamp an object with a download file name, stored WITH the object so every
 * GET of it carries `Content-Disposition: attachment`.
 *
 * Why not just the presigned GET's response-content-disposition override:
 * Neon Object Storage ignores it (and drops a Content-Disposition sent in a
 * browser POST upload), so a download would open inline and save as
 * "original". A server-side copy onto itself with REPLACE metadata works on
 * Neon, MinIO and AWS S3 alike, and never moves the bytes through the app.
 */
export async function setDownloadName(
  key: string,
  opts: { filename: string; contentType: string; bucket?: string },
): Promise<void> {
  const bucket = opts.bucket ?? BUCKET;
  await client().send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: key,
      CopySource: `${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`,
      MetadataDirective: "REPLACE",
      ContentType: opts.contentType,
      ContentDisposition: attachmentDisposition(opts.filename),
    }),
  );
}

/**
 * Short-lived presigned GET for the browser, forcing a download with the
 * given file name (MinIO and AWS echo the response-* overrides as headers; on
 * Neon the name comes from setDownloadName, stamped at finalize).
 */
export async function getSignedDownloadUrl(
  key: string,
  opts: { filename: string; ttlSeconds: number; bucket?: string; contentType?: string },
): Promise<string> {
  return presign(
    publicClient(),
    new GetObjectCommand({
      Bucket: opts.bucket ?? BUCKET,
      Key: key,
      ResponseContentDisposition: attachmentDisposition(opts.filename),
      ...(opts.contentType ? { ResponseContentType: opts.contentType } : {}),
      ResponseCacheControl: "no-store",
    }),
    { expiresIn: opts.ttlSeconds },
  );
}
