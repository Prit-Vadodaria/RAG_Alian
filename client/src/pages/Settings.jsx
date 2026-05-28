import { Cog, Palette } from "lucide-react";
import SectionCard from "../components/ui/SectionCard";

function Settings() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm shadow-cyan-500/5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">Settings</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Configure the frontend workspace experience and future
              preferences.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200">
            <Cog className="h-4 w-4 text-cyan-400" />
            Placeholder settings
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="UI Preferences">
          <div className="space-y-4 text-sm text-zinc-400">
            <p>
              Theme settings and workspace appearance controls will be added
              here.
            </p>
            <div className="grid gap-3 rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-center gap-3 text-zinc-200">
                <Palette className="h-5 w-5 text-cyan-400" />
                <span>Theme mode placeholder</span>
              </div>
              <p className="text-xs text-zinc-500">
                Switch between compact and expanded UI modes in future releases.
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Future preferences">
          <div className="space-y-4 text-sm text-zinc-400">
            <p>
              Saved preferences, alert thresholds, and workspace defaults will
              be managed here.
            </p>
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                Coming soon
              </p>
              <p className="mt-3 text-sm text-zinc-300">
                Query templates, response controls, and custom confidence
                thresholds.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export default Settings;
