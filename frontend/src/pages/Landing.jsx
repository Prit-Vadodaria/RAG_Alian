import { Link, Navigate } from "react-router-dom";
import { ArrowRight, Sparkles, ShieldCheck, Workflow } from "lucide-react";
import { useAuthStore } from "../store/authStore";

function Landing() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrating = useAuthStore((state) => state.isHydrating);

  if (isHydrating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(201,119,92,0.18),transparent_30%),linear-gradient(180deg,#161311_0%,#0f0e0d_100%)] px-4 py-8 text-[color:var(--on-dark)]">
        <div className="surface-page px-6 py-4 text-sm text-[color:var(--on-dark-soft)]">
          Loading workspace...
        </div>
      </div>
    );
  }

  if (!isHydrating && isAuthenticated) {
    return <Navigate to="/workspace" replace />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(201,119,92,0.18),transparent_30%),linear-gradient(180deg,#161311_0%,#0f0e0d_100%)] px-4 py-8 text-[color:var(--on-dark)]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col justify-between gap-8">
        <header className="surface-page flex items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-kicker">Private RAG workspace</p>
            <h1 className="mt-2 text-xl font-semibold">Alian AI</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="button-secondary">
              Sign in
            </Link>
            <Link to="/signup" className="button-primary">
              Get started
            </Link>
          </div>
        </header>

        <main className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="surface-page flex flex-col justify-between gap-10 p-8 lg:p-12">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(201,119,92,0.24)] bg-[rgba(201,119,92,0.1)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--primary)]">
                <Sparkles className="h-4 w-4" />
                Your private AI workspace
              </div>
              <h2 className="mt-6 max-w-2xl text-5xl font-semibold leading-tight sm:text-6xl">
                Ask questions, ingest websites, and keep every workspace private.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[color:var(--on-dark-soft)]">
                Sign in to manage chatbots, contexts, prompt settings, and quota
                controls from one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link to="/signup" className="button-primary">
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/login" className="button-secondary">
                Existing account
              </Link>
            </div>
          </section>

          <aside className="grid gap-4">
            <div className="surface-page p-6">
              <ShieldCheck className="h-6 w-6 text-[color:var(--primary)]" />
              <h3 className="mt-4 text-lg font-semibold">Secure access</h3>
              <p className="mt-2 text-sm leading-7 text-[color:var(--on-dark-soft)]">
                JWT-backed sessions keep the workspace tied to the correct client.
              </p>
            </div>
            <div className="surface-page p-6">
              <Workflow className="h-6 w-6 text-[color:var(--primary)]" />
              <h3 className="mt-4 text-lg font-semibold">Simple workflow</h3>
              <p className="mt-2 text-sm leading-7 text-[color:var(--on-dark-soft)]">
                Ingest, chat, and manage settings without leaving the dashboard.
              </p>
            </div>
            <div className="surface-page p-6">
              <Sparkles className="h-6 w-6 text-[color:var(--primary)]" />
              <h3 className="mt-4 text-lg font-semibold">Built for teams</h3>
              <p className="mt-2 text-sm leading-7 text-[color:var(--on-dark-soft)]">
                Admin and client views stay separate while sharing the same core platform.
              </p>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

export default Landing;
