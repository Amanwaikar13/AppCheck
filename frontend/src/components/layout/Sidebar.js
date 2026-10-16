import Brand from "./Brand";
import NavLinks from "./NavLinks";
import SidebarFooter from "./SidebarFooter";

/** Sidebar contents; rendered fixed on desktop and inside the mobile drawer. */
export default function Sidebar({ onNavigate }) {
  return (
    <div className="flex h-full flex-col bg-navy-950 py-4">
      <div className="px-5 pb-6">
        <Brand href="/dashboard" subtitle />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        <NavLinks onNavigate={onNavigate} />
      </div>
      <div className="px-3 pt-4">
        <SidebarFooter />
      </div>
    </div>
  );
}
