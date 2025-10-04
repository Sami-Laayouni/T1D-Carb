import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

export interface ClarifyParams {
  foodName: string;
  clarificationQuestion: string | null;
  userResponse?: string;
  imageUrl?: string | null;
  originalServingSize?: string;
}

export interface ClarifyResult {
  foodName: string;
  carbs: number;
  confidence: number;
  protein?: number;
  fat?: number;
  calories?: number;
  servingSize?: string;
}

export interface VisionResult {
  foodName: string;
  carbs: number;
  confidence: number;
  protein?: number;
  fat?: number;
  calories?: number;
  servingSize?: string;
  notes?: string;
  needsClarification?: boolean;
  clarificationQuestion?: string;
}

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  return new GoogleGenerativeAI(apiKey);
}

const VISION_MODEL = "gemini-2.0-flash";
const TEXT_MODEL = "gemini-2.0-flash";

export async function clarifyWithGeminiOrVertex(
  params: ClarifyParams
): Promise<ClarifyResult> {
  const systemPrompt =
    "You are a nutrition expert helping Type 1 Diabetics estimate macronutrients. Return STRICT JSON only with keys: foodName (string), carbs (number), protein (number), fat (number), calories (number), confidence (0..1), servingSize (string).";

  const userPrompt = `Original food: ${params.foodName}
Original serving size: ${params.originalServingSize || "not specified"}
Question asked: ${params.clarificationQuestion || "(none)"}
User's answer: ${params.userResponse || "(none)"}

CRITICAL: You must preserve the ORIGINAL portion count from the vision analysis. If the original analysis showed 6 pancakes, your clarification must also show 6 pancakes - do NOT reduce the portion count.

Based on the user's clarification, provide an updated nutrition estimate specific to this exact food mention. Consider how the user's answer affects the nutritional content:

- If they specified syrup type (maple vs high fructose corn syrup), adjust carbs accordingly
- If they specified bread type (white vs whole wheat), adjust fiber and carbs
- If they specified preparation method (fried vs grilled), adjust fat content
- If they specified portion size details, ONLY adjust if they explicitly mention a different count
- ALWAYS maintain the same number of items as originally detected in the image
- Use the original serving size as your baseline - do NOT change the portion count

Include all macronutrients and calories per serving. Be precise about portion sizes and explain any significant changes from the original estimate.`;

  try {
    const client = getClient();
    const model = client.getGenerativeModel({ model: TEXT_MODEL });

    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 500,
      },
    });

    const text = response.response.text();
    if (!text) throw new Error("Empty model response");

    console.log("[Gemini] Clarification result", { text });
    return safeParseClarifyJson(text);
  } catch (error) {
    console.error("[Gemini] Clarification failed", error);
    throw error;
  }
}

export async function analyzeImageWithGemini(
  imageB64: string,
  mimeType: string = "image/jpeg"
): Promise<VisionResult> {
  const prompt = `You are a nutrition expert helping Type 1 Diabetics. Analyze the provided food image and estimate macronutrients for the most likely single food item present. 

Return STRICT JSON only with: {
  "foodName": string, 
  "carbs": number, 
  "protein": number, 
  "fat": number, 
  "calories": number,
  "confidence": number, 
  "servingSize": string,
  "notes": string,
  "needsClarification": boolean,
  "clarificationQuestion": string
}. 

CRITICAL PORTION COUNTING RULES:
1. COUNT EXACTLY what you see in the image - be accurate and precise
2. If you see 6 pancakes, say "6 pancakes" - don't underestimate
3. Count all visible items accurately - don't be conservative if you can clearly see more
4. Describe the exact size and number of items visible
5. The servingSize field MUST match the actual count in your notes - if you see 6 pancakes, servingSize should say "6 pancakes"

MANDATORY CLARIFICATION RULES - ALWAYS set needsClarification to true and ask ONE specific question for:

1. SYRUPS & SWEETENERS (ALWAYS ask):
   - "What type of syrup is this? (maple syrup, high fructose corn syrup, or artificial sweetener?)"
   - "Is this honey, agave, or regular sugar?"

2. BREADS & GRAINS (ALWAYS ask):
   - "Is this white bread, whole wheat, or multigrain?"
   - "Is this white rice, brown rice, or wild rice?"
   - "Is this regular pasta or whole wheat pasta?"

3. MEATS & PROTEINS (ALWAYS ask):
   - "Is this chicken breast, thigh, or wing?"
   - "Is this lean ground beef or regular ground beef?"
   - "Is this salmon, cod, or another type of fish?"

4. DAIRY (ALWAYS ask):
   - "Is this whole milk, 2%, 1%, or skim milk?"
   - "Is this regular cheese or low-fat cheese?"

5. PREPARATION METHODS (ALWAYS ask):
   - "Is this fried, grilled, or baked?"
   - "Is this cooked with oil, butter, or cooking spray?"

6. PORTION ACCURACY (ALWAYS ask):
   - "How many pieces/servings do you see?"
   - "Is this a small, medium, or large portion?"
   - "Can you confirm the exact count of items visible?"

IMPORTANT: 
- For pancakes with syrup, ALWAYS ask about syrup type and verify portion count. The clarifying question should be simple and specific.
- Ensure servingSize field accurately reflects the actual count of items visible in the image.
- If you count 6 pancakes in your analysis, the servingSize must say "6 pancakes", not "2 pancakes".`;

  try {
    const client = getClient();
    const model = client.getGenerativeModel({ model: VISION_MODEL });

    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt,
            },
            {
              inlineData: {
                data: imageB64,
                mimeType: mimeType,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 500,
      },
    });

    const text = response.response.text();
    if (!text) throw new Error("Empty model response");

    console.log("[Gemini] Vision analysis result", { text });
    return safeParseVisionJson(text);
  } catch (error) {
    console.error("[Gemini] Vision analysis failed", error);
    throw error;
  }
}

