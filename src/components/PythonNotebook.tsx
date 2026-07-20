import { useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity";
import { CheckCircle2, Loader2, Play, Sparkles, Send } from "lucide-react";
import { toast } from "sonner";

const PYODIDE_VERSION = "0.26.4";
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

type PyTask = {
  title: string;
  prompt: string;
  setup_code: string;
  starter_code: string;
  difficulty: string;
  grading_notes: string;
};

// Minimal shape of the global Pyodide interface we use.
type PyodideInterface = {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (opts: { batched?: (msg: string) => void }) => void;
  setStderr: (opts: { batched?: (msg: string) => void }) => void;
  loadPackage: (pkgs: string[]) => Promise<void>;
};

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideInterface>;
  }
}

let pyodideSingleton: Promise<PyodideInterface> | null = null;

function loadPyodideScriptOnce(): Promise<void> {
  if (window.loadPyodide) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-pyodide]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Pyodide")));
      return;
    }
    const script = document.createElement("script");
    script.src = `${PYODIDE_INDEX_URL}pyodide.js`;
    script.dataset.pyodide = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Pyodide"));
    document.head.appendChild(script);
  });
}

async function getPyodide(): Promise<PyodideInterface> {
  if (!pyodideSingleton) {
    pyodideSingleton = (async () => {
      await loadPyodideScriptOnce();
      const pyodide = await window.loadPyodide!({ indexURL: PYODIDE_INDEX_URL });
      await pyodide.loadPackage(["numpy", "pandas"]);
      return pyodide;
    })();
  }
  return pyodideSingleton;
}

const FALLBACK_TASK: PyTask = {
  title: "Explore product sales",
  prompt:
    "A `df` DataFrame with columns product, category, units_sold, price is already loaded. Compute total revenue per product (units_sold * price), then print the top 3 products by revenue.",
  setup_code: `import pandas as pd\n\ndf = pd.DataFrame({\n    "product": ["Notebook", "Pen", "Backpack", "Mug", "Laptop Stand"],\n    "category": ["Stationery", "Stationery", "Bags", "Home", "Office"],\n    "units_sold": [120, 340, 45, 90, 30],\n    "price": [12.5, 3.0, 45.0, 9.0, 28.0],\n})\n`,
  starter_code: "# Write your solution below.\n# df is already available.\n\n",
  difficulty: "Basic",
  grading_notes:
    "Correct answer computes revenue = units_sold * price per row, sorts descending, and prints the top 3 products with their revenue.",
};

