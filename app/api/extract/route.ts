import { NextRequest, NextResponse } from "next/server";
import { extractReceiptData } from "@/lib/extract";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    let mediaType = file.type;
    // Normalize PDF — Claude can handle PDF as image via base64 for single-page,
    // but for multi-page PDFs we'll just send first page indicator
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mediaType)) {
      // For PDFs and other formats, use a placeholder media type and note
      return NextResponse.json({
        error: "Only image files (JPG, PNG, WebP) are supported for AI extraction. PDFs will be included as receipts but cannot be auto-extracted."
      }, { status: 422 });
    }

    const result = await extractReceiptData(base64, mediaType, file.name);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
