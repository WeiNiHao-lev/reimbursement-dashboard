import { NextRequest, NextResponse } from "next/server";
import { extractReceiptData } from "@/lib/extract";

export async function POST(req: NextRequest) {
  // Manual mode: no API key configured
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "your_anthropic_api_key") {
    return NextResponse.json({ manual: true }, { status: 200 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const mediaType = file.type;
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mediaType)) {
      return NextResponse.json({ manual: true }, { status: 200 });
    }

    const result = await extractReceiptData(base64, mediaType, file.name);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
