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

export function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  return new GoogleGenerativeAI(apiKey);
}

const VISION_MODEL = "gemini-2.0-flash-exp";
const TEXT_MODEL = "gemini-2.0-flash-exp";

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
  const prompt = `You are a nutrition expert helping Type 1 Diabetics. Analyze the provided food image and identify ALL food items you can see. Be extremely thorough and descriptive.

Return STRICT JSON array with ALL detected food items. Each item should have: {
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
}

Example format:
[
  {
    "foodName": "Pancakes",
    "carbs": 30,
    "protein": 4,
    "fat": 3,
    "calories": 170,
    "confidence": 0.9,
    "servingSize": "6 pancakes",
    "notes": "Stack of 6 pancakes",
    "needsClarification": true,
    "clarificationQuestion": "What type of syrup is this?"
  },
  {
    "foodName": "Butter",
    "carbs": 0,
    "protein": 0,
    "fat": 11,
    "calories": 100,
    "confidence": 0.9,
    "servingSize": "3 pats",
    "notes": "1 pat on pancakes, 2 pats in dish",
    "needsClarification": false,
    "clarificationQuestion": ""
  }
] 

COMPREHENSIVE FOOD IDENTIFICATION RULES:
1. Look at the ENTIRE image - scan all areas for food items
2. Identify EVERY food item: main dishes, sides, drinks, condiments, garnishes
3. For complex meals, break down into individual components
4. Include beverages, sauces, dressings, bread, butter, etc.
5. ALWAYS separate different food types into different array items
6. If multiple plates/containers, analyze each area separately
7. NEVER return "Unknown food" - always try to identify something, even if uncertain
8. NEVER combine different foods into one item (e.g., "Pancakes with Syrup" should be separate items)

DETAILED COUNTING RULES:
1. COUNT EXACTLY what you see - be accurate and precise
2. If you see 6 pancakes, say "6 pancakes" - don't underestimate
3. Count ALL visible items: main dish, sides, drinks, condiments
4. Describe exact sizes and quantities for each component
5. The servingSize field should describe the main item
6. The notes field should list ALL items with their quantities
7. For nutrition values, provide rough estimates for the main item only

COMPLEX MEAL ANALYSIS:
- Main dish: Describe the primary food item with size/quantity
- Side items: List all sides with estimated amounts
- Beverages: Note any drinks with estimated volumes
- Condiments: Include sauces, dressings, butter, etc.
- Cooking methods: Note if items are fried, grilled, baked, etc.
- Overall context: Breakfast, lunch, dinner, snack, etc.

CONFIDENCE RULES:
- Use confidence 0.8-0.9 for clear, obvious food items
- Use confidence 0.6-0.7 for somewhat unclear but identifiable items
- Use confidence 0.4-0.5 for blurry or partially visible items
- NEVER use confidence below 0.3 unless the image is completely unidentifiable

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
    // Clean the text to extract JSON - handle both objects and arrays
    const jsonMatch = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    const jsonText = jsonMatch ? jsonMatch[0] : text;

    const parsed = JSON.parse(jsonText);

    // Handle array response - take the first item (main food)
    let foodData;
    if (Array.isArray(parsed)) {
      // Find the main food item (highest confidence or first item)
      foodData =
        parsed.find(
          (item) =>
            item.foodName && !item.foodName.toLowerCase().includes("butter")
        ) || parsed[0];
    } else {
      foodData = parsed;
    }
    const foodName = String(foodData.foodName || "Unknown food").toLowerCase();

    // If foodName is "unknown food" or empty, try to extract from notes
    let finalFoodName = foodData.foodName || "Unknown food";
    if (finalFoodName.toLowerCase() === "unknown food" && foodData.notes) {
      // Try to extract food name from notes
      const notesLower = foodData.notes.toLowerCase();
      if (notesLower.includes("pancake")) finalFoodName = "Pancakes";
      else if (notesLower.includes("bread")) finalFoodName = "Bread";
      else if (notesLower.includes("rice")) finalFoodName = "Rice";
      else if (notesLower.includes("pasta")) finalFoodName = "Pasta";
      else if (notesLower.includes("chicken")) finalFoodName = "Chicken";
      else if (notesLower.includes("beef")) finalFoodName = "Beef";
      else if (notesLower.includes("fish")) finalFoodName = "Fish";
      else if (notesLower.includes("milk")) finalFoodName = "Milk";
      else if (notesLower.includes("cheese")) finalFoodName = "Cheese";
      else if (notesLower.includes("oat")) finalFoodName = "Oatmeal";
    }

    // Force clarification for foods that need it, regardless of AI's decision
    let needsClarification = Boolean(foodData.needsClarification || false);
    let clarificationQuestion = foodData.clarificationQuestion || "";

    // Override AI decision for foods that should always ask for clarification
    const foodNameLower = finalFoodName.toLowerCase();
    if (
      foodNameLower.includes("pancake") ||
      foodNameLower.includes("syrup") ||
      foodNameLower.includes("bread") ||
      foodNameLower.includes("rice") ||
      foodNameLower.includes("pasta") ||
      foodNameLower.includes("chicken") ||
      foodNameLower.includes("beef") ||
      foodNameLower.includes("fish") ||
      foodNameLower.includes("milk") ||
      foodNameLower.includes("cheese") ||
      foodNameLower.includes("oatmeal")
    ) {
      if (foodNameLower.includes("pancake")) {
        needsClarification = true;
        if (foodNameLower.includes("syrup")) {
          clarificationQuestion =
            "What type of syrup is this? (maple syrup, high fructose corn syrup, or artificial sweetener?)";
        } else {
          clarificationQuestion =
            "How many pancakes do you see in this image? Please confirm the exact count.";
        }
      } else if (foodNameLower.includes("bread")) {
        needsClarification = true;
        clarificationQuestion =
          "Is this white bread, whole wheat, or multigrain?";
      } else if (foodNameLower.includes("rice")) {
        needsClarification = true;
        clarificationQuestion = "Is this white rice, brown rice, or wild rice?";
      } else if (foodNameLower.includes("pasta")) {
        needsClarification = true;
        clarificationQuestion = "Is this regular pasta or whole wheat pasta?";
      } else if (foodNameLower.includes("chicken")) {
        needsClarification = true;
        clarificationQuestion = "Is this chicken breast, thigh, or wing?";
      } else if (foodNameLower.includes("beef")) {
        needsClarification = true;
        clarificationQuestion =
          "Is this lean ground beef or regular ground beef?";
      } else if (foodNameLower.includes("fish")) {
        needsClarification = true;
        clarificationQuestion = "Is this salmon, cod, or another type of fish?";
      } else if (foodNameLower.includes("milk")) {
        needsClarification = true;
        clarificationQuestion = "Is this whole milk, 2%, 1%, or skim milk?";
      } else if (foodNameLower.includes("cheese")) {
        needsClarification = true;
        clarificationQuestion = "Is this regular cheese or low-fat cheese?";
      } else if (foodNameLower.includes("oatmeal")) {
        needsClarification = true;
        clarificationQuestion =
          "Is this plain oatmeal or flavored? What size portion do you see?";
      }
    }

    return {
      foodName: finalFoodName,
      carbs: Number(foodData.carbs || 0),
      protein: Number(foodData.protein || 0),
      fat: Number(foodData.fat || 0),
      calories: Number(foodData.calories || 0),
      confidence: Math.max(
        0.4,
        Math.min(1, Number(foodData.confidence || 0.5))
      ), // Minimum 0.4 confidence
      servingSize: String(foodData.servingSize || "1 serving"),
      notes: typeof foodData.notes === "string" ? foodData.notes : undefined,
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
      confidence: 0.4, // Higher minimum confidence
      servingSize: "1 serving",
      needsClarification: true,
      clarificationQuestion:
        "Could you please clarify what type of food this is?",
    };
  }
}
