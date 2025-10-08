"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Edit3 } from "lucide-react";

interface FoodSuggestion {
  quantity: string;
  description: string;
  carbs: number;
  confidence: number;
}

interface FoodConfirmationProps {
  foodName: string;
  suggestions: FoodSuggestion[];
  onConfirm: (selectedSuggestion: FoodSuggestion) => void;
  onEdit: () => void;
  isProcessing: boolean;
}

export function FoodConfirmation({
  foodName,
  suggestions,
  onConfirm,
  onEdit,
  isProcessing,
}: FoodConfirmationProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [customQuantity, setCustomQuantity] = useState("");
  const [customCarbs, setCustomCarbs] = useState("");
  const [isCustomMode, setIsCustomMode] = useState(false);

  const handleConfirm = () => {
    if (isCustomMode) {
      const carbs = Number.parseFloat(customCarbs);
      if (customQuantity.trim() && !isNaN(carbs) && carbs > 0) {
        onConfirm({
          quantity: customQuantity.trim(),
          description: customQuantity.trim(),
          carbs: carbs,
          confidence: 1.0,
        });
      }
    } else {
      onConfirm(suggestions[selectedIndex]);
    }
  };

  const handleCustomToggle = () => {
    setIsCustomMode(!isCustomMode);
    if (!isCustomMode) {
      // When switching to custom mode, pre-fill with selected suggestion
      const selected = suggestions[selectedIndex];
      setCustomQuantity(selected.quantity);
      setCustomCarbs(selected.carbs.toString());
    }
  };

  return (
    <Card className="border-green-500">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <CardTitle className="text-lg">Is this correct?</CardTitle>
              <CardDescription>
                AI analyzed: <strong>{foodName}</strong>
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
            Edit Food
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isCustomMode ? (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Select quantity:</Label>
              <Select
                value={selectedIndex.toString()}
                onValueChange={(value) => setSelectedIndex(Number(value))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {suggestions.map((suggestion, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {suggestion.description} - {suggestion.carbs}g carbs
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Selected:</span>
                <span className="text-xs text-gray-500">
                  Confidence:{" "}
                  {Math.round(suggestions[selectedIndex].confidence * 100)}%
                </span>
              </div>
              <div className="text-lg font-semibold">
                {suggestions[selectedIndex].description}
              </div>
              <div className="text-2xl font-bold text-green-600">
                {suggestions[selectedIndex].carbs}g carbs
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleCustomToggle}
              className="w-full"
            >
              Custom quantity not listed?
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="customQuantity" className="text-sm font-medium">
                Custom Quantity
              </Label>
              <Input
                id="customQuantity"
                value={customQuantity}
                onChange={(e) => setCustomQuantity(e.target.value)}
                placeholder="e.g., 6 medium pancakes"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="customCarbs" className="text-sm font-medium">
                Carbohydrates (grams)
              </Label>
              <div className="relative mt-1">
                <Input
                  id="customCarbs"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={customCarbs}
                  onChange={(e) => setCustomCarbs(e.target.value)}
                  placeholder="45"
                  className="pr-12"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">
                  g
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleCustomToggle}
              className="w-full"
            >
              Back to suggestions
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleConfirm}
            disabled={
              isProcessing ||
              (!isCustomMode && !suggestions[selectedIndex]) ||
              (isCustomMode &&
                (!customQuantity.trim() ||
                  isNaN(Number.parseFloat(customCarbs)) ||
                  Number.parseFloat(customCarbs) <= 0))
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
