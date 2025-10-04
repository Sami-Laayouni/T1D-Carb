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
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center justify-center space-y-4">
          {preview ? (
            <div className="relative w-full max-w-md">
              <img
                src={preview || "/placeholder.svg"}
                alt="Food preview"
                className="w-full h-64 object-cover rounded-lg"
              />
              {isAnalyzing && (
                <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                  <div className="text-center text-white">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p className="text-sm">Analyzing your food...</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="w-full max-w-md h-64 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-card">
                <div className="text-center">
                  <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Take a photo of your food
                  </p>
                  <p className="text-xs text-muted-foreground">
                    We'll estimate the carbs and calculate your dose
                  </p>
                </div>
              </div>
              <div className="flex gap-3 w-full max-w-md">
                <Button
                  onClick={handleCameraClick}
                  disabled={isAnalyzing}
                  size="lg"
                  className="flex-1"
                  variant="default"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Camera className="h-5 w-5 mr-2" />
                      Take Photo
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleUploadClick}
                  disabled={isAnalyzing}
                  size="lg"
                  className="flex-1"
                  variant="outline"
                >
                  <ImageIcon className="h-5 w-5 mr-2" />
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
      </CardContent>
    </Card>
  );
}
