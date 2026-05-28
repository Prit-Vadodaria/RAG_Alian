import { Outlet } from "react-router-dom";

//import Navbar from "../components/navbar/Navbar";
import Sidebar from "../components/sidebar/Sidebar";

function MainLayout() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="flex h-[calc(100vh)] overflow-hidden border-t border-zinc-800">
        <Sidebar />
        <main className="flex-1 overflow-hidden bg-zinc-950 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
