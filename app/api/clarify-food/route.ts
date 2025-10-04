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

    // Calculate final nutrition using FDC data per item × count
    let finalCarbs = clarified.carbs;
    let finalProtein = clarified.protein;
    let finalFat = clarified.fat;
    let finalCalories = clarified.calories;

    if (enrichment) {
      console.log("[ClarifyFood] FDC enrichment data:", enrichment);

      // Extract count from serving size (e.g., "6 pancakes" -> 6)
      const countMatch = clarified.servingSize?.match(/(\d+)/);
      const itemCount = countMatch ? parseInt(countMatch[1]) : 1;

      console.log("[ClarifyFood] Detected item count:", itemCount);

      // Use FDC per-serving data if available, otherwise use per-100g data with estimated serving size
      if (enrichment.carbsPerServing) {
        finalCarbs = enrichment.carbsPerServing * itemCount;
        console.log(
          `[ClarifyFood] FDC carbs per serving: ${enrichment.carbsPerServing} × ${itemCount} = ${finalCarbs}`
        );
      } else if (enrichment.carbsPer100g) {
        // Estimate realistic serving size based on food type
        const estimatedServingGrams = getRealisticServingSize(
          clarified.foodName,
          itemCount
        );
        finalCarbs =
          ((enrichment.carbsPer100g * estimatedServingGrams) / 100) * itemCount;
        console.log(
          `[ClarifyFood] FDC carbs per 100g: ${enrichment.carbsPer100g} × ${estimatedServingGrams}g per item × ${itemCount} items = ${finalCarbs}`
        );
      }

      if (enrichment.proteinPerServing) {
        finalProtein = enrichment.proteinPerServing * itemCount;
      } else if (enrichment.proteinPer100g) {
        const estimatedServingGrams = getRealisticServingSize(
          clarified.foodName,
          itemCount
        );
        finalProtein =
          ((enrichment.proteinPer100g * estimatedServingGrams) / 100) *
          itemCount;
      }

      if (enrichment.fatPerServing) {
        finalFat = enrichment.fatPerServing * itemCount;
      } else if (enrichment.fatPer100g) {
        const estimatedServingGrams = getRealisticServingSize(
          clarified.foodName,
          itemCount
        );
        finalFat =
          ((enrichment.fatPer100g * estimatedServingGrams) / 100) * itemCount;
      }

      if (enrichment.caloriesPerServing) {
        finalCalories = enrichment.caloriesPerServing * itemCount;
      } else if (enrichment.caloriesPer100g) {
        const estimatedServingGrams = getRealisticServingSize(
          clarified.foodName,
          itemCount
        );
        finalCalories =
          ((enrichment.caloriesPer100g * estimatedServingGrams) / 100) *
          itemCount;
      }

      console.log("[ClarifyFood] Final calculated values:", {
        carbs: finalCarbs,
        protein: finalProtein,
        fat: finalFat,
        calories: finalCalories,
        itemCount,
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
