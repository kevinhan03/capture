const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const PROMPT = `이 캡쳐 이미지에서 쇼핑 가능한 아이템의 정보를 추출해주세요. 사진에 여러 아이템이 있다면 가장 메인이 되는 아이템 하나를 골라주세요. 정보가 명확하지 않으면 이미지의 분위기나 형태를 바탕으로 자연스럽게 추론해서 채워주세요.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    brand: {
      type: "STRING",
      description: "브랜드 이름 (알 수 없으면 '미상')",
    },
    itemName: {
      type: "STRING",
      description: "상품명 또는 아이템의 짧은 묘사",
    },
    price: {
      type: "STRING",
      description: "가격 정보 (알 수 없으면 '미정')",
    },
    styleKeywords: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "스타일 키워드 3개",
    },
  },
  required: ["brand", "itemName", "price", "styleKeywords"],
};

export interface ShoppingItem {
  brand: string;
  itemName: string;
  price: string;
  styleKeywords: string[];
}

export interface GeminiImageInput {
  /** Base64-encoded image data (without the data URI prefix) */
  base64Data: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 500;

/** Sleep for the given number of milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calls the Gemini API with exponential backoff retry logic.
 * Retries up to MAX_RETRIES times on transient errors (5xx, 429).
 */
export async function analyzeShoppingImage(
  image: GeminiImageInput
): Promise<ShoppingItem> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }

  const url = `${GEMINI_API_URL}?key=${apiKey}`;

  const body = JSON.stringify({
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: image.mimeType,
              data: image.base64Data,
            },
          },
          { text: PROMPT },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: "application/json",
      response_schema: RESPONSE_SCHEMA,
    },
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 500ms, 1000ms, 2000ms, 4000ms, 8000ms
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await sleep(delay);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } catch (networkError) {
      // Network-level failure — always retry
      lastError =
        networkError instanceof Error
          ? networkError
          : new Error(String(networkError));
      continue;
    }

    // Retry on rate-limit or server errors
    if (response.status === 429 || response.status >= 500) {
      const text = await response.text().catch(() => "");
      lastError = new Error(
        `Gemini API error ${response.status}: ${text.slice(0, 200)}`
      );
      continue;
    }

    if (!response.ok) {
      // Non-retryable client error (4xx except 429)
      const text = await response.text().catch(() => "");
      throw new Error(
        `Gemini API error ${response.status}: ${text.slice(0, 200)}`
      );
    }

    const json = await response.json();
    const rawText: string =
      json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    const parsed: ShoppingItem = JSON.parse(rawText);
    return parsed;
  }

  throw lastError ?? new Error("Gemini API request failed after max retries.");
}
