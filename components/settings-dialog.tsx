"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRatio: number;
  currentBG: string;
  bgTrend: string;
  totalDailyDose: string;
  bgUnit?: "mg/dL" | "mmol/L";
  onUpdateProfile: (data: {
    ratio: number;
    currentBG: string;
    bgTrend: string;
    totalDailyDose: string;
    bgUnit: "mg/dL" | "mmol/L";
  }) => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  currentRatio,
  currentBG,
  bgTrend,
  totalDailyDose,
  bgUnit = "mg/dL",
  onUpdateProfile,
}: SettingsDialogProps) {
  const [ratio, setRatio] = useState(currentRatio.toString());
  const [bg, setBg] = useState(currentBG);
  const [trend, setTrend] = useState(bgTrend);
  const [tdd, setTdd] = useState(totalDailyDose);
  const [unit, setUnit] = useState<"mg/dL" | "mmol/L">(bgUnit);

  const handleSave = () => {
    const ratioValue = Number.parseFloat(ratio);
    if (ratioValue > 0 && bg.trim() && trend && tdd.trim()) {
      onUpdateProfile({
        ratio: ratioValue,
        currentBG: bg.trim(),
        bgTrend: trend,
        totalDailyDose: tdd.trim(),
        bgUnit: unit,
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader className="text-center pb-8">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">⚙️</span>
          </div>
          <DialogTitle className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Settings
          </DialogTitle>
          <DialogDescription className="text-lg text-gray-600 dark:text-gray-400">
            Configure your diabetes management preferences for accurate insulin
            dosing
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8">
          {/* Carb Ratio Section */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <span className="text-lg">💉</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Carb-to-Insulin Ratio
              </h3>
            </div>

            <div className="space-y-3">
              <Label
                htmlFor="settings-ratio"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                How many grams of carbs are covered by 1 unit of insulin?
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="settings-ratio"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={ratio}
                  onChange={(e) => setRatio(e.target.value)}
                  className="text-lg py-3 px-4 border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg"
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">
                  grams per unit
                </span>
              </div>
            </div>
          </div>

          {/* BG Information Section */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-xl p-8 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <span className="text-xl">🩸</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Blood Glucose Information
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Set your current BG and preferred units
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Current BG and Unit */}
              <div className="space-y-4">
                <Label
                  htmlFor="settings-bg"
                  className="text-base font-medium text-gray-700 dark:text-gray-300"
                >
                  Current Blood Glucose
                </Label>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Input
                      id="settings-bg"
                      type="number"
                      min={unit === "mg/dL" ? "50" : "2.8"}
                      max={unit === "mg/dL" ? "500" : "27.8"}
                      step={unit === "mg/dL" ? "1" : "0.1"}
                      value={bg}
                      onChange={(e) => setBg(e.target.value)}
                      className="text-lg py-4 px-4 border-2 border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 rounded-lg w-full"
                      placeholder={unit === "mg/dL" ? "120" : "6.7"}
                    />
                  </div>
                  <div className="w-32">
                    <Select
                      value={unit}
                      onValueChange={(value: "mg/dL" | "mmol/L") =>
                        setUnit(value)
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
                  {unit === "mg/dL"
                    ? "Normal range: 70-180 mg/dL"
                    : "Normal range: 3.9-10.0 mmol/L"}
                </p>
              </div>

              {/* TDD */}
              <div className="space-y-4">
                <Label
                  htmlFor="settings-tdd"
                  className="text-base font-medium text-gray-700 dark:text-gray-300"
                >
                  Total Daily Insulin Dose
                </Label>
                <div className="relative">
                  <Input
                    id="settings-tdd"
                    type="number"
                    min="10"
                    max="200"
                    step="0.1"
                    value={tdd}
                    onChange={(e) => setTdd(e.target.value)}
                    className="text-lg py-4 px-4 border-2 border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 rounded-lg w-full"
                    placeholder="40"
                  />
                  <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-sm text-gray-500 font-medium">
                    units
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Your total daily insulin dose (used for ICR/ISF calculations)
                </p>
              </div>
            </div>

            {/* BG Trend Section */}
            <div className="mt-8">
              <Label className="text-base font-medium text-gray-700 dark:text-gray-300 mb-4 block">
                Current BG Trend
              </Label>
              <div className="grid grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setTrend("falling")}
                  className={`px-6 py-6 rounded-xl text-sm font-medium transition-all duration-200 ${
                    trend === "falling"
                      ? "bg-red-100 text-red-800 border-2 border-red-400 shadow-lg scale-105"
                      : "bg-gray-50 text-gray-700 border-2 border-gray-300 hover:bg-red-50 hover:border-red-300 hover:scale-102"
                  }`}
                >
                  <div className="text-2xl mb-2">📉</div>
                  <div className="text-sm font-semibold">Falling</div>
                  <div className="text-xs text-gray-500 mt-1">
                    BG decreasing
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setTrend("stable")}
                  className={`px-6 py-6 rounded-xl text-sm font-medium transition-all duration-200 ${
                    trend === "stable"
                      ? "bg-green-100 text-green-800 border-2 border-green-400 shadow-lg scale-105"
                      : "bg-gray-50 text-gray-700 border-2 border-gray-300 hover:bg-green-50 hover:border-green-300 hover:scale-102"
                  }`}
                >
                  <div className="text-2xl mb-2">➡️</div>
                  <div className="text-sm font-semibold">Stable</div>
                  <div className="text-xs text-gray-500 mt-1">BG steady</div>
                </button>
                <button
                  type="button"
                  onClick={() => setTrend("rising")}
                  className={`px-6 py-6 rounded-xl text-sm font-medium transition-all duration-200 ${
                    trend === "rising"
                      ? "bg-orange-100 text-orange-800 border-2 border-orange-400 shadow-lg scale-105"
                      : "bg-gray-50 text-gray-700 border-2 border-gray-300 hover:bg-orange-50 hover:border-orange-300 hover:scale-102"
                  }`}
                >
                  <div className="text-2xl mb-2">📈</div>
                  <div className="text-sm font-semibold">Rising</div>
                  <div className="text-xs text-gray-500 mt-1">
                    BG increasing
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-6 pt-8">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 py-4 text-lg font-medium border-2 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 py-4 text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
              disabled={!ratio || !bg.trim() || !trend || !tdd.trim()}
            >
              💾 Save Changes
            </Button>
          </div>

          {(!ratio || !bg.trim() || !trend || !tdd.trim()) && (
            <div className="text-center p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                ⚠️ Please fill in all fields to save your settings
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
