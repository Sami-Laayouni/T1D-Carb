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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  CheckCircle,
  Camera,
  Loader2,
  AlertTriangle,
  Edit3,
  Save,
  X,
} from "lucide-react";

export interface FoodAnalysis {
  imageUrl?: string;
  foodName: string;
  carbs: number;
  confidence: number;
  needsClarification: boolean;
  clarificationQuestion?: string;
  notes?: string;
  enrichment?: boolean;
  detectedFoods?: DetectedFood[];
}

export interface DetectedFood {
  foodName: string;
  quantity: string;
  carbs: number;
  confidence: number;
}

interface AnalysisResultProps {
  analysis: FoodAnalysis;
  carbRatio: number;
  currentBG: string;
  bgTrend: string;
  totalDailyDose: string;
  bgUnit: "mg/dL" | "mmol/L";
  correctionFactor: number;
  onClarificationResponse: (response: string) => void;
  onReset: () => void;
  isProcessing: boolean;
}

interface BGPrediction {
  current: number;
  oneHour: number;
  twoHours: number;
  threeHours: number;
  fullProfile: number[];
  ICR: number;
  ISF: number;
}

interface CGMDataPoint {
  time: number;
  timeLabel: string;
  bg: number;
  isHigh: boolean;
  isLow: boolean;
  isNormal: boolean;
  isTarget: boolean;
  isCriticalHigh: boolean;
  isCriticalLow: boolean;
}

interface GridLine {
  value: number;
  label: string;
  color: string;
  bgColor: string;
  isTarget: boolean;
  isCritical: boolean;
}

interface TimePoint {
  time: number;
  label: string;
}

