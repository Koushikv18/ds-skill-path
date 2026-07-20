import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({ code: z.string().optional() });

export const Route = createFileRoute("/_authenticated/github-callback")({
  validateSearch: searchSchema,
  component: GithubCallbackPage,
});

function GithubCallbackPage() {
  const { code } = Route.useSearch();
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const run = async () => {
      if (!code) {
        toast.error("Missing GitHub code");
        navigate({ to: "/settings", replace: true });
        return;
      }
      try {
        const { error } = await supabase.functions.invoke("github-oauth-callback", { body: { code } });
        if (error) throw error;
        toast.success("GitHub connected");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to connect GitHub");
      } finally {
        navigate({ to: "/settings", replace: true });
      }
    };
    void run();
  }, [code, navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Connecting your GitHub account…
      </div>
    </div>
  );
}
