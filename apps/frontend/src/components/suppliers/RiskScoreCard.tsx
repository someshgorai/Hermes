import { Supplier } from "@/types"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { RISK_COLORS } from "@/components/shared/RiskBadge"

interface RiskScoreCardProps {
  supplier: Supplier
}

/**
 * Shows the overall risk score and breakdown of risk dimensions for a single supplier.
 */
export function RiskScoreCard({ supplier }: RiskScoreCardProps) {
  const colors = RISK_COLORS[supplier.riskLevel]

  return (
    <Card className={`border-2 ${colors.border}`}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Overall Risk Score</h3>
            <div className={`text-4xl font-bold mt-1 ${colors.text}`}>
              {supplier.riskScore.toFixed(1)}
              <span className="text-xl font-normal text-muted-foreground ml-1">/ 100</span>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-bold capitalize ${colors.bg} ${colors.text}`}>
            {supplier.riskLevel} Risk
          </div>
        </div>

        <div className="space-y-4">
          <ScoreBar label="Event Risk" score={supplier.eventScore} />
          <ScoreBar label="Operational Risk" score={supplier.operationalScore} />
          <ScoreBar label="Weather Risk" score={supplier.weatherScore} />
        </div>
      </CardContent>
    </Card>
  )
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  // Assuming scores are 0-100 where higher is worse risk (or better, context dependent. Let's assume higher = higher risk)
  // Wait, if "low risk" is good, then score might be 0-100 where higher is higher risk.
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{score.toFixed(1)}</span>
      </div>
      <Progress value={score} className="h-2" />
    </div>
  )
}
