import { type NextRequest, NextResponse } from "next/server";
import { clarifyWithGeminiOrVertex } from "@/lib/gemini";
import { enrichNutritionFromUSDA } from "@/lib/nutrition";

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

    // Skip FDC enrichment to avoid confusion with portion counts
    let enrichment: any = null;
    // try {
    //   enrichment = await enrichNutritionFromUSDA(clarified.foodName);
    // } catch (e) {
    //   console.log("[ClarifyFood] FDC enrichment failed:", e);
    // }

    // ALWAYS use clarified Gemini estimates - NEVER override with FDC
    const finalCarbs = clarified.carbs;
    const finalProtein = clarified.protein;
    const finalFat = clarified.fat;
    const finalCalories = clarified.calories;

    // FDC data is only for additional information, never for overriding portion counts
    if (enrichment) {
      console.log(
        "[ClarifyFood] FDC enrichment data (for reference only):",
        enrichment
      );
      console.log("[ClarifyFood] Using ONLY clarified Gemini estimates:", {
        carbs: finalCarbs,
        protein: finalProtein,
        fat: finalFat,
        calories: finalCalories,
        servingSize: clarified.servingSize,
      });
    }

    return NextResponse.json({
      foodName: clarified.foodName,
      carbs: Math.round(finalCarbs || 0),
      protein: Math.round(finalProtein || 0),
      fat: Math.round(finalFat || 0),
      calories: Math.round(finalCalories || 0),
      confidence: clarified.confidence,
      servingSize: clarified.servingSize || "1 serving",
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
