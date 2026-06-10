import { SignUp } from "@clerk/clerk-react"

/**
 * Public sign up page handling registration via Clerk.
 */
export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl="/onboarding" />
    </div>
  )
}
