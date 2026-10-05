/**
 * Prepare (and prove) the bucket that holds lesson attachments.
 *
 *   npm run storage:setup                 # reads .env.storage, then .env
 *   STORAGE_ENV_FILE=.env.foo npm run storage:setup
 *
 * Works for any S3-compatible store the app supports (MinIO, Neon Object
 * Storage, AWS S3). Reads the same MINIO_* variables the app reads, so a green
 * run here means the same values will work when pasted into Vercel.
 *
 * What it does, in order:
 *   1. checks the bucket exists (creates it if missing — private by default);
 *   2. sets the CORS rule teachers' browsers need: POST from the site origins
 *      (STORAGE_ORIGINS, comma-separated; defaults below);
 *   3. proves it end to end with the exact mechanism the app uses: a presigned
 *      POST upload, a CORS preflight as a browser would send it, HEAD, a ranged
 *      GET, the stored download name + a presigned download, then deletes the
 *      test object.
 *
 * Never prints secrets. Self-contained (no `server-only` imports), like the
 * other scripts here.
 */
import { config } from "dotenv";
import {
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  GetBucketCorsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// .env.storage first (credentials kept out of the main .env), then .env.
config({ path: process.env.STORAGE_ENV_FILE ?? ".env.storage" });
config();

const DEFAULT_ORIGINS = [
  "https://mezon-talim.vercel.app",
  "https://mezontalim.uz",
  "https://www.mezontalim.uz",
];

const blank = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

const endpointHost = blank(process.env.MINIO_ENDPOINT);
const accessKeyId = blank(process.env.MINIO_ACCESS_KEY);
const secretAccessKey = blank(process.env.MINIO_SECRET_KEY);
const bucketSetting = blank(process.env.MINIO_ATTACHMENTS_BUCKET) ?? blank(process.env.MINIO_BUCKET);
const useSsl = process.env.MINIO_USE_SSL === "true";
const port = Number(blank(process.env.MINIO_PORT) ?? (useSsl ? 443 : 9000));
const region = blank(process.env.MINIO_REGION) ?? "us-east-1";
const origins = (blank(process.env.STORAGE_ORIGINS)?.split(",") ?? DEFAULT_ORIGINS)
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

if (!endpointHost || !accessKeyId || !secretAccessKey || !bucketSetting) {
  fail(
    "Missing settings. Need MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY and " +
      "MINIO_ATTACHMENTS_BUCKET (or MINIO_BUCKET) — in .env.storage or the environment.",
  );
}
if (/^https?:\/\//.test(endpointHost)) {
  fail("MINIO_ENDPOINT must be the host only, without https:// (e.g. br-xxx.storage....neon.tech).");
}

// Narrowed once here: closures below do not inherit the checks above.
const bucket: string = bucketSetting;
const endpoint = `${useSsl ? "https" : "http"}://${endpointHost}:${port}`;
const s3 = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey },
});

const step = (n: number, text: string) => console.log(`\n${n}. ${text}`);
const ok = (text: string) => console.log(`   ✓ ${text}`);

async function main() {
  console.log(`Storage: ${endpoint}  region=${region}  bucket=${bucket}`);
  console.log(`Origins: ${origins.join(", ")}`);

  step(1, "Bucket");
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    ok("exists");
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 403) fail("access denied — check the access key/secret and that they can write (storage:write).");
    if (status !== 404) throw err;
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    ok("created (private)");
  }

  step(2, "CORS rule for browser uploads");
  try {
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: origins,
              AllowedMethods: ["POST"],
              AllowedHeaders: ["*"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );
    const cors = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
    const rule = cors.CORSRules?.[0];
    if (!rule?.AllowedMethods?.includes("POST")) fail("CORS rule did not stick.");
    ok(`POST allowed from ${rule.AllowedOrigins?.length ?? 0} origin(s)`);
  } catch (err) {
    // Self-hosted MinIO has no per-bucket CORS: it answers NotImplemented and
    // applies MINIO_API_CORS_ALLOW_ORIGIN server-wide. The preflight in step 3
    // is the real test either way.
    if ((err as { name?: string }).name !== "NotImplemented") throw err;
    console.log("   · this server sets CORS server-wide (MinIO: MINIO_API_CORS_ALLOW_ORIGIN); checking it below");
  }

  step(3, "End-to-end check (the app's own upload path)");
  const key = `lesson-attachments/_setup-check/${Date.now()}.txt`;
  const body = new TextEncoder().encode("mezon storage check");
  const post = await createPresignedPost(s3, {
    Bucket: bucket,
    Key: key,
    Conditions: [
      ["eq", "$Content-Type", "text/plain"],
      ["content-length-range", 1, 1024],
    ],
    Fields: { "Content-Type": "text/plain" },
    Expires: 120,
  });

  const preflight = await fetch(post.url, {
    method: "OPTIONS",
    headers: { Origin: origins[0], "Access-Control-Request-Method": "POST" },
  });
  const allowOrigin = preflight.headers.get("access-control-allow-origin");
  if (!preflight.ok || (allowOrigin !== origins[0] && allowOrigin !== "*")) {
    fail(`CORS preflight from ${origins[0]} refused (HTTP ${preflight.status}). Browsers would not be able to upload.`);
  }
  ok(`CORS preflight from ${origins[0]} accepted`);

  const form = new FormData();
  for (const [k, v] of Object.entries(post.fields)) form.append(k, v);
  form.append("file", new Blob([body], { type: "text/plain" }));
  const up = await fetch(post.url, { method: "POST", body: form });
  if (!up.ok) fail(`presigned POST upload failed: HTTP ${up.status} ${(await up.text()).slice(0, 300)}`);
  ok("presigned POST upload");

  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  if (head.ContentLength !== body.length) fail(`HEAD size ${head.ContentLength} ≠ ${body.length}`);
  ok("HEAD");

  const ranged = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: "bytes=0-4" }));
  const first = Buffer.from(await ranged.Body!.transformToByteArray()).toString();
  if (first !== "mezon") fail(`ranged GET returned "${first}"`);
  ok("ranged GET");

  // The app stamps the download name onto the stored original at finalize
  // (Neon ignores the presigned GET's response-content-disposition override).
  await s3.send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: key,
      CopySource: `${bucket}/${key}`,
      MetadataDirective: "REPLACE",
      ContentType: "text/plain",
      ContentDisposition: 'attachment; filename="check.txt"',
    }),
  );
  const dl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: 60,
  });
  const got = await fetch(dl);
  if (!got.ok) fail(`presigned download failed: HTTP ${got.status}`);
  const disposition = got.headers.get("content-disposition") ?? "";
  if (!disposition.startsWith("attachment")) {
    fail("downloads would open inline: the stored Content-Disposition was not kept by this store.");
  }
  ok(`presigned download saves as a file (${disposition})`);

  const anon = await fetch(`${endpoint}/${bucket}/${key}`);
  if (anon.ok) {
    console.warn("   ! the bucket allows ANONYMOUS reads — make it private, or view-only slides could be fetched unwatermarked.");
  } else {
    ok(`bucket is private (anonymous read → HTTP ${anon.status})`);
  }

  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  ok("test object deleted");

  console.log("\nAll good. Put the same MINIO_* values into Vercel (Production), leave MINIO_BUCKET unset");
  console.log("so certificate archiving stays off, and redeploy.");
}

main().catch((err) => fail(err instanceof Error ? `${err.name}: ${err.message}` : String(err)));
