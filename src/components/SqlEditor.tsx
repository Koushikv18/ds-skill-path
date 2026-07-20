import { useEffect, useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import initSqlJs, { type Database as SqlDatabase } from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { CheckCircle2, Github, Play, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity";

type Task = {
  id: number;
  title: string;
  prompt: string;
  schema_sql: string;
  expected_result_rows: Array<Record<string, unknown>>;
  difficulty: "Basic" | "Intermediate" | "Advanced";
};

type RunResult = {
  rows: Array<Record<string, unknown>>;
  columns: string[];
  correct: boolean;
  feedback: string;
  error?: string;
};

const FALLBACK_TASKS: Task[] = [
  {
    id: 1,
    title: "Customers with large orders",
    prompt: "Which customers placed orders over $100? Show the customer name and total order amount.",
    difficulty: "Basic",
    schema_sql: `
      CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL, total_amount REAL NOT NULL);
      INSERT INTO customers (id, name) VALUES (1, 'Ava'), (2, 'Ben'), (3, 'Cleo');
      INSERT INTO orders (id, customer_id, total_amount) VALUES (1, 1, 140), (2, 2, 80), (3, 3, 215), (4, 1, 60);
    `,
    expected_result_rows: [
      { name: "Ava", total_amount: 140 },
      { name: "Cleo", total_amount: 215 },
    ],
  },
  {
    id: 2,
    title: "Sales by product",
    prompt: "Show the product with the highest total revenue across all orders.",
    difficulty: "Intermediate",
    schema_sql: `
      CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL);
      CREATE TABLE order_items (id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL, quantity INTEGER NOT NULL);
      INSERT INTO products (id, name, price) VALUES (1, 'Notebook', 12.5), (2, 'Pen', 3.0), (3, 'Backpack', 45.0);
      INSERT INTO order_items (id, product_id, quantity) VALUES (1, 1, 3), (2, 2, 8), (3, 3, 2), (4, 1, 2);
    `,
    expected_result_rows: [{ name: "Notebook", total_revenue: 62.5 }],
  },
];

function normalizeRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b))));
}

function compareRows(actual: Array<Record<string, unknown>>, expected: Array<Record<string, unknown>>) {
  if (actual.length !== expected.length) return false;
  const normalizedActual = normalizeRows(actual);
  const normalizedExpected = normalizeRows(expected);
  return JSON.stringify(normalizedActual) === JSON.stringify(normalizedExpected);
}

