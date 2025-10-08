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
    <Card className="border-purple-500">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
            <PenTool className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <CardTitle className="text-lg">Manual Food Entry</CardTitle>
            <CardDescription>
              Add food details manually without taking a photo
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="foodName" className="text-sm font-medium">
              Food Name
            </Label>
            <Input
              id="foodName"
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              placeholder="e.g., Apple, 1 medium"
              required
              className="text-base py-3"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">
              Additional Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., With skin, estimated portion, special preparation..."
              rows={3}
              className="text-base resize-none"
            />
            <p className="text-xs text-gray-500">
              Add any relevant details about the food or preparation
            </p>
          </div>

          <Button
            type="submit"
            disabled={isProcessing || !foodName.trim()}
            className="w-full py-3 text-base font-medium bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Analyzing food...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Analyze Food
              </div>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
