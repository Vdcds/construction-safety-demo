import {
  ShieldCheck,
  LayoutDashboard,
  ListChecks,
  SlidersHorizontal,
  BookOpen,
  ChevronDown,
  HardHat,
} from "lucide-react";
import type { Page } from "../types";

export default function Sidebar({
  page,
  onNavigate,
  online,
}: {
  page: Page;
  onNavigate: (page: Page) => void;
  online: boolean;
}) {
  const links = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "history", label: "Violation history", icon: ListChecks },
    { id: "setup", label: "Detection setup", icon: SlidersHorizontal },
    { id: "guide", label: "Demo guide", icon: BookOpen },
  ] as const;
  return (
    <aside className="sidebar">
      <a
        className="brand"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onNavigate("overview");
        }}
      >
        <span className="brand-mark">
          <ShieldCheck size={25} strokeWidth={2.1} />
        </span>
        <span>
          SiteGuard<small>Construction safety</small>
        </span>
      </a>
      <div className="workspace">
        <span className="workspace-icon">
          <HardHat size={21} />
        </span>
        <div>
          Local workspace<small>Construction site</small>
        </div>
        <ChevronDown size={15} />
      </div>
      <div className="nav-caption">Workspace</div>
      <nav aria-label="Main navigation">
        {links.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={page === id ? "nav-link active" : "nav-link"}
            onClick={() => onNavigate(id)}
          >
            <Icon size={19} />
            {label}
            {id === "overview" && <span className="nav-dot" />}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="connection">
          <span className={online ? "status-dot" : "status-dot offline"} />
          <span>
            {online ? "Local system connected" : "Backend disconnected"}
          </span>
        </div>
        <div className="sidebar-footer">
          <span className="avatar">SG</span>
          <div>
            Safety monitoring<small>College project · MVP</small>
          </div>
          <span className="version">v1.0</span>
        </div>
      </div>
    </aside>
  );
}
