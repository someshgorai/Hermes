import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { io } from "socket.io-client"
import { useOrganization } from "@clerk/clerk-react"

/**
 * Connects to Socket.io and invalidates React Query cache on events.
 * Joins the organization room so events are properly scoped.
 */
export function useSocket() {
  const queryClient = useQueryClient()
  const { organization } = useOrganization()

  useEffect(() => {
    const socket = io(import.meta.env.VITE_WS_URL)

    // Join the organization room for scoped events
    if (organization?.id) {
      socket.emit("join:org", organization.id)
    }

    socket.on("risk:update", (data: { supplierId: string }) => {
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
      // Use partial matching to invalidate all alert query variants:
      // ["alerts"], ["alerts", "active"], ["alerts", "dismissed"], ["alerts", "all"]
      queryClient.invalidateQueries({ queryKey: ["alerts"] })
    })

    return () => { 
      socket.disconnect() 
    }
  }, [queryClient, organization?.id])
}
