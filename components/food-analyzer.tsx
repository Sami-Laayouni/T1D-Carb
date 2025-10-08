"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings, Camera, PenTool } from "lucide-react";
import { FoodUpload } from "@/components/food-upload";
import { ManualFoodEntry } from "@/components/manual-food-entry";
import { FoodConfirmation } from "@/components/food-confirmation";
import { PhotoFoodConfirmation } from "@/components/photo-food-confirmation";
import { AnalysisResult } from "@/components/analysis-result";
import { SettingsDialog } from "@/components/settings-dialog";

interface FoodAnalyzerProps {
  carbRatio: number;
  currentBG: string;
  bgTrend: string;
  totalDailyDose: string;
  bgUnit: "mg/dL" | "mmol/L";
  correctionFactor: number;
  onUpdateProfile: (data: {
    ratio: number;
    currentBG: string;
    bgTrend: string;
    totalDailyDose: string;
    bgUnit: "mg/dL" | "mmol/L";
    correctionFactor: number;
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

interface FoodSuggestion {
  quantity: string;
  description: string;
  carbs: number;
  confidence: number;
}

interface DetectedFood {
  foodName: string;
  quantity: string;
  carbs: number;
  confidence: number;
}

export function FoodAnalyzer({
  carbRatio,
  currentBG,
  bgTrend,
  totalDailyDose,
  bgUnit,
  correctionFactor,
  onUpdateProfile,
}: FoodAnalyzerProps) {
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [entryMode, setEntryMode] = useState<"photo" | "manual">("photo");
  const [foodSuggestions, setFoodSuggestions] = useState<FoodSuggestion[]>([]);
  const [pendingFoodName, setPendingFoodName] = useState("");
  const [pendingNotes, setPendingNotes] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [photoDetectedFoods, setPhotoDetectedFoods] = useState<DetectedFood[]>(
    []
  );
  const [pendingImageUrl, setPendingImageUrl] = useState("");
  const [showPhotoConfirmation, setShowPhotoConfirmation] = useState(false);

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

      // Always show confirmation for photo analysis to allow editing
      if (data.detectedFoods && data.detectedFoods.length > 0) {
        setPhotoDetectedFoods(data.detectedFoods);
        setPendingImageUrl(imageUrl);
        setShowPhotoConfirmation(true);
      } else {
        // Fallback if no detected foods
        setAnalysis({
          ...data,
          imageUrl,
        });
      }
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

  const handleManualFoodSubmit = async (data: {
    foodName: string;
    notes?: string;
  }) => {
    setIsAnalyzing(true);
    setPendingFoodName(data.foodName);
    setPendingNotes(data.notes || "");

    try {
      const response = await fetch("/api/analyze-food-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodName: data.foodName,
          notes: data.notes,
        }),
      });

      const result = await response.json();

      if (result.suggestions && result.suggestions.length > 0) {
        setFoodSuggestions(result.suggestions);
        setShowConfirmation(true);
      } else {
        // Fallback if no suggestions
        setAnalysis({
          foodName: data.foodName,
          carbs: 0,
          confidence: 0,
          needsClarification: true,
          clarificationQuestion:
            "Could you provide more details about the quantity?",
          imageUrl: "",
          notes: data.notes,
        });
      }
    } catch (error) {
      console.error("Error analyzing food name:", error);
      // Fallback to manual entry
      setAnalysis({
        foodName: data.foodName,
        carbs: 0,
        confidence: 0,
        needsClarification: true,
        clarificationQuestion:
          "Could you provide more details about the quantity?",
        imageUrl: "",
        notes: data.notes,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmation = (selectedSuggestion: FoodSuggestion) => {
    setAnalysis({
      foodName: pendingFoodName,
      carbs: selectedSuggestion.carbs,
      confidence: selectedSuggestion.confidence,
      needsClarification: false,
      imageUrl: "",
      notes: pendingNotes,
      servingSize: selectedSuggestion.quantity,
    });
    setShowConfirmation(false);
    setFoodSuggestions([]);
    setPendingFoodName("");
    setPendingNotes("");
  };

  const handleEditFood = () => {
    setShowConfirmation(false);
    setFoodSuggestions([]);
  };

  const handlePhotoConfirmation = (confirmedFoods: DetectedFood[]) => {
    const totalCarbs = confirmedFoods.reduce(
      (sum, food) => sum + food.carbs,
      0
    );
    const foodNames = confirmedFoods.map((food) => food.foodName).join(", ");

    setAnalysis({
      foodName: foodNames,
      carbs: totalCarbs,
      confidence: 1.0, // User confirmed
      needsClarification: false,
      imageUrl: pendingImageUrl,
      detectedFoods: confirmedFoods,
    });
    setShowPhotoConfirmation(false);
    setPhotoDetectedFoods([]);
    setPendingImageUrl("");
  };

  const handleEditPhoto = () => {
    setShowPhotoConfirmation(false);
    setPhotoDetectedFoods([]);
    setPendingImageUrl("");
  };

  const handleReset = () => {
    setAnalysis(null);
    setShowConfirmation(false);
    setFoodSuggestions([]);
    setPendingFoodName("");
    setPendingNotes("");
    setShowPhotoConfirmation(false);
    setPhotoDetectedFoods([]);
    setPendingImageUrl("");
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

      {/* Entry Mode Toggle */}
      {!analysis && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              How would you like to add your food?
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Choose between AI photo analysis or manual entry
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setEntryMode("photo")}
              className={`p-4 rounded-xl border-2 transition-all ${
                entryMode === "photo"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                  : "border-gray-300 hover:border-blue-300"
              }`}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <Camera className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                    Photo Analysis
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Take a photo for AI analysis
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setEntryMode("manual")}
              className={`p-4 rounded-xl border-2 transition-all ${
                entryMode === "manual"
                  ? "border-purple-500 bg-purple-50 dark:bg-purple-950/20"
                  : "border-gray-300 hover:border-purple-300"
              }`}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                  <PenTool className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                    Manual Entry
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Enter details manually
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Food Analysis - Show based on selected mode */}
      {!analysis &&
        !showConfirmation &&
        !showPhotoConfirmation &&
        entryMode === "photo" && (
          <FoodUpload
            onImageCapture={handleImageCapture}
            isAnalyzing={isAnalyzing}
          />
        )}

      {!analysis &&
        !showConfirmation &&
        !showPhotoConfirmation &&
        entryMode === "manual" && (
          <ManualFoodEntry
            onFoodSubmit={handleManualFoodSubmit}
            isProcessing={isAnalyzing}
          />
        )}

      {showConfirmation && (
        <FoodConfirmation
          foodName={pendingFoodName}
          suggestions={foodSuggestions}
          onConfirm={handleConfirmation}
          onEdit={handleEditFood}
          isProcessing={isAnalyzing}
        />
      )}

      {showPhotoConfirmation && (
        <PhotoFoodConfirmation
          imageUrl={pendingImageUrl}
          detectedFoods={photoDetectedFoods}
          onConfirm={handlePhotoConfirmation}
          onEdit={handleEditPhoto}
          isProcessing={isAnalyzing}
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
          correctionFactor={correctionFactor}
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
        correctionFactor={correctionFactor}
        onUpdateProfile={onUpdateProfile}
      />
    </div>
  );
}
