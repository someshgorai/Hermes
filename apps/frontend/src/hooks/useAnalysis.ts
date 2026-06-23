import { useMutation } from "@tanstack/react-query"
import { useApiClient } from "@/api/client"
import { toast } from "sonner"

interface RunAnalysisPayload {
  supplierId: string
  warehouseId?: string
}

interface RunAnalysisResponse {
  jobId: string
  message: string
}

export function useAnalysis() {
  const api = useApiClient()

  return useMutation({
    mutationFn: async (payload: RunAnalysisPayload) => {
      const res = await api.post<RunAnalysisResponse>("/api/analysis/run", payload)
      return res.data
    },
    onError: () => {
      toast.error("Failed to run analysis")
    },
    onSuccess: () => {
      toast.success("Analysis started...")
    }
  })
}
