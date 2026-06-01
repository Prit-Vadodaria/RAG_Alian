import { useEffect } from "react";
import { Cog, Palette, SlidersHorizontal, Moon, Sparkles } from "lucide-react";
import SectionCard from "../components/ui/SectionCard";
import ContextManager from "../components/context/ContextManager";

function Settings() {
  useEffect(() => {
    if (window.location.hash === "#knowledge-contexts") {
      document
        .getElementById("knowledge-contexts")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <div className="h-full min-h-0 overflow-y-auto pr-1 space-y-6">
      <div className="rounded-[2rem] border border-zinc-800 bg-[#111317] p-6 shadow-[0_40px_80px_rgba(15,23,42,0.18)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-400">
              Workspace preferences
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-zinc-100">
              Settings
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Configure your AI workspace experience, appearance options, and
              retrieval controls.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-3xl border border-zinc-800 bg-[#0f1116] px-4 py-3 text-sm text-zinc-200">
            <Cog className="h-4 w-4 text-cyan-400" />
            Workspace settings
          </div>
        </div>
      </div>

      <div id="knowledge-contexts" className="scroll-mt-6">
        <SectionCard title="Knowledge contexts">
          <ContextManager />
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Appearance">
          <div className="space-y-5">
            <div className="rounded-[1.75rem] border border-zinc-800 bg-[#0f1116] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">
                    Dark theme
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Premium AI-native appearance for all pages.
                  </p>
                </div>
                <label className="relative inline-flex h-7 w-12 cursor-pointer rounded-full bg-zinc-800 transition">
                  <input type="checkbox" className="peer sr-only" />
                  <span className="absolute inset-0 rounded-full bg-zinc-800 transition peer-checked:bg-cyan-500" />
                  <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                </label>
              </div>
            </div>
            <div className="rounded-[1.75rem] border border-zinc-800 bg-[#0f1116] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">
                    Compact mode
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Tighter spacing for fast workflows.
                  </p>
                </div>
                <label className="relative inline-flex h-7 w-12 cursor-pointer rounded-full bg-zinc-800 transition">
                  <input type="checkbox" className="peer sr-only" />
                  <span className="absolute inset-0 rounded-full bg-zinc-800 transition peer-checked:bg-cyan-500" />
                  <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                </label>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Workspace controls">
          <div className="space-y-5">
            <div className="rounded-[1.75rem] border border-zinc-800 bg-[#0f1116] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">
                    Model target
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Select the best model for your retrieval workflow.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-3xl border border-zinc-800 bg-[#111317] px-3 py-2 text-sm text-zinc-200">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  Gemini
                </div>
              </div>
            </div>
            <div className="rounded-[1.75rem] border border-zinc-800 bg-[#0f1116] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">
                    Retrieval hints
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Enable richer context signals in the returned answers.
                  </p>
                </div>
                <label className="relative inline-flex h-7 w-12 cursor-pointer rounded-full bg-zinc-800 transition">
                  <input type="checkbox" className="peer sr-only" />
                  <span className="absolute inset-0 rounded-full bg-zinc-800 transition peer-checked:bg-cyan-500" />
                  <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                </label>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Experience">
          <div className="rounded-[1.75rem] border border-zinc-800 bg-[#0f1116] p-5 text-sm text-zinc-400">
            <div className="flex items-center gap-3 text-cyan-400">
              <Palette className="h-5 w-5" />
              <p className="font-semibold text-zinc-100">Design mode</p>
            </div>
            <p className="mt-3">
              Fine-tune the interface without changing your backend logic.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="API & tools">
          <div className="rounded-[1.75rem] border border-zinc-800 bg-[#0f1116] p-5 text-sm text-zinc-400">
            <div className="flex items-center gap-3 text-cyan-400">
              <SlidersHorizontal className="h-5 w-5" />
              <p className="font-semibold text-zinc-100">Workspace controls</p>
            </div>
            <p className="mt-3">
              Manage conversation behavior, system prompts, and retrieval
              defaults.
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export default Settings;