function safeParseClarifyJson(text: string): ClarifyResult {
  try {
    // Clean the text to extract JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? jsonMatch[0] : text;

    const parsed = JSON.parse(jsonText);
    return {
      foodName: String(parsed.foodName || "Unknown food"),
      carbs: Number(parsed.carbs || 0),
      protein: Number(parsed.protein || 0),
      fat: Number(parsed.fat || 0),
      calories: Number(parsed.calories || 0),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0.3))),
      servingSize: String(parsed.servingSize || "1 serving"),
    };
  } catch (error) {
    console.error("[Gemini] Failed to parse clarification JSON", {
      text,
      error,
    });
    return {
      foodName: "Unknown food",
      carbs: 0,
      protein: 0,
      fat: 0,
      calories: 0,
      confidence: 0.3,
      servingSize: "1 serving",
    };
  }
}

function safeParseVisionJson(text: string): VisionResult {
  try {
    // Clean the text to extract JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? jsonMatch[0] : text;

    const parsed = JSON.parse(jsonText);
    const foodName = String(parsed.foodName || "Unknown food").toLowerCase();

    // Force clarification for foods that need it, regardless of AI's decision
    let needsClarification = Boolean(parsed.needsClarification || false);
    let clarificationQuestion = parsed.clarificationQuestion || "";

    // Override AI decision for foods that should always ask for clarification
    if (
      foodName.includes("pancake") ||
      foodName.includes("syrup") ||
      foodName.includes("bread") ||
      foodName.includes("rice") ||
      foodName.includes("pasta") ||
      foodName.includes("chicken") ||
      foodName.includes("beef") ||
      foodName.includes("fish") ||
      foodName.includes("milk") ||
      foodName.includes("cheese")
    ) {
      if (foodName.includes("pancake")) {
        needsClarification = true;
        if (foodName.includes("syrup")) {
          clarificationQuestion =
            "What type of syrup is this? (maple syrup, high fructose corn syrup, or artificial sweetener?)";
        } else {
          clarificationQuestion =
            "How many pancakes do you see in this image? Please confirm the exact count.";
        }
      } else if (foodName.includes("bread")) {
        needsClarification = true;
        clarificationQuestion =
          "Is this white bread, whole wheat, or multigrain?";
      } else if (foodName.includes("rice")) {
        needsClarification = true;
        clarificationQuestion = "Is this white rice, brown rice, or wild rice?";
      } else if (foodName.includes("pasta")) {
        needsClarification = true;
        clarificationQuestion = "Is this regular pasta or whole wheat pasta?";
      } else if (foodName.includes("chicken")) {
        needsClarification = true;
        clarificationQuestion = "Is this chicken breast, thigh, or wing?";
      } else if (foodName.includes("beef")) {
        needsClarification = true;
        clarificationQuestion =
          "Is this lean ground beef or regular ground beef?";
      } else if (foodName.includes("fish")) {
        needsClarification = true;
        clarificationQuestion = "Is this salmon, cod, or another type of fish?";
      } else if (foodName.includes("milk")) {
        needsClarification = true;
        clarificationQuestion = "Is this whole milk, 2%, 1%, or skim milk?";
      } else if (foodName.includes("cheese")) {
        needsClarification = true;
        clarificationQuestion = "Is this regular cheese or low-fat cheese?";
      }
    }

    return {
      foodName: String(parsed.foodName || "Unknown food"),
      carbs: Number(parsed.carbs || 0),
      protein: Number(parsed.protein || 0),
      fat: Number(parsed.fat || 0),
      calories: Number(parsed.calories || 0),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0.3))),
      servingSize: String(parsed.servingSize || "1 serving"),
      notes: typeof parsed.notes === "string" ? parsed.notes : undefined,
      needsClarification,
      clarificationQuestion,
    };
  } catch (error) {
    console.error("[Gemini] Failed to parse vision JSON", { text, error });
    return {
      foodName: "Unknown food",
      carbs: 0,
      protein: 0,
      fat: 0,
      calories: 0,
      confidence: 0.3,
      servingSize: "1 serving",
      needsClarification: true,
      clarificationQuestion:
        "Could you please clarify what type of food this is?",
    };
  }
}
