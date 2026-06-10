import { useQuery } from "@tanstack/react-query"
import { useApiClient } from "@/api/client"
import { Alert } from "@/types"
import { Alert as AlertComponent, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Bell, X } from "lucide-react"
import { RISK_COLORS } from "@/components/shared/RiskBadge"
import { toast } from "sonner"

/**
 * Live alert strip showing the latest unread alerts.
 */
export function AlertBanner() {
  const api = useApiClient()

  const { data: alerts, refetch } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const res = await api.get<Alert[]>("/api/alerts?isDismissed=false")
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

  if (!alerts || alerts.length === 0) return null

  // Show only top 3
  const displayAlerts = alerts.slice(0, 3)

  return (
    <div className="space-y-3 mb-6">
      {displayAlerts.map(alert => {
        // Find a matching color for the risk type if possible, or fallback to orange
        const riskColorObj = RISK_COLORS[alert.riskType === 'financial' ? 'critical' : alert.riskType === 'geopolitical' ? 'high' : 'medium'] || RISK_COLORS.medium

        return (
          <AlertComponent key={alert.id} className={`${riskColorObj.bg} ${riskColorObj.border} relative pr-12 animate-in fade-in slide-in-from-top-2`}>
            <Bell className={`w-4 h-4 ${riskColorObj.text}`} />
            <AlertTitle className={`${riskColorObj.text} font-bold flex items-center gap-2`}>
              New {alert.riskType} Risk Detected
              {alert.supplierName && <span className="font-normal opacity-80">— {alert.supplierName}</span>}
            </AlertTitle>
            <AlertDescription className={`${riskColorObj.text} mt-1`}>
              {alert.message}
              <div className="text-xs opacity-70 mt-1">
                {new Date(alert.createdAt).toLocaleString()}
              </div>
            </AlertDescription>
            <Button 
              variant="ghost" 
              size="icon" 
              className={`absolute top-2 right-2 hover:bg-black/5 ${riskColorObj.text}`}
              onClick={() => dismissAlert(alert.id)}
            >
              <X className="w-4 h-4" />
            </Button>
          </AlertComponent>
        )
      })}
    </div>
  )
}
