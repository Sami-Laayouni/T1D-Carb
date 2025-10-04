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
  AlertCircle,
  CheckCircle,
  Camera,
  Loader2,
  AlertTriangle,
} from "lucide-react";
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
  const [currentBG, setCurrentBG] = useState("");
  const [bgTrend, setBgTrend] = useState("");
  const [showBGPredictions, setShowBGPredictions] = useState(false);
  const [totalDailyDose, setTotalDailyDose] = useState("40"); // Default TDD

  const insulinDose = (analysis.carbs / carbRatio).toFixed(1);

  // Calculate ICR and ISF using 500/1500 rules
  const calculateICRandISF = (tdd: number) => {
    const ICR = 500 / tdd; // grams per unit
    const ISF = 1500 / tdd; // mg/dL per unit (rapid-acting insulin)
    return { ICR, ISF };
  };

  // Gamma kernel for carb absorption (shape=2)
  const gammaKernel = (t: number, tauC: number) => {
    if (t <= 0) return 0;
    return (t / (tauC * tauC)) * Math.exp(-t / tauC);
  };

  // Biexponential kernel for insulin action
  const insulinKernel = (t: number, tau1: number, tau2: number) => {
    if (t <= 0) return 0;
    const exp1 = Math.exp(-t / tau1);
    const exp2 = Math.exp(-t / tau2);
    return exp2 - exp1;
  };

  // Normalize insulin kernel to have integral = 1
  const normalizeInsulinKernel = (t: number, tau1: number, tau2: number) => {
    const raw = insulinKernel(t, tau1, tau2);
    // Approximate normalization factor (integral of biexponential)
    const normFactor = tau2 - tau1;
    return raw / normFactor;
  };

  // Convolutional BG prediction using proper mathematical model
  const calculateBGPredictions = (
    currentBG: number,
    carbs: number,
    insulinDose: number,
    trend: string = "stable",
    tdd: number = 40
  ) => {
    const currentBGNum = parseFloat(currentBG);
    if (isNaN(currentBGNum)) return null;

    // Calculate ICR and ISF using 500/1500 rules
    const { ICR, ISF } = calculateICRandISF(tdd);

    // Model parameters
    const deltaT = 1; // 1 minute time step
    const horizon = 180; // 3 hours
    const tauC = 60; // carb absorption time constant (mixed meal)
    const tau1 = 20; // insulin onset time constant
    const tau2 = 160; // insulin duration time constant
    const kBaseline = 0.001; // baseline drift constant
    const bgTarget = 100; // target BG

    // Trend adjustment (initial slope)
    let initialSlope = 0;
    switch (trend) {
      case "rising":
        initialSlope = 2; // 2 mg/dL per minute
        break;
      case "falling":
        initialSlope = -2; // -2 mg/dL per minute
        break;
      default:
        initialSlope = 0;
    }

    // Initialize BG array
    const bgArray = new Array(horizon + 1);
    bgArray[0] = currentBGNum;

    // Calculate carb absorption profile
    const carbProfile = new Array(horizon);
    for (let i = 0; i < horizon; i++) {
      const t = i * deltaT;
      carbProfile[i] = carbs * gammaKernel(t, tauC) * deltaT;
    }

    // Calculate insulin action profile
    const insulinProfile = new Array(horizon);
    for (let i = 0; i < horizon; i++) {
      const t = i * deltaT;
      insulinProfile[i] =
        insulinDose * normalizeInsulinKernel(t, tau1, tau2) * deltaT;
    }

    // Discrete time simulation
    for (let i = 1; i <= horizon; i++) {
      const t = i * deltaT;

      // Carb effect this minute
      const carbsThisMinute = carbProfile[i - 1] || 0;
      const deltaFromCarbs = (ISF / ICR) * carbsThisMinute;

      // Insulin effect this minute
      const insulinThisMinute = insulinProfile[i - 1] || 0;
      const deltaFromInsulin = ISF * insulinThisMinute;

      // Baseline drift toward target
      const drift = -kBaseline * (bgArray[i - 1] - bgTarget) * deltaT;

      // Initial trend (only for first few minutes)
      const trendEffect = i <= 10 ? initialSlope * deltaT : 0;

      // Update BG
      bgArray[i] = Math.max(
        50,
        bgArray[i - 1] + deltaFromCarbs - deltaFromInsulin + drift + trendEffect
      );
    }

    return {
      current: currentBGNum,
      oneHour: Math.round(bgArray[60]),
      twoHours: Math.round(bgArray[120]),
      threeHours: Math.round(bgArray[180]),
      fullProfile: bgArray, // For graph plotting
      ICR: Math.round(ICR * 10) / 10,
      ISF: Math.round(ISF * 10) / 10,
    };
  };

  // Generate CGM-style graph data points using convolutional model
  const generateCGMData = (
    currentBG: number,
    carbs: number,
    insulinDose: number,
    trend: string = "stable",
    tdd: number = 40
  ) => {
    const currentBGNum = parseFloat(currentBG);
    if (isNaN(currentBGNum)) return [];

    // Get the full BG profile from convolutional model
    const predictions = calculateBGPredictions(
      currentBGNum,
      carbs,
      insulinDose,
      trend,
      tdd
    );
    if (!predictions || !predictions.fullProfile) return [];

    // Sample every 15 minutes from the full profile
    const dataPoints = [];
    for (let i = 0; i <= 12; i++) {
      const timeMinutes = i * 15; // 0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180
      const bgIndex = Math.min(timeMinutes, predictions.fullProfile.length - 1);
      const predictedBG = predictions.fullProfile[bgIndex];

      const timeLabel =
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
        isTarget: predictedBG >= 70 && predictedBG <= 180, // Target range
        isCriticalHigh: predictedBG > 250,
        isCriticalLow: predictedBG < 55,
      });
    }

    // Debug: Log the data points to see what's happening
    console.log(
      "CGM Data Points:",
      dataPoints.map((p) => ({ time: p.time, label: p.timeLabel, bg: p.bg }))
    );

    return dataPoints;
  };

  const handleBGPrediction = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentBG.trim()) {
      setShowBGPredictions(true);
    }
  };

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

            {/* Medical Disclaimer Warning */}
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

            {/* Blood Glucose Prediction */}
            {!showBGPredictions ? (
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                      Blood Glucose Prediction
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Enter your current blood glucose and trend to see
                      predicted levels after this meal.
                    </p>
                  </div>
                </div>
                <form onSubmit={handleBGPrediction} className="space-y-3">
                  <div className="space-y-3">
                    <div>
                      <Input
                        type="number"
                        value={currentBG}
                        onChange={(e) => setCurrentBG(e.target.value)}
                        placeholder="Current BG (mg/dL)"
                        min="50"
                        max="500"
                        step="1"
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-blue-600 dark:text-blue-400 mb-1 font-medium">
                        Total Daily Insulin Dose (TDD)
                      </label>
                      <Input
                        type="number"
                        value={totalDailyDose}
                        onChange={(e) => setTotalDailyDose(e.target.value)}
                        placeholder="Total units per day"
                        min="10"
                        max="200"
                        step="1"
                        className="w-full"
                      />
                      <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                        💡 Include ALL insulin: rapid-acting (meals) +
                        long-acting (basal) per day
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mb-2 font-medium">
                      How is your BG currently trending?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setBgTrend("falling")}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          bgTrend === "falling"
                            ? "bg-red-100 text-red-700 border border-red-300"
                            : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
                        }`}
                      >
                        📉 Falling
                      </button>
                      <button
                        type="button"
                        onClick={() => setBgTrend("stable")}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          bgTrend === "stable"
                            ? "bg-green-100 text-green-700 border border-green-300"
                            : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
                        }`}
                      >
                        ➡️ Stable
                      </button>
                      <button
                        type="button"
                        onClick={() => setBgTrend("rising")}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          bgTrend === "rising"
                            ? "bg-orange-100 text-orange-700 border border-orange-300"
                            : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
                        }`}
                      >
                        📈 Rising
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    className="w-full"
                    disabled={
                      !currentBG.trim() || !bgTrend || !totalDailyDose.trim()
                    }
                  >
                    Predict with Convolutional Model
                  </Button>

                  {/* TDD Help Section */}
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
                    <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-2">
                      📊 How to calculate your Total Daily Dose (TDD):
                    </p>
                    <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                      <p>
                        • <strong>Rapid-acting insulin</strong> (meals): Count
                        all units used for food
                      </p>
                      <p>
                        • <strong>Long-acting insulin</strong> (basal): Your
                        daily background dose
                      </p>
                      <p>
                        • <strong>Example:</strong> 4u breakfast + 6u lunch + 5u
                        dinner + 20u basal = 35u TDD
                      </p>
                      <p>
                        • <strong>Default:</strong> 40u (typical starting point)
                      </p>
                    </div>
                  </div>
                </form>
              </div>
            ) : (
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                        Predicted Blood Glucose
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        Based on {analysis.carbs}g carbs and {insulinDose}u
                        insulin
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowBGPredictions(false)}
                    className="text-blue-600 dark:text-blue-400"
                  >
                    Edit
                  </Button>
                </div>

                {(() => {
                  const predictions = calculateBGPredictions(
                    currentBG,
                    analysis.carbs,
                    parseFloat(insulinDose),
                    bgTrend,
                    parseFloat(totalDailyDose)
                  );
                  const cgmData = generateCGMData(
                    currentBG,
                    analysis.carbs,
                    parseFloat(insulinDose),
                    bgTrend,
                    parseFloat(totalDailyDose)
                  );

                  if (!predictions || cgmData.length === 0) return null;

                  // Calculate graph dimensions and scaling
                  const maxBG = Math.max(...cgmData.map((d) => d.bg));
                  const minBG = Math.min(...cgmData.map((d) => d.bg));
                  const bgRange = maxBG - minBG;
                  const padding = Math.max(30, bgRange * 0.15);
                  const graphMin = Math.max(50, minBG - padding);
                  const graphMax = Math.min(400, maxBG + padding);
                  const graphHeight = 250;
                  const graphWidth = 100;

                  // Convert BG to Y coordinate
                  const bgToY = (bg: number) => {
                    return (
                      graphHeight -
                      ((bg - graphMin) / (graphMax - graphMin)) * graphHeight
                    );
                  };

                  // Generate SVG path for the curve
                  const pathData = cgmData
                    .map((point, index) => {
                      const x = (index / (cgmData.length - 1)) * graphWidth;
                      const y = bgToY(point.bg);
                      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
                    })
                    .join(" ");

                  return (
                    <div className="space-y-4">
                      {/* Enhanced CGM Graph */}
                      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl p-6 relative overflow-hidden shadow-2xl border border-slate-700">
                        {/* Background grid pattern */}
                        <div className="absolute inset-0 opacity-20">
                          <div
                            className="absolute inset-0"
                            style={{
                              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)`,
                              backgroundSize: "20px 20px",
                            }}
                          ></div>
                        </div>

                        {/* Target range highlight with gradient (70-180) */}
                        <div className="absolute inset-0">
                          <div
                            className="absolute w-full bg-gradient-to-t from-green-500/15 via-green-400/10 to-green-500/15 border-t-2 border-b-2 border-green-400/40"
                            style={{
                              top: `${bgToY(180)}px`,
                              height: `${bgToY(70) - bgToY(180)}px`,
                            }}
                          ></div>
                          {/* Target range label */}
                          <div
                            className="absolute left-2 text-green-400 text-xs font-bold bg-slate-800/80 px-2 py-1 rounded"
                            style={{ top: `${bgToY(125) - 20}px` }}
                          >
                            TARGET ZONE (70-180)
                          </div>
                        </div>

                        {/* Enhanced grid lines with better styling */}
                        <div className="absolute inset-0">
                          {[
                            {
                              value: 50,
                              label: "50",
                              color: "text-yellow-300",
                              bgColor: "bg-yellow-500/20",
                              isTarget: false,
                              isCritical: true,
                            },
                            {
                              value: 70,
                              label: "70",
                              color: "text-green-300",
                              bgColor: "bg-green-500/20",
                              isTarget: true,
                              isCritical: false,
                            },
                            {
                              value: 180,
                              label: "180",
                              color: "text-green-300",
                              bgColor: "bg-green-500/20",
                              isTarget: true,
                              isCritical: false,
                            },
                            {
                              value: 250,
                              label: "250",
                              color: "text-red-300",
                              bgColor: "bg-red-500/20",
                              isTarget: false,
                              isCritical: true,
                            },
                          ].map((line, i) => {
                            const y = bgToY(line.value);
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

                        {/* Enhanced time labels */}
                        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 pb-2">
                          {[
                            { time: 0, label: "Now" },
                            { time: 30, label: "30m" },
                            { time: 60, label: "1h" },
                            { time: 90, label: "1h 30m" },
                            { time: 120, label: "2h" },
                            { time: 150, label: "2h 30m" },
                            { time: 180, label: "3h" },
                          ].map((timePoint, i) => (
                            <div
                              key={i}
                              className="text-xs text-slate-300 font-mono bg-slate-800/60 px-2 py-1 rounded border border-slate-600/40"
                            >
                              {timePoint.label}
                            </div>
                          ))}
                        </div>

                        {/* BG Curve */}
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

                          {/* Area under curve */}
                          <path
                            d={`${pathData} L ${graphWidth} ${graphHeight} L 0 ${graphHeight} Z`}
                            fill="url(#bgGradient)"
                          />

                          {/* Enhanced main curve */}
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

                          {/* Enhanced data points with better styling */}
                          {cgmData.map((point, index) => {
                            const x =
                              (index / (cgmData.length - 1)) * graphWidth;
                            const y = bgToY(point.bg);
                            let color = "#10b981"; // Default green
                            let strokeColor = "#ffffff";
                            let strokeWidth = 2;
                            let glowColor = "rgba(16, 185, 129, 0.3)";

                            if (point.isCriticalHigh) {
                              color = "#dc2626"; // Dark red for critical high
                              strokeColor = "#fbbf24"; // Gold stroke
                              strokeWidth = 3;
                              glowColor = "rgba(220, 38, 38, 0.5)";
                            } else if (point.isCriticalLow) {
                              color = "#f59e0b"; // Orange for critical low
                              strokeColor = "#fbbf24"; // Gold stroke
                              strokeWidth = 3;
                              glowColor = "rgba(245, 158, 11, 0.5)";
                            } else if (point.isHigh) {
                              color = "#ef4444"; // Red for high
                              glowColor = "rgba(239, 68, 68, 0.4)";
                            } else if (point.isLow) {
                              color = "#f59e0b"; // Yellow for low
                              glowColor = "rgba(245, 158, 11, 0.4)";
                            } else if (point.isTarget) {
                              color = "#22c55e"; // Bright green for target range
                              glowColor = "rgba(34, 197, 94, 0.4)";
                            }

                            return (
                              <g key={index}>
                                {/* Glow effect */}
                                <circle
                                  cx={x}
                                  cy={y}
                                  r="10"
                                  fill={glowColor}
                                  className="blur-sm"
                                />
                                {/* Main circle */}
                                <circle
                                  cx={x}
                                  cy={y}
                                  r="7"
                                  fill={color}
                                  stroke={strokeColor}
                                  strokeWidth={strokeWidth}
                                  className="drop-shadow-xl"
                                />
                                {/* Inner circle */}
                                <circle
                                  cx={x}
                                  cy={y}
                                  r="4"
                                  fill="white"
                                  className="drop-shadow-sm"
                                />
                                {/* Value labels for key points */}
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
                                    {point.bg}
                                  </text>
                                )}
                                {/* Critical indicators */}
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
                                    {point.isCriticalHigh ? "⚠️" : "⚠️"}
                                  </text>
                                )}
                              </g>
                            );
                          })}
                        </svg>

                        {/* Enhanced Current BG display */}
                        <div className="absolute top-4 right-4 bg-gradient-to-r from-slate-800/95 to-slate-700/95 rounded-xl px-4 py-3 border border-slate-600/50 shadow-2xl">
                          <div className="flex items-center gap-3">
                            <div className="text-white text-lg font-mono font-bold">
                              {Math.round(predictions.current)} mg/dL
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
                            ICR: {predictions.ICR}g/u | ISF: {predictions.ISF}{" "}
                            mg/dL/u
                          </div>
                        </div>

                        {/* Enhanced Legend */}
                        <div className="absolute bottom-4 left-4 bg-gradient-to-r from-slate-800/95 to-slate-700/95 rounded-xl px-4 py-3 border border-slate-600/50 shadow-2xl">
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-green-500 shadow-lg"></div>
                              <span className="text-green-300 font-medium">
                                Target (70-180)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-lg"></div>
                              <span className="text-yellow-300 font-medium">
                                Low (&lt;70)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-red-500 shadow-lg"></div>
                              <span className="text-red-300 font-medium">
                                High (&gt;180)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-red-600 border-2 border-yellow-400 shadow-lg"></div>
                              <span className="text-yellow-300 font-medium">
                                Critical (&gt;250)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Key metrics */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border text-center">
                          <p className="text-xs text-muted-foreground mb-1">
                            Peak
                          </p>
                          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            {Math.max(...cgmData.map((d) => d.bg))} mg/dL
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border text-center">
                          <p className="text-xs text-muted-foreground mb-1">
                            Lowest
                          </p>
                          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            {Math.min(...cgmData.map((d) => d.bg))} mg/dL
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border text-center">
                          <p className="text-xs text-muted-foreground mb-1">
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
                            {Math.round(predictions.threeHours)} mg/dL
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    <strong>Note:</strong> These are rough estimates. Individual
                    responses vary significantly. Always monitor your actual
                    blood glucose and adjust as needed.
                  </p>
                </div>
              </div>
            )}

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
