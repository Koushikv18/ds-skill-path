import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [goal, setGoal] = useState("4");

  useEffect(() => {
    const stored = window.localStorage.getItem("ds-track-weekly-goal");
    if (stored) setGoal(stored);
  }, []);

  const saveGoal = () => {
    const parsed = Number(goal);
    if (Number.isFinite(parsed) && parsed > 0) {
      window.localStorage.setItem("ds-track-weekly-goal", String(parsed));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Card className="border-border/70 bg-card/80 shadow-[var(--shadow-sm)]">
          <CardHeader>
            <CardTitle className="text-xl">Settings</CardTitle>
            <CardDescription>Adjust your weekly goal for the tracker and keep the dashboard aligned with your current pace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="weekly-goal">Weekly active days goal</Label>
              <Input id="weekly-goal" type="number" min="1" value={goal} onChange={(event) => setGoal(event.target.value)} />
            </div>
            <Button onClick={saveGoal}>Save goal</Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
