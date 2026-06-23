import "server-only";

/**
 * MinIO (S3-compatible, self-hosted, in-country) — certificates and uploads.
 * All personal data / generated files stay in-country here; never send them to
 * an off-shore service (CLAUDE.md §1).
 *
 * Phase 7 (certificates) wires the real client against the MINIO_* env vars.
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

const NOT_IMPLEMENTED =
  "lib/storage: MinIO client not implemented until Phase 7 (certificates).";

export function getStorageClient(): StorageClient {
  // TODO(phase-7): construct an S3 client pointed at the MinIO endpoint.
  throw new Error(NOT_IMPLEMENTED);
}
