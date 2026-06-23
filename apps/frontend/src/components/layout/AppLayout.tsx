import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"

// Main application layout wrapper containing the Sidebar and main content area.
export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-green-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
        <div className="flex-1 p-6 w-full mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
