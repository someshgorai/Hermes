import { ScoredRoute } from "@/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { RiskBadge } from "@/components/shared/RiskBadge"

interface RouteScoreTableProps {
  routes: ScoredRoute[]
}

/**
 * Table showing all route combinations and their scores.
 */
export function RouteScoreTable({ routes }: RouteScoreTableProps) {
  // sort lowest score first — lower = better route
  const sortedRoutes = [...routes].sort((a, b) => a.totalScore - b.totalScore)

  return (
    <div className="bg-card rounded-md border border-border overflow-hidden mt-8">
      <div className="p-4 border-b border-border bg-muted/20">
        <h3 className="font-semibold">All Route Combinations</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Export Port</TableHead>
            <TableHead>Import Port</TableHead>
            <TableHead>Warehouse</TableHead>
            <TableHead className="text-right">Distance (km)</TableHead>
            <TableHead className="text-right">Time (days)</TableHead>
            <TableHead className="text-right">Cost (USD)</TableHead>
            <TableHead className="text-right">Risk Score</TableHead>
            <TableHead>Risk Level</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRoutes.map((route, idx) => (
            <TableRow key={`${route.exportPortId}-${route.warehouseId}-${idx}`}>
              <TableCell>{route.exportPortName}</TableCell>
              <TableCell>{route.importPortName}</TableCell>
              <TableCell>{route.warehouseName}</TableCell>
              <TableCell className="text-right">{route.totalDistanceKm.toLocaleString()}</TableCell>
              <TableCell className="text-right">{route.totalDeliveryDays}</TableCell>
              <TableCell className="text-right">${route.estimatedCostUsd.toLocaleString()}</TableCell>
              <TableCell className="text-right font-medium">{route.totalScore.toFixed(1)}</TableCell>
              <TableCell>
                <RiskBadge level={route.riskLevel} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
