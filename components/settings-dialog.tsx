"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRatio: number
  onUpdateRatio: (ratio: number) => void
}

export function SettingsDialog({ open, onOpenChange, currentRatio, onUpdateRatio }: SettingsDialogProps) {
  const [ratio, setRatio] = useState(currentRatio.toString())

  const handleSave = () => {
    const ratioValue = Number.parseFloat(ratio)
    if (ratioValue > 0) {
      onUpdateRatio(ratioValue)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Update your carb-to-insulin ratio</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="settings-ratio">Carb-to-Insulin Ratio</Label>
            <div className="flex items-center gap-2">
              <Input
                id="settings-ratio"
                type="number"
                step="0.1"
                min="0.1"
                value={ratio}
                onChange={(e) => setRatio(e.target.value)}
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">grams per unit</span>
            </div>
          </div>
          <Button onClick={handleSave} className="w-full">
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
