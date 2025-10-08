"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Edit3, Plus, Trash2 } from "lucide-react";
import { DetectedFood } from "./analysis-result";

interface PhotoFoodConfirmationProps {
  imageUrl: string;
  detectedFoods: DetectedFood[];
  onConfirm: (foods: DetectedFood[]) => void;
  onEdit: () => void;
  isProcessing: boolean;
}

export function PhotoFoodConfirmation({
  imageUrl,
  detectedFoods,
  onConfirm,
  onEdit,
  isProcessing,
}: PhotoFoodConfirmationProps) {
  const [foods, setFoods] = useState<DetectedFood[]>(detectedFoods);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setFoods(detectedFoods);
  }, [detectedFoods]);

  const handleFoodChange = async (
    index: number,
    field: keyof DetectedFood,
    value: string | number
  ) => {
    const newFoods = [...foods];
    newFoods[index] = { ...newFoods[index], [field]: value };
    setFoods(newFoods);

    // If food name or quantity changed, recalculate carbs
    if ((field === "foodName" || field === "quantity") && value) {
      const foodName =
        field === "foodName" ? (value as string) : newFoods[index].foodName;
      const quantity =
        field === "quantity" ? (value as string) : newFoods[index].quantity;

      if (foodName.trim() && quantity.trim()) {
        try {
          const response = await fetch("/api/calculate-carbs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              foodName: foodName.trim(),
              quantity: quantity.trim(),
            }),
          });

          if (response.ok) {
            const result = await response.json();
            newFoods[index] = {
              ...newFoods[index],
              carbs: Math.round(result.carbs || 0),
              confidence: result.confidence || 0.8,
            };
            setFoods([...newFoods]);
          }
        } catch (error) {
          console.error("Failed to calculate carbs:", error);
        }
      }
    }
  };

  const addFood = () => {
    setFoods([
      ...foods,
      { foodName: "", quantity: "", carbs: 0, confidence: 1.0 },
    ]);
  };

  const removeFood = (index: number) => {
    if (foods.length > 1) {
      setFoods(foods.filter((_, i) => i !== index));
    }
  };

  const handleConfirm = () => {
    // Filter out empty foods and validate
    const validFoods = foods.filter(
      (food) => food.foodName.trim() && food.quantity.trim()
    );

    if (validFoods.length > 0) {
      onConfirm(validFoods);
    }
  };

  const totalCarbs = foods.reduce((sum, food) => sum + (food.carbs || 0), 0);

  return (
    <Card className="border-green-500">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <CardTitle className="text-lg">Is this correct?</CardTitle>
              <CardDescription>
                AI detected these food items in your photo
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-8 px-2 text-xs"
          >
            <Edit3 className="h-3 w-3 mr-1" />
            Edit Photo
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Show the photo */}
        <div className="mb-4">
          <img
            src={imageUrl}
            alt="Analyzed food"
            className="w-full h-48 object-cover rounded-lg"
          />
        </div>

        {/* Food items list */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Detected Food Items:</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={addFood}
              className="h-8 px-2 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Item
            </Button>
          </div>

          {foods.map((food, index) => (
            <div
              key={index}
              className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Item {index + 1}
                </span>
                {foods.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFood(index)}
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label
                    htmlFor={`foodName-${index}`}
                    className="text-xs font-medium"
                  >
                    Food Name
                  </Label>
                  <Input
                    id={`foodName-${index}`}
                    value={food.foodName}
                    onChange={(e) =>
                      handleFoodChange(index, "foodName", e.target.value)
                    }
                    placeholder="e.g., Pancakes"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label
                    htmlFor={`quantity-${index}`}
                    className="text-xs font-medium"
                  >
                    Quantity
                  </Label>
                  <Input
                    id={`quantity-${index}`}
                    value={food.quantity}
                    onChange={(e) =>
                      handleFoodChange(index, "quantity", e.target.value)
                    }
                    placeholder="e.g., 6 medium"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Carbs display - read-only */}
              <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">
                    Estimated Carbs:
                  </span>
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                    {food.carbs}g
                  </span>
                </div>
                {food.confidence < 1.0 && (
                  <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                    AI Confidence: {Math.round(food.confidence * 100)}%
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Total carbs summary */}
        <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Total Carbohydrates:
            </span>
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {totalCarbs.toFixed(1)}g
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleConfirm}
            disabled={
              isProcessing ||
              foods.filter(
                (food) => food.foodName.trim() && food.quantity.trim()
              ).length === 0
            }
            className="flex-1"
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </div>
            ) : (
              "Yes, this is correct"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
