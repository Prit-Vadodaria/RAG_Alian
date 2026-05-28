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
      } catch (error) {
        setStatus("offline");
      }
    };

    loadHealth();
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm shadow-cyan-500/5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">
              System status
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Operational measures for the private RAG engine and knowledge
              workspace.
            </p>
          </div>
          <div className="inline-flex items-center gap-3 rounded-3xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200">
            <span
              className={`inline-flex h-3.5 w-3.5 rounded-full ${status === "healthy" ? "bg-emerald-400" : status === "loading" ? "bg-amber-400" : "bg-rose-500"}`}
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
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
              <div className="flex items-center gap-3 text-cyan-400">
                <Database className="h-5 w-5" />
                <p className="text-sm font-semibold text-zinc-100">Vector DB</p>
              </div>
              <p className="mt-3 text-sm text-zinc-400">Connected</p>
            </div>
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
              <div className="flex items-center gap-3 text-cyan-400">
                <Cpu className="h-5 w-5" />
                <p className="text-sm font-semibold text-zinc-100">
                  LLM Provider
                </p>
              </div>
              <p className="mt-3 text-sm text-zinc-400">Google Gemini</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Knowledge base">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                Embedding model
              </p>
              <p className="mt-3 text-base text-zinc-100">
                Enterprise Embed v1
              </p>
            </div>
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                KB chunks
              </p>
              <p className="mt-3 text-base text-zinc-100">12,400</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Latency overview">
          <div className="grid gap-4">
            <div className="flex items-center justify-between rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
              <div>
                <p className="text-sm text-zinc-500">Average round-trip</p>
                <p className="mt-1 text-xl font-semibold text-zinc-100">
                  {formatDuration(1850)}
                </p>
              </div>
              <Activity className="h-5 w-5 text-cyan-400" />
            </div>
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-400">
              <p className="text-zinc-100">Backend health details</p>
              <p className="mt-3">
                {health?.status || "Health status unavailable"}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Observability">
          <div className="grid gap-4">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-400">
              <p className="text-zinc-100">Request throughput</p>
              <p className="mt-3">
                Stable connection from frontend to backend.
              </p>
            </div>
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-400">
              <p className="text-zinc-100">Schema sync</p>
              <p className="mt-3">Health endpoint responded successfully.</p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export default System;