export function AnalysisResult({
  analysis,
  carbRatio,
  currentBG,
  bgTrend,
  totalDailyDose,
  bgUnit: propBgUnit,
  correctionFactor,
  onClarificationResponse,
  onReset,
  isProcessing,
}: AnalysisResultProps) {
  const [clarificationInput, setClarificationInput] = useState<string>("");
  const [bgUnit, setBgUnit] = useState<"mg/dL" | "mmol/L">(propBgUnit);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState(analysis.notes || "");
  const [isEditingFood, setIsEditingFood] = useState(false);
  const [editedFoodName, setEditedFoodName] = useState(analysis.foodName);
  const [editedCarbs, setEditedCarbs] = useState(analysis.carbs.toString());
  const [isFoodEdited, setIsFoodEdited] = useState(false);

  // Unit conversion functions
  const mgdLToMmolL = (mgdL: number): number => mgdL / 18.0182;
  const mmolLToMgdL = (mmolL: number): number => mmolL * 18.0182;

  // Convert BG value based on selected unit
  const convertBG = (
    value: number,
    fromUnit: "mg/dL" | "mmol/L",
    toUnit: "mg/dL" | "mmol/L"
  ): number => {
    if (fromUnit === toUnit) return value;
    if (fromUnit === "mg/dL" && toUnit === "mmol/L") return mgdLToMmolL(value);
    if (fromUnit === "mmol/L" && toUnit === "mg/dL") return mmolLToMgdL(value);
    return value;
  };

  // Format BG value with unit
  const formatBG = (value: number, unit: "mg/dL" | "mmol/L"): string => {
    const converted = convertBG(value, "mg/dL", unit);
    return unit === "mmol/L"
      ? converted.toFixed(1)
      : Math.round(converted).toString();
  };

  // Calculate base insulin dose with validation
  const carbs = Number(analysis.carbs) || 0;
  const ratio = Number(carbRatio) || 1;
  const baseInsulinDose: number = carbs / ratio;

  // Calculate insulin correction dose using the formula: (BG - 7) ÷ correctionFactor
  const currentBGNum: number = parseFloat(currentBG) || 0;
  let correctionDose: number = 0;
  let totalInsulinDose: number = baseInsulinDose;

  if (!isNaN(currentBGNum)) {
    // Convert BG to mmol/L if needed for correction calculation
    const bgInMmolL =
      bgUnit === "mg/dL" ? mgdLToMmolL(currentBGNum) : currentBGNum;

    // Apply correction formula: (BG - 7) ÷ correctionFactor
    if (bgInMmolL > 7) {
      correctionDose = (bgInMmolL - 7) / correctionFactor;
    }

    // Add correction dose to base dose
    totalInsulinDose = baseInsulinDose + correctionDose;

    // Apply safety adjustments for very low BG
    if (currentBGNum < 80) {
      totalInsulinDose = Math.max(0, totalInsulinDose - 1);
    }
  }

  const insulinDose: string = totalInsulinDose.toFixed(1);
  const correctionDoseStr: string = correctionDose.toFixed(1);

  // Calculate ICR and ISF using 500/1500 rules
  const calculateICRandISF = (tdd: number): { ICR: number; ISF: number } => {
    const ICR: number = 500 / tdd;
    const ISF: number = 1500 / tdd;
    return { ICR, ISF };
  };

  // Gamma kernel for carb absorption
  const gammaKernel = (t: number, tauC: number): number => {
    if (t <= 0) return 0;
    return (t / (tauC * tauC)) * Math.exp(-t / tauC);
  };

  // Biexponential kernel for insulin action
  const insulinKernel = (t: number, tau1: number, tau2: number): number => {
    if (t <= 0) return 0;
    const exp1: number = Math.exp(-t / tau1);
    const exp2: number = Math.exp(-t / tau2);
    return exp2 - exp1;
  };

  // Normalize insulin kernel
  const normalizeInsulinKernel = (
    t: number,
    tau1: number,
    tau2: number
  ): number => {
    const raw: number = insulinKernel(t, tau1, tau2);
    const normFactor: number = tau2 - tau1;
    return raw / normFactor;
  };

  // BG prediction model
  const calculateBGPredictions = (
    currentBGValue: string | number,
    carbs: number,
    insulinDoseValue: number,
    trend: string = "stable",
    tdd: number = 40
  ): BGPrediction | null => {
    const bgNum: number =
      typeof currentBGValue === "string"
        ? parseFloat(currentBGValue)
        : currentBGValue;

    if (isNaN(bgNum)) return null;

    const { ICR, ISF } = calculateICRandISF(tdd);

    const deltaT: number = 1;
    const horizon: number = 180;
    const tauC: number = 60;
    const tau1: number = 20;
    const tau2: number = 160;
    const kBaseline: number = 0.001;
    const bgTarget: number = 100;

    let initialSlope: number = 0;
    switch (trend) {
      case "rising":
        initialSlope = 2;
        break;
      case "falling":
        initialSlope = -2;
        break;
      default:
        initialSlope = 0;
    }

    const bgArray: number[] = new Array(horizon + 1);
    bgArray[0] = bgNum;

    const carbProfile: number[] = new Array(horizon);
    for (let i = 0; i < horizon; i++) {
      const t: number = i * deltaT;
      carbProfile[i] = carbs * gammaKernel(t, tauC) * deltaT;
    }

    const insulinProfile: number[] = new Array(horizon);
    for (let i = 0; i < horizon; i++) {
      const t: number = i * deltaT;
      insulinProfile[i] =
        insulinDoseValue * normalizeInsulinKernel(t, tau1, tau2) * deltaT;
    }

    for (let i = 1; i <= horizon; i++) {
      const carbsThisMinute: number = carbProfile[i - 1] || 0;
      const deltaFromCarbs: number = (ISF / ICR) * carbsThisMinute;
      const insulinThisMinute: number = insulinProfile[i - 1] || 0;
      const deltaFromInsulin: number = ISF * insulinThisMinute;
      const drift: number = -kBaseline * (bgArray[i - 1] - bgTarget) * deltaT;
      const trendEffect: number = i <= 10 ? initialSlope * deltaT : 0;

      bgArray[i] = Math.max(
        50,
        bgArray[i - 1] + deltaFromCarbs - deltaFromInsulin + drift + trendEffect
      );
    }

    return {
      current: bgNum,
      oneHour: Math.round(bgArray[60]),
      twoHours: Math.round(bgArray[120]),
      threeHours: Math.round(bgArray[180]),
      fullProfile: bgArray,
      ICR: Math.round(ICR * 10) / 10,
      ISF: Math.round(ISF * 10) / 10,
    };
  };

  // Generate CGM data
  const generateCGMData = (
    currentBGValue: string | number,
    carbs: number,
    insulinDoseValue: number,
    trend: string = "stable",
    tdd: number = 40
  ): CGMDataPoint[] => {
    const bgNum: number =
      typeof currentBGValue === "string"
        ? parseFloat(currentBGValue)
        : currentBGValue;

    if (isNaN(bgNum)) return [];

    const predictions: BGPrediction | null = calculateBGPredictions(
      bgNum,
      carbs,
      insulinDoseValue,
      trend,
      tdd
    );
    if (!predictions || !predictions.fullProfile) return [];

    const dataPoints: CGMDataPoint[] = [];
    for (let i = 0; i <= 12; i++) {
      const timeMinutes: number = i * 15;
      const bgIndex: number = Math.min(
        timeMinutes,
        predictions.fullProfile.length - 1
      );
      const predictedBG: number = predictions.fullProfile[bgIndex];

      const timeLabel: string =
        timeMinutes === 0
          ? "Now"
          : timeMinutes < 60
          ? `${timeMinutes}m`
          : `${Math.floor(timeMinutes / 60)}h ${timeMinutes % 60}m`.replace(
              " 0m",
              "h"
            );

      dataPoints.push({
        time: timeMinutes,
        timeLabel,
        bg: Math.round(predictedBG),
        isHigh: predictedBG > 180,
        isLow: predictedBG < 70,
        isNormal: predictedBG >= 70 && predictedBG <= 180,
        isTarget: predictedBG >= 70 && predictedBG <= 180,
        isCriticalHigh: predictedBG > 250,
        isCriticalLow: predictedBG < 55,
      });
    }

    return dataPoints;
  };

  const handleClarificationSubmit = (
    e: React.FormEvent<HTMLFormElement>
  ): void => {
    e.preventDefault();
    if (clarificationInput.trim()) {
      onClarificationResponse(clarificationInput);
      setClarificationInput("");
    }
  };

  const handleEditNotes = () => {
    setIsEditingNotes(true);
    setEditedNotes(analysis.notes || "");
  };

  const handleSaveNotes = () => {
    // Update the analysis with edited notes
    analysis.notes = editedNotes;
    setIsEditingNotes(false);
  };

  const handleCancelEdit = () => {
    setEditedNotes(analysis.notes || "");
    setIsEditingNotes(false);
  };

  const handleEditFood = () => {
    setIsEditingFood(true);
    setEditedFoodName(analysis.foodName);
    setEditedCarbs(analysis.carbs.toString());
  };

  const handleSaveFood = () => {
    const newCarbs = Number.parseFloat(editedCarbs);
    if (editedFoodName.trim() && !isNaN(newCarbs) && newCarbs > 0) {
      analysis.foodName = editedFoodName.trim();
      analysis.carbs = newCarbs;
      setIsFoodEdited(true);
      setIsEditingFood(false);
    }
  };

  const handleCancelFoodEdit = () => {
    setEditedFoodName(analysis.foodName);
    setEditedCarbs(analysis.carbs.toString());
    setIsEditingFood(false);
  };

  const predictions: BGPrediction | null = calculateBGPredictions(
    currentBG,
    carbs,
    totalInsulinDose,
    bgTrend,
    parseFloat(totalDailyDose)
  );

  const cgmData: CGMDataPoint[] = generateCGMData(
    currentBG,
    carbs,
    totalInsulinDose,
    bgTrend,
    parseFloat(totalDailyDose)
  );

  // Calculate graph dimensions
  const maxBG: number =
    cgmData.length > 0 ? Math.max(...cgmData.map((d) => d.bg)) : 200;
  const minBG: number =
    cgmData.length > 0 ? Math.min(...cgmData.map((d) => d.bg)) : 80;
  const bgRange: number = maxBG - minBG;
  const padding: number = Math.max(30, bgRange * 0.15);
  const graphMin: number = Math.max(50, minBG - padding);
  const graphMax: number = Math.min(400, maxBG + padding);
  const graphHeight: number = 250;
  const graphWidth: number = 100;

  const bgToY = (bg: number): number => {
    return (
      graphHeight - ((bg - graphMin) / (graphMax - graphMin)) * graphHeight
    );
  };

  const pathData: string = cgmData
    .map((point: CGMDataPoint, index: number) => {
      const x: number = (index / (cgmData.length - 1)) * graphWidth;
      const y: number = bgToY(point.bg);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  // Generate grid lines based on selected unit
  const getGridLines = (unit: "mg/dL" | "mmol/L"): GridLine[] => {
    const mgdLValues = [50, 70, 180, 250];
    return mgdLValues.map((value) => ({
      value: unit === "mmol/L" ? mgdLToMmolL(value) : value,
      label: formatBG(value, unit),
      color:
        value === 70 || value === 180
          ? "text-green-300"
          : value === 50 || value === 250
          ? "text-red-300"
          : "text-yellow-300",
      bgColor:
        value === 70 || value === 180
          ? "bg-green-500/20"
          : value === 50 || value === 250
          ? "bg-red-500/20"
          : "bg-yellow-500/20",
      isTarget: value === 70 || value === 180,
      isCritical: value === 50 || value === 250,
    }));
  };

  const gridLines: GridLine[] = getGridLines(bgUnit);

  const timePoints: TimePoint[] = [
    { time: 0, label: "Now" },
    { time: 30, label: "30m" },
    { time: 60, label: "1h" },
    { time: 90, label: "1h 30m" },
    { time: 120, label: "2h" },
    { time: 150, label: "2h 30m" },
    { time: 180, label: "3h" },
  ];

  return (
    <div className="space-y-4 p-4">
      {analysis.imageUrl && (
        <Card>
          <CardContent className="pt-6">
            <img
              src={analysis.imageUrl}
              alt="Analyzed food"
              className="w-full h-48 object-cover rounded-lg mb-4"
            />
          </CardContent>
        </Card>
      )}

      {analysis.needsClarification ? (
        <Card className="border-orange-500">
          <CardHeader>
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setClarificationInput(e.target.value)
                }
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
        <Card className="border-blue-500">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="flex-1">
                  {isEditingFood ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Food Name
                        </label>
                        <Input
                          value={editedFoodName}
                          onChange={(e) => setEditedFoodName(e.target.value)}
                          className="mt-1"
                          placeholder="Enter food name"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Carbohydrates (grams)
                        </label>
                        <div className="relative mt-1">
                          <Input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={editedCarbs}
                            onChange={(e) => setEditedCarbs(e.target.value)}
                            className="pr-12"
                            placeholder="25"
                          />
                          <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">
                            g
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleSaveFood}
                          disabled={
                            !editedFoodName.trim() ||
                            isNaN(Number.parseFloat(editedCarbs)) ||
                            Number.parseFloat(editedCarbs) <= 0
                          }
                        >
                          <Save className="h-3 w-3 mr-1" />
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelFoodEdit}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-lg">
                          {analysis.foodName}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleEditFood}
                          className="h-6 px-2 text-xs"
                        >
                          <Edit3 className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      </div>
                      <CardDescription>
                        {isFoodEdited ? (
                          <span className="text-orange-600 dark:text-orange-400">
                            ✏️ Manually edited
                          </span>
                        ) : (
                          <>
                            Confidence:{" "}
                            {Math.round(
                              (Number(analysis.confidence) || 0) * 100
                            )}
                            %
                          </>
                        )}
                      </CardDescription>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {isFoodEdited ? "Carbs" : "Estimated Carbs"}
                  </p>
                  {isFoodEdited && (
                    <span className="text-xs text-orange-600 dark:text-orange-400">
                      ✏️ Edited
                    </span>
                  )}
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {carbs}g
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-500">
                <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">
                  Insulin Dose
                </p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {insulinDose}u
                </p>
              </div>
            </div>

            {!isNaN(currentBGNum) && (
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Insulin Dose Breakdown
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Base dose (carbs):</span>
                    <span className="font-medium">
                      {baseInsulinDose.toFixed(1)}u
                    </span>
                  </div>
                  {correctionDose > 0 && (
                    <div className="flex justify-between">
                      <span>Correction dose (BG):</span>
                      <span className="font-medium text-orange-600">
                        +{correctionDoseStr}u
                      </span>
                    </div>
                  )}
                  {currentBGNum < 80 && (
                    <div className="flex justify-between">
                      <span>Safety adjustment (low BG):</span>
                      <span className="font-medium text-red-600">-1.0u</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 font-bold text-lg">
                    <span>Total dose:</span>
                    <span className="text-blue-600">{insulinDose}u</span>
                  </div>
                </div>
                {correctionDose > 0 && (
                  <div className="mt-3 p-2 bg-orange-50 dark:bg-orange-950/20 rounded border border-orange-200 dark:border-orange-800">
                    <p className="text-xs text-orange-700 dark:text-orange-300">
                      <strong>Correction Formula:</strong> (BG - 7) ÷{" "}
                      {correctionFactor} = {correctionDoseStr}u
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
                    ⚠️ Important Disclaimer
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    These estimates should{" "}
                    <strong>not be taken at face value</strong>. Always
                    double-check with your healthcare provider. This tool is for
                    estimation purposes only and is{" "}
                    <strong>not medically accurate</strong>. Use at your own
                    discretion.
                  </p>
                </div>
              </div>
            </div>

            {analysis.detectedFoods && analysis.detectedFoods.length > 1 && (
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Detected Food Items
                  </p>
                </div>
                <div className="space-y-2">
                  {analysis.detectedFoods.map((food, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center text-sm"
                    >
                      <span className="text-blue-700 dark:text-blue-300">
                        {food.foodName} ({food.quantity})
                      </span>
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        {food.carbs}g carbs
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {analysis.notes ? "AI-Generated Notes" : "Personal Notes"}
                </p>
                {!isEditingNotes && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEditNotes}
                    className="h-8 px-2 text-xs"
                  >
                    <Edit3 className="h-3 w-3 mr-1" />
                    {analysis.notes ? "Edit" : "Add Notes"}
                  </Button>
                )}
              </div>

              {isEditingNotes ? (
                <div className="space-y-3">
                  <textarea
                    value={editedNotes}
                    onChange={(e) => setEditedNotes(e.target.value)}
                    className="w-full p-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Add your notes here..."
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveNotes}
                      className="h-8 px-3 text-xs"
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                      className="h-8 px-3 text-xs"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  {analysis.notes ? (
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {analysis.notes}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                      No notes added yet. Click "Add Notes" to add personal
                      comments about this meal.
                    </p>
                  )}
                </div>
              )}
            </div>

            {currentBG &&
              bgTrend &&
              totalDailyDose &&
              predictions &&
              cgmData.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                          Blood Glucose Prediction
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          Predicted BG levels after this meal
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-blue-700 dark:text-blue-300">
                        Units:
                      </span>
                      <Select
                        value={bgUnit}
                        onValueChange={(value: "mg/dL" | "mmol/L") =>
                          setBgUnit(value)
                        }
                      >
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mg/dL">mg/dL</SelectItem>
                          <SelectItem value="mmol/L">mmol/L</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl p-6 relative overflow-hidden shadow-2xl border border-slate-700">
                      <div className="absolute inset-0 opacity-20">
                        <div
                          className="absolute inset-0"
                          style={{
                            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)`,
                            backgroundSize: "20px 20px",
                          }}
                        ></div>
                      </div>

                      <div className="absolute inset-0">
                        <div
                          className="absolute w-full bg-gradient-to-t from-green-500/15 via-green-400/10 to-green-500/15 border-t-2 border-b-2 border-green-400/40"
                          style={{
                            top: `${bgToY(180)}px`,
                            height: `${bgToY(70) - bgToY(180)}px`,
                          }}
                        ></div>
                        <div
                          className="absolute left-2 text-green-400 text-xs font-bold bg-slate-800/80 px-2 py-1 rounded"
                          style={{ top: `${bgToY(125) - 20}px` }}
                        >
                          TARGET ZONE (70-180)
                        </div>
                      </div>

                      <div className="absolute inset-0">
                        {gridLines.map((line: GridLine, i: number) => {
                          const y: number = bgToY(line.value);
                          return (
                            <div
                              key={i}
                              className={`absolute w-full ${
                                line.isTarget
                                  ? "border-t-2 border-green-400/60"
                                  : line.isCritical
                                  ? "border-t border-red-400/40"
                                  : "border-t border-slate-600/30"
                              }`}
                              style={{ top: `${y}px` }}
                            >
                              <div
                                className={`absolute -left-16 -top-3 ${line.bgColor} px-2 py-1 rounded-lg border border-slate-600/50`}
                              >
                                <span
                                  className={`text-sm font-bold font-mono ${line.color}`}
                                >
                                  {line.label}
                                </span>
                                {line.isTarget && (
                                  <span className="text-xs text-green-300 font-medium ml-1">
                                    ✓
                                  </span>
                                )}
                                {line.isCritical && !line.isTarget && (
                                  <span className="text-xs text-red-300 font-medium ml-1">
                                    ⚠
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 pb-2">
                        {timePoints.map((timePoint: TimePoint, i: number) => (
                          <div
                            key={i}
                            className="text-xs text-slate-300 font-mono bg-slate-800/60 px-2 py-1 rounded border border-slate-600/40"
                          >
                            {timePoint.label}
                          </div>
                        ))}
                      </div>

                      <svg
                        width="100%"
                        height={graphHeight}
                        className="relative z-10"
                        viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                      >
                        <defs>
                          <linearGradient
                            id="bgGradient"
                            x1="0%"
                            y1="0%"
                            x2="0%"
                            y2="100%"
                          >
                            <stop
                              offset="0%"
                              stopColor="#10b981"
                              stopOpacity="0.3"
                            />
                            <stop
                              offset="100%"
                              stopColor="#10b981"
                              stopOpacity="0"
                            />
                          </linearGradient>
                        </defs>

                        <path
                          d={`${pathData} L ${graphWidth} ${graphHeight} L 0 ${graphHeight} Z`}
                          fill="url(#bgGradient)"
                        />

                        <path
                          d={pathData}
                          stroke="url(#bgGradient)"
                          strokeWidth="4"
                          fill="none"
                          className="drop-shadow-2xl"
                          style={{
                            filter:
                              "drop-shadow(0 0 8px rgba(16, 185, 129, 0.4))",
                          }}
                        />

                        {cgmData.map((point: CGMDataPoint, index: number) => {
                          const x: number =
                            (index / (cgmData.length - 1)) * graphWidth;
                          const y: number = bgToY(point.bg);
                          let color: string = "#10b981";
                          let strokeColor: string = "#ffffff";
                          let strokeWidth: number = 2;
                          let glowColor: string = "rgba(16, 185, 129, 0.3)";

                          if (point.isCriticalHigh) {
                            color = "#dc2626";
                            strokeColor = "#fbbf24";
                            strokeWidth = 3;
                            glowColor = "rgba(220, 38, 38, 0.5)";
                          } else if (point.isCriticalLow) {
                            color = "#f59e0b";
                            strokeColor = "#fbbf24";
                            strokeWidth = 3;
                            glowColor = "rgba(245, 158, 11, 0.5)";
                          } else if (point.isHigh) {
                            color = "#ef4444";
                            glowColor = "rgba(239, 68, 68, 0.4)";
                          } else if (point.isLow) {
                            color = "#f59e0b";
                            glowColor = "rgba(245, 158, 11, 0.4)";
                          } else if (point.isTarget) {
                            color = "#22c55e";
                            glowColor = "rgba(34, 197, 94, 0.4)";
                          }

                          return (
                            <g key={index}>
                              <circle
                                cx={x}
                                cy={y}
                                r="10"
                                fill={glowColor}
                                className="blur-sm"
                              />
                              <circle
                                cx={x}
                                cy={y}
                                r="7"
                                fill={color}
                                stroke={strokeColor}
                                strokeWidth={strokeWidth}
                                className="drop-shadow-xl"
                              />
                              <circle
                                cx={x}
                                cy={y}
                                r="4"
                                fill="white"
                                className="drop-shadow-sm"
                              />
                              {index % 3 === 0 && (
                                <text
                                  x={x}
                                  y={y - 20}
                                  textAnchor="middle"
                                  className="text-xs font-mono fill-white font-bold"
                                  style={{
                                    fontSize: "9px",
                                    textShadow: "0 0 4px rgba(0,0,0,0.8)",
                                  }}
                                >
                                  {formatBG(point.bg, bgUnit)}
                                </text>
                              )}
                              {(point.isCriticalHigh ||
                                point.isCriticalLow) && (
                                <text
                                  x={x}
                                  y={y + 25}
                                  textAnchor="middle"
                                  className="text-xs font-bold fill-yellow-300"
                                  style={{
                                    fontSize: "8px",
                                    textShadow: "0 0 4px rgba(0,0,0,0.8)",
                                  }}
                                >
                                  ⚠️
                                </text>
                              )}
                            </g>
                          );
                        })}
                      </svg>

                      <div className="absolute top-4 right-4 bg-gradient-to-r from-slate-800/95 to-slate-700/95 rounded-xl px-4 py-3 border border-slate-600/50 shadow-2xl">
                        <div className="flex items-center gap-3">
                          <div className="text-white text-lg font-mono font-bold">
                            {formatBG(predictions.current, bgUnit)} {bgUnit}
                          </div>
                          <div
                            className={`text-sm px-3 py-1 rounded-full font-medium ${
                              bgTrend === "rising"
                                ? "bg-orange-500/30 text-orange-200 border border-orange-400/50"
                                : bgTrend === "falling"
                                ? "bg-red-500/30 text-red-200 border border-red-400/50"
                                : "bg-green-500/30 text-green-200 border border-green-400/50"
                            }`}
                          >
                            {bgTrend === "rising"
                              ? "📈 Rising"
                              : bgTrend === "falling"
                              ? "📉 Falling"
                              : "➡️ Stable"}
                          </div>
                        </div>
                        <div className="text-xs text-slate-300 mt-2 font-mono">
                          ICR: {predictions.ICR}g/u | ISF:{" "}
                          {formatBG(predictions.ISF, bgUnit)} {bgUnit}/u
                        </div>
                      </div>

                      <div className="absolute bottom-4 left-4 bg-gradient-to-r from-slate-800/95 to-slate-700/95 rounded-xl px-4 py-3 border border-slate-600/50 shadow-2xl">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500 shadow-lg"></div>
                            <span className="text-green-300 font-medium">
                              Target ({formatBG(70, bgUnit)}-
                              {formatBG(180, bgUnit)})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-lg"></div>
                            <span className="text-yellow-300 font-medium">
                              Low (&lt;{formatBG(70, bgUnit)})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500 shadow-lg"></div>
                            <span className="text-red-300 font-medium">
                              High (&gt;{formatBG(180, bgUnit)})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-600 border-2 border-yellow-400 shadow-lg"></div>
                            <span className="text-yellow-300 font-medium">
                              Critical (&gt;{formatBG(250, bgUnit)})
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          1h
                        </p>
                        <p
                          className={`text-lg font-bold ${
                            predictions.oneHour > 180
                              ? "text-red-600"
                              : predictions.oneHour < 70
                              ? "text-yellow-600"
                              : "text-green-600"
                          }`}
                        >
                          {formatBG(predictions.oneHour, bgUnit)}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          2h
                        </p>
                        <p
                          className={`text-lg font-bold ${
                            predictions.twoHours > 180
                              ? "text-red-600"
                              : predictions.twoHours < 70
                              ? "text-yellow-600"
                              : "text-green-600"
                          }`}
                        >
                          {formatBG(predictions.twoHours, bgUnit)}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          3h End
                        </p>
                        <p
                          className={`text-lg font-bold ${
                            predictions.threeHours > 180
                              ? "text-red-600"
                              : predictions.threeHours < 70
                              ? "text-yellow-600"
                              : "text-green-600"
                          }`}
                        >
                          {formatBG(predictions.threeHours, bgUnit)}
                        </p>
                      </div>
                    </div>

                    <div className="p-2 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-800">
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        <strong>Note:</strong> These are rough estimates.
                        Individual responses vary significantly. Always monitor
                        your actual blood glucose and adjust as needed.
                      </p>
                    </div>
                  </div>
                </div>
              )}

            <Button onClick={onReset} variant="outline" className="w-full">
              <Camera className="h-4 w-4 mr-2" />
              Analyze Another Meal
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
