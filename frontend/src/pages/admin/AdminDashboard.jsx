import { useEffect, useState } from "react";
import { Bot, Globe, Search, Shield, Users } from "lucide-react";
import { getStats } from "../../services/admin";

const Card = ({ title, value, icon: Icon, sublabel }) => (
  <div className="surface-page p-5">
    <div className="flex items-center justify-between gap-3">
      <p className="text-kicker">{title}</p>
      <Icon className="h-5 w-5 text-[color:var(--primary)]" />
    </div>
    <p className="mt-4 text-3xl font-semibold text-[color:var(--on-dark)]">{value}</p>
    <p className="mt-2 text-sm text-[color:var(--on-dark-soft)]">{sublabel}</p>
  </div>
);

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getStats()
      .then((value) => {
        if (!active) return;
        setStats(value);
        setError("");
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || String(err));
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1 pb-2">
      <header className="surface-page p-5">
        <p className="text-kicker">Admin overview</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--on-dark)]">Platform dashboard</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--on-dark-soft)]">
          Track clients, contexts, chatbot deployments, and quota usage across the platform.
        </p>
      </header>
      {loading ? <div className="surface-page p-4 text-sm text-[color:var(--on-dark-soft)]">Loading platform metrics...</div> : null}
      {error ? <div className="surface-page border border-[color:var(--error)]/30 p-4 text-sm text-[color:var(--error)]">{error}</div> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Total Clients" value={stats?.totalClients ?? 0} icon={Users} sublabel="Registered client accounts" />
        <Card title="Disabled Clients" value={stats?.disabledClients ?? 0} icon={Shield} sublabel="Disabled accounts" />
        <Card title="Contexts" value={stats?.totalContexts ?? 0} icon={Globe} sublabel="Website knowledge bases" />
        <Card title="Chatbots" value={stats?.totalChatbots ?? 0} icon={Bot} sublabel="Public widget deployments" />
        <Card title="Queries Today" value={stats?.totalQueriesToday ?? 0} icon={Search} sublabel="Queries fired today" />
        <Card title="All-Time Queries" value={stats?.totalQueriesAllTime ?? 0} icon={Search} sublabel="Queries fired so far" />
      </div>
    </div>
  );
}

export default AdminDashboard;
