"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PenTool, Calculator } from "lucide-react";

interface ManualFoodEntryProps {
  onFoodSubmit: (data: { foodName: string; notes?: string }) => void;
  isProcessing: boolean;
}

export function ManualFoodEntry({
  onFoodSubmit,
  isProcessing,
}: ManualFoodEntryProps) {
  const [foodName, setFoodName] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (foodName.trim()) {
      onFoodSubmit({
        foodName: foodName.trim(),
        notes: notes.trim() || undefined,
      });
      // Reset form
      setFoodName("");
      setNotes("");
    }
  };

  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-white/20 dark:border-gray-700/50">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
          <PenTool className="h-10 w-10 text-white" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          Manual Food Entry
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          Add food details manually without taking a photo
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-3">
          <Label htmlFor="foodName" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Food Name
          </Label>
          <Input
            id="foodName"
            value={foodName}
            onChange={(e) => setFoodName(e.target.value)}
            placeholder="e.g., Apple, 1 medium"
            required
            className="h-14 text-lg px-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800 transition-all duration-200"
          />
        </div>

        <div className="space-y-3">
          <Label htmlFor="notes" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Additional Notes (Optional)
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., With skin, estimated portion, special preparation..."
            rows={4}
            className="text-lg px-4 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800 resize-none transition-all duration-200"
          />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Add any relevant details about the food or preparation
          </p>
        </div>

        <Button
          type="submit"
          disabled={isProcessing || !foodName.trim()}
          className="w-full h-16 text-lg font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl"
        >
          {isProcessing ? (
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
              <span>Analyzing food...</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Calculator className="h-6 w-6" />
              <span>Analyze Food</span>
            </div>
          )}
        </Button>
      </form>
    </div>
  );
}
