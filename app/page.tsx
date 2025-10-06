"use client";

import { useState, useEffect } from "react";
import { ProfileSetup } from "@/components/profile-setup";
import { FoodAnalyzer } from "@/components/food-analyzer";

export default function Home() {
  const [profileData, setProfileData] = useState<{
    ratio: number;
    currentBG: string;
    bgTrend: string;
    totalDailyDose: string;
    bgUnit: "mg/dL" | "mmol/L";
  } | null>(null);

  useEffect(() => {
    // Load profile data from localStorage
    const stored = localStorage.getItem("profileData");
    if (stored) {
      setProfileData(JSON.parse(stored));
    }
  }, []);

  const handleProfileSave = (data: {
    ratio: number;
    currentBG: string;
    bgTrend: string;
    totalDailyDose: string;
    bgUnit: "mg/dL" | "mmol/L";
  }) => {
    localStorage.setItem("profileData", JSON.stringify(data));
    setProfileData(data);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {profileData === null ? (
          <ProfileSetup onSave={handleProfileSave} />
        ) : (
          <div className="space-y-8">
            <header className="text-center">
              <h1 className="text-5xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                🩸 T1D Carb Tracker
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-400">
                Snap a photo, get your insulin dose
              </p>
            </header>

            <FoodAnalyzer
              carbRatio={profileData.ratio}
              currentBG={profileData.currentBG}
              bgTrend={profileData.bgTrend}
              totalDailyDose={profileData.totalDailyDose}
              bgUnit={profileData.bgUnit}
              onUpdateProfile={handleProfileSave}
            />
          </div>
        )}
      </div>
    </main>
  );
}
