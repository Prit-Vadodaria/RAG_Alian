import { useEffect } from "react";
import { Globe } from "lucide-react";
import SectionCard from "../components/ui/SectionCard";
import ContextManager from "../components/context/ContextManager";

function Contexts() {
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === "#knowledge-contexts" || hash === "#add-context") {
      const targetId = hash === "#add-context" ? "add-context" : "knowledge-contexts";
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <div className="h-full min-h-0 space-y-6 overflow-y-auto pr-1">
      <div className="surface-page p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-kicker">Knowledge management</p>
            <h1 className="text-surface-title mt-3 text-3xl font-semibold sm:text-4xl">
              Contexts
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--body)]">
              Ingest websites into isolated knowledge contexts. Each context is
              crawled, chunked, and indexed independently so you can query
              specific sources or all ready contexts at once.
            </p>
          </div>
          <div className="surface-card inline-flex items-center gap-2 px-4 py-3 text-sm text-[color:var(--body)]">
            <Globe className="h-4 w-4 text-[color:var(--primary)]" />
            Website ingestion
          </div>
        </div>
      </div>

      <div id="knowledge-contexts" className="scroll-mt-6">
        <SectionCard title="Knowledge contexts">
          <ContextManager />
        </SectionCard>
      </div>
    </div>
  );
}

export default Contexts;
