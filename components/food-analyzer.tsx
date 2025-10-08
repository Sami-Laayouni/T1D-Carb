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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Profile Info Header - Mobile Optimized */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-white/20 dark:border-gray-700/50">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">💉</span>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Your Profile
                </h2>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-2">
                    <span className="font-semibold text-blue-700 dark:text-blue-300">Ratio:</span>
                    <div className="text-blue-900 dark:text-blue-100 font-bold">{carbRatio}g/unit</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-2">
                    <span className="font-semibold text-green-700 dark:text-green-300">BG:</span>
                    <div className="text-green-900 dark:text-green-100 font-bold">{currentBG} {bgUnit}</div>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-2">
                    <span className="font-semibold text-purple-700 dark:text-purple-300">TDD:</span>
                    <div className="text-purple-900 dark:text-purple-100 font-bold">{totalDailyDose} units</div>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-2">
                    <span className="font-semibold text-orange-700 dark:text-orange-300">Trend:</span>
                    <div className="text-orange-900 dark:text-orange-100 font-bold">
                      {bgTrend === "falling" ? "📉 Falling" : bgTrend === "rising" ? "📈 Rising" : "➡️ Stable"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowSettings(true)}
              className="w-full sm:w-auto px-6 py-3 text-sm font-semibold border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all duration-200 rounded-xl"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        {/* Entry Mode Toggle - Mobile Optimized */}
        {!analysis && (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-white/20 dark:border-gray-700/50">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                How would you like to add your food?
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                Choose between AI photo analysis or manual entry
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => setEntryMode("photo")}
                className={`p-6 rounded-2xl border-2 transition-all duration-300 transform hover:scale-105 ${
                  entryMode === "photo"
                    ? "border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 shadow-lg"
                    : "border-gray-300 hover:border-blue-300 bg-white dark:bg-gray-700/50"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${
                    entryMode === "photo" 
                      ? "bg-gradient-to-br from-blue-500 to-blue-600" 
                      : "bg-blue-100 dark:bg-blue-900"
                  }`}>
                    <Camera className={`h-8 w-8 ${
                      entryMode === "photo" 
                        ? "text-white" 
                        : "text-blue-600 dark:text-blue-400"
                    }`} />
                  </div>
                  <div className="text-left flex-1">
                    <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                      Photo Analysis
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400">
                      Take a photo for AI analysis
                    </p>
                    <div className="mt-2 text-sm text-blue-600 dark:text-blue-400 font-medium">
                      ✨ AI-powered food detection
                    </div>
                  </div>
                  {entryMode === "photo" && (
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  )}
                </div>
              </button>

              <button
                onClick={() => setEntryMode("manual")}
                className={`p-6 rounded-2xl border-2 transition-all duration-300 transform hover:scale-105 ${
                  entryMode === "manual"
                    ? "border-purple-500 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30 shadow-lg"
                    : "border-gray-300 hover:border-purple-300 bg-white dark:bg-gray-700/50"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${
                    entryMode === "manual" 
                      ? "bg-gradient-to-br from-purple-500 to-purple-600" 
                      : "bg-purple-100 dark:bg-purple-900"
                  }`}>
                    <PenTool className={`h-8 w-8 ${
                      entryMode === "manual" 
                        ? "text-white" 
                        : "text-purple-600 dark:text-purple-400"
                    }`} />
                  </div>
                  <div className="text-left flex-1">
                    <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                      Manual Entry
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400">
                      Enter details manually
                    </p>
                    <div className="mt-2 text-sm text-purple-600 dark:text-purple-400 font-medium">
                      📝 Quick and precise
                    </div>
                  </div>
                  {entryMode === "manual" && (
                    <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  )}
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
    </div>
  );
}
