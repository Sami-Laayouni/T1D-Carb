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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProfileSetupProps {
  onSave: (data: {
    ratio: number;
    currentBG: string;
    bgTrend: string;
    totalDailyDose: string;
    bgUnit: "mg/dL" | "mmol/L";
  }) => void;
}

export function ProfileSetup({ onSave }: ProfileSetupProps) {
  const [ratio, setRatio] = useState("");
  const [currentBG, setCurrentBG] = useState("");
  const [bgTrend, setBgTrend] = useState("");
  const [totalDailyDose, setTotalDailyDose] = useState("40");
  const [bgUnit, setBgUnit] = useState<"mg/dL" | "mmol/L">("mg/dL");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ratioValue = Number.parseFloat(ratio);
    if (
      ratioValue > 0 &&
      currentBG.trim() &&
      bgTrend &&
      totalDailyDose.trim()
    ) {
      onSave({
        ratio: ratioValue,
        currentBG: currentBG.trim(),
        bgTrend,
        totalDailyDose: totalDailyDose.trim(),
        bgUnit,
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-2xl p-8 shadow-xl border border-blue-200 dark:border-blue-800">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-900 dark:text-blue-100 mb-3">
            🩸 T1D Carb Tracker
          </h1>
          <p className="text-lg text-blue-700 dark:text-blue-300">
            Set up your profile for accurate insulin dosing
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Carb Ratio Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <span className="text-xl">💉</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Carb-to-Insulin Ratio
              </h2>
            </div>

            <div className="space-y-3">
              <Label
                htmlFor="ratio"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                How many grams of carbs are covered by 1 unit of insulin?
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="ratio"
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="10"
                  value={ratio}
                  onChange={(e) => setRatio(e.target.value)}
                  required
                  className="text-lg py-3 px-4 border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg"
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">
                  grams per unit
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Example: If your ratio is 10:1, enter 10
              </p>
            </div>
          </div>

          {/* BG Information Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <span className="text-xl">🩸</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Blood Glucose Information
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Current BG */}
              <div className="space-y-3">
                <Label
                  htmlFor="currentBG"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Current Blood Glucose
                </Label>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Input
                      id="currentBG"
                      type="number"
                      min={bgUnit === "mg/dL" ? "50" : "2.8"}
                      max={bgUnit === "mg/dL" ? "500" : "27.8"}
                      step={bgUnit === "mg/dL" ? "1" : "0.1"}
                      placeholder={bgUnit === "mg/dL" ? "120" : "6.7"}
                      value={currentBG}
                      onChange={(e) => setCurrentBG(e.target.value)}
                      required
                      className="text-lg py-3 px-4 border-2 border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 rounded-lg w-full"
                    />
                  </div>
                  <div className="w-32">
                    <Select
                      value={bgUnit}
                      onValueChange={(value: "mg/dL" | "mmol/L") =>
                        setBgUnit(value)
                      }
                    >
                      <SelectTrigger className="h-12 text-base border-2 border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mg/dL">mg/dL</SelectItem>
                        <SelectItem value="mmol/L">mmol/L</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {bgUnit === "mg/dL"
                    ? "Normal range: 70-180 mg/dL"
                    : "Normal range: 3.9-10.0 mmol/L"}
                </p>
              </div>

              {/* TDD */}
              <div className="space-y-3">
                <Label
                  htmlFor="totalDailyDose"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Total Daily Insulin Dose
                </Label>
                <div className="relative">
                  <Input
                    id="totalDailyDose"
                    type="number"
                    min="10"
                    max="200"
                    placeholder="40"
                    value={totalDailyDose}
                    onChange={(e) => setTotalDailyDose(e.target.value)}
                    required
                    className="text-lg py-3 px-4 border-2 border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 rounded-lg w-full"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">
                    units
                  </span>
                </div>
              </div>

              {/* BG Trend */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  BG Trend
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBgTrend("falling")}
                    className={`px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                      bgTrend === "falling"
                        ? "bg-red-100 text-red-800 border-2 border-red-400 shadow-md"
                        : "bg-gray-50 text-gray-700 border border-gray-300 hover:bg-red-50 hover:border-red-300"
                    }`}
                  >
                    <div className="text-lg mb-1">📉</div>
                    <div className="text-xs">Falling</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBgTrend("stable")}
                    className={`px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                      bgTrend === "stable"
                        ? "bg-green-100 text-green-800 border-2 border-green-400 shadow-md"
                        : "bg-gray-50 text-gray-700 border border-gray-300 hover:bg-green-50 hover:border-green-300"
                    }`}
                  >
                    <div className="text-lg mb-1">➡️</div>
                    <div className="text-xs">Stable</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBgTrend("rising")}
                    className={`px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                      bgTrend === "rising"
                        ? "bg-orange-100 text-orange-800 border-2 border-orange-400 shadow-md"
                        : "bg-gray-50 text-gray-700 border border-gray-300 hover:bg-orange-50 hover:border-orange-300"
                    }`}
                  >
                    <div className="text-lg mb-1">📈</div>
                    <div className="text-xs">Rising</div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="text-center">
            <Button
              type="submit"
              className="px-8 py-4 text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              disabled={
                !ratio ||
                !currentBG.trim() ||
                !bgTrend ||
                !totalDailyDose.trim()
              }
            >
              🚀 Start Tracking
            </Button>

            {(!ratio ||
              !currentBG.trim() ||
              !bgTrend ||
              !totalDailyDose.trim()) && (
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-3">
                Please fill in all fields to continue
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
