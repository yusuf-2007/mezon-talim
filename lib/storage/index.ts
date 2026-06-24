import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl as presign } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

/**
 * MinIO (S3-compatible, self-hosted, in-country) — certificates and uploads.
 * All personal data / generated files stay in-country here; never send them to
 * an off-shore service (CLAUDE.md §1).
 *
 * Config-gated: when the MINIO_* env vars are absent (e.g. the preview deploy
 * with no in-country VPS), `isStorageConfigured()` is false and callers degrade
 * gracefully — certificates are generated on-demand instead of archived.
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

/** True only when MinIO is fully configured (endpoint + creds + bucket). */
export function isStorageConfigured(): boolean {
  return Boolean(
    env.MINIO_ENDPOINT &&
      env.MINIO_ACCESS_KEY &&
      env.MINIO_SECRET_KEY &&
      env.MINIO_BUCKET,
  );
}

const BUCKET = env.MINIO_BUCKET ?? "";

let cached: S3Client | null = null;

function client(): S3Client {
  if (!isStorageConfigured()) {
    throw new Error("lib/storage: MinIO is not configured (MINIO_* env vars).");
  }
  if (cached) return cached;
  const useSsl = env.MINIO_USE_SSL === true;
  const port = env.MINIO_PORT ?? (useSsl ? 443 : 9000);
  cached = new S3Client({
    // MinIO ignores region but the SDK requires one.
    region: "us-east-1",
    endpoint: `${useSsl ? "https" : "http"}://${env.MINIO_ENDPOINT}:${port}`,
    forcePathStyle: true, // required for MinIO
    credentials: {
      accessKeyId: env.MINIO_ACCESS_KEY!,
      secretAccessKey: env.MINIO_SECRET_KEY!,
    },
  });
  return cached;
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
