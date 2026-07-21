import { useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity";
import { CheckCircle2, Circle, Loader2, Play, Sparkles, Send } from "lucide-react";
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

type ExerciseState = {
  task: PyTask;
  passed: boolean;
  lastCode: string | null;
};

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
  const [exercises, setExercises] = useState<ExerciseState[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadingSet, setLoadingSet] = useState(true);
  const [code, setCode] = useState("");
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

  // Load or generate the exercise set for this module, resuming any saved progress.
  useEffect(() => {
    let active = true;
    const loadSet = async () => {
      setLoadingSet(true);
      setExercises(null);
      setActiveIndex(0);
      setOutput("");
      setHasRun(false);
      setVerdict(null);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) throw new Error("Not signed in");

        const { data: existingRows, error: existingError } = await supabase
          .from("module_exercise_progress")
          .select("exercise_index, task, passed, last_code")
          .eq("module_id", moduleId)
          .order("exercise_index", { ascending: true });
        if (existingError) throw existingError;

        if (existingRows && existingRows.length > 0) {
          const loaded: ExerciseState[] = existingRows.map((row) => ({
            task: row.task as unknown as PyTask,
            passed: row.passed,
            lastCode: row.last_code,
          }));
          if (!active) return;
          setExercises(loaded);
          const firstUnpassed = loaded.findIndex((e) => !e.passed);
          const startIndex = firstUnpassed === -1 ? loaded.length - 1 : firstUnpassed;
          setActiveIndex(startIndex);
          setCode(loaded[startIndex].lastCode ?? loaded[startIndex].task.starter_code);
          return;
        }

        const { data, error } = await supabase.functions.invoke("generate-python-task", {
          body: {
            module_title: moduleTitle,
            module_description: moduleDescription,
            is_capstone: isCapstone,
          },
        });
        if (error) throw error;
        const generated = (data?.exercises ?? []) as PyTask[];
        const rows = generated.map((task, index) => ({
          user_id: userId,
          module_id: moduleId,
          exercise_index: index,
          task: task as unknown as never,
          passed: false,
          last_code: task.starter_code,
        }));
        if (rows.length > 0) {
          await supabase.from("module_exercise_progress").insert(rows);
        }
        const fresh: ExerciseState[] = generated.map((task) => ({
          task,
          passed: false,
          lastCode: task.starter_code,
        }));
        if (!active) return;
        setExercises(fresh);
        setActiveIndex(0);
        setCode(fresh[0]?.task.starter_code ?? "");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't load this module's exercises.");
      } finally {
        if (active) setLoadingSet(false);
      }
    };
    void loadSet();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  const currentTask = exercises?.[activeIndex]?.task;
  const passedCount = exercises?.filter((e) => e.passed).length ?? 0;
  const totalCount = exercises?.length ?? 0;
  const allPassed = totalCount > 0 && passedCount === totalCount;

  const goToExercise = (index: number) => {
    if (!exercises) return;
    setActiveIndex(index);
    setCode(exercises[index].lastCode ?? exercises[index].task.starter_code);
    setOutput("");
    setHasRun(false);
    setVerdict(null);
  };

  const runCode = async () => {
    if (!pyodideRef.current || !currentTask) return;
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
      await pyodideRef.current.runPythonAsync(`${currentTask.setup_code}\n${code}`);
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
      if (userId) {
        await logActivity({ userId, type: "notebook_run", moduleId });
        await supabase
          .from("module_exercise_progress")
          .update({ last_code: code })
          .eq("user_id", userId)
          .eq("module_id", moduleId)
          .eq("exercise_index", activeIndex);
      }
    } catch {
      // non-fatal
    }
  };

  const submitForGrading = async () => {
    if (!currentTask || !exercises) return;
    setGrading(true);
    try {
      const { data, error } = await supabase.functions.invoke("grade-python-task", {
        body: {
          prompt: currentTask.prompt,
          grading_notes: currentTask.grading_notes,
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
          await supabase
            .from("module_exercise_progress")
            .update({ passed: true, last_code: code })
            .eq("user_id", userId)
            .eq("module_id", moduleId)
            .eq("exercise_index", activeIndex);
        }
        const updatedExercises = exercises.map((e, i) =>
          i === activeIndex ? { ...e, passed: true, lastCode: code } : e,
        );
        setExercises(updatedExercises);

        const nowAllPassed = updatedExercises.every((e) => e.passed);
        if (nowAllPassed) {
          if (userId) {
            await logActivity({
              userId,
              type: isCapstone ? "capstone_passed" : "module_passed",
              moduleId,
            });
          }
          toast.success(
            isCapstone
              ? "Capstone passed! Module complete."
              : "Module complete — all exercises passed!",
          );
          onPassed();
        } else {
          toast.success("Exercise passed. On to the next one.");
          const nextIndex = updatedExercises.findIndex((e) => !e.passed);
          if (nextIndex !== -1) goToExercise(nextIndex);
        }
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
            <CardTitle className="text-xl">Notebook exercises</CardTitle>
            <CardDescription className="mt-1">
              Real Python, running entirely in your browser via Pyodide. pandas and numpy are
              pre-loaded.
            </CardDescription>
          </div>
          {totalCount > 0 && (
            <div className="rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              {passedCount} / {totalCount} passed
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {alreadyPassed && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> You've already passed this module. Feel free to
            keep practicing below.
          </div>
        )}

        {loadingSet && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Building your problem set…
          </div>
        )}

        {exercises && exercises.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {exercises.map((ex, i) => (
              <button
                key={i}
                onClick={() => goToExercise(i)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  i === activeIndex
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/70 bg-background/60 text-muted-foreground hover:bg-muted/60"
                }`}
              >
                {ex.passed ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Circle className="h-3.5 w-3.5" />
                )}
                {i + 1}. {ex.task.title}
              </button>
            ))}
          </div>
        )}

        {currentTask && (
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Exercise {activeIndex + 1} of {totalCount} · {currentTask.difficulty}
              </div>
            </div>
            <div className="mb-3 flex items-start gap-2 text-sm font-medium text-primary">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{currentTask.prompt}</span>
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
              <Button onClick={runCode} disabled={!pyodideReady || running} className="gap-2">
                {running ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {running ? "Running…" : "Run code"}
              </Button>
              <Button
                onClick={submitForGrading}
                disabled={!hasRun || grading}
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
        )}

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

        {allPassed && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> All exercises in this module are passed.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
