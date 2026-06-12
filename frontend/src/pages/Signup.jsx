import { Link, Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import AuthLayout from "../layouts/AuthLayout";
import { useAuthStore } from "../store/authStore";

function Signup() {
  const navigate = useNavigate();
  const signup = useAuthStore((state) => state.signup);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrating = useAuthStore((state) => state.isHydrating);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [googleApiKey, setGoogleApiKey] = useState("");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [showKey, setShowKey] = useState(false);
  const [modelOptions, setModelOptions] = useState([]);
  const [modelLookupLoading, setModelLookupLoading] = useState(false);
  const [modelLookupError, setModelLookupError] = useState("");
  const hasApiKey = Boolean(googleApiKey.trim());
  const visibleModelOptions = hasApiKey ? modelOptions : [];

  useEffect(() => {
    const key = googleApiKey.trim();

    if (!key) {
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setModelLookupLoading(true);
      setModelLookupError("");

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error("Unable to load Gemini model suggestions.");
        }

        const { models } = await response.json();
        const nextModels = Array.from(
          new Set(
            Array.isArray(models)
              ? models
                  .map((entry) => String(entry?.name || "").replace(/^models\//, "").trim())
                  .filter((value) => value.startsWith("gemini-"))
              : [],
          ),
        ).sort();

        setModelOptions(nextModels);
      } catch (error) {
        if (error?.name !== "AbortError") {
          setModelOptions([]);
          setModelLookupError(error.message || String(error));
        }
      } finally {
        if (!controller.signal.aborted) {
          setModelLookupLoading(false);
        }
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [googleApiKey]);

  if (!isHydrating && isAuthenticated) {
    return <Navigate to="/workspace" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const result = await signup(name.trim(), email.trim(), password, {
        googleApiKey: googleApiKey.trim(),
        model,
      });
      navigate(result.user?.role === "admin" ? "/admin" : "/workspace", { replace: true });
    } catch {
      // The store already surfaces the error text.
    }
  };

  return (
    <AuthLayout
      eyebrow="Create account"
      title="Get access to the private AI workspace"
      description="Create your client account to manage contexts, chatbots, and token usage."
      footer={
        <p className="text-sm text-[color:var(--on-dark-soft)]">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-[color:var(--primary)]">
            Sign in
          </Link>
        </p>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="text-sm text-[color:var(--on-dark-soft)]">Name</span>
          <input className="field w-full" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-[color:var(--on-dark-soft)]">Email</span>
          <input className="field w-full" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-[color:var(--on-dark-soft)]">Password</span>
          <input className="field w-full" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-[color:var(--on-dark-soft)]">Google Gemini API Key</span>
          <div className="flex gap-2">
            <input
              className="field w-full"
              value={googleApiKey}
              onChange={(e) => setGoogleApiKey(e.target.value)}
              type={showKey ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Paste your Google API key"
              required
            />
            <button
              type="button"
              className="button-secondary px-3"
              onClick={() => setShowKey((value) => !value)}
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-[color:var(--on-dark-soft)]">Model</span>
          <input
            className="field w-full"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            list="gemini-model-options"
            placeholder="Type a Gemini model ID"
            required
          />
          <datalist id="gemini-model-options">
            {visibleModelOptions.map((entry) => (
              <option key={entry} value={entry} />
            ))}
          </datalist>
          <p className="text-xs text-[color:var(--on-dark-soft)]">
            Start typing a model name, then pick from the suggestions loaded from Google or enter a custom Gemini model ID.
          </p>
          {hasApiKey && modelLookupLoading ? (
            <p className="text-xs text-[color:var(--on-dark-soft)]">Loading model suggestions...</p>
          ) : null}
          {hasApiKey && modelLookupError ? (
            <p className="text-xs text-[color:var(--error)]">{modelLookupError}</p>
          ) : null}
        </label>
        {error ? <p className="text-sm text-[color:var(--error)]">{error}</p> : null}
        <button type="submit" className="button-primary w-full justify-center" disabled={isLoading}>
          {isLoading ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}

export default Signup;
