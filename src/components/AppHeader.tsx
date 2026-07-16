import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BookOpen, LogOut, Settings, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export function AppHeader({ email }: { email?: string | null }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg text-primary-foreground font-bold" style={{ background: "var(--gradient-primary)" }}>DS</div>
          <span className="font-display text-lg font-semibold">DS Track</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/sql-practice"><Button variant="ghost" size="sm" className="gap-1.5"><BookOpen className="h-4 w-4" /> SQL Practice</Button></Link>
          <Link to="/settings"><Button variant="ghost" size="sm" className="gap-1.5"><Settings className="h-4 w-4" /> Settings</Button></Link>
          {email && <span className="hidden text-sm text-muted-foreground sm:inline">{email}</span>}
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5"><LogOut className="h-4 w-4" /> Sign out</Button>
        </div>
      </div>
    </header>
  );
}
