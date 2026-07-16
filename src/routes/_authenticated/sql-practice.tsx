import { createFileRoute } from "@tanstack/react-router";
import { SqlEditor } from "@/components/SqlEditor";

export const Route = createFileRoute("/_authenticated/sql-practice")({
  component: SqlPracticePage,
});

function SqlPracticePage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <p className="text-sm text-muted-foreground">Practice area</p>
          <h1 className="mt-2 font-display text-3xl font-bold">SQL Practice</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Work through browser-based SQL drills, inspect real query results, and keep your streak alive with daily practice.</p>
        </div>
        <SqlEditor />
      </main>
    </div>
  );
}
