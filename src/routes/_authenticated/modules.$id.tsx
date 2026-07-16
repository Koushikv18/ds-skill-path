import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { ArrowLeft, Code2, Sparkles, Lock } from "lucide-react";
import type { Module } from "@/lib/modules";

export const Route = createFileRoute("/_authenticated/modules/$id")({
  component: ModuleDetail,
});

function ModuleDetail() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const moduleId = Number(id);

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

            <section className="mt-10 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <Code2 className="h-6 w-6" />
              </div>
              <h2 className="mt-4 font-display text-2xl font-bold">Your task & notebook</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Coming soon — you'll get a real dataset and a live Python notebook (pandas, NumPy, matplotlib) running right in this window.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-accent" /> Task generation shipping in the next phase
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
