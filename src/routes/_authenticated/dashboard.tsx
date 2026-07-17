import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { LEVELS, type Module } from "@/lib/modules";
import { Lock, Sparkles, Play, Trophy, Flame, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { WeeklyTracker } from "@/components/WeeklyTracker";
import { DailyChecklistCard } from "@/components/DailyChecklistCard";

type ProgressStatus = "locked" | "unlocked" | "in_progress" | "passed";
type ProgressRow = { module_id: number; status: ProgressStatus };

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your skill tree · DS Track" },
      { name: "description", content: "Your personal Data Science skill tree — twelve modules across three levels." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();

  const { data: modules = [] } = useQuery({
    queryKey: ["modules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("modules").select("*").order("id");
      if (error) throw error;
      return data as Module[];
    },
  });

  const { data: progress = [] } = useQuery({
    queryKey: ["progress", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_module_progress")
        .select("module_id,status")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []) as ProgressRow[];
    },
  });

  const statusById = new Map(progress.map((p) => [p.module_id, p.status]));
  const passedCount = progress.filter((p) => p.status === "passed").length;
  const currentLevel = modules.find((m) => statusById.get(m.id) === "unlocked" || statusById.get(m.id) === "in_progress")?.level
    ?? (passedCount === 12 ? 3 : 1);

  const nextModule = modules.find((m) => {
    const s = statusById.get(m.id);
    return s === "unlocked" || s === "in_progress";
  }) ?? modules.find((m) => statusById.get(m.id) !== "passed");

  const nextModuleLabel = nextModule
    ? `Continue: ${nextModule.title}`
    : "You've cleared the skill tree — pick a module to revisit.";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader email={user.email} />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-10 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Welcome back</p>
              <h1 className="mt-1 font-display text-3xl font-bold">Let's keep building.</h1>
              <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                {nextModule ? (
                  <>Your next step is <span className="font-medium text-foreground">{nextModule.title}</span>. About 20 minutes.</>
                ) : (
                  <>All twelve modules complete. Revisit a capstone or head to SQL Practice.</>
                )}
              </p>
            </div>
            {nextModule && (
              <Link to="/modules/$id" params={{ id: String(nextModule.id) }}>
                <div className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-90">
                  <Play className="h-4 w-4" /> Continue learning
                </div>
              </Link>
            )}
          </div>
          <div className="mt-6 flex gap-6 text-sm">
            <Stat icon={Flame} label="Day streak" value="0" />
            <Stat icon={Trophy} label="Modules done" value={`${passedCount} / 12`} />
            <Stat icon={Sparkles} label="Level" value={LEVELS[currentLevel - 1]?.name ?? "Basic"} />
          </div>
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <WeeklyTracker />
          <DailyChecklistCard
            userId={user.id}
            nextModuleLabel={nextModuleLabel}
            nextModuleId={nextModule?.id ?? null}
          />
        </div>

        <div className="mb-2">
          <h2 className="font-display text-2xl font-bold">Your skill tree</h2>
          <p className="mt-1 text-sm text-muted-foreground">Twelve modules across three levels. Finish a level to unlock the next.</p>
        </div>

        <div className="mt-8 space-y-14">
          {LEVELS.map((lvl) => {
            const levelModules = modules.filter((m) => m.level === lvl.level);
            return (
              <section key={lvl.level}>
                <div className="mb-6 flex items-baseline gap-3">
                  <div className={cn(
                    "grid h-9 w-9 place-items-center rounded-full text-sm font-bold",
                    lvl.level === 1 && "bg-primary text-primary-foreground",
                    lvl.level === 2 && "bg-accent text-accent-foreground",
                    lvl.level === 3 && "bg-foreground text-background",
                  )}>{lvl.level}</div>
                  <div>
                    <h3 className="font-display text-xl font-bold">{lvl.name}</h3>
                    <p className="text-sm text-muted-foreground">{lvl.tagline}</p>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-border via-border to-transparent" aria-hidden />
                  <div className="space-y-6">
                    {levelModules.map((m, idx) => (
                      <ModuleNode
                        key={m.id}
                        module={m}
                        status={statusById.get(m.id) ?? "locked"}
                        side={idx % 2 === 0 ? "left" : "right"}
                      />
                    ))}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-muted-foreground"><Icon className="h-4 w-4" /></div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

function ModuleNode({ module: m, status, side }: { module: Module; status: ProgressStatus; side: "left" | "right" }) {
  const clickable = status !== "locked";
  const passed = status === "passed";

  const inner = (
    <div className={cn(
      "group relative rounded-2xl border transition",
      m.is_capstone
        ? "border-transparent shadow-[var(--shadow-capstone)]"
        : "border-border bg-card shadow-[var(--shadow-sm)]",
      clickable ? "hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]" : "opacity-60",
      passed && "ring-1 ring-emerald-500/40",
      m.is_capstone ? "p-6" : "p-5",
    )}
    style={m.is_capstone ? { background: "var(--gradient-capstone)" } : undefined}
    >
      <div className="flex items-start gap-4">
        <div className={cn(
          "grid shrink-0 place-items-center rounded-xl font-bold",
          m.is_capstone ? "h-12 w-12 bg-white/20 text-white text-lg" : "h-10 w-10 bg-primary/10 text-primary",
        )}>
          {passed ? <Check className="h-5 w-5 text-emerald-500" /> : clickable ? m.order_in_level : <Lock className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {m.is_capstone && (
              <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Capstone Project
              </span>
            )}
            {status === "passed" && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Passed
              </span>
            )}
            {status === "in_progress" && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                In progress
              </span>
            )}
            {status === "locked" && !m.is_capstone && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Locked
              </span>
            )}
          </div>
          <h4 className={cn(
            "mt-1 font-display font-bold",
            m.is_capstone ? "text-xl text-white" : "text-lg",
          )}>{m.title}</h4>
          <p className={cn(
            "mt-1.5 text-sm leading-relaxed",
            m.is_capstone ? "text-white/85" : "text-muted-foreground",
          )}>{m.description}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn("relative flex", side === "left" ? "md:justify-start md:pr-[52%]" : "md:justify-end md:pl-[52%]")}>
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-6 hidden h-3 w-3 -translate-x-1/2 rounded-full border-2 border-background bg-primary md:block"
        style={m.is_capstone ? { background: "var(--capstone)" } : passed ? { background: "rgb(16 185 129)" } : undefined}
      />
      {clickable ? (
        <Link to="/modules/$id" params={{ id: String(m.id) }} className="block w-full">{inner}</Link>
      ) : (
        <div className="w-full cursor-not-allowed">{inner}</div>
      )}
    </div>
  );
}
