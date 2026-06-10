import { useEffect } from "react";
import {
  Activity,
  Bot,
  Globe,
  Shield,
  TrendingDown,
  Zap,
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

const statusTone = (status) => {
  const normalized = String(status || "active").toLowerCase();
  if (normalized === "cooldown") {
    return "border-[rgba(184,78,78,0.22)] bg-[rgba(184,78,78,0.14)] text-[#f1c0c0]";
  }
  if (normalized === "limited") {
    return "border-[rgba(184,132,45,0.22)] bg-[rgba(184,132,45,0.14)] text-[#efd6a8]";
  }
  if (normalized === "suspended") {
    return "border-[rgba(160,153,150,0.22)] bg-[rgba(160,153,150,0.12)] text-[color:var(--on-dark-soft)]";
  }
  return "border-[rgba(79,157,103,0.22)] bg-[rgba(79,157,103,0.14)] text-[#c8e6d1]";
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
        {Array.from({ length: 6 }).map((_, index) => (
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

  useEffect(() => {
    fetchSummary();
    const intervalId = window.setInterval(() => {
      fetchSummary();
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [fetchSummary]);

  const resolvedSummary = summary || {};
  const warningLevel = resolvedSummary.warningLevel || "none";
  const warningLabel = warningLevel === "none" ? "active" : warningLevel;
  const accountStatus = String(
    resolvedSummary.accountStatus || "active",
  ).toLowerCase();

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
          <div className={`inline-flex items-center gap-2 self-start rounded-full border px-4 py-2 text-sm font-semibold capitalize ${statusTone(accountStatus)}`}>
            {accountStatus === "active" ? (
              <CircleCheckBig className="h-4 w-4" />
            ) : accountStatus === "cooldown" ? (
              <AlertTriangle className="h-4 w-4" />
            ) : accountStatus === "limited" ? (
              <CircleAlert className="h-4 w-4" />
            ) : (
              <Shield className="h-4 w-4" />
            )}
            <span>{accountStatus}</span>
          </div>
        </div>
        {resolvedSummary.planName ? (
          <p className="mt-3 text-xs uppercase tracking-[0.24em] text-[color:var(--on-dark-soft)]">
            Plan: {resolvedSummary.planName}
          </p>
        ) : null}
      </header>

      {error ? (
        <div className="surface-page border-[rgba(184,78,78,0.22)] bg-[rgba(184,78,78,0.08)] p-4 text-sm text-[#f1c0c0]">
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
          title="Today Tokens"
          value={formatNumber(resolvedSummary.todayTokensUsed)}
          icon={Zap}
          sublabel={`${formatNumber(resolvedSummary.todayRequests)} requests today`}
          colorClass="text-[color:var(--warning)]"
        />
        <OverviewCard
          title="Daily Limit"
          value={formatNumber(resolvedSummary.dailyTokenLimit)}
          icon={Shield}
          sublabel={formatResetLabel(resolvedSummary.cooldownDurationMinutes)}
        />
        <OverviewCard
          title="Remaining"
          value={formatNumber(resolvedSummary.tokensRemaining)}
          icon={TrendingDown}
          sublabel="Before cooldown starts"
          colorClass="text-[color:var(--success)]"
        />
        <OverviewCard
          title="Warning Level"
          value={warningLabel}
          icon={Activity}
          sublabel="Derived from usage percentage"
          colorClass="text-[color:var(--primary)]"
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
