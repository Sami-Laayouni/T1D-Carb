import { type NextRequest, NextResponse } from "next/server";
import { clarifyWithGeminiOrVertex } from "@/lib/gemini";
import { enrichNutritionFromUSDA } from "@/lib/nutrition";

// Helper function to estimate realistic serving sizes based on food type
function getRealisticServingSize(foodName: string, itemCount: number): number {
  const foodLower = foodName.toLowerCase();

  // Pancakes: ~40g each
  if (foodLower.includes("pancake")) {
    return 40;
  }

  // Bread slices: ~25g each
  if (foodLower.includes("bread") || foodLower.includes("toast")) {
    return 25;
  }

  // Rice: ~150g per serving
  if (foodLower.includes("rice")) {
    return 150;
  }

  // Pasta: ~100g per serving
  if (foodLower.includes("pasta") || foodLower.includes("noodle")) {
    return 100;
  }

  // Chicken breast: ~150g per piece
  if (foodLower.includes("chicken")) {
    return 150;
  }

  // Beef: ~100g per serving
  if (foodLower.includes("beef") || foodLower.includes("meat")) {
    return 100;
  }

  // Fish: ~120g per fillet
  if (
    foodLower.includes("fish") ||
    foodLower.includes("salmon") ||
    foodLower.includes("cod")
  ) {
    return 120;
  }

  // Oatmeal: ~50g per serving
  if (foodLower.includes("oatmeal") || foodLower.includes("oat")) {
    return 50;
  }

  // Default: 80g per item (reasonable for most foods)
  return 80;
}

export async function POST(request: NextRequest) {
  try {
    const {
      foodName,
      clarificationQuestion,
      userResponse,
      imageUrl,
      originalServingSize,
    } = await request.json();

    // Use Gemini clarifier
    const clarified = await clarifyWithGeminiOrVertex({
      foodName,
      clarificationQuestion,
      userResponse,
      imageUrl,
      originalServingSize,
    });

    // Enrich with FDC data for accurate nutritional values per item
    let enrichment: any = null;
    try {
      enrichment = await enrichNutritionFromUSDA(clarified.foodName);
    } catch (e) {
      console.log("[ClarifyFood] FDC enrichment failed:", e);
    }

    // Use AI to make smart predictions based on clarified Gemini observations + FDC data
    console.log(
      "[ClarifyFood] Using AI to predict final nutritional values..."
    );

    let aiResult;
    // Extract a numeric item count from clarified servingSize/notes
    const servingCountMatch = (clarified.servingSize || "").match(
      /\b(\d{1,3})\b/
    );
    const notesCountMatch = (clarified.notes || "").match(/\b(\d{1,3})\b/);
    const detectedCount = servingCountMatch
      ? parseInt(servingCountMatch[1], 10)
      : notesCountMatch
      ? parseInt(notesCountMatch[1], 10)
      : null;
    try {
      const aiResponse = await fetch(
        `${
          process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
        }/api/ai-predict-carbs`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            geminiObservations: {
              foodName: clarified.foodName,
              servingSize: clarified.servingSize,
              notes: clarified.notes,
              confidence: clarified.confidence,
            },
            fdcData: enrichment ? [enrichment] : [],
            clarificationResponse: userResponse,
          }),
        }
      );

      if (!aiResponse.ok) {
        throw new Error("AI prediction failed");
      }

      const aiResponseData = await aiResponse.json();
      aiResult = aiResponseData.result;
      if (detectedCount && typeof aiResult?.itemCount === "number") {
        aiResult.itemCount = detectedCount;
      }
      console.log("[ClarifyFood] AI prediction result:", aiResult);
    } catch (aiError) {
      console.error(
        "[ClarifyFood] AI prediction failed, falling back to Gemini estimates:",
        aiError
      );
      // Fallback to Gemini's estimates if AI fails
      aiResult = {
        carbs: clarified.carbs,
        protein: clarified.protein,
        fat: clarified.fat,
        calories: clarified.calories,
        itemCount: detectedCount || 1,
        servingSize: clarified.servingSize,
        breakdown: "Fallback to Gemini estimates",
        confidence: clarified.confidence,
      };
    }

    const finalCarbs = aiResult.carbs;
    const finalProtein = aiResult.protein;
    const finalFat = aiResult.fat;
    const finalCalories = aiResult.calories;
    const itemCount = aiResult.itemCount;

    return NextResponse.json({
      foodName: clarified.foodName,
      carbs: Math.round(finalCarbs || 0),
      protein: Math.round(finalProtein || 0),
      fat: Math.round(finalFat || 0),
      calories: Math.round(finalCalories || 0),
      confidence: aiResult.confidence,
      servingSize: aiResult.servingSize || clarified.servingSize || "1 serving",
      breakdown: aiResult.breakdown,
      itemCount: itemCount,
      enrichment,
    });
  } catch (error) {
    console.error("[ClarifyFood] Error in clarify-food:", error);
    return NextResponse.json(
      { error: "Failed to process clarification" },
      { status: 500 }
    );
  }
}
