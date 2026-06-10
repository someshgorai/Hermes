import { CreateOrganization, useOrganization } from "@clerk/clerk-react"
import { useNavigate } from "react-router-dom"
import { useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

/**
 * Onboarding wizard shown when user has no organization.
 * Starts with Organization creation, then optional initial data setup.
 */
export default function OnboardingPage() {
  const { organization, isLoaded } = useOrganization()
  const navigate = useNavigate()

  useEffect(() => {
    // If the org is created, for now we just redirect to dashboard
    // A full implementation would step through Port -> Warehouse -> Supplier
    if (isLoaded && organization) {
      navigate("/")
    }
  }, [organization, isLoaded, navigate])

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Welcome to Hermes</h2>
          <p className="mt-2 text-muted-foreground">Let's set up your supply chain workspace.</p>
        </div>

        {!organization ? (
          <div className="flex justify-center">
            <CreateOrganization routing="hash" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Organization Created</CardTitle>
              <CardDescription>We are preparing your workspace...</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button onClick={() => navigate("/")}>Go to Dashboard</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
