export interface EnrichedNutrition {
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
  source: "usda-fdc" | "none";
}

export async function enrichNutritionFromUSDA(
  query: string
): Promise<EnrichedNutrition | null> {
  try {
    const apiKey = process.env.FDC_API_KEY;
    if (!apiKey) return null;

    const searchUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(
      apiKey
    )}&pageSize=1&query=${encodeURIComponent(query)}`;
    const searchRes = await fetch(searchUrl);
    const searchJson = await searchRes.json();
    const food = searchJson?.foods?.[0];
    if (!food) return null;

    // Extract nutrition data from FDC
    const nutritionData = extractNutritionData(food);

    // Derive serving if available
    let servingDescription: string | undefined;
    const servingSize = Number(food?.servingSize);
    const servingUnit = food?.servingSizeUnit as string | undefined;
    if (servingSize && servingUnit) {
      servingDescription = `${servingSize} ${servingUnit}`;
    }

    return {
      foodName: String(food?.description || query),
      carbsPer100g: nutritionData.carbs,
      carbsPerServing: nutritionData.carbs
        ? calculatePerServing(nutritionData.carbs, servingSize, servingUnit)
        : undefined,
      proteinPer100g: nutritionData.protein,
      proteinPerServing: nutritionData.protein
        ? calculatePerServing(nutritionData.protein, servingSize, servingUnit)
        : undefined,
      fatPer100g: nutritionData.fat,
      fatPerServing: nutritionData.fat
        ? calculatePerServing(nutritionData.fat, servingSize, servingUnit)
        : undefined,
      caloriesPer100g: nutritionData.calories,
      caloriesPerServing: nutritionData.calories
        ? calculatePerServing(nutritionData.calories, servingSize, servingUnit)
        : undefined,
      servingDescription,
      source: "usda-fdc",
    };
  } catch (e) {
    console.error("FDC enrichment failed:", e);
    return null;
  }
}

function extractNutritionData(food: any) {
  const data = {
    carbs: undefined as number | undefined,
    protein: undefined as number | undefined,
    fat: undefined as number | undefined,
    calories: undefined as number | undefined,
  };

  // Try labelNutrients first (more reliable)
  if (food?.labelNutrients) {
    data.carbs = food.labelNutrients.carbohydrates?.value;
    data.protein = food.labelNutrients.protein?.value;
    data.fat = food.labelNutrients.fat?.value;
    data.calories = food.labelNutrients.energy?.value;
  }

  // Fallback to foodNutrients array
  if (Array.isArray(food?.foodNutrients)) {
    const nutrients = food.foodNutrients;

    // Carbohydrates (nutrient ID 1005)
    if (data.carbs === undefined) {
      const carb = nutrients.find((n: any) => n?.nutrientId === 1005);
      data.carbs = carb?.value;
    }

    // Protein (nutrient ID 1003)
    if (data.protein === undefined) {
      const protein = nutrients.find((n: any) => n?.nutrientId === 1003);
      data.protein = protein?.value;
    }

    // Fat (nutrient ID 1004)
    if (data.fat === undefined) {
      const fat = nutrients.find((n: any) => n?.nutrientId === 1004);
      data.fat = fat?.value;
    }

    // Energy/Calories (nutrient ID 1008)
    if (data.calories === undefined) {
      const energy = nutrients.find((n: any) => n?.nutrientId === 1008);
      data.calories = energy?.value;
    }
  }

  return data;
}

function calculatePerServing(
  per100g: number,
  servingSize?: number,
  servingUnit?: string
): number | undefined {
  if (!servingSize || !servingUnit) return undefined;

  // FDC values are typically per 100g, so we need to scale based on serving size
  if (servingUnit.toLowerCase() === "g") {
    return (per100g * servingSize) / 100;
  }

  // For other units, we'll use a rough approximation
  // This could be improved with more sophisticated unit conversion
  return (per100g * servingSize) / 100;
}
