import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ensureDailyChecklist, updateChecklistItemStatus } from "@/lib/activity";
import { CheckCircle2, Sparkles } from "lucide-react";

type ChecklistItem = {
  id: string;
  date: string;
  item_type: string;
  label: string;
  status: "pending" | "done";
  ref_id: number | string | null;
};

function getTodayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function DailyChecklistCard({ userId, nextModuleLabel, nextModuleId }: { userId: string; nextModuleLabel: string; nextModuleId?: number | null }) {
  const [streak, setStreak] = useState(0);
  const [celebration, setCelebration] = useState(false);
  const today = getTodayKey();

  const { data: checklist = [], refetch } = useQuery({
    queryKey: ["daily-checklist", userId, today],
    queryFn: async () => {
      const { data, error } = await supabase.from("daily_checklist").select("id,date,item_type,label,status,ref_id").eq("user_id", userId).eq("date", today).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChecklistItem[];
    },
  });

  useEffect(() => {
    const stored = window.localStorage.getItem("ds-track-streak");
    if (stored) setStreak(Number(stored));
    void ensureDailyChecklist({ userId, nextModuleLabel, moduleId: nextModuleId });
  }, [userId, nextModuleLabel, nextModuleId]);

  useEffect(() => {
    const channel = supabase.channel(`daily-checklist-${userId}`);
    channel.on("postgres_changes", { event: "*", schema: "public", table: "daily_checklist", filter: `user_id=eq.${userId}` }, () => {
      void refetch();
    });
    channel.on("postgres_changes", { event: "*", schema: "public", table: "activity_log", filter: `user_id=eq.${userId}` }, () => {
      void refetch();
    });
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refetch, userId]);

  useEffect(() => {
    if (!checklist.length) return;
    const allDone = checklist.every((item) => item.status === "done");
    if (allDone && !celebration) {
      setCelebration(true);
      const stored = Number(window.localStorage.getItem("ds-track-streak") ?? "0");
      const nextStreak = stored + 1;
      window.localStorage.setItem("ds-track-streak", String(nextStreak));
      setStreak(nextStreak);
      window.setTimeout(() => setCelebration(false), 1800);
    }
  }, [celebration, checklist]);

  const pendingCount = useMemo(() => checklist.filter((item) => item.status === "pending").length, [checklist]);

  const toggleItem = async (id: string, status: "pending" | "done") => {
    await updateChecklistItemStatus({ id, status });
    await refetch();
  };

  return (
    <Card className="border-border/70 bg-card/80 shadow-[var(--shadow-sm)]">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-xl">Today</CardTitle>
            <CardDescription className="mt-1">A compact checklist that updates instantly when you complete the underlying tasks in another tab.</CardDescription>
          </div>
          <div className="rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            Streak {streak}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {checklist.length ? checklist.map((item) => (
          <label key={item.id} className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/70 px-3 py-2">
            <Checkbox checked={item.status === "done"} onCheckedChange={() => toggleItem(item.id, item.status === "done" ? "pending" : "done")} />
            <span className={`text-sm ${item.status === "done" ? "text-muted-foreground line-through" : "text-foreground"}`}>{item.label}</span>
          </label>
        )) : <div className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">Preparing today’s checklist…</div>}
        {celebration && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            All done — your streak just grew.
          </div>
        )}
        {pendingCount === 0 && !celebration && (
          <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">
            <Sparkles className="h-4 w-4" />
            You’ve completed today’s routine. Nice work.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
