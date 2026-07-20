import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { PythonNotebook } from "@/components/PythonNotebook";
import { ArrowLeft, Sparkles, Lock, DatabaseZap, Target } from "lucide-react";
import type { Module } from "@/lib/modules";

type ProgressStatus = "locked" | "unlocked" | "in_progress" | "passed";

export const Route = createFileRoute("/_authenticated/modules/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Module ${params.id} · DS Track` },
      {
        name: "description",
        content: "A focused Data Science module inside the DS Track skill tree.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ModuleDetail,
});

function ModuleDetail() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const moduleId = Number(id);
  const queryClient = useQueryClient();

  const { data: module, isLoading } = useQuery({
    queryKey: ["module", moduleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modules")
        .select("*")
        .eq("id", moduleId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data as Module;
    },
  });

  const { data: progress } = useQuery({
    queryKey: ["progress", user.id, moduleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_module_progress")
        .select("status")
        .eq("user_id", user.id)
        .eq("module_id", moduleId)
        .maybeSingle();
      if (error) throw error;
      return (data?.status ?? "locked") as ProgressStatus;
    },
  });

  const unlocked = progress === "unlocked" || progress === "in_progress" || progress === "passed";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader email={user.email} />

      <main className="mx-auto max-w-4xl px-6 py-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
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
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px]"
                    style={{ background: "var(--gradient-capstone)", color: "white" }}
                  >
                    Capstone
                  </span>
                </>
              )}
              {progress === "passed" && (
                <>
                  <span>·</span>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                    Passed
                  </span>
                </>
              )}
            </div>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">{module.title}</h1>
            <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{module.description}</p>

            {!unlocked ? (
              <div className="mt-8 flex items-center gap-3 rounded-xl border border-border bg-muted/50 p-4">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Finish the previous module to unlock this one.
                </p>
              </div>
            ) : (
              <>
                <section className="mt-10">
                  <PythonNotebook
                    moduleId={moduleId}
                    moduleTitle={module.title}
                    moduleDescription={module.description}
                    isCapstone={module.is_capstone}
                    alreadyPassed={progress === "passed"}
                    onPassed={() => {
                      queryClient.invalidateQueries({ queryKey: ["progress"] });
                      queryClient.invalidateQueries({ queryKey: ["progress", user.id, moduleId] });
                    }}
                  />
                </section>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Target className="h-4 w-4 text-primary" /> What you'll be able to do
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      By the end of this module you'll ship a small, reviewable notebook
                      demonstrating the concept end-to-end on a realistic dataset.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <DatabaseZap className="h-4 w-4 text-primary" /> Warm up with SQL
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Keep the streak alive with a browser-only SQL drill.
                    </p>
                    <Link
                      to="/sql-practice"
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary"
                    >
                      Open SQL Practice <Sparkles className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
