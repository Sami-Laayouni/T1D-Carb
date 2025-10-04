import { type NextRequest, NextResponse } from "next/server";
import { analyzeImageWithGemini } from "@/lib/gemini";
import { enrichNutritionFromUSDA } from "@/lib/nutrition";

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

      // Skip FDC enrichment to avoid confusion with portion counts
      let enrichment: any = null;
      // try {
      //   enrichment = await enrichNutritionFromUSDA(gemini.foodName);
      // } catch (e) {
      //   console.log("[AnalyzeFood] FDC enrichment failed:", e);
      // }

      // ALWAYS use Gemini's portion-based estimates - NEVER override with FDC
      const finalCarbs = gemini.carbs;
      const finalProtein = gemini.protein;
      const finalFat = gemini.fat;
      const finalCalories = gemini.calories;

      // FDC data is only for additional information, never for overriding portion counts
      if (enrichment) {
        console.log(
          "[AnalyzeFood] FDC enrichment data (for reference only):",
          enrichment
        );
        console.log(
          "[AnalyzeFood] Using ONLY Gemini portion-based estimates:",
          {
            carbs: finalCarbs,
            protein: finalProtein,
            fat: finalFat,
            calories: finalCalories,
            servingSize: gemini.servingSize,
          }
        );
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
