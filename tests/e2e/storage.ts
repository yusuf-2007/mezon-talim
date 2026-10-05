import "dotenv/config";
import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Test-side access to the e2e MinIO bucket. Tests may use the AWS SDK directly;
 * the app may not (lib/storage is its swap boundary).
 *
 * The values are the MINIO_* env vars the server under test also gets:
 * playwright.config passes process.env through, and both sides fall back to
 * .env. Blank values count as unset, the same rule lib/env.ts applies.
 *
 * The suite deletes everything under `lesson-attachments/` in that bucket, so,
 * like db.ts, this refuses anything but a localhost endpoint — and, because a
 * developer's local MinIO is usually also their dev app's, any bucket whose
 * name does not say it is disposable ("e2e" or "test" in it). The repo's
 * .env points MINIO_BUCKET at the dev bucket; the e2e run must override it
 * (CI uses `mezon-e2e`). A refusal throws; global-setup and the spec turn it
 * into a warning and a skip, so the other specs still run.
 */

export const STORAGE_SKIP_REASON =
  "Lesson attachments need MinIO. Set MINIO_ENDPOINT, MINIO_PORT, MINIO_ACCESS_KEY, " +
  "MINIO_SECRET_KEY and MINIO_BUCKET (or MINIO_ATTACHMENTS_BUCKET) to a throwaway bucket " +
  "such as mezon-e2e. CI starts one; locally run `docker compose up -d minio`.";

/** A bucket the suite may empty: its name has to say it is disposable. */
const DISPOSABLE_BUCKET = /e2e|test/i;

/** Prefix the app stores every lesson attachment under (lib/attachments/keys.ts). */
export const ATTACHMENTS_PREFIX = "lesson-attachments/";

export type E2EStorage = { client: S3Client; bucket: string; endpoint: string };

function value(name: string): string | undefined {
  const v = process.env[name]?.trim().replace(/^["']|["']$/g, "").trim();
  return v ? v : undefined;
}

let cached: E2EStorage | null | undefined;

/** The e2e bucket, or null when attachment storage is not configured. */
export function e2eStorage(): E2EStorage | null {
  if (cached !== undefined) return cached;
  const host = value("MINIO_ENDPOINT");
  const accessKeyId = value("MINIO_ACCESS_KEY");
  const secretAccessKey = value("MINIO_SECRET_KEY");
  const bucket = value("MINIO_ATTACHMENTS_BUCKET") ?? value("MINIO_BUCKET");
  if (!host || !accessKeyId || !secretAccessKey || !bucket) {
    cached = null;
    return cached;
  }
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(
      `E2E storage refused: MINIO_ENDPOINT is "${host}". Only localhost is allowed, because the suite deletes objects.`,
    );
  }
  // The server under test resolves its bucket the same way
  // (MINIO_ATTACHMENTS_BUCKET ?? MINIO_BUCKET), so this is the bucket it
  // writes to as well as the one the suite wipes.
  if (!DISPOSABLE_BUCKET.test(bucket)) {
    throw new Error(
      `E2E storage refused: bucket "${bucket}" does not look disposable (its name must contain ` +
        `"e2e" or "test"), and the suite deletes everything under ${ATTACHMENTS_PREFIX} in it. ` +
        `Pass MINIO_BUCKET=mezon-e2e (or MINIO_ATTACHMENTS_BUCKET) for the e2e run.`,
    );
  }
  const ssl = ["true", "1", "yes", "on"].includes((value("MINIO_USE_SSL") ?? "").toLowerCase());
  const port = value("MINIO_PORT") ?? (ssl ? "443" : "9000");
  const endpoint = `${ssl ? "https" : "http"}://${host}:${port}`;
  cached = {
    bucket,
    endpoint,
    client: new S3Client({
      region: "us-east-1",
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
  return cached;
}

function isMissing(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } } | null;
  return e?.name === "NotFound" || e?.name === "NoSuchBucket" || e?.$metadata?.httpStatusCode === 404;
}

/** Create the bucket unless it already exists. Idempotent. */
export async function ensureBucket(s: E2EStorage): Promise<void> {
  try {
    await s.client.send(new HeadBucketCommand({ Bucket: s.bucket }));
  } catch (err) {
    if (!isMissing(err)) throw err;
    await s.client.send(new CreateBucketCommand({ Bucket: s.bucket }));
  }
}

/** Stored metadata of an object (what every GET of it will carry). */
export async function headObject(
  s: E2EStorage,
  key: string,
): Promise<{ contentType?: string; contentDisposition?: string }> {
  const res = await s.client.send(new HeadObjectCommand({ Bucket: s.bucket, Key: key }));
  return { contentType: res.ContentType, contentDisposition: res.ContentDisposition };
}

/** Whole object as bytes, or null when it does not exist. */
export async function getObject(s: E2EStorage, key: string): Promise<Buffer | null> {
  try {
    const res = await s.client.send(new GetObjectCommand({ Bucket: s.bucket, Key: key }));
    return res.Body ? Buffer.from(await res.Body.transformToByteArray()) : null;
  } catch (err) {
    if (isMissing(err) || (err as { name?: string }).name === "NoSuchKey") return null;
    throw err;
  }
}

export async function listKeys(s: E2EStorage, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const page = await s.client.send(
      new ListObjectsV2Command({ Bucket: s.bucket, Prefix: prefix, ContinuationToken: token }),
    );
    for (const o of page.Contents ?? []) if (o.Key) keys.push(o.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

/** Write one object (to plant bytes the app did not upload itself). */
export async function putObject(s: E2EStorage, key: string, body: Buffer, contentType: string) {
  if (!key.startsWith(ATTACHMENTS_PREFIX)) {
    throw new Error(`putObject refused: "${key}" is outside ${ATTACHMENTS_PREFIX}`);
  }
  await s.client.send(
    new PutObjectCommand({ Bucket: s.bucket, Key: key, Body: body, ContentType: contentType }),
  );
}

/** Delete every object under `prefix` (the suite only ever passes ATTACHMENTS_PREFIX or deeper). */
export async function wipePrefix(s: E2EStorage, prefix: string = ATTACHMENTS_PREFIX): Promise<void> {
  if (!prefix.startsWith(ATTACHMENTS_PREFIX)) {
    throw new Error(`wipePrefix refused: "${prefix}" is outside ${ATTACHMENTS_PREFIX}`);
  }
  const keys = await listKeys(s, prefix);
  for (let i = 0; i < keys.length; i += 1000) {
    await s.client.send(
      new DeleteObjectsCommand({
        Bucket: s.bucket,
        Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }
}
