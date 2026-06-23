import { useState } from "react"
import { NavLink } from "react-router-dom"
import { 
  LayoutDashboard, 
  Package, 
  Warehouse, 
  Anchor, 
  BarChart3, 
  Bell, 
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { OrganizationSwitcher, UserButton } from "@clerk/clerk-react"

const NAV_ITEMS = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Suppliers", href: "/suppliers", icon: Package },
  { name: "Warehouses", href: "/warehouses", icon: Warehouse },
  { name: "Ports", href: "/ports", icon: Anchor },
  { name: "Analysis", href: "/analysis", icon: BarChart3 },
  { name: "Alerts", href: "/alerts", icon: Bell },
]

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    return saved === "true";
  });

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  return (
    <aside 
      className={`${
        isCollapsed ? "w-[70px]" : "w-[240px]"
      } flex-shrink-0 flex flex-col bg-card border-r border-green-100 h-screen transition-all duration-300 ease-in-out relative`}
    >
      {/* Brand Header */}
      <div className={`p-6 flex items-center justify-between ${isCollapsed ? "justify-center" : ""}`}>
        <div className="flex items-center gap-2 overflow-hidden">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="w-6 h-6 text-primary shrink-0" 
            aria-hidden="true"
          >
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
          </svg>
          <span className={`font-bold text-xl text-foreground tracking-tight whitespace-nowrap transition-all duration-300 ${
            isCollapsed ? "opacity-0 w-0 pointer-events-none overflow-hidden" : "opacity-100 w-auto"
          }`}>
            Hermes
          </span>
        </div>
        
        <button 
          onClick={toggleSidebar}
          className="absolute -right-3 top-6 p-1 rounded-full border border-green-200 bg-background hover:bg-green-50 text-muted-foreground hover:text-green-600 shadow-md z-50 transition-colors"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className={`flex-1 px-3 py-4 space-y-1 ${isCollapsed ? "flex flex-col items-center" : ""}`}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === "/"}
            title={isCollapsed ? item.name : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 py-2.5 rounded-md transition-colors text-sm font-medium border-l-[3px] ${
                isCollapsed ? "px-2 justify-center" : "px-3"
              } ${
                isActive
                  ? "bg-green-50 text-green-600 border-green-600"
                  : "text-muted-foreground border-transparent hover:bg-green-50 hover:text-foreground"
              }`
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span className={`whitespace-nowrap transition-all duration-300 ${
              isCollapsed ? "opacity-0 w-0 pointer-events-none overflow-hidden" : "opacity-100 w-auto"
            }`}>
              {item.name}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* Account / Org Switcher Footer */}
      <div className={`p-4 border-t border-border mt-auto flex flex-col gap-4 ${isCollapsed ? "items-center justify-center" : ""}`}>
        {!isCollapsed && (
          <div className="flex items-center justify-between overflow-hidden transition-all duration-300">
            <OrganizationSwitcher 
              hidePersonal
              appearance={{
                elements: {
                  organizationPreview: "text-sm",
                }
              }}
            />
          </div>
        )}
        <div className={`flex items-center gap-2 px-1 ${isCollapsed ? "justify-center text-center" : ""}`}>
          <div className="shrink-0">
            <UserButton />
          </div>
          <span className={`text-sm font-medium text-muted-foreground whitespace-nowrap transition-all duration-300 ${
            isCollapsed ? "opacity-0 w-0 pointer-events-none overflow-hidden" : "opacity-100 w-auto"
          }`}>
            Account
          </span>
        </div>
      </div>
    </aside>
  )
}