export function SqlEditor() {
  const [task, setTask] = useState<Task>(FALLBACK_TASKS[0]);
  const [query, setQuery] = useState("SELECT name, total_amount FROM (SELECT c.name, SUM(o.total_amount) AS total_amount FROM customers c JOIN orders o ON c.id = o.customer_id GROUP BY c.name) q WHERE total_amount > 100 ORDER BY total_amount DESC;");
  const [db, setDb] = useState<SqlDatabase | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const init = async () => {
      const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
      const database = new SQL.Database();
      if (active) {
        setDb(database);
      }
    };
    void init();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const loadTask = async () => {
      try {
        const { data, error } = await supabase.from("sql_tasks").select("*").limit(1);
        if (!error && (data ?? []).length) {
          const row = data[0] as Task;
          setTask(row);
          setQuery(`SELECT * FROM ${row.title.toLowerCase().replace(/\s+/g, "_")} LIMIT 10;`);
          return;
        }
      } catch {
        // fall back to defaults silently
      }
    };
    void loadTask();
  }, []);

  useEffect(() => {
    if (!db) return;
    try {
      db.run(task.schema_sql);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize sample schema.");
    }
  }, [db, task]);

  const taskLabel = useMemo(() => `${task.difficulty} · ${task.title}`, [task]);

  const generateTask = async () => {
    setGenerating(true);
    setError(null);
    try {
      const { data, error: functionError } = await supabase.functions.invoke("generate-sql-task", {
        body: { mode: "generate-task", difficulty: task.difficulty },
      });
      if (functionError) throw functionError;
      const nextTask = data?.task as Task | undefined;
      if (!nextTask) throw new Error("No task was generated.");
      setTask(nextTask);
      setQuery(`SELECT * FROM ${nextTask.title.toLowerCase().replace(/\s+/g, "_")} LIMIT 10;`);
      setResult(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate a new SQL task.";
      setError(message);
    } finally {
      setGenerating(false);
    }
  };

  const runQuery = async () => {
    if (!db) return;
    setLoading(true);
    setError(null);
    try {
      const statements = db.exec(query);
      if (!statements.length) {
        throw new Error("The query returned no result set.");
      }
      const data = statements[0];
      const rows = data.values.map((values) => Object.fromEntries(data.columns.map((column, index) => [column, values[index]])));
      const correct = compareRows(rows, task.expected_result_rows);

      let feedback = "This looks structured and readable. A senior analyst would also check that the query handles nulls or empty groups gracefully.";
      if (correct) {
        feedback = "The result matches the expected rows exactly. The query is a strong fit for the business question and is easy to read.";
      }

      try {
        const { data: feedbackPayload, error: feedbackError } = await supabase.functions.invoke("generate-sql-task", {
          body: {
            mode: "feedback",
            query,
            schema_sql: task.schema_sql,
            result: rows,
            expected_result_rows: task.expected_result_rows,
            correct,
          },
        });
        if (!feedbackError && feedbackPayload?.feedback) {
          feedback = feedbackPayload.feedback;
        }
      } catch (feedbackErr) {
        console.warn("[sql] failed to fetch qualitative feedback", feedbackErr);
      }

      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (userId) {
          await logActivity({ userId, type: "sql_run" });
          await supabase.from("sql_sessions").insert({
            sql_task_id: task.id,
            user_id: userId,
            query_text: query,
            last_run_result: { rows, correct, feedback } as any,
            last_saved_at: new Date().toISOString(),
          });
        }
      } catch (insertError) {
        console.warn("[sql] failed to persist session", insertError);
      }

      setResult({ rows, columns: data.columns, correct, feedback });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected SQL error";
      setResult(null);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/70 bg-card/80 shadow-[var(--shadow-sm)]">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl">SQL Practice</CardTitle>
            <CardDescription className="mt-1">Run SQL entirely in your browser with a lightweight SQLite engine and instant feedback.</CardDescription>
          </div>
          <div className="rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            {taskLabel}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            {task.prompt}
          </div>
          <CodeMirror
            value={query}
            height="220px"
            extensions={[sql(), oneDark]}
            onChange={(value) => setQuery(value)}
            basicSetup={{ lineNumbers: true, highlightActiveLineGutter: true }}
            className="rounded-xl border border-border/70"
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={runQuery} disabled={loading} className="gap-2">
              <Play className="h-4 w-4" />
              {loading ? "Running..." : "Run query"}
            </Button>
            <Button onClick={generateTask} disabled={generating} variant="outline" className="gap-2">
              <Wand2 className="h-4 w-4" />
              {generating ? "Generating..." : "Generate new task"}
            </Button>
            <span className="text-sm text-muted-foreground">Results are graded deterministically against the expected rows.</span>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-3 rounded-2xl border border-border/70 bg-background/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Verdict</div>
                <div className="text-sm text-muted-foreground">Correctness is deterministic; feedback is advisory.</div>
              </div>
              {result.correct ? <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-medium text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Correct</div> : <div className="rounded-full bg-amber-500/15 px-3 py-1 text-sm font-medium text-amber-600">Needs adjustment</div>}
            </div>
            <div className="rounded-xl border border-border/70 bg-card/70 p-3 text-sm text-muted-foreground">{result.feedback}</div>
            <div className="overflow-hidden rounded-xl border border-border/70">
              <div className="border-b border-border/70 bg-muted/50 px-3 py-2 text-sm font-medium">Result table</div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border/70 text-sm">
                  <thead>
                    <tr className="bg-muted/30 text-left text-muted-foreground">
                      {result.columns.map((column) => <th key={column} className="px-3 py-2 font-medium">{column}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.length ? result.rows.map((row, index) => (
                      <tr key={`${index}-${JSON.stringify(row)}`} className="border-t border-border/70">
                        {result.columns.map((column) => <td key={column} className="px-3 py-2">{String(row[column] ?? "")}</td>)}
                      </tr>
                    )) : <tr><td colSpan={result.columns.length} className="px-3 py-3 text-muted-foreground">No rows returned.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
