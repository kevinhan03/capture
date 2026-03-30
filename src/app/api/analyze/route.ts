import { NextRequest, NextResponse } from "next/server";
import { analyzeShoppingImage, type GeminiImageInput } from "@/lib/gemini";

interface AnalyzeRequestBody {
  /** Base64-encoded image (without data URI prefix, e.g. "/9j/4AAQ...") */
  base64Data: string;
  mimeType: GeminiImageInput["mimeType"];
}

export async function POST(req: NextRequest) {
  let body: AnalyzeRequestBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { base64Data, mimeType } = body;

  if (!base64Data || typeof base64Data !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid `base64Data` field." },
      { status: 400 }
    );
  }

  if (!mimeType) {
    return NextResponse.json(
      { error: "Missing `mimeType` field." },
      { status: 400 }
    );
  }

  try {
    const result = await analyzeShoppingImage({ base64Data, mimeType });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
