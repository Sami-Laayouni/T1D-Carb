"use client";

import type React from "react";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle, Camera, Loader2 } from "lucide-react";
import type { FoodAnalysis } from "@/components/food-analyzer";

interface AnalysisResultProps {
  analysis: FoodAnalysis;
  carbRatio: number;
  onClarificationResponse: (response: string) => void;
  onReset: () => void;
  isProcessing: boolean;
}

export function AnalysisResult({
  analysis,
  carbRatio,
  onClarificationResponse,
  onReset,
  isProcessing,
}: AnalysisResultProps) {
  const [clarificationInput, setClarificationInput] = useState("");

  const insulinDose = (analysis.carbs / carbRatio).toFixed(1);

  const handleClarificationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (clarificationInput.trim()) {
      onClarificationResponse(clarificationInput);
      setClarificationInput("");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <img
            src={analysis.imageUrl || "/placeholder.svg"}
            alt="Analyzed food"
            className="w-full h-48 object-cover rounded-lg mb-4"
          />
        </CardContent>
      </Card>

      {analysis.needsClarification ? (
        <Card className="border-accent">
          <CardHeader>
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-accent mt-0.5" />
              <div className="flex-1">
                <CardTitle className="text-lg">Need More Info</CardTitle>
                <CardDescription className="mt-1">
                  {analysis.clarificationQuestion}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleClarificationSubmit} className="flex gap-2">
              <Input
                value={clarificationInput}
                onChange={(e) => setClarificationInput(e.target.value)}
                placeholder="Type your answer..."
                disabled={isProcessing}
              />
              <Button
                type="submit"
                disabled={isProcessing || !clarificationInput.trim()}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Submit"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-primary">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <CardTitle className="text-lg">{analysis.foodName}</CardTitle>
                  <CardDescription>
                    Confidence: {Math.round(analysis.confidence * 100)}%
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card p-4 rounded-lg border">
                <p className="text-sm text-muted-foreground mb-1">
                  Estimated Carbs
                </p>
                <p className="text-3xl font-bold text-foreground">
                  {analysis.carbs}g
                </p>
              </div>
              <div className="bg-primary/10 p-4 rounded-lg border border-primary">
                <p className="text-sm text-primary mb-1">Insulin Dose</p>
                <p className="text-3xl font-bold text-primary">
                  {insulinDose}u
                </p>
              </div>
            </div>

            {/* Nutrition Details */}
            <div className="grid grid-cols-2 gap-4">
              {analysis.protein !== undefined && (
                <div className="bg-card p-3 rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-1">Protein</p>
                  <p className="text-xl font-semibold text-foreground">
                    {analysis.protein}g
                  </p>
                </div>
              )}
              {analysis.fat !== undefined && (
                <div className="bg-card p-3 rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-1">Fat</p>
                  <p className="text-xl font-semibold text-foreground">
                    {analysis.fat}g
                  </p>
                </div>
              )}
              {analysis.calories !== undefined && (
                <div className="bg-card p-3 rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-1">Calories</p>
                  <p className="text-xl font-semibold text-foreground">
                    {analysis.calories} cal
                  </p>
                </div>
              )}
              {analysis.servingSize && (
                <div className="bg-card p-3 rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-1">
                    Serving Size
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    {analysis.servingSize}
                  </p>
                </div>
              )}
            </div>

            {/* FDC Data Source Indicator */}
            {analysis.enrichment && (
              <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-700 dark:text-green-300">
                  ✓ Enhanced with USDA Food Data Central
                </p>
              </div>
            )}

            {/* Notes */}
            {analysis.notes && (
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{analysis.notes}</p>
              </div>
            )}

            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Calculation</p>
              <p className="text-sm font-mono">
                {analysis.carbs}g ÷ {carbRatio}g/u = {insulinDose} units
              </p>
            </div>

            <Button
              onClick={onReset}
              variant="outline"
              className="w-full bg-transparent"
            >
              <Camera className="h-4 w-4 mr-2" />
              Analyze Another Meal
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
