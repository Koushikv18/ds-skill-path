import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Github, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

type GhStatus = { connected: boolean; github_username: string | null; repo_full_name: string | null };

function SettingsPage() {
  const [goal, setGoal] = useState("4");
  const [gh, setGh] = useState<GhStatus | null>(null);
  const [repoInput, setRepoInput] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("ds-track-weekly-goal");
    if (stored) setGoal(stored);
  }, []);

  const loadStatus = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_github_connection_status");
    if (error) return;
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      setGh(row as GhStatus);
      setRepoInput((row as GhStatus).repo_full_name ?? "");
    }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  const saveGoal = () => {
    const parsed = Number(goal);
    if (Number.isFinite(parsed) && parsed > 0) {
      window.localStorage.setItem("ds-track-weekly-goal", String(parsed));
      toast.success("Weekly goal saved");
    }
  };

  const connectGithub = () => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    if (!clientId) {
      toast.error("VITE_GITHUB_CLIENT_ID is not configured");
      return;
    }
    const redirect = `${window.location.origin}/github-callback`;
    const url = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirect)}&scope=repo`;
    window.location.href = url;
  };

  const saveRepo = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("set_github_repo", { new_repo_full_name: repoInput.trim() });
      if (error) throw error;
      toast.success("Target repo updated");
      await loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update repo");
    } finally { setBusy(false); }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("disconnect_github");
      if (error) throw error;
      toast.success("GitHub disconnected");
      setGh({ connected: false, github_username: null, repo_full_name: null });
      setRepoInput("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <Card className="border-border/70 bg-card/80 shadow-[var(--shadow-sm)]">
          <CardHeader>
            <CardTitle className="text-xl">Settings</CardTitle>
            <CardDescription>Adjust your weekly goal for the tracker and keep the dashboard aligned with your current pace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="weekly-goal">Weekly active days goal</Label>
              <Input id="weekly-goal" type="number" min="1" value={goal} onChange={(event) => setGoal(event.target.value)} />
            </div>
            <Button onClick={saveGoal}>Save goal</Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 shadow-[var(--shadow-sm)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl"><Github className="h-5 w-5" /> GitHub portfolio</CardTitle>
            <CardDescription>Connect GitHub and pick a repo — passed modules and SQL drills commit directly to it as your public portfolio.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {gh?.connected ? (
              <>
                <div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm">
                  Connected as <span className="font-medium">@{gh.github_username}</span>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="repo">Target repo (owner/repo)</Label>
                  <Input id="repo" placeholder="your-username/ds-track-portfolio" value={repoInput} onChange={(e) => setRepoInput(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={saveRepo} disabled={busy || !repoInput.trim()}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save repo
                  </Button>
                  <Button variant="outline" onClick={disconnect} disabled={busy}>Disconnect</Button>
                </div>
              </>
            ) : (
              <Button onClick={connectGithub} className="gap-2">
                <Github className="h-4 w-4" /> Connect GitHub
              </Button>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
