import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Code2, LineChart, Sparkles, Target, Zap, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-hero)" }}>
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg text-primary-foreground font-bold" style={{ background: "var(--gradient-primary)" }}>
            DS
          </div>
          <span className="font-display text-lg font-semibold">DS Track</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
          <Link to="/auth" search={{ mode: "signup" as const }}><Button>Get started</Button></Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-16 pb-24 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          A career skill-track for aspiring data scientists
        </div>
        <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
          Go from Python basics to <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>job-ready</span> data scientist by actually building things.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Twelve focused modules. Real datasets. A live Python notebook in your browser. DS Track tells you what to do next — every day — until you have portfolio-worthy projects to show.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/auth" search={{ mode: "signup" as const }}>
            <Button size="lg" className="gap-2">Start learning free <ArrowRight className="h-4 w-4" /></Button>
          </Link>
          <Link to="/auth"><Button size="lg" variant="outline">I already have an account</Button></Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">No credit card. Nothing to install. Runs in your browser.</p>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Target, title: "A guided skill tree", body: "3 levels · 12 modules · 3 capstones. Finish a level to unlock the next." },
            { icon: Zap, title: "A daily routine engine", body: "A checklist and weekly tracker tell you what to do next, so you build a habit instead of hunting for tutorials." },
            { icon: BookOpen, title: "SQL practice in the browser", body: "Run real queries against sample schemas, right in your browser — no setup." },
            { icon: Code2, title: "Python notebooks", body: "In-browser notebooks with pandas, NumPy and matplotlib are landing in your dashboard next." },
            { icon: LineChart, title: "Real datasets, real tasks", body: "Each module hands you a realistic problem with data you can actually explore." },
            { icon: Sparkles, title: "Portfolio-worthy capstones", body: "Levels end with a capstone brief you can show hiring managers." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)] transition hover:shadow-[var(--shadow-md)]">
              <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="rounded-3xl border border-border p-10 text-center shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-primary)" }}>
          <h2 className="font-display text-3xl font-bold text-primary-foreground md:text-4xl">Your next data science project starts today.</h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">Create your free account and unlock Module 1 in under a minute.</p>
          <Link to="/auth" search={{ mode: "signup" as const }}>
            <Button size="lg" variant="secondary" className="mt-6 gap-2">Create your account <ArrowRight className="h-4 w-4" /></Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} DS Track. Built for people who learn by doing.
      </footer>
    </div>
  );
}
