import { useEffect } from "react";
import {
  Activity,
  Bot,
  Globe,
  Shield,
  Search,
  CircleAlert,
  CircleCheckBig,
  AlertTriangle,
} from "lucide-react";

import { useDashboardStore } from "../store/dashboardStore";
import OverviewCard from "../components/dashboard/OverviewCard";
import UsageProgressBar from "../components/dashboard/UsageProgressBar";

const formatNumber = (value) => Number(value || 0).toLocaleString();

const formatResetLabel = (minutes) => {
  const value = Number(minutes || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return "Resets daily";
  }
  if (value % 1440 === 0) {
    const days = value / 1440;
    return days === 1 ? "Resets every 24 hours" : `Resets every ${days} days`;
  }
  if (value % 60 === 0) {
    const hours = value / 60;
    return hours === 1 ? "Resets every hour" : `Resets every ${hours} hours`;
  }
  return `Resets every ${value} minutes`;
};

const formatQuotaSource = (source) => {
  const normalized = String(source || "").toLowerCase();
  if (normalized === "override") return "Client Override";
  if (normalized === "default") return "Platform Default";
  return "Inherited";
};

const statusTone = (status) => {
  const normalized = String(status || "active").toLowerCase();
  if (normalized === "cooldown") {
    return "border-[color:var(--error)]/30 bg-[color:var(--error)]/10 text-[color:var(--error)]";
  }
  if (normalized === "limited") {
    return "border-[color:var(--warning)]/30 bg-[color:var(--warning)]/10 text-[color:var(--warning)]";
  }
  if (normalized === "suspended") {
    return "border-[color:var(--muted)]/30 bg-[color:var(--surface-2)] text-[color:var(--on-dark-soft)]";
  }
  return "border-[color:var(--success)]/30 bg-[color:var(--success)]/10 text-[color:var(--success)]";
};

function DashboardSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1 pb-2">
      <div className="surface-page animate-pulse p-5">
        <div className="h-4 w-24 rounded bg-white/10" />
        <div className="mt-4 h-8 w-56 rounded bg-white/10" />
        <div className="mt-3 h-4 w-80 max-w-full rounded bg-white/10" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="surface-page animate-pulse p-5">
            <div className="h-3 w-20 rounded bg-white/10" />
            <div className="mt-4 h-8 w-28 rounded bg-white/10" />
            <div className="mt-2 h-3 w-32 rounded bg-white/10" />
          </div>
        ))}
      </div>
      <div className="surface-page animate-pulse p-5">
        <div className="h-3 w-24 rounded bg-white/10" />
        <div className="mt-4 h-3 w-full rounded bg-white/10" />
        <div className="mt-3 h-3 w-3/4 rounded bg-white/10" />
      </div>
    </div>
  );
}

