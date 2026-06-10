import { AnalysisResult } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RiskBadge } from "@/components/shared/RiskBadge"
import { CheckCircle2, TrendingDown, Clock, MapPin } from "lucide-react"

interface PriorityPanelProps {
  result: AnalysisResult
}

/**
 * Shows ranked route analysis results.
 */
export function PriorityPanel({ result }: PriorityPanelProps) {
  const { recommendation, routes } = result

  if (!recommendation) return null

  return (
    <div className="space-y-6">
      <Card className="border-2 border-green-500 bg-green-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="text-green-600 w-5 h-5" />
            Recommended Route
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{recommendation.reason}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-card p-3 rounded-md border border-border">
              <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Export Port</div>
              <div className="font-medium">
                {routes.find(r => r.exportPortId === recommendation.suggestedExportPortId)?.exportPortName || "N/A"}
              </div>
            </div>
            <div className="bg-card p-3 rounded-md border border-border">
              <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Import Port</div>
              <div className="font-medium">
                {routes.find(r => r.importPortId === recommendation.suggestedImportPortId)?.importPortName || "N/A"}
              </div>
            </div>
            <div className="bg-card p-3 rounded-md border border-border">
              <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Warehouse</div>
              <div className="font-medium">
                {routes.find(r => r.warehouseId === recommendation.suggestedWarehouseId)?.warehouseName || "N/A"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            {recommendation.extraDistanceKm !== null && recommendation.extraDistanceKm !== 0 && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{recommendation.extraDistanceKm > 0 ? '+' : ''}{recommendation.extraDistanceKm} km</span>
              </div>
            )}
            {recommendation.extraDays !== null && recommendation.extraDays !== 0 && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{recommendation.extraDays > 0 ? '+' : ''}{recommendation.extraDays} days</span>
              </div>
            )}
            {recommendation.extraCostUsd !== null && recommendation.extraCostUsd !== 0 && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <TrendingDown className="w-4 h-4" />
                <span>{recommendation.extraCostUsd > 0 ? '+' : ''}${recommendation.extraCostUsd.toLocaleString()} cost</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {recommendation.exportPortRank && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Best Export Ports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recommendation.exportPortRank.map((rank, i) => (
                <div key={rank.id} className="flex items-start justify-between p-3 rounded-md bg-secondary/50">
                  <div className="flex gap-3">
                    <div className="font-bold text-muted-foreground w-4">{i + 1}.</div>
                    <div>
                      <div className="font-medium">{rank.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{rank.reason}</div>
                    </div>
                  </div>
                  <RiskBadge level={rank.riskLevel} />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {recommendation.warehouseRank && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Best Warehouses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recommendation.warehouseRank.map((rank, i) => (
                <div key={rank.id} className="flex items-start justify-between p-3 rounded-md bg-secondary/50">
                  <div className="flex gap-3">
                    <div className="font-bold text-muted-foreground w-4">{i + 1}.</div>
                    <div>
                      <div className="font-medium">{rank.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{rank.reason}</div>
                    </div>
                  </div>
                  <RiskBadge level={rank.riskLevel} />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
