import { Routes, Route, Navigate } from "react-router-dom"
import { useAuth, useOrganization } from "@clerk/clerk-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { useSocket } from "@/hooks/useSocket"

// Pages
import SignInPage from "@/pages/SignIn"
import SignUpPage from "@/pages/SignUp"
import OnboardingPage from "@/pages/Onboarding"
import DashboardPage from "@/pages/Dashboard"
import SuppliersPage from "@/pages/Suppliers"
import WarehousesPage from "@/pages/Warehouses"
import PortsPage from "@/pages/Ports"
import AnalysisPage from "@/pages/Analysis"
import AlertsPage from "@/pages/Alerts"

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const { organization, isLoaded: orgLoaded } = useOrganization()

  if (!isLoaded || !orgLoaded) return null // Or a full page spinner

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }

  // Signed in, but no organization
  if (!organization) {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}

export default function App() {

  return (
    <Routes>
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      
      {/* Onboarding doesn't require org, just auth */}
      <Route path="/onboarding" element={
        <RequireAuth>
          <OnboardingPage />
        </RequireAuth>
      } />

      {/* Main app requires auth + org */}
      <Route path="/" element={
        <ProtectedRoute>
          <SocketWrapper>
            <AppLayout />
          </SocketWrapper>
        </ProtectedRoute>
      }>
        <Route index element={<DashboardPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="warehouses" element={<WarehousesPage />} />
        <Route path="ports" element={<PortsPage />} />
        <Route path="analysis" element={<AnalysisPage />} />
        <Route path="alerts" element={<AlertsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  if (!isLoaded) return null
  if (!isSignedIn) return <Navigate to="/sign-in" replace />
  return <>{children}</>
}

function SocketWrapper({ children }: { children: React.ReactNode }) {
  useSocket()
  return <>{children}</>
}