function Dashboard() {
  const summary = useDashboardStore((state) => state.summary);
  const loading = useDashboardStore((state) => state.loading);
  const error = useDashboardStore((state) => state.error);
  const fetchSummary = useDashboardStore((state) => state.fetchSummary);
  const resetUsage = useDashboardStore((state) => state.resetUsage);

  useEffect(() => {
    fetchSummary();
    const intervalId = window.setInterval(() => {
      fetchSummary();
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [fetchSummary]);

  const resolvedSummary = summary || {};
  const warningLevel = resolvedSummary.warningLevel || "active";
  const warningLabel = warningLevel;
  const accountStatus = String(
    resolvedSummary.accountStatus || "active",
  ).toLowerCase();
  const quotaDefaults = resolvedSummary.quotaDefaults || {};
  const quotaEffective = resolvedSummary.quotaEffective || {};
  const hasGenerationConfig = Boolean(resolvedSummary.hasGenerationConfig);
  const hasCooldownOverride =
    Number(quotaEffective.cooldownDurationMinutes || 0) !==
    Number(quotaDefaults.cooldownDurationMinutes || 0);

  if (loading && !summary) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1 pb-2">
      <header className="surface-page p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-kicker">Overview</p>
            <h1 className="mt-3 text-3xl font-semibold text-[color:var(--on-dark)]">
              Dashboard
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--on-dark-soft)]">
              Track token usage, quota state, and the current workspace activity at a glance.
            </p>
          </div>
          <div className="flex flex-col gap-3 self-start">
            <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold capitalize ${statusTone(accountStatus)}`}>
              {accountStatus === "active" ? (
                <CircleCheckBig className="h-4 w-4" />
              ) : accountStatus === "cooldown" ? (
                <AlertTriangle className="h-4 w-4" />
              ) : accountStatus === "limited" ? (
                <CircleAlert className="h-4 w-4" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              <span>{accountStatus === "active" ? "Healthy" : accountStatus}</span>
            </div>
            <button
              type="button"
              onClick={() => resetUsage()}
              disabled={loading}
              className="button-secondary self-end"
            >
              Reset usage
            </button>
          </div>
        </div>
        {resolvedSummary.planName ? (
          <p className="mt-3 text-xs uppercase tracking-[0.24em] text-[color:var(--on-dark-soft)]">
            Plan: {resolvedSummary.planName}
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="surface-card p-4">
            <p className="text-kicker">Configured limit</p>
            <p className="mt-2 text-lg font-semibold text-[color:var(--on-dark)]">
              {formatNumber(resolvedSummary.dailyTokenLimit)}
            </p>
            <p className="mt-1 text-xs text-[color:var(--on-dark-soft)]">
              {hasGenerationConfig ? "From your AI configuration" : "Configure your AI key first"}
            </p>
          </div>
          <div className="surface-card p-4">
            <p className="text-kicker">Quota source</p>
            <p className="mt-2 text-lg font-semibold text-[color:var(--on-dark)]">{formatQuotaSource(hasGenerationConfig ? "override" : "default")}</p>
            <p className="mt-1 text-xs text-[color:var(--on-dark-soft)]">
              {hasGenerationConfig ? "Client-owned generation settings" : "No AI config on file"}
            </p>
          </div>
          <div className="surface-card p-4">
            <p className="text-kicker">Reset timing</p>
            <p className="mt-2 text-lg font-semibold text-[color:var(--on-dark)]">
              {formatResetLabel(quotaDefaults.cooldownDurationMinutes || resolvedSummary.cooldownDurationMinutes)}
            </p>
            <p className="mt-1 text-xs text-[color:var(--on-dark-soft)]">
              {formatQuotaSource(hasCooldownOverride ? "override" : "default")}
            </p>
          </div>
        </div>
      </header>

      {error ? (
        <div className="surface-page border-[color:var(--error)]/30 bg-[color:var(--error)]/10 p-4 text-sm text-[color:var(--error)]">
          Unable to load dashboard data: {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <OverviewCard
          title="Total Contexts"
          value={formatNumber(resolvedSummary.contextsGenerated)}
          icon={Globe}
          sublabel="Website contexts available"
        />
        <OverviewCard
          title="Chatbots"
          value={formatNumber(resolvedSummary.chatbotsCreated)}
          icon={Bot}
          sublabel="Configured assistants"
        />
        <OverviewCard
          title="Queries Today"
          value={formatNumber(resolvedSummary.queriesToday ?? resolvedSummary.todayRequests)}
          icon={Search}
          sublabel="Total queries fired today"
          colorClass="text-[color:var(--primary)]"
        />
        <OverviewCard
          title="Daily Limit"
          value={formatNumber(resolvedSummary.dailyTokenLimit)}
          icon={Shield}
          sublabel={`${formatResetLabel(resolvedSummary.cooldownDurationMinutes)} · ${formatQuotaSource(hasGenerationConfig ? "override" : "default")}`}
        />
        <OverviewCard
          title="Quota State"
          value={warningLabel}
          icon={Activity}
          sublabel="Matches the enforced quota state"
          colorClass="text-[color:var(--primary)]"
        />
        <OverviewCard
          title="All-Time Queries"
          value={formatNumber(resolvedSummary.queriesAllTime ?? resolvedSummary.allTimeRequests)}
          icon={Search}
          sublabel="Total queries fired so far"
          colorClass="text-[color:var(--success)]"
        />
      </div>

      <UsageProgressBar
        tokensUsed={resolvedSummary.todayTokensUsed ?? 0}
        dailyLimit={resolvedSummary.dailyTokenLimit ?? 0}
        warningLevel={warningLevel}
      />
    </div>
  );
}

export default Dashboard;
