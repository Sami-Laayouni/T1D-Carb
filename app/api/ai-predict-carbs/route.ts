import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/gemini";

const TEXT_MODEL = "gemini-2.0-flash-exp";

function extractCountFromText(text?: string): number | null {
  if (!text) return null;
  // Look for leading or embedded integer counts like "6 pancakes", "x6", etc.
  const countMatch = text.match(
    /\b(\d{1,3})\b\s*(pancake|pancakes|slice|slices|piece|pieces|pat|pats|item|items|taco|tacos|cookie|cookies|egg|eggs|waffle|waffles)\b/i
  );
  if (countMatch) return parseInt(countMatch[1], 10);
  const altMatch = text.match(/\b(x|×)\s*(\d{1,3})\b/i);
  if (altMatch) return parseInt(altMatch[2], 10);
  return null;
}

interface AIPredictionRequest {
  geminiObservations: {
    foodName: string;
    servingSize: string;
    notes: string;
    confidence: number;
  };
  fdcData: {
    foodName: string;
    carbsPer100g?: number;
    carbsPerServing?: number;
    proteinPer100g?: number;
    proteinPerServing?: number;
    fatPer100g?: number;
    fatPerServing?: number;
    caloriesPer100g?: number;
    caloriesPerServing?: number;
    servingDescription?: string;
    source: string;
  }[];
  clarificationResponse?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: AIPredictionRequest = await request.json();
    const { geminiObservations, fdcData, clarificationResponse } = body;

    console.log("[AIPredictCarbs] Request:", {
      geminiObservations,
      fdcDataCount: fdcData.length,
      hasClarification: !!clarificationResponse,
    });

    // Derive detected item count from serving size/notes
    const detectedCount =
      extractCountFromText(geminiObservations.servingSize) ||
      extractCountFromText(geminiObservations.notes) ||
      null;

    // Create a comprehensive prompt for the AI to make smart predictions
    const prompt = `
You are an expert nutritionist helping Type 1 Diabetics calculate accurate carbohydrate content for insulin dosing.

GEMINI VISION OBSERVATIONS:
- Main food: ${geminiObservations.foodName}
- Serving size: ${geminiObservations.servingSize}
- Detailed notes: ${geminiObservations.notes}
- Confidence: ${geminiObservations.confidence}
${detectedCount ? `- DETECTED ITEM COUNT: ${detectedCount}` : ""}

FDC NUTRITIONAL DATA (for reference):
${fdcData
  .map(
    (item, i) => `
Item ${i + 1}: ${item.foodName}
- Carbs per 100g: ${item.carbsPer100g || "N/A"}
- Carbs per serving: ${item.carbsPerServing || "N/A"}
- Protein per 100g: ${item.proteinPer100g || "N/A"}
- Fat per 100g: ${item.fatPer100g || "N/A"}
- Calories per 100g: ${item.caloriesPer100g || "N/A"}
- Serving description: ${item.servingDescription || "N/A"}
`
  )
  .join("\n")}

${clarificationResponse ? `USER CLARIFICATION: ${clarificationResponse}` : ""}

TASK: Use the Gemini observations to understand the ACTUAL meal composition and serving sizes, then use the FDC data as reference to calculate accurate nutritional values.

ANALYSIS STEPS:
1. Parse the Gemini notes to identify ALL food components and their quantities
2. Match each component to relevant FDC data
3. Calculate realistic serving sizes based on visual descriptions
4. Provide final nutritional estimates for the ENTIRE meal

IMPORTANT RULES:
- Use Gemini's visual observations as the primary source for quantities
- FDC data is for nutritional density reference only
- Consider the actual serving sizes described in Gemini's notes
- For complex meals, sum up all components
- Be realistic about portion sizes based on visual cues
- If Gemini says "6 pancakes", calculate for 6 pancakes, not 1
${
  detectedCount
    ? `- You MUST use exactly ${detectedCount} as the item count in your totals`
    : ""
}

Return JSON with:
{
  "carbs": number (total carbs for the entire meal),
  "protein": number (total protein for the entire meal),
  "fat": number (total fat for the entire meal),
  "calories": number (total calories for the entire meal),
  "itemCount": number (total number of main items),
  "servingSize": string (description of the full meal),
  "breakdown": string (detailed breakdown of how you calculated each component),
  "confidence": number (0-1, based on clarity of observations and FDC data quality)
}

Example calculation:
If Gemini sees "6 pancakes with syrup and butter" and FDC shows pancakes at 20g carbs per 100g:
- 6 pancakes × 40g each = 240g total
- 240g × (20g carbs / 100g) = 48g carbs from pancakes
- Add syrup and butter estimates
- Total: ~65g carbs for the entire meal
`;

    const client = getClient();
    const model = client.getGenerativeModel({ model: TEXT_MODEL });

    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 800,
      },
    });

    const text = response.response.text();
    if (!text) throw new Error("Empty AI response");

    console.log("[AIPredictCarbs] AI response:", text);

    // Parse the AI response robustly: strip code fences, support arrays or objects
    const cleaned = text
      .replace(/^```[a-zA-Z]*\n/m, "")
      .replace(/```$/m, "")
      .trim();

    const jsonMatch = cleaned.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in AI response");

    const parsed = JSON.parse(jsonMatch[0]);
    const aiResult = Array.isArray(parsed) ? parsed[0] : parsed;

    console.log("[AIPredictCarbs] Parsed result:", aiResult);

    return NextResponse.json({
      success: true,
      result: aiResult,
    });
  } catch (error) {
    console.error("[AIPredictCarbs] Error:", error);
    return NextResponse.json(
      { success: false, error: "AI prediction failed" },
      { status: 500 }
    );
  }
}
