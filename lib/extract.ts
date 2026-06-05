import Anthropic from "@anthropic-ai/sdk";
import { ExtractedReceipt, ExpenseCategory, Currency } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function extractReceiptData(
  base64Image: string,
  mediaType: string,
  fileName: string
): Promise<Partial<ExtractedReceipt>> {
  const prompt = `You are extracting data from a travel/expense receipt. Analyze this image and return a JSON object with these fields:
- date: ISO date string (YYYY-MM-DD)
- description: brief description of the expense in English
- amount: numeric amount (no currency symbol, just number)
- currency: one of IDR, CNY, USD, SGD, MYR, EUR
- category: one of:
  - "transportation_intercity" (flights, trains, intercity buses between cities)
  - "transportation_urban" (taxis, ride-hailing, city buses, within same city)
  - "accommodation" (hotels, guesthouses)
  - "other"
- origin: departure location (city or address, if applicable)
- destination: arrival location (city or address, if applicable)
- vendor: company/service name (e.g. "MyBluebird", "Bluebird", "Garuda Indonesia")

Rules:
- If the receipt is a ride-hailing app (Gojek, Grab, Bluebird, Maxim) going to/from an airport, check if it crosses cities:
  - Same city airport transfer → "transportation_urban"
  - Between cities → "transportation_intercity"
- Return ONLY valid JSON, no markdown, no explanation.

Example output:
{"date":"2026-05-09","description":"MyBluebird taxi from Grand INNA Hotel to Juanda Airport","amount":112000,"currency":"IDR","category":"transportation_urban","origin":"Grand INNA Hotel, Surabaya","destination":"Juanda Airport Terminal 2, Surabaya","vendor":"MyBluebird"}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: base64Image,
            },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  try {
    const parsed = JSON.parse(text.trim());
    return {
      fileName,
      date: parsed.date || new Date().toISOString().split("T")[0],
      description: parsed.description || fileName,
      amount: Number(parsed.amount) || 0,
      currency: (parsed.currency as Currency) || "IDR",
      category: (parsed.category as ExpenseCategory) || "other",
      origin: parsed.origin || "",
      destination: parsed.destination || "",
      vendor: parsed.vendor || "",
    };
  } catch {
    return {
      fileName,
      date: new Date().toISOString().split("T")[0],
      description: fileName,
      amount: 0,
      currency: "IDR",
      category: "other",
    };
  }
}

export function computeAllowanceDays(receipts: Partial<ExtractedReceipt>[]): {
  startDate: string;
  endDate: string;
  days: number;
} {
  const dates = receipts
    .map((r) => r.date)
    .filter(Boolean)
    .sort() as string[];
  if (dates.length === 0) {
    const today = new Date().toISOString().split("T")[0];
    return { startDate: today, endDate: today, days: 1 };
  }
  const start = dates[0];
  const end = dates[dates.length - 1];
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  const days = Math.floor(diffMs / 86400000) + 1;
  return { startDate: start, endDate: end, days };
}
