import { useCallback, useSyncExternalStore } from "react"

/**
 * Lightweight external store tracking which supplier IDs are currently
 * being analyzed. Components subscribe via useSyncExternalStore so they
 * re-render when a supplier's analysis starts or completes.
 */

type Listener = () => void

const analyzingSuppliers = new Set<string>()
const listeners = new Set<Listener>()

function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify() {
  for (const listener of listeners) {
    listener()
  }
}

function getSnapshot(): ReadonlySet<string> {
  return analyzingSuppliers
}

export function useAnalysisStatus() {
  const analyzing = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const markStarted = useCallback((supplierId: string) => {
    analyzingSuppliers.add(supplierId)
    notify()
  }, [])

  const markCompleted = useCallback((supplierId: string) => {
    analyzingSuppliers.delete(supplierId)
    notify()
  }, [])

  const isAnalyzing = useCallback(
    (supplierId: string | undefined) => {
      if (!supplierId) return false
      return analyzing.has(supplierId)
    },
    [analyzing],
  )

  return { isAnalyzing, markStarted, markCompleted }
}
