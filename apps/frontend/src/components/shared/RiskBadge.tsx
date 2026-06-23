import { Badge } from "@/components/ui/badge"
import { RiskLevel } from "@/types"

export const RISK_COLORS = {
  low: { bg: "bg-green-100", text: "text-green-800", border: "border-green-200", dot: "bg-green-500" },
  medium: { bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-200", dot: "bg-yellow-500" },
  high: { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-200", dot: "bg-orange-500" },
  critical: { bg: "bg-red-100", text: "text-red-800", border: "border-red-200", dot: "bg-red-500" },
} as const

interface RiskBadgeProps {
  level: RiskLevel
  className?: string
}

// Colored badge showing risk level.
export function RiskBadge({ level, className = "" }: RiskBadgeProps) {
  const colors = RISK_COLORS[level]
  return (
    <Badge 
      variant="outline" 
      className={`${colors.bg} ${colors.text} ${colors.border} flex items-center gap-1.5 ${className}`}
    >
      <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
      <span className="capitalize">{level}</span>
    </Badge>
  )
}
