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
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-white/20 dark:border-gray-700/50">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <CheckCircle className="h-8 w-8 text-white" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Is this correct?
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          AI detected these food items in your photo
        </p>
        <Button
          variant="outline"
          onClick={onEdit}
          className="mt-4 px-4 py-2 text-sm font-medium border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/20 transition-all duration-200 rounded-xl"
        >
          <Edit3 className="h-4 w-4 mr-2" />
          Edit Photo
        </Button>
      </div>

      <div className="space-y-6">
        {/* Show the photo */}
        <div className="relative">
          <img
            src={imageUrl}
            alt="Analyzed food"
            className="w-full h-64 object-cover rounded-2xl shadow-lg"
          />
          <div className="absolute top-4 right-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg px-3 py-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
            {foods.length} item{foods.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Food items list */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Detected Food Items
            </h4>
            <Button
              variant="outline"
              onClick={addFood}
              className="px-4 py-2 text-sm font-medium border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/20 transition-all duration-200 rounded-xl"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>

          {foods.map((food, index) => (
            <div
              key={index}
              className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-600 shadow-lg"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                    {index + 1}
                  </div>
                  <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Item {index + 1}
                  </span>
                </div>
                {foods.length > 1 && (
                  <Button
                    variant="ghost"
                    onClick={() => removeFood(index)}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label
                    htmlFor={`foodName-${index}`}
                    className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 block"
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
                    className="h-12 text-base px-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all duration-200"
                  />
                </div>

                <div>
                  <Label
                    htmlFor={`quantity-${index}`}
                    className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 block"
                  >
                    Quantity
                  </Label>
                  <Input
                    id={`quantity-${index}`}
                    value={food.quantity}
                    onChange={(e) =>
                      handleFoodChange(index, "quantity", e.target.value)
                    }
                    placeholder="e.g., 6 pancakes"
                    className="h-12 text-base px-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all duration-200"
                  />
                </div>
              </div>

              {/* Carbs display - read-only */}
              <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-xl border border-green-200 dark:border-green-700">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-green-800 dark:text-green-200">
                    Estimated Carbs:
                  </span>
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">
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
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 p-6 rounded-2xl border border-blue-200 dark:border-blue-700 shadow-lg">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-blue-800 dark:text-blue-200">
              Total Carbohydrates:
            </span>
            <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {totalCarbs.toFixed(1)}g
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="pt-4">
          <Button
            onClick={handleConfirm}
            disabled={
              isProcessing ||
              foods.filter(
                (food) => food.foodName.trim() && food.quantity.trim()
              ).length === 0
            }
            className="w-full h-16 text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl"
          >
            {isProcessing ? (
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6" />
                <span>Yes, this is correct</span>
              </div>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
