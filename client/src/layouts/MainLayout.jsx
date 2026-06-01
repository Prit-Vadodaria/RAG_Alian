import { Outlet } from "react-router-dom";
//import { Menu, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import Sidebar from "../components/sidebar/Sidebar";
import ToastContainer from "../components/ui/ToastContainer";

function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="h-screen bg-[#0a0a0a] text-slate-100">
      <div className="relative flex h-screen overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          collapsed={sidebarCollapsed}
          onClose={() => setSidebarOpen(false)}
          onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-hidden px-4 py-5 sm:px-6">
            <div className="mx-auto flex h-full w-full max-w-[1280px] flex-col overflow-hidden">
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
