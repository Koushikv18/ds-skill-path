import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, Sparkles, Target } from "lucide-react";

type ActivityRow = {
  id: string;
  date: string;
  activity_type: string;
  module_id: number | null;
  minutes_spent: number | null;
};

function getIsoWeekKey(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = (day + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  const year = copy.getFullYear();
  const week = Math.ceil(((copy.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function getWeekRange(key: string) {
  const [year, week] = key.split("-W");
  const weekNumber = Number(week);
  const first = new Date(Number(year), 0, 4);
  const monday = new Date(first);
  monday.setDate(first.getDate() - ((first.getDay() + 6) % 7) + (weekNumber - 1) * 7);
  return { start: monday, end: new Date(monday.getTime() + 6 * 86400000) };
}

export function WeeklyTracker() {
  const [goal, setGoal] = useState(4);
  const { data: activities = [] } = useQuery({
    queryKey: ["activity-log"],
    queryFn: async () => {
      const { data, error } = await supabase.from("activity_log").select("id,date,activity_type,module_id,minutes_spent").order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
  });

  useEffect(() => {
    const storedGoal = window.localStorage.getItem("ds-track-weekly-goal");
    if (storedGoal) {
      setGoal(Number(storedGoal));
    }
  }, []);

  const { weeks, currentWeekStats } = useMemo(() => {
    const byWeek = new Map<string, ActivityRow[]>();
    activities.forEach((activity) => {
      const key = getIsoWeekKey(new Date(activity.date));
      const bucket = byWeek.get(key) ?? [];
      bucket.push(activity);
      byWeek.set(key, bucket);
    });

    const orderedWeeks = Array.from(byWeek.entries()).sort(([a], [b]) => a.localeCompare(b));
    const lastTwelve = orderedWeeks.slice(-12);
    const weeks = Array.from({ length: 12 }, (_, index) => {
      const base = new Date();
      base.setDate(base.getDate() - (11 - index) * 7);
      const key = getIsoWeekKey(base);
      const bucket = byWeek.get(key) ?? [];
      return { key, count: bucket.length, label: `Week ${key.split("-W")[1]}` };
    });

    const currentKey = getIsoWeekKey(new Date());
    const currentBucket = byWeek.get(currentKey) ?? [];
    const uniqueActiveDays = new Set(currentBucket.map((item) => item.date)).size;
    const modulesCompleted = currentBucket.filter((item) => item.activity_type === "module_passed").length;
    const sqlRuns = currentBucket.filter((item) => item.activity_type === "sql_run").length;
    return { weeks, currentWeekStats: { uniqueActiveDays, modulesCompleted, sqlRuns, total: currentBucket.length } };
  }, [activities]);

  const progress = Math.min(100, Math.round((currentWeekStats.uniqueActiveDays / Math.max(goal, 1)) * 100));

  return (
    <Card className="border-border/70 bg-card/80 shadow-[var(--shadow-sm)]">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-xl">Weekly Tracker</CardTitle>
            <CardDescription className="mt-1">A live heatmap of your activity built from the same activity stream as the rest of the app.</CardDescription>
          </div>
          <div className="rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            Goal: {goal} active days/week
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-[1.7fr_1fr]">
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <CalendarDays className="h-4 w-4 text-primary" />
              Last 12 weeks
            </div>
            <div className="grid grid-cols-12 gap-1.5">
              {weeks.map((week) => (
                <div key={week.key} className="flex flex-col items-center gap-1">
                  <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: week.count > 0 ? "oklch(0.66 0.18 210 / 0.75)" : "oklch(0.2 0.02 250 / 0.45)" }} />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{week.key.split("-W")[1]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Target className="h-4 w-4 text-primary" />
              This week
            </div>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Modules completed</span><span className="font-semibold">{currentWeekStats.modulesCompleted}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">SQL tasks completed</span><span className="font-semibold">{currentWeekStats.sqlRuns}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Active days</span><span className="font-semibold">{currentWeekStats.uniqueActiveDays}</span></div>
            </div>
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Goal progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">
          <Sparkles className="h-4 w-4" />
          The tracker stays aligned with your live activity log, so there is no separate number to maintain.
        </div>
      </CardContent>
    </Card>
  );
}
