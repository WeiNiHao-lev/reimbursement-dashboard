import { NextRequest, NextResponse } from "next/server";

const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // If Railway PDF service is configured, proxy the request to it
    if (PDF_SERVICE_URL) {
      const proxyFd = new FormData();
      for (const [key, value] of Array.from(formData.entries())) {
        if (key === "form") {
          proxyFd.append("form", value as string);
        } else if (key.startsWith("receipt_") && value instanceof File) {
          proxyFd.append("files", value, value.name);
        }
      }

      const res = await fetch(`${PDF_SERVICE_URL}/generate-pdf`, {
        method: "POST",
        body: proxyFd,
      });

      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json({ error: text || "PDF service error" }, { status: 500 });
      }

      const pdfBytes = await res.arrayBuffer();
      const formJson = formData.get("form") as string;
      const form = JSON.parse(formJson);
      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="Reimbursement ${form.month}.pdf"`,
        },
      });
    }

    // Fallback: use pdf-lib local generation (no Excel template)
    const { buildPDFFallback } = await import("./fallback");
    return buildPDFFallback(formData);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "PDF generation failed";
    console.error(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