export function PythonNotebook({
  moduleId,
  moduleTitle,
  moduleDescription,
  isCapstone,
  alreadyPassed,
  onPassed,
}: {
  moduleId: number;
  moduleTitle: string;
  moduleDescription: string;
  isCapstone: boolean;
  alreadyPassed: boolean;
  onPassed: () => void;
}) {
  const [task, setTask] = useState<PyTask>(FALLBACK_TASK);
  const [loadingTask, setLoadingTask] = useState(true);
  const [code, setCode] = useState(FALLBACK_TASK.starter_code);
  const [pyodideReady, setPyodideReady] = useState(false);
  const [pyodideLoading, setPyodideLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [grading, setGrading] = useState(false);
  const [output, setOutput] = useState<string>("");
  const [hadError, setHadError] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [verdict, setVerdict] = useState<{ passed: boolean; feedback: string } | null>(null);
  const pyodideRef = useRef<PyodideInterface | null>(null);

  useEffect(() => {
    let active = true;
    getPyodide()
      .then((py) => {
        if (!active) return;
        pyodideRef.current = py;
        setPyodideReady(true);
      })
      .catch(() => {
        if (active) toast.error("Couldn't load the Python runtime. Try refreshing the page.");
      })
      .finally(() => {
        if (active) setPyodideLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadTask = async () => {
      setLoadingTask(true);
      try {
        const { data, error } = await supabase.functions.invoke("generate-python-task", {
          body: {
            module_title: moduleTitle,
            module_description: moduleDescription,
            is_capstone: isCapstone,
          },
        });
        if (error) throw error;
        const nextTask = (data?.task ?? FALLBACK_TASK) as PyTask;
        if (active) {
          setTask(nextTask);
          setCode(nextTask.starter_code);
        }
      } catch {
        if (active) {
          setTask(FALLBACK_TASK);
          setCode(FALLBACK_TASK.starter_code);
        }
      } finally {
        if (active) setLoadingTask(false);
      }
    };
    void loadTask();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  const runCode = async () => {
    if (!pyodideRef.current) return;
    setRunning(true);
    setVerdict(null);
    let captured = "";
    let errored = false;
    try {
      pyodideRef.current.setStdout({
        batched: (msg) => {
          captured += msg + "\n";
        },
      });
      pyodideRef.current.setStderr({
        batched: (msg) => {
          captured += msg + "\n";
        },
      });
      await pyodideRef.current.runPythonAsync(`${task.setup_code}\n${code}`);
    } catch (err) {
      errored = true;
      captured += err instanceof Error ? err.message : String(err);
    } finally {
      pyodideRef.current.setStdout({});
      pyodideRef.current.setStderr({});
    }
    setOutput(captured.trim() || (errored ? "" : "(no output — use print() to show results)"));
    setHadError(errored);
    setHasRun(true);
    setRunning(false);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (userId) await logActivity({ userId, type: "notebook_run", moduleId });
    } catch {
      // non-fatal
    }
  };

  const submitForGrading = async () => {
    setGrading(true);
    try {
      const { data, error } = await supabase.functions.invoke("grade-python-task", {
        body: {
          prompt: task.prompt,
          grading_notes: task.grading_notes,
          code,
          stdout: output,
          had_error: hadError,
        },
      });
      if (error) throw error;
      const result = data as { passed: boolean; feedback: string };
      setVerdict(result);

      if (result.passed) {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (userId) {
          await logActivity({
            userId,
            type: isCapstone ? "capstone_passed" : "module_passed",
            moduleId,
          });
        }
        toast.success(isCapstone ? "Capstone passed!" : "Module passed!");
        onPassed();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Grading failed. Try again.");
    } finally {
      setGrading(false);
    }
  };

  return (
    <Card className="border-border/70 bg-card/80 shadow-[var(--shadow-sm)]">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl">Notebook exercise</CardTitle>
            <CardDescription className="mt-1">
              Real Python, running entirely in your browser via Pyodide. pandas and numpy are
              pre-loaded.
            </CardDescription>
          </div>
          <div className="rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            {task.difficulty}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {alreadyPassed && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> You've already passed this module. Feel free to
            keep practicing below.
          </div>
        )}

        <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
          <div className="mb-3 flex items-start gap-2 text-sm font-medium text-primary">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{loadingTask ? "Generating your task…" : task.prompt}</span>
          </div>

          {pyodideLoading && (
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Starting the Python runtime (first load
              can take ~10–20s)…
            </div>
          )}

          <CodeMirror
            value={code}
            height="240px"
            extensions={[python(), oneDark]}
            onChange={(value) => setCode(value)}
            basicSetup={{ lineNumbers: true, highlightActiveLineGutter: true }}
            className="rounded-xl border border-border/70"
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              onClick={runCode}
              disabled={!pyodideReady || running || loadingTask}
              className="gap-2"
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {running ? "Running…" : "Run code"}
            </Button>
            <Button
              onClick={submitForGrading}
              disabled={!hasRun || grading || loadingTask}
              variant="outline"
              className="gap-2"
            >
              {grading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {grading ? "Grading…" : "Submit for feedback"}
            </Button>
          </div>
        </div>

        {hasRun && (
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
            <div className="mb-2 text-sm font-semibold">{hadError ? "Error" : "Output"}</div>
            <pre
              className={`overflow-x-auto whitespace-pre-wrap rounded-xl p-3 text-sm ${hadError ? "border border-destructive/30 bg-destructive/10 text-destructive" : "border border-border/70 bg-muted/40"}`}
            >
              {output}
            </pre>
          </div>
        )}

        {verdict && (
          <div className="space-y-2 rounded-2xl border border-border/70 bg-background/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Verdict</div>
              {verdict.passed ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-medium text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> Passed
                </div>
              ) : (
                <div className="rounded-full bg-amber-500/15 px-3 py-1 text-sm font-medium text-amber-600">
                  Needs another pass
                </div>
              )}
            </div>
            <div className="rounded-xl border border-border/70 bg-card/70 p-3 text-sm text-muted-foreground">
              {verdict.feedback}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
