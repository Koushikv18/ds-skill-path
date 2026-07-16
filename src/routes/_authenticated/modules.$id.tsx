import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { ArrowLeft, Code2, Sparkles, Lock, Play, DatabaseZap } from "lucide-react";
import type { Module } from "@/lib/modules";
import { Button } from "@/components/ui/button";
import { logActivity } from "@/lib/activity";

export const Route = createFileRoute("/_authenticated/modules/$id")({
  component: ModuleDetail,
});

function ModuleDetail() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const moduleId = Number(id);

  const completeModule = async () => {
    await logActivity({ userId: user.id, type: "module_passed", moduleId });
  };

  const { data: module, isLoading } = useQuery({
    queryKey: ["module", moduleId],
    queryFn: async () => {
      const { data, error } = await supabase.from("modules").select("*").eq("id", moduleId).maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data as Module;
    },
  });

  const unlocked = moduleId === 1;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader email={user.email} />

      <main className="mx-auto max-w-4xl px-6 py-8">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to skill tree
        </Link>

        {isLoading || !module ? (
          <div className="mt-8 h-40 animate-pulse rounded-2xl bg-muted" />
        ) : (
          <>
            <div className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Level {module.level}</span>
              <span>·</span>
              <span>Module {module.order_in_level}</span>
              {module.is_capstone && (
                <>
                  <span>·</span>
                  <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: "var(--gradient-capstone)", color: "white" }}>Capstone</span>
                </>
              )}
            </div>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">{module.title}</h1>
            <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{module.description}</p>

            {!unlocked && (
              <div className="mt-8 flex items-center gap-3 rounded-xl border border-border bg-muted/50 p-4">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Finish the previous modules to unlock this one.</p>
              </div>
            )}

            <section className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                    <Code2 className="h-3.5 w-3.5 text-primary" /> Module task
                  </div>
                  <h2 className="mt-3 font-display text-2xl font-bold">Practice the core idea in this module</h2>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    Work through a short notebook-style exercise and then mark the module complete to feed your weekly and daily trackers.
                  </p>
                </div>
                <Button onClick={completeModule} className="gap-2">
                  <Play className="h-4 w-4" /> Mark module complete
                </Button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-[1fr_0.9fr]">
                <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Sparkles className="h-4 w-4 text-primary" /> Suggested action
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Revisit the main concepts from this module in a short notebook-style reflection: one insight, one chart idea, and one thing you would test next.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <DatabaseZap className="h-4 w-4 text-primary" /> Quick daily drill
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Keep momentum going with a SQL drill in the standalone practice area when you want a fast browser-only exercise.
                  </p>
                  <Link to="/sql-practice" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">
                    Open SQL Practice <ArrowLeft className="h-4 w-4 rotate-180" />
                  </Link>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
