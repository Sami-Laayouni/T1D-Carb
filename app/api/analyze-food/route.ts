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

      // Use AI to make smart predictions based on Gemini observations + FDC data
      console.log(
        "[AnalyzeFood] Using AI to predict final nutritional values..."
      );

      let aiResult;
      // Extract a numeric item count from Gemini servingSize/notes (e.g., "6 pancakes")
      const servingCountMatch = (gemini.servingSize || "").match(
        /\b(\d{1,3})\b/
      );
      const notesCountMatch = (gemini.notes || "").match(/\b(\d{1,3})\b/);
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
                foodName: gemini.foodName,
                servingSize: gemini.servingSize,
                notes: gemini.notes,
                confidence: gemini.confidence,
              },
              fdcData: enrichment ? [enrichment] : [],
            }),
          }
        );

        if (!aiResponse.ok) {
          throw new Error("AI prediction failed");
        }

        const aiResponseData = await aiResponse.json();
        aiResult = aiResponseData.result;
        // If we detected a count, enforce it in the AI result
        if (detectedCount && typeof aiResult?.itemCount === "number") {
          aiResult.itemCount = detectedCount;
        }
        console.log("[AnalyzeFood] AI prediction result:", aiResult);
      } catch (aiError) {
        console.error(
          "[AnalyzeFood] AI prediction failed, falling back to Gemini estimates:",
          aiError
        );
        // Fallback to Gemini's estimates if AI fails
        aiResult = {
          carbs: gemini.carbs,
          protein: gemini.protein,
          fat: gemini.fat,
          calories: gemini.calories,
          itemCount: detectedCount || 1,
          servingSize: gemini.servingSize,
          breakdown: "Fallback to Gemini estimates",
          confidence: gemini.confidence,
        };
      }

      const finalCarbs = aiResult.carbs;
      const finalProtein = aiResult.protein;
      const finalFat = aiResult.fat;
      const finalCalories = aiResult.calories;
      const itemCount = aiResult.itemCount;

      return NextResponse.json({
        foodName: gemini.foodName,
        carbs: Math.round(finalCarbs || 0),
        protein: Math.round(finalProtein || 0),
        fat: Math.round(finalFat || 0),
        calories: Math.round(finalCalories || 0),
        confidence: aiResult.confidence ?? gemini.confidence ?? 0.4,
        servingSize: aiResult.servingSize || gemini.servingSize || "1 serving",
        needsClarification,
        clarificationQuestion: needsClarification
          ? gemini.clarificationQuestion ||
            "Could you please provide more details about this food?"
          : null,
        enrichment,
        notes: gemini.notes,
        breakdown: aiResult.breakdown,
        itemCount: itemCount,
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
