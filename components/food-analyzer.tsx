"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { FoodUpload } from "@/components/food-upload";
import { AnalysisResult } from "@/components/analysis-result";
import { SettingsDialog } from "@/components/settings-dialog";

interface FoodAnalyzerProps {
  carbRatio: number;
  onUpdateRatio: (ratio: number) => void;
}

export interface FoodAnalysis {
  foodName: string;
  carbs: number;
  protein?: number;
  fat?: number;
  calories?: number;
  confidence: number;
  servingSize?: string;
  needsClarification: boolean;
  clarificationQuestion?: string;
  imageUrl: string;
  enrichment?: any;
  notes?: string;
}

export function FoodAnalyzer({ carbRatio, onUpdateRatio }: FoodAnalyzerProps) {
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleImageCapture = async (imageUrl: string, file: File) => {
    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      // Send image to analysis API
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/analyze-food", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setAnalysis({
        ...data,
        imageUrl,
      });
    } catch (error) {
      console.error("[v0] Error analyzing food:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClarificationResponse = async (response: string) => {
    if (!analysis) return;

    setIsAnalyzing(true);

    try {
      const res = await fetch("/api/clarify-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodName: analysis.foodName,
          clarificationQuestion: analysis.clarificationQuestion,
          userResponse: response,
          imageUrl: analysis.imageUrl,
          originalServingSize: analysis.servingSize,
        }),
      });

      const data = await res.json();
      setAnalysis({
        ...analysis,
        ...data,
        needsClarification: false,
      });
    } catch (error) {
      console.error("[v0] Error processing clarification:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setAnalysis(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-muted-foreground">
            Your ratio:{" "}
            <span className="font-semibold text-foreground">
              {carbRatio}g per unit
            </span>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSettings(true)}
        >
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>

      {!analysis ? (
        <FoodUpload
          onImageCapture={handleImageCapture}
          isAnalyzing={isAnalyzing}
        />
      ) : (
        <AnalysisResult
          analysis={analysis}
          carbRatio={carbRatio}
          onClarificationResponse={handleClarificationResponse}
          onReset={handleReset}
          isProcessing={isAnalyzing}
        />
      )}

      <SettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        currentRatio={carbRatio}
        onUpdateRatio={onUpdateRatio}
      />
    </div>
  );
}
