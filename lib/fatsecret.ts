export interface FatSecretTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface FatSecretImageRecognitionRequest {
  image_b64: string;
  region?: string;
  language?: string;
  include_food_data?: boolean;
  eaten_foods?: unknown[];
}

export async function getFatSecretAccessToken(
  requestedScope?: string
): Promise<string> {
  const clientId = process.env.FATSECRET_CLIENT_ID;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing FATSECRET_CLIENT_ID or FATSECRET_CLIENT_SECRET env vars"
    );
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  // Prefer explicit scope from caller, then env, then a sensible default
  const preferredScope =
    requestedScope || process.env.FATSECRET_SCOPE || "basic";

  async function requestToken(scopeValue?: string): Promise<Response> {
    const params = new URLSearchParams({ grant_type: "client_credentials" });
    if (scopeValue) params.set("scope", scopeValue);

    return fetch("https://oauth.fatsecret.com/connect/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
  }

  // Try with preferred scope first
  console.log("[FatSecret] Requesting token", { scope: preferredScope });
  let response = await requestToken(preferredScope);
  if (!response.ok) {
    const text = await response.text();
    console.warn("[FatSecret] Token request failed", {
      status: response.status,
      text,
    });
    // If scope is invalid, retry with no scope, then with "basic" as a last resort
    if (/invalid_scope/i.test(text)) {
      console.log("[FatSecret] Retrying token with no scope");
      response = await requestToken(undefined);
      if (!response.ok) {
        const textNoScope = await response.text();
        console.warn("[FatSecret] Token retry (no scope) failed", {
          status: response.status,
          text: textNoScope,
        });
        if (/invalid_scope/i.test(textNoScope) || response.status >= 400) {
          // Final attempt: use basic
          console.log("[FatSecret] Final token retry with scope=basic");
          response = await requestToken("basic");
          if (!response.ok) {
            const finalText = await response.text();
            console.error("[FatSecret] Token request failed after retries", {
              status: response.status,
              text: finalText,
            });
            throw new Error(
              `FatSecret token error: ${response.status} ${finalText}`
            );
          }
        }
      }
    } else {
      console.error("[FatSecret] Token request failed with non-scope error", {
        status: response.status,
        text,
      });
      throw new Error(`FatSecret token error: ${response.status} ${text}`);
    }
  }

  const data = (await response.json()) as FatSecretTokenResponse;
  console.log("[FatSecret] Token acquired", {
    hasToken: !!data.access_token,
    expires_in: data.expires_in,
    scope: data.scope,
  });
  return data.access_token;
}

export async function callFatSecretImageRecognition(
  body: FatSecretImageRecognitionRequest
) {
  const token = await getFatSecretAccessToken();

  console.log("[FatSecret] Calling image recognition", {
    include_food_data: body.include_food_data,
    region: body.region,
    language: body.language,
    image_bytes: body.image_b64?.length,
  });

  const response = await fetch(
    "https://platform.fatsecret.com/rest/image-recognition/v1",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    console.error("[FatSecret] Image recognition failed", {
      status: response.status,
      text,
    });
    throw new Error(
      `FatSecret image recognition error: ${response.status} ${text}`
    );
  }

  const json = await response.json();
  console.log("[FatSecret] Image recognition response summary", {
    keys: Object.keys(json || {}),
    foodsCount:
      (Array.isArray(json?.foods) && json.foods.length) ||
      (Array.isArray(json?.results) && json.results.length) ||
      (Array.isArray(json?.food_response) && json.food_response.length) ||
      0,
  });
  return json;
}

export function pickBestFoodCandidate(recognitionJson: any) {
  const foods: any[] =
    recognitionJson?.foods ||
    recognitionJson?.food_response ||
    recognitionJson?.results ||
    [];
  if (!Array.isArray(foods) || foods.length === 0) return null;

  // Prefer items with nutritional data; fall back to first
  let best = foods.find(
    (f) => !!f.total_nutritional_content || Array.isArray(f?.food?.servings)
  );
  if (!best) best = foods[0];
  return best;
}

export function extractCarbsFromCandidate(candidate: any): {
  carbs?: number;
  foodName?: string;
} {
  if (!candidate) return {};

  // total_nutritional_content at top-level
  const total = candidate.total_nutritional_content;
  const foodName =
    candidate.food_entry_name ||
    candidate.food_name ||
    candidate?.food?.food_name;
  if (total && typeof total.carbohydrate === "number") {
    return { carbs: Number(total.carbohydrate), foodName };
  }

  // Look into food.servings array if present
  const servings = candidate?.food?.servings || candidate?.servings;
  if (Array.isArray(servings)) {
    const defaultServing =
      servings.find((s: any) => s.is_default === 1) || servings[0];
    if (defaultServing && typeof defaultServing.carbohydrate === "number") {
      return { carbs: Number(defaultServing.carbohydrate), foodName };
    }
  }

  return { foodName };
}
