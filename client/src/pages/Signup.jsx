import { Link, Navigate, useNavigate } from "react-router-dom";
import { useState } from "react";
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

  if (!isHydrating && isAuthenticated) {
    return <Navigate to="/workspace" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const result = await signup(name.trim(), email.trim(), password);
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
        {error ? <p className="text-sm text-[color:var(--error)]">{error}</p> : null}
        <button type="submit" className="button-primary w-full justify-center" disabled={isLoading}>
          {isLoading ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}

export default Signup;
