"use client"

import { useState, useEffect } from "react"
import { ProfileSetup } from "@/components/profile-setup"
import { FoodAnalyzer } from "@/components/food-analyzer"

export default function Home() {
  const [carbRatio, setCarbRatio] = useState<number | null>(null)

  useEffect(() => {
    // Load carb ratio from localStorage
    const stored = localStorage.getItem("carbRatio")
    if (stored) {
      setCarbRatio(Number.parseFloat(stored))
    }
  }, [])

  const handleRatioSave = (ratio: number) => {
    localStorage.setItem("carbRatio", ratio.toString())
    setCarbRatio(ratio)
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-2">T1D Carb Tracker</h1>
          <p className="text-muted-foreground">Snap a photo, get your insulin dose</p>
        </header>

        {carbRatio === null ? (
          <ProfileSetup onSave={handleRatioSave} />
        ) : (
          <FoodAnalyzer carbRatio={carbRatio} onUpdateRatio={handleRatioSave} />
        )}
      </div>
    </main>
  )
}
