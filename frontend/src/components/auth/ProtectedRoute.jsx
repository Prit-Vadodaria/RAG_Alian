import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

function ProtectedRoute() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrating = useAuthStore((state) => state.isHydrating);

  if (isHydrating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(200,255,87,0.12),transparent_34%),linear-gradient(180deg,#0d0d0d_0%,#090909_100%)] text-[color:var(--on-dark)]">
        <div className="surface-page px-6 py-4 text-sm text-[color:var(--on-dark-soft)]">
          Checking session...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (location.pathname === "/") {
    return <Navigate to="/workspace" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
