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
      <div className="flex min-h-screen items-center justify-center bg-[#090909] text-white">
        <div className="flex items-center gap-3 text-sm text-[#555]">
          <div className="h-1.5 w-1.5 rounded-full bg-[#c8ff57] animate-pulse" />
          Loading…
        </div>
      </div>
    );
  }

  if (!isHydrating && isAuthenticated) {
    return <Navigate to="/workspace" replace />;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[color:var(--canvas)] text-[color:var(--on-dark)]" style={{ fontFamily: "var(--font-body)" }}>
      {/* ── NAV ─────────────────────────────────────────────── */}
      <header
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(9,9,9,0.85)",
          backdropFilter: "blur(16px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "#c8ff57",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Zap size={16} color="#000" strokeWidth={2.5} />
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
                color: "#999",
                fontSize: 14,
                fontWeight: 500,
                padding: "8px 16px",
                borderRadius: 8,
                transition: "color 140ms",
              }}
              onMouseEnter={(e) => (e.target.style.color = "#f5f5f5")}
              onMouseLeave={(e) => (e.target.style.color = "#999")}
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              style={{
                background: "#c8ff57",
                color: "#000",
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
                e.currentTarget.style.background = "#a8e040";
                e.currentTarget.style.boxShadow =
                  "0 0 20px rgba(200,255,87,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#c8ff57";
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
            border: "1px solid rgba(200,255,87,0.26)",
            borderRadius: 9999,
            background: "rgba(200,255,87,0.06)",
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
              background: "#c8ff57",
              display: "inline-block",
            }}
          />
          <span
            style={{
              color: "#c8ff57",
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
          Your website. <span style={{ color: "#c8ff57" }}>Answered.</span>
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
              color: "#000",
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
              e.currentTarget.style.boxShadow = "0 0 32px rgba(200,255,87,0.28)";
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
              e.currentTarget.style.borderColor = "rgba(200,255,87,0.26)";
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
                  boxShadow: "0 0 10px rgba(200,255,87,0.45)",
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
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="mx-auto max-w-6xl">
          <p
            style={{
              color: "#c8ff57",
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
              color: "#666",
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
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 14,
                  background: "#111",
                  padding: "28px 24px",
                  transition: "border-color 200ms, box-shadow 200ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(200,255,87,0.25)";
                  e.currentTarget.style.boxShadow =
                    "0 0 30px rgba(200,255,87,0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
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
                      color: "#c8ff57",
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
                      background: "rgba(200,255,87,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={15} color="#c8ff57" />
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
                <p style={{ color: "#666", fontSize: 13.5, lineHeight: 1.6 }}>
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
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="mx-auto max-w-6xl">
          <p
            style={{
              color: "#c8ff57",
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
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 14,
                  background: "#0e0e0e",
                  padding: "24px 22px",
                  transition: "border-color 200ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(200,255,87,0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: "rgba(200,255,87,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 14,
                  }}
                >
                  <Icon size={16} color="#c8ff57" />
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
                <p style={{ color: "#666", fontSize: 13.5, lineHeight: 1.6 }}>
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
          borderTop: "1px solid rgba(255,255,255,0.06)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "#0d0d0d",
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
                  color: "#c8ff57",
                  marginBottom: 8,
                }}
              >
                {value}
              </div>
              <p style={{ color: "#666", fontSize: 13.5, lineHeight: 1.5 }}>
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
          borderTop: "1px solid rgba(255,255,255,0.06)",
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
                  border: "1px solid rgba(200,255,87,0.12)",
                  borderRadius: 14,
                  background: "rgba(200,255,87,0.04)",
                  padding: "28px 24px",
                }}
              >
                <Icon size={20} color="#c8ff57" style={{ marginBottom: 14 }} />
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
                <p style={{ color: "#666", fontSize: 13.5, lineHeight: 1.6 }}>
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
          borderTop: "1px solid rgba(255,255,255,0.06)",
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
              color: "#666",
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
                background: "#c8ff57",
                color: "#000",
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
                e.currentTarget.style.background = "#a8e040";
                e.currentTarget.style.boxShadow =
                  "0 0 36px rgba(200,255,87,0.4)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#c8ff57";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              Create free account <ArrowRight size={16} />
            </Link>
            <Link
              to="/login"
              style={{
                color: "#999",
                fontSize: 15,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "14px 8px",
                transition: "color 140ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#f5f5f5";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#999";
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
          borderTop: "1px solid rgba(255,255,255,0.06)",
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
              background: "#c8ff57",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Zap size={13} color="#000" strokeWidth={2.5} />
          </div>
          <span
            style={{ fontWeight: 700, fontSize: 14, letterSpacing: "-0.02em" }}
          >
              LoreHub
          </span>
        </div>
        <p style={{ color: "#444", fontSize: 13 }}>
          LoreHub — your data stays yours.
        </p>
        <div className="flex items-center gap-4">
          <Link
            to="/login"
            style={{ color: "#555", fontSize: 13, transition: "color 140ms" }}
            onMouseEnter={(e) => (e.target.style.color = "#999")}
            onMouseLeave={(e) => (e.target.style.color = "#555")}
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            style={{ color: "#c8ff57", fontSize: 13, fontWeight: 600 }}
          >
            Get started
          </Link>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
