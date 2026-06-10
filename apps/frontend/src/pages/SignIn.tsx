import { SignIn } from "@clerk/clerk-react"

/**
 * Public sign in page handling authentication via Clerk.
 */
export default function SignInPage() {
  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/onboarding" />
    </div>
  )
}
