import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { io } from "socket.io-client"
import { useOrganization } from "@clerk/clerk-react"
import { useAnalysisStatus } from "./useAnalysisStatus"


// Connects to Socket.io and invalidates React Query cache on events.
// Joins the organization room so events are properly scoped.
export function useSocket() {
  const queryClient = useQueryClient()
  const { organization } = useOrganization()
  const { markStarted, markCompleted } = useAnalysisStatus()

  useEffect(() => {
    const socket = io(import.meta.env.VITE_WS_URL)

    // hop into the org room so events are scoped properly
    if (organization?.id) {
      socket.emit("join:org", organization.id)
    }

    socket.on("analysis:started", (data: { supplierId: string }) => {
      markStarted(data.supplierId)
    })

    socket.on("risk:update", (data: { supplierId: string }) => {
      markCompleted(data.supplierId)
      queryClient.invalidateQueries({ queryKey: ["suppliers"] })
      queryClient.invalidateQueries({ queryKey: ["history", data.supplierId] })
      queryClient.invalidateQueries({ queryKey: ["events", data.supplierId] })
      queryClient.invalidateQueries({ queryKey: ["routes", data.supplierId] })
      queryClient.invalidateQueries({ queryKey: ["recommendations"] })
    })

    socket.on("recommendation:new", () => {
      queryClient.invalidateQueries({ queryKey: ["recommendations"] })
    })

    socket.on("alert:new", () => {
      // partial match so we bust all alert query variants at once
      queryClient.invalidateQueries({ queryKey: ["alerts"] })
    })

    return () => { 
      socket.disconnect() 
    }
  }, [queryClient, organization?.id, markStarted, markCompleted])
}
