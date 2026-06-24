import { renderCertificatePdf } from "@/lib/certificates/service";

/**
 * Public-by-code certificate PDF. The verification code is the capability —
 * anyone holding it (the student, an employer verifying via /verify/:code) can
 * download the PDF. Revoked/unknown codes 404. Generated on-demand so it works
 * even where MinIO is unreachable (e.g. preview deploys).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const result = await renderCertificatePdf(code);
  if (!result) {
    return new Response("Certificate not found", { status: 404 });
  }
  return new Response(Buffer.from(result.bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${result.filename}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
