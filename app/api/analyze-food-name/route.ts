import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    const { foodName, notes } = await request.json();

    if (!foodName) {
      return NextResponse.json(
        { error: "Food name is required" },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const prompt = `
You are a nutrition expert analyzing food for diabetes management. 

Food: "${foodName}"
Additional notes: ${notes || "None"}

Please analyze this food and provide:
1. The most common serving sizes/quantities people typically eat
2. Estimated carbohydrates for each serving size
3. Confidence level (0-1) for your estimates

Format your response as JSON with this structure:
{
  "foodName": "Standardized food name",
  "suggestions": [
    {
      "quantity": "1 medium",
      "description": "1 medium pancake",
      "carbs": 15,
      "confidence": 0.9
    },
    {
      "quantity": "2 medium", 
      "description": "2 medium pancakes",
      "carbs": 30,
      "confidence": 0.9
    },
    {
      "quantity": "3 medium",
      "description": "3 medium pancakes", 
      "carbs": 45,
      "confidence": 0.9
    }
  ],
  "needsClarification": false,
  "clarificationQuestion": null
}

Provide 3-5 common serving size options. Be specific about quantities (e.g., "1 medium", "2 large", "1 cup", "6 pieces").
Make sure carb estimates are realistic and accurate.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Try to parse the JSON response
    let analysis;
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      return NextResponse.json(
        { error: "Failed to analyze food" },
        { status: 500 }
      );
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Error analyzing food name:", error);
    return NextResponse.json(
      { error: "Failed to analyze food" },
      { status: 500 }
    );
  }
}
