import { type NextRequest, NextResponse } from "next/server";
import { analyzeImageWithGemini } from "@/lib/gemini";
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
    const formData = await request.formData();
    const image = formData.get("image") as File;

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Convert image to base64
    const bytes = await image.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString("base64");
    const mimeType = image.type || "image/jpeg";

    console.log("[AnalyzeFood] Received image", {
      name: (image as any)?.name,
      type: (image as any)?.type,
      size: (image as any)?.size,
      b64_len: base64Image.length,
    });

    // Analyze with Google Gemini Vision Pro
    try {
      const gemini = await analyzeImageWithGemini(base64Image, mimeType);
      console.log("[AnalyzeFood] Gemini result", gemini);

      // Use Gemini's clarification logic - the AI will determine if clarification is needed
      const needsClarification = gemini.needsClarification ?? false;

      // Enrich with FDC data for accurate nutritional values per item
      let enrichment: any = null;
      try {
        enrichment = await enrichNutritionFromUSDA(gemini.foodName);
      } catch (e) {
        console.log("[AnalyzeFood] FDC enrichment failed:", e);
      }

      // Calculate final nutrition using FDC data per item × count
      let finalCarbs = gemini.carbs;
      let finalProtein = gemini.protein;
      let finalFat = gemini.fat;
      let finalCalories = gemini.calories;

      if (enrichment) {
        console.log("[AnalyzeFood] FDC enrichment data:", enrichment);

        // Extract count from serving size (e.g., "6 pancakes" -> 6)
        const countMatch = gemini.servingSize?.match(/(\d+)/);
        const itemCount = countMatch ? parseInt(countMatch[1]) : 1;

        console.log("[AnalyzeFood] Detected item count:", itemCount);

        // Use FDC per-serving data if available, otherwise use per-100g data with realistic serving size
        if (enrichment.carbsPerServing) {
          finalCarbs = enrichment.carbsPerServing * itemCount;
          console.log(
            `[AnalyzeFood] FDC carbs per serving: ${enrichment.carbsPerServing} × ${itemCount} = ${finalCarbs}`
          );
        } else if (enrichment.carbsPer100g) {
          // Estimate realistic serving size based on food type
          const estimatedServingGrams = getRealisticServingSize(
            gemini.foodName,
            itemCount
          );
          finalCarbs =
            ((enrichment.carbsPer100g * estimatedServingGrams) / 100) *
            itemCount;
          console.log(
            `[AnalyzeFood] FDC carbs per 100g: ${enrichment.carbsPer100g} × ${estimatedServingGrams}g per item × ${itemCount} items = ${finalCarbs}`
          );
        }

        if (enrichment.proteinPerServing) {
          finalProtein = enrichment.proteinPerServing * itemCount;
        } else if (enrichment.proteinPer100g) {
          const estimatedServingGrams = getRealisticServingSize(
            gemini.foodName,
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
            gemini.foodName,
            itemCount
          );
          finalFat =
            ((enrichment.fatPer100g * estimatedServingGrams) / 100) * itemCount;
        }

        if (enrichment.caloriesPerServing) {
          finalCalories = enrichment.caloriesPerServing * itemCount;
        } else if (enrichment.caloriesPer100g) {
          const estimatedServingGrams = getRealisticServingSize(
            gemini.foodName,
            itemCount
          );
          finalCalories =
            ((enrichment.caloriesPer100g * estimatedServingGrams) / 100) *
            itemCount;
        }

        console.log("[AnalyzeFood] Final calculated values:", {
          carbs: finalCarbs,
          protein: finalProtein,
          fat: finalFat,
          calories: finalCalories,
          itemCount,
          servingSize: gemini.servingSize,
        });
      }

      return NextResponse.json({
        foodName: gemini.foodName,
        carbs: Math.round(finalCarbs || 0),
        protein: Math.round(finalProtein || 0),
        fat: Math.round(finalFat || 0),
        calories: Math.round(finalCalories || 0),
        confidence: gemini.confidence ?? 0.4,
        servingSize: gemini.servingSize || "1 serving",
        needsClarification,
        clarificationQuestion: needsClarification
          ? gemini.clarificationQuestion ||
            "Could you please provide more details about this food?"
          : null,
        enrichment,
        notes: gemini.notes,
      });
    } catch (ge) {
      console.error("[AnalyzeFood] Gemini analysis failed", ge);
      return NextResponse.json(
        { error: "Image analysis failed" },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("[AnalyzeFood] Error in analyze-food:", error);
    return NextResponse.json(
      { error: "Failed to analyze food" },
      { status: 500 }
    );
  }
}
