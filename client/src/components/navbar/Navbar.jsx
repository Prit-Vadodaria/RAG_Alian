import { Link } from "react-router-dom";
import { Settings, Activity } from "lucide-react";

import Logo from "./Logo";
import SystemStatus from "./SystemStatus";

function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/95 py-4 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1660px] items-center justify-between gap-4 px-4 md:px-6">
        <Logo />
        <div className="flex items-center gap-3">
          <SystemStatus status="healthy" />
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-cyan-500 hover:text-cyan-300"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
