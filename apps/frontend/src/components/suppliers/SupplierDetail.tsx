import { Supplier, SupplierScoreHistory, RiskEvent } from "@/types"
import { useQuery } from "@tanstack/react-query"
import { useApiClient } from "@/api/client"
import { RiskScoreCard } from "./RiskScoreCard"
import { RiskTrendChart } from "@/components/charts/RiskTrendChart"
import { RiskEventChart } from "@/components/charts/RiskEventChart"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { Trash2, Play } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useAnalysisStatus } from "@/hooks/useAnalysisStatus"

interface SupplierDetailProps {
  supplier: Supplier
  onDelete: (id: string) => void
}

/**
 * Detail panel showing score card, history, and recent events for a selected supplier.
 */
export function SupplierDetail({ supplier, onDelete }: SupplierDetailProps) {
  const api = useApiClient()
  const navigate = useNavigate()
  const { isAnalyzing } = useAnalysisStatus()
  const supplierAnalyzing = isAnalyzing(supplier.id)

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["history", supplier.id],
    queryFn: async () => {
      const res = await api.get<SupplierScoreHistory[]>(`/api/suppliers/${supplier.id}/history`)
      return res.data
    },
  })

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ["events", supplier.id],
    queryFn: async () => {
      const res = await api.get<RiskEvent[]>(`/api/suppliers/${supplier.id}/events`)
      return res.data
    },
  })

  const handleDelete = () => {
    // In a real app we'd have a confirmation dialog
    if (confirm(`Are you sure you want to delete ${supplier.name}?`)) {
      onDelete(supplier.id)
    }
  }

  const handleRunAnalysis = () => {
    navigate(`/analysis?supplierId=${supplier.id}`)
  }

  return (
    <div className="bg-card rounded-md border border-border p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">{supplier.name}</h2>
          <p className="text-sm text-muted-foreground">{supplier.originAddress}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRunAnalysis}>
            <Play className="w-4 h-4 mr-2" />
            Run Analysis
          </Button>
          <Button variant="ghost" className="text-destructive" onClick={handleDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1">
          <RiskScoreCard supplier={supplier} />
        </div>
        <div className="xl:col-span-2 bg-background rounded-md border border-border p-4">
          <h3 className="text-sm font-medium mb-4">Risk Trend & Forecast</h3>
          {supplierAnalyzing ? (
            <div className="flex items-center justify-center h-[200px]">
              <LoadingSpinner text="Running risk analysis…" />
            </div>
          ) : historyLoading ? <LoadingSpinner /> : <RiskTrendChart data={history || []} />}
        </div>
      </div>

      <div className="bg-background rounded-md border border-border p-4">
        <h3 className="text-sm font-medium mb-4">Recent Risk Events</h3>
        {supplierAnalyzing ? (
          <div className="flex items-center justify-center h-[200px]">
            <LoadingSpinner text="Scanning risk events…" />
          </div>
        ) : eventsLoading ? <LoadingSpinner /> : <RiskEventChart events={events || []} />}
      </div>
    </div>
  )
}
