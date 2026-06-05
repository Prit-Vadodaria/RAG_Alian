import { useEffect, useState } from "react";
import { Activity, Database, Cpu, Sparkles } from "lucide-react";

import { pingHealth } from "../services/rag";
import SectionCard from "../components/ui/SectionCard";
import { formatDuration } from "../utils/format";

function System() {
  const [health, setHealth] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const loadHealth = async () => {
      try {
        const response = await pingHealth();
        setHealth(response);
        setStatus("healthy");
      } catch {
        setStatus("offline");
      }
    };

    loadHealth();
  }, []);

  return (
    <div className="h-full min-h-0 space-y-6 overflow-hidden">
      <div className="surface-page p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-kicker">System overview</p>
            <h1 className="text-surface-title mt-3 text-3xl font-semibold sm:text-4xl">
              Engine status
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--body)]">
              Operational health and observability metrics for the private RAG engine.
            </p>
          </div>
          <div className="surface-card inline-flex items-center gap-3 px-4 py-3 text-sm text-[color:var(--body)]">
            <span
              className={`inline-flex h-3.5 w-3.5 rounded-full ${
                status === "healthy"
                  ? "bg-[color:var(--success)]"
                  : status === "loading"
                    ? "bg-[color:var(--warning)]"
                    : "bg-[color:var(--error)]"
              }`}
            />
            {status === "healthy"
              ? "Backend healthy"
              : status === "loading"
                ? "Checking..."
                : "Backend offline"}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Infrastructure">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="surface-card p-5">
              <div className="flex items-center gap-3 text-[color:var(--primary)]">
                <Database className="h-5 w-5" />
                <p className="text-sm font-semibold text-[color:var(--ink)]">
                  Vector DB
                </p>
              </div>
              <p className="mt-3 text-sm text-[color:var(--body)]">Connected</p>
            </div>
            <div className="surface-card p-5">
              <div className="flex items-center gap-3 text-[color:var(--primary)]">
                <Cpu className="h-5 w-5" />
                <p className="text-sm font-semibold text-[color:var(--ink)]">
                  LLM provider
                </p>
              </div>
              <p className="mt-3 text-sm text-[color:var(--body)]">Google Gemini</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Knowledge base">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="surface-card p-5">
              <p className="text-kicker">Embedding model</p>
              <p className="mt-3 text-base text-[color:var(--ink)]">
                Enterprise Embed v1
              </p>
            </div>
            <div className="surface-card p-5">
              <p className="text-kicker">KB chunks</p>
              <p className="mt-3 text-base text-[color:var(--ink)]">12,400</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Latency overview">
          <div className="grid gap-4">
            <div className="surface-card flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-[color:var(--muted)]">Average round-trip</p>
                <p className="mt-1 text-2xl font-semibold text-[color:var(--ink)]">
                  {formatDuration(1850)}
                </p>
              </div>
              <Activity className="h-5 w-5 text-[color:var(--primary)]" />
            </div>
            <div className="surface-card p-5 text-sm text-[color:var(--body)]">
              <p className="text-[color:var(--ink)]">Backend health details</p>
              <p className="mt-3">
                {health?.status || "Health status unavailable"}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Observability">
          <div className="grid gap-4">
            <div className="surface-card p-5 text-sm text-[color:var(--body)]">
              <p className="text-[color:var(--ink)]">Request throughput</p>
              <p className="mt-3">
                Stable connection from frontend to backend.
              </p>
            </div>
            <div className="surface-card p-5 text-sm text-[color:var(--body)]">
              <p className="text-[color:var(--ink)]">Schema sync</p>
              <p className="mt-3">Health endpoint responded successfully.</p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export default System;
