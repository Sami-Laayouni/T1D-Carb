import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    const { foodName, quantity } = await request.json();

    if (!foodName || !quantity) {
      return NextResponse.json(
        { error: "Food name and quantity are required" },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const prompt = `
You are a nutrition expert. Calculate the approximate carbohydrates for the given food and quantity.

Food: "${foodName}"
Quantity: "${quantity}"

Please provide ONLY a JSON response with this exact format:
{
  "carbs": 45.5,
  "confidence": 0.9
}

Be as accurate as possible with your carb estimates. Use your knowledge of typical serving sizes and nutritional content.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Try to parse the JSON response
    let analysis;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      return NextResponse.json(
        { error: "Failed to calculate carbs" },
        { status: 500 }
      );
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Error calculating carbs:", error);
    return NextResponse.json(
      { error: "Failed to calculate carbs" },
      { status: 500 }
    );
  }
}
