import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useApiClient } from "@/api/client"
import { Alert } from "@/types"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { EmptyState } from "@/components/shared/EmptyState"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bell, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

const alertFilters = ["all", "active", "dismissed"] as const
type AlertFilter = (typeof alertFilters)[number]

function isAlertFilter(value: string): value is AlertFilter {
  return alertFilters.includes(value as AlertFilter)
}

export default function AlertsPage() {
  const api = useApiClient()
  const [filter, setFilter] = useState<AlertFilter>("active")

  const { data: alerts, isLoading, refetch } = useQuery({
    queryKey: ["alerts", filter],
    queryFn: async () => {
      const query = filter === "all" ? "" : `?isDismissed=${filter === "dismissed"}`
      const res = await api.get<Alert[]>(`/api/alerts${query}`)
      return res.data
    },
  })

  const dismissAlert = async (id: string) => {
    try {
      await api.patch(`/api/alerts/${id}/dismiss`)
      refetch()
    } catch (error) {
      toast.error("Failed to dismiss alert")
    }
  }

  const dismissAll = async () => {
    try {
      await api.post(`/api/alerts/dismiss-all`)
      toast.success("All alerts dismissed")
      refetch()
    } catch (error) {
      toast.error("Failed to dismiss all alerts")
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Alerts" 
        subtitle="Full history of supply chain risk events and notifications."
        action={
          <Button variant="outline" onClick={dismissAll}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Mark all dismissed
          </Button>
        }
      />

      <Tabs value={filter} onValueChange={(value) => {
        if (isAlertFilter(value)) {
          setFilter(value)
        }
      }} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="all">All Alerts</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <LoadingSpinner text="Loading alerts..." />
      ) : !alerts || alerts.length === 0 ? (
        <EmptyState 
          icon={Bell} 
          title="No alerts found" 
          description={`No ${filter !== "all" ? filter : ""} alerts match your criteria.`} 
        />
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className={`p-4 rounded-md border ${alert.isDismissed ? 'bg-muted/30 border-border' : 'bg-card border-orange-200'} flex items-start justify-between gap-4 transition-colors`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold uppercase tracking-wider ${alert.isDismissed ? 'text-muted-foreground' : 'text-orange-600'}`}>
                    {alert.riskType}
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">{new Date(alert.createdAt).toLocaleString()}</span>
                </div>
                <div className="font-medium text-foreground">{alert.message}</div>
                {alert.supplierName && (
                  <div className="text-sm text-muted-foreground mt-1">Supplier: {alert.supplierName}</div>
                )}
              </div>
              {!alert.isDismissed && (
                <Button variant="outline" size="sm" onClick={() => dismissAlert(alert.id)}>
                  Dismiss
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
