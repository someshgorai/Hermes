import { Loader2 } from "lucide-react"

interface LoadingSpinnerProps {
  className?: string
  text?: string
}

/**
 * Centered loading spinner with optional text.
 */
export function LoadingSpinner({ className = "", text }: LoadingSpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-muted-foreground ${className}`}>
      <Loader2 className="w-8 h-8 animate-spin mb-4" />
      {text && <p className="text-sm font-medium">{text}</p>}
    </div>
  )
}
