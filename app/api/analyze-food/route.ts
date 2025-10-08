import { type NextRequest, NextResponse } from "next/server";
import { analyzeImageWithGemini, getClient } from "@/lib/gemini";
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

      // Parse the Gemini response to extract all detected food items
      let detectedFoods = [];

      try {
        // The Gemini response should now be an array, but we need to get it from the raw response
        // First try to get the raw text from the Gemini response
        const client = getClient();
        const model = client.getGenerativeModel({
          model: "gemini-2.0-flash-exp",
        });

        // Re-analyze the image to get the array format
        const rawResponse = await model.generateContent({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `You are a nutrition expert helping Type 1 Diabetics. Analyze the provided food image and identify ALL food items you can see. Be extremely thorough and descriptive.

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
5. Be descriptive: "6 pancakes with maple syrup and butter" not just "pancakes"
6. If multiple plates/containers, analyze each area separately
7. NEVER return "Unknown food" - always try to identify something, even if uncertain

DETAILED COUNTING RULES:
1. COUNT EXACTLY what you see - be accurate and precise
2. If you see 6 pancakes, say "6 pancakes" - don't underestimate
3. Count ALL visible items: main dish, sides, drinks, condiments
4. Describe exact sizes and quantities for each component
5. The servingSize field should describe the main item
6. The notes field should list ALL items with their quantities
7. For nutrition values, provide rough estimates for the main item only

IMPORTANT: 
- For pancakes with syrup, ALWAYS ask about syrup type and verify portion count. The clarifying question should be simple and specific.
- Ensure servingSize field accurately reflects the actual count of items visible in the image.
- If you count 6 pancakes in your analysis, the servingSize must say "6 pancakes", not "2 pancakes".`,
                },
                {
                  inlineData: {
                    data: base64Image,
                    mimeType: mimeType,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1000,
          },
        });

        const rawText = rawResponse.response.text();
        console.log("[AnalyzeFood] Raw Gemini response:", rawText);

        // Try to parse the JSON array from the raw response
        const jsonMatch = rawText.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          const foodsArray = JSON.parse(jsonMatch[1]);
          console.log("[AnalyzeFood] Parsed multiple foods:", foodsArray);
          detectedFoods = foodsArray.map((food) => {
            // Calculate realistic carbs based on food type and quantity
            let realisticCarbs = food.carbs || 0;

            // Fix pancake carb estimates - 6 pancakes should be ~120-150g carbs
            if (food.foodName.toLowerCase().includes("pancake")) {
              const pancakeCount = parseInt(
                food.servingSize?.match(/\d+/)?.[0] || "1"
              );
              realisticCarbs = pancakeCount * 22; // ~22g carbs per pancake
            }

            // Fix syrup carb estimates - 2 tbsp should be ~26g carbs
            if (food.foodName.toLowerCase().includes("syrup")) {
              const tbspMatch = food.servingSize?.match(/(\d+)\s*tablespoon/i);
              if (tbspMatch) {
                const tbspCount = parseInt(tbspMatch[1]);
                realisticCarbs = tbspCount * 13; // ~13g carbs per tbsp
              }
            }

            return {
              foodName: food.foodName,
              quantity: food.servingSize || "1 serving",
              carbs: Math.round(realisticCarbs),
              confidence: food.confidence || 0.8,
            };
          });
        } else {
          console.log("[AnalyzeFood] No JSON array found, using single food");
          // Fallback to single food item
          detectedFoods = [
            {
              foodName: gemini.foodName,
              quantity: `${itemCount} ${aiResult.servingSize || "serving"}`,
              carbs: Math.round(finalCarbs || 0),
              confidence: aiResult.confidence ?? gemini.confidence ?? 0.4,
            },
          ];
        }
      } catch (parseError) {
        console.log(
          "[AnalyzeFood] Failed to parse multiple foods, using single item:",
          parseError
        );
        // Fallback to single food item
        detectedFoods = [
          {
            foodName: gemini.foodName,
            quantity: `${itemCount} ${aiResult.servingSize || "serving"}`,
            carbs: Math.round(finalCarbs || 0),
            confidence: aiResult.confidence ?? gemini.confidence ?? 0.4,
          },
        ];
      }

      console.log("[AnalyzeFood] Final detected foods:", detectedFoods);

      // Calculate totals from detected foods
      const totalCarbs = detectedFoods.reduce(
        (sum, food) => sum + food.carbs,
        0
      );
      const combinedFoodName = detectedFoods
        .map((food) => food.foodName)
        .join(", ");

      return NextResponse.json({
        foodName: combinedFoodName,
        carbs: totalCarbs,
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
        detectedFoods: detectedFoods,
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
