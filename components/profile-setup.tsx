"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ProfileSetupProps {
  onSave: (ratio: number) => void
}

export function ProfileSetup({ onSave }: ProfileSetupProps) {
  const [ratio, setRatio] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const ratioValue = Number.parseFloat(ratio)
    if (ratioValue > 0) {
      onSave(ratioValue)
    }
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Welcome to T1D Carb Tracker</CardTitle>
        <CardDescription>First, let's set up your carb-to-insulin ratio</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ratio">Carb-to-Insulin Ratio</Label>
            <div className="flex items-center gap-2">
              <Input
                id="ratio"
                type="number"
                step="0.1"
                min="0.1"
                placeholder="10"
                value={ratio}
                onChange={(e) => setRatio(e.target.value)}
                required
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">grams per unit</span>
            </div>
            <p className="text-sm text-muted-foreground">
              This is how many grams of carbs are covered by 1 unit of insulin. For example, if your ratio is 10:1,
              enter 10.
            </p>
          </div>
          <Button type="submit" className="w-full">
            Continue
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
