"use client";

import type React from "react";

import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Loader2, ImageIcon } from "lucide-react";

interface FoodUploadProps {
  onImageCapture: (imageUrl: string, file: File) => void;
  isAnalyzing: boolean;
}

export function FoodUpload({ onImageCapture, isAnalyzing }: FoodUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageUrl = reader.result as string;
        setPreview(imageUrl);
        onImageCapture(imageUrl, file);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-white/20 dark:border-gray-700/50">
      <div className="flex flex-col items-center justify-center space-y-6">
        {preview ? (
          <div className="relative w-full max-w-sm">
            <img
              src={preview || "/placeholder.svg"}
              alt="Food preview"
              className="w-full h-80 object-cover rounded-2xl shadow-lg"
            />
            {isAnalyzing && (
              <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <div className="text-center text-white">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                  <p className="text-lg font-semibold mb-1">Analyzing your food...</p>
                  <p className="text-sm opacity-90">AI is detecting food items and calculating carbs</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="w-full max-w-sm h-80 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800">
              <div className="text-center p-6">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Camera className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Take a photo of your food
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Our AI will detect food items and calculate accurate carb counts
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span>AI-powered analysis</span>
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
              <Button
                onClick={handleCameraClick}
                disabled={isAnalyzing}
                size="lg"
                className="flex-1 h-14 text-lg font-semibold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-6 w-6 mr-3 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Camera className="h-6 w-6 mr-3" />
                    Take Photo
                  </>
                )}
              </Button>
              <Button
                onClick={handleUploadClick}
                disabled={isAnalyzing}
                size="lg"
                className="flex-1 h-14 text-lg font-semibold bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-2 border-gray-300 dark:border-gray-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl"
              >
                <ImageIcon className="h-6 w-6 mr-3" />
                Upload
              </Button>
            </div>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
