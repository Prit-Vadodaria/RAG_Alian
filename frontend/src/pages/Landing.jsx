import { Link, Navigate } from "react-router-dom";
import {
  ArrowRight,
  Zap,
  Shield,
  Globe,
  Bot,
  Database,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { useAuthStore } from "../store/authStore";
import DarkVeil from "../components/landing/DarkVeil";

function Landing() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrating = useAuthStore((state) => state.isHydrating);

  if (isHydrating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--canvas)] text-[color:var(--on-dark)]">
        <div className="flex items-center gap-3 text-sm text-[color:var(--ink-muted)]">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--primary)]" />
          Loading…
        </div>
      </div>
    );
  }

  if (!isHydrating && isAuthenticated) {
    return <Navigate to="/workspace" replace />;
  }

  return (
    <div className="landing-shell">
      {/* ── NAV ─────────────────────────────────────────────── */}
      <header className="landing-header">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Zap size={16} color="var(--canvas)" strokeWidth={2.5} />
            </div>
            <span
              style={{
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: "-0.02em",
              }}
            >
              LoreHub
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              style={{
                color: "var(--ink-soft)",
                fontSize: 14,
                fontWeight: 500,
                padding: "8px 16px",
                borderRadius: 8,
                transition: "color 140ms",
              }}
              onMouseEnter={(e) => (e.target.style.color = "var(--on-dark)")}
              onMouseLeave={(e) => (e.target.style.color = "var(--ink-soft)")}
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              style={{
                background: "var(--primary)",
                color: "var(--canvas)",
                fontWeight: 600,
                fontSize: 14,
                padding: "8px 18px",
                borderRadius: 8,
                transition: "background 140ms, box-shadow 140ms",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--primary-active)";
                e.currentTarget.style.boxShadow = "0 0 20px var(--accent-glow)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--primary)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section
        className="relative flex flex-col items-center justify-center overflow-hidden px-6 text-center"
        style={{ paddingTop: 120, paddingBottom: 120 }}
      >
        <div className="absolute inset-0">
          <DarkVeil
            hueShift={0}
            noiseIntensity={0}
            scanlineIntensity={0.08}
            speed={0.9}
            scanlineFrequency={0.5}
            warpAmount={0.08}
          />
        </div>

        {/* Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            border: "1px solid var(--accent-border)",
            borderRadius: 9999,
            background: "var(--accent-soft)",
            padding: "6px 14px",
            marginBottom: 32,
            position: "relative",
            zIndex: 1,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--primary)",
              display: "inline-block",
            }}
          />
          <span
            style={{
              color: "var(--primary)",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.08em",
            }}
          >
            PRIVATE RAG WORKSPACE
          </span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: "clamp(2.8rem, 6vw, 5rem)",
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.04em",
            maxWidth: 820,
            marginBottom: 24,
            position: "relative",
            zIndex: 1,
          }}
        >
          Your website. <span style={{ color: "var(--primary)" }}>Answered.</span>
          <br />
          Instantly.
        </h1>

        <p
          style={{
            color: "var(--body)",
            fontSize: "clamp(1rem, 2vw, 1.2rem)",
            lineHeight: 1.65,
            maxWidth: 560,
            marginBottom: 40,
            position: "relative",
            zIndex: 1,
          }}
        >
          Ingest any website into a private vector knowledge base. Ask
          questions, get grounded answers with citations — powered by your own
          API key.
        </p>

        {/* CTAs */}
        <div className="relative z-1 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/signup"
            style={{
              background: "var(--primary)",
              color: "var(--canvas)",
              fontWeight: 700,
              fontSize: 15,
              padding: "13px 28px",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "background 140ms, box-shadow 140ms, transform 140ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--primary-active)";
              e.currentTarget.style.boxShadow = "0 0 32px var(--accent-glow)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--primary)";
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            Start for free <ArrowRight size={16} />
          </Link>
          <Link
            to="/login"
            style={{
              border: "1px solid var(--hairline-strong)",
              color: "var(--on-dark)",
              fontWeight: 600,
              fontSize: 15,
              padding: "13px 28px",
              borderRadius: 10,
              transition: "border-color 140ms, transform 140ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent-border)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--hairline-strong)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            Sign in
          </Link>
        </div>

        {/* Social proof row */}
        <div
          className="flex flex-wrap items-center justify-center gap-6 mt-14"
          style={{
            color: "var(--on-dark-soft)",
            fontSize: 13,
            position: "relative",
            zIndex: 1,
          }}
        >
          {[
            "Semantic Search",
            "Cross-encoder Reranking",
            "Gemini Generation",
            "ChromaDB",
          ].map((f) => (
            <div key={f} className="flex items-center gap-2">
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "var(--primary)",
                  boxShadow: "0 0 10px var(--accent-glow)",
                }}
              />
              {f}
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <section
        style={{
          padding: "80px 24px",
          borderTop: "1px solid var(--hairline)",
        }}
      >
        <div className="mx-auto max-w-6xl">
          <p
            style={{
              color: "var(--primary)",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            HOW IT WORKS
          </p>
          <h2
            style={{
              textAlign: "center",
              fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              marginBottom: 16,
            }}
          >
            From URL to answers in minutes
          </h2>
          <p
            style={{
              textAlign: "center",
              color: "var(--muted)",
              maxWidth: 500,
              margin: "0 auto 60px",
            }}
          >
            A production-grade RAG pipeline that handles crawling, chunking,
            embedding, and generation — fully private.
          </p>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                num: "01",
                icon: Globe,
                title: "Crawl",
                body: "Paste a URL. We discover, crawl, and snapshot every page via Playwright.",
              },
              {
                num: "02",
                icon: Database,
                title: "Embed",
                body: "Content is chunked semantically and stored in a per-workspace ChromaDB vector index.",
              },
              {
                num: "03",
                icon: Zap,
                title: "Retrieve",
                body: "Queries hit the vector index, get reranked with a cross-encoder, and grounded context is assembled.",
              },
              {
                num: "04",
                icon: Bot,
                title: "Answer",
                body: "Gemini generates a grounded answer with inline citations and a confidence score.",
              },
            ].map(({ num, icon: Icon, title, body }) => (
              <div
                key={num}
                style={{
                  border: "1px solid var(--hairline)",
                  borderRadius: 14,
                  background: "var(--surface-1)",
                  padding: "28px 24px",
                  transition: "border-color 200ms, box-shadow 200ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent-border)";
                  e.currentTarget.style.boxShadow = "0 0 30px var(--accent-glow)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--hairline)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 16,
                  }}
                >
                  <span
                    style={{
                      color: "var(--primary)",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                    }}
                  >
                    {num}
                  </span>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "var(--accent-soft-strong)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={15} color="var(--primary)" />
                  </div>
                </div>
                <h3
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    letterSpacing: "-0.02em",
                    marginBottom: 8,
                  }}
                >
                  {title}
                </h3>
                <p style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.6 }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────── */}
      <section
        style={{
          padding: "80px 24px",
          borderTop: "1px solid var(--hairline)",
        }}
      >
        <div className="mx-auto max-w-6xl">
          <p
            style={{
              color: "var(--primary)",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            FEATURES
          </p>
          <h2
            style={{
              textAlign: "center",
              fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              marginBottom: 56,
            }}
          >
            Everything a production RAG needs
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Sparkles,
                title: "Multi-website contexts",
                body: "Ingest multiple sites into isolated knowledge bases. Query one or all at once.",
              },
              {
                icon: Zap,
                title: "Confidence scoring",
                body: "Every answer includes retrieval, rerank, grounding, and quality confidence scores.",
              },
              {
                icon: Shield,
                title: "Prompt guardrails",
                body: "Built-in injection protection, profanity filtering, and citation-suppression blocking.",
              },
              {
                icon: Bot,
                title: "Embeddable widget",
                body: "Ship a white-label chatbot widget to any site. Domain-restricted, CORS-safe.",
              },
              {
                icon: Database,
                title: "BYOK generation",
                body: "Bring your own Google Gemini API key. Per-client daily token limits enforced.",
              },
              {
                icon: Globe,
                title: "Admin dashboard",
                body: "Manage clients, reset quotas, configure platform-wide ingestion and retrieval settings.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                style={{
                  border: "1px solid var(--hairline)",
                  borderRadius: 14,
                  background: "var(--surface-1)",
                  padding: "24px 22px",
                  transition: "border-color 200ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent-border)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--hairline)";
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: "var(--accent-soft-strong)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 14,
                  }}
                >
                  <Icon size={16} color="var(--primary)" />
                </div>
                <h3
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    letterSpacing: "-0.02em",
                    marginBottom: 8,
                  }}
                >
                  {title}
                </h3>
                <p style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.6 }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ───────────────────────────────────────────── */}
      <section
        style={{
          padding: "80px 24px",
          borderTop: "1px solid var(--hairline)",
          borderBottom: "1px solid var(--hairline)",
          background: "var(--surface-dark-soft)",
        }}
      >
        <div className="mx-auto max-w-4xl grid gap-8 sm:grid-cols-3 text-center">
          {[
            {
              value: "5-stage",
              label: "Pipeline: crawl → chunk → embed → rerank → generate",
            },
            { value: "4 signals", label: "Confidence breakdown per answer" },
            {
              value: "100%",
              label: "Private — your data, your key, your server",
            },
          ].map(({ value, label }) => (
            <div key={value}>
              <div
                style={{
                  fontSize: "clamp(2rem, 4vw, 3rem)",
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  color: "var(--primary)",
                  marginBottom: 8,
                }}
              >
                {value}
              </div>
              <p style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.5 }}>
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TRUST CARDS ─────────────────────────────────────── */}
      <section
        style={{
          padding: "80px 24px",
          borderTop: "1px solid var(--hairline)",
        }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              {
                icon: Shield,
                title: "JWT-secured sessions",
                body: "Every workspace is scoped to an authenticated client. No data leaks between accounts.",
              },
              {
                icon: Database,
                title: "Per-site vector indexes",
                body: "Each ingested website lives in its own ChromaDB collection — total isolation.",
              },
              {
                icon: Zap,
                title: "Pause & resume ingestion",
                body: "Long crawls can be paused and resumed from exactly where they left off.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                style={{
                  border: "1px solid var(--accent-border)",
                  borderRadius: 14,
                  background: "var(--accent-soft)",
                  padding: "28px 24px",
                }}
              >
                <Icon size={20} color="var(--primary)" style={{ marginBottom: 14 }} />
                <h3
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    letterSpacing: "-0.02em",
                    marginBottom: 8,
                  }}
                >
                  {title}
                </h3>
                <p style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.6 }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section
        style={{
          padding: "100px 24px",
          textAlign: "center",
          borderTop: "1px solid var(--hairline)",
        }}
      >
        <div className="mx-auto max-w-2xl">
          <h2
            style={{
              fontSize: "clamp(2rem, 4vw, 3.2rem)",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              marginBottom: 16,
            }}
          >
            Ready to build your private AI workspace?
          </h2>
          <p
            style={{
              color: "var(--muted)",
              fontSize: 16,
              lineHeight: 1.65,
              marginBottom: 40,
            }}
          >
            Ingest a site, chat with it, deploy a widget — all from one place.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/signup"
              style={{
                background: "var(--primary)",
                color: "var(--canvas)",
                fontWeight: 700,
                fontSize: 15,
                padding: "14px 32px",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition:
                  "background 140ms, box-shadow 140ms, transform 140ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--primary-active)";
                e.currentTarget.style.boxShadow = "0 0 36px var(--accent-glow)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--primary)";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              Create free account <ArrowRight size={16} />
            </Link>
            <Link
              to="/login"
              style={{
                color: "var(--ink-soft)",
                fontSize: 15,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "14px 8px",
                transition: "color 140ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--on-dark)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--ink-soft)";
              }}
            >
              I already have an account <ChevronRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: "1px solid var(--hairline)",
          padding: "32px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          maxWidth: 1152,
          margin: "0 auto",
        }}
      >
        <div className="flex items-center gap-2">
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Zap size={13} color="var(--canvas)" strokeWidth={2.5} />
          </div>
          <span
            style={{ fontWeight: 700, fontSize: 14, letterSpacing: "-0.02em" }}
          >
              LoreHub
          </span>
        </div>
        <p style={{ color: "var(--muted-soft)", fontSize: 13 }}>
          LoreHub — your data stays yours.
        </p>
        <div className="flex items-center gap-4">
          <Link
            to="/login"
            style={{ color: "var(--ink-muted)", fontSize: 13, transition: "color 140ms" }}
            onMouseEnter={(e) => (e.target.style.color = "var(--ink-soft)")}
            onMouseLeave={(e) => (e.target.style.color = "var(--ink-muted)")}
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            style={{ color: "var(--primary)", fontSize: 13, fontWeight: 600 }}
          >
            Get started
          </Link>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
