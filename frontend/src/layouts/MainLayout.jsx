import { Outlet } from "react-router-dom";
//import { Menu, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import Sidebar from "../components/sidebar/Sidebar";
import ToastContainer from "../components/ui/ToastContainer";

function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="app-shell">
      <div className="relative flex h-full overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          collapsed={sidebarCollapsed}
          onClose={() => setSidebarOpen(false)}
          onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
        />

        <div className="relative flex flex-1 flex-col overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--accent-soft),transparent_28%),radial-gradient(circle_at_bottom_left,var(--ink-soft-overlay),transparent_26%)]" />
          <main className="relative flex-1 overflow-hidden px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
            <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col overflow-hidden">
              <Outlet />
            </div>
          </main>
        </div>
        <ToastContainer />
      </div>
    </div>
  );
}

export default MainLayout;
