import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BookOpen, LogOut, Settings } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(email?: string | null) {
  if (!email) return "DS";
  const name = email.split("@")[0];
  const parts = name.split(/[._-]/).filter(Boolean);
  const chars = (parts[0]?.[0] ?? name[0] ?? "D") + (parts[1]?.[0] ?? "");
  return chars.toUpperCase();
}

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Account menu"
                className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-sm font-semibold text-foreground hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {initials(email)}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {email && (
                <>
                  <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                    {email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem asChild>
                <Link to="/settings" className="gap-2"><Settings className="h-4 w-4" /> Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="gap-2 text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
