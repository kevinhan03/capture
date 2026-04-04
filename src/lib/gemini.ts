const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const PROMPT = `이 이미지의 유형(패션/상품, 코디, 인테리어, 텍스트/프롬프트, 무드/영감, 음식, 기타 등)을 먼저 파악한 뒤, 각 필드를 아래 기준에 맞게 채워주세요.

- brand(출처): 패션/상품이면 브랜드명, 텍스트·프롬프트 캡쳐면 출처 계정이나 매체명, 무드/영감이면 작가·채널명. 알 수 없으면 '미상'
- itemName(핵심 내용): 패션이면 상품명, 텍스트/프롬프트면 핵심 내용 한 줄 요약, 코디/무드면 분위기·스타일 묘사, 음식이면 메뉴명
- price(참고 정보): 가격 정보가 있으면 가격, 없으면 플랫폼이나 맥락 정보(예: 'Instagram', '블로그', 'YouTube'). 아무것도 없으면 '없음'
- styleKeywords: 이미지를 잘 설명하는 키워드 3개`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    brand: {
      type: "STRING",
      description: "출처 (브랜드명, 계정명, 작가명 등. 알 수 없으면 '미상')",
    },
    itemName: {
      type: "STRING",
      description: "핵심 내용 (상품명, 요약, 스타일 묘사 등)",
    },
    price: {
      type: "STRING",
      description: "참고 정보 (가격, 플랫폼, 맥락 등. 없으면 '없음')",
    },
    styleKeywords: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "이미지를 설명하는 키워드 3개",
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
