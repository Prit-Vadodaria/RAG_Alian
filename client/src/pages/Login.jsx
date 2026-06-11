import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import AuthLayout from "../layouts/AuthLayout";
import { useAuthStore } from "../store/authStore";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrating = useAuthStore((state) => state.isHydrating);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const from = location.state?.from?.pathname || "/workspace";

  if (!isHydrating && isAuthenticated) {
    return <Navigate to="/workspace" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const result = await login(email.trim(), password);
      navigate(result.user?.role === "admin" ? "/admin" : from, { replace: true });
    } catch {
      // The store already surfaces the error text.
    }
  };

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in to your workspace"
      description="Use your account to access the private RAG workspace, dashboards, and management tools."
      footer={
        <p className="text-sm text-[color:var(--on-dark-soft)]">
          Need an account?{" "}
          <Link to="/signup" className="font-semibold text-[color:var(--primary)]">
            Create one
          </Link>
        </p>
      }
      >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="text-sm text-[color:var(--on-dark-soft)]">Email</span>
          <input className="field w-full" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-[color:var(--on-dark-soft)]">Password</span>
          <input className="field w-full" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </label>
        {error ? <p className="text-sm text-[color:var(--error)]">{error}</p> : null}
        <button type="submit" className="button-primary w-full justify-center" disabled={isLoading}>
          {isLoading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
}

export default Login;
