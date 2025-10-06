"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { FoodUpload } from "@/components/food-upload";
import { AnalysisResult } from "@/components/analysis-result";
import { SettingsDialog } from "@/components/settings-dialog";

interface FoodAnalyzerProps {
  carbRatio: number;
  currentBG: string;
  bgTrend: string;
  totalDailyDose: string;
  bgUnit: "mg/dL" | "mmol/L";
  onUpdateProfile: (data: {
    ratio: number;
    currentBG: string;
    bgTrend: string;
    totalDailyDose: string;
    bgUnit: "mg/dL" | "mmol/L";
  }) => void;
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

export function FoodAnalyzer({
  carbRatio,
  currentBG,
  bgTrend,
  totalDailyDose,
  bgUnit,
  onUpdateProfile,
}: FoodAnalyzerProps) {
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
    <div className="space-y-8">
      {/* Profile Info Header */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <span className="text-2xl">💉</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Your Profile
              </h2>
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>
                  <span className="font-medium">Ratio:</span> {carbRatio}g per
                  unit
                </span>
                <span>
                  <span className="font-medium">BG:</span> {currentBG} {bgUnit}
                </span>
                <span>
                  <span className="font-medium">TDD:</span> {totalDailyDose}{" "}
                  units
                </span>
                <span>
                  <span className="font-medium">Trend:</span>{" "}
                  {bgTrend === "falling"
                    ? "📉 Falling"
                    : bgTrend === "rising"
                    ? "📈 Rising"
                    : "➡️ Stable"}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowSettings(true)}
            className="px-4 py-2 text-sm font-medium border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-all"
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Food Analysis - Always show when no analysis */}
      {!analysis && (
        <FoodUpload
          onImageCapture={handleImageCapture}
          isAnalyzing={isAnalyzing}
        />
      )}

      {analysis && (
        <AnalysisResult
          analysis={analysis}
          carbRatio={carbRatio}
          currentBG={currentBG}
          bgTrend={bgTrend}
          totalDailyDose={totalDailyDose}
          bgUnit={bgUnit}
          onClarificationResponse={handleClarificationResponse}
          onReset={() => {
            setAnalysis(null);
          }}
          isProcessing={isAnalyzing}
        />
      )}

      <SettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        currentRatio={carbRatio}
        currentBG={currentBG}
        bgTrend={bgTrend}
        totalDailyDose={totalDailyDose}
        bgUnit={bgUnit}
        onUpdateProfile={onUpdateProfile}
      />
    </div>
  );
}
