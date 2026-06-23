import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useApiClient } from "@/api/client"
import { Supplier, Warehouse } from "@/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Play, Loader2, Eye } from "lucide-react"

interface AnalysisTriggerProps {
  initialSupplierId?: string
  initialWarehouseId?: string
  onRun: (supplierId: string, warehouseId?: string) => void
  onShow: (supplierId: string, warehouseId?: string) => void
  isPending: boolean
}

// Trigger section to select supplier and warehouse, and run or view analysis.
export function AnalysisTrigger({ initialSupplierId, initialWarehouseId, onRun, onShow, isPending }: AnalysisTriggerProps) {
  const api = useApiClient()
  const [supplierId, setSupplierId] = useState<string | undefined>(initialSupplierId)
  const [warehouseId, setWarehouseId] = useState<string | undefined>(initialWarehouseId || "all")

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await api.get<Supplier[]>("/api/suppliers")).data,
  })

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => (await api.get<Warehouse[]>("/api/warehouses")).data,
  })

  const resolvedWarehouseId = warehouseId === "all" ? undefined : warehouseId

  const handleRun = () => {
    if (supplierId) {
      onRun(supplierId, resolvedWarehouseId)
    }
  }

  const handleShow = () => {
    if (supplierId) {
      onShow(supplierId, resolvedWarehouseId)
    }
  }

  return (
    <div className="bg-card rounded-md border border-border p-6 flex flex-col md:flex-row gap-4 items-end">
      <div className="flex-1 w-full">
        <label className="block text-sm font-medium mb-2">Select Supplier</label>
        <Select value={supplierId} onValueChange={setSupplierId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a supplier..." />
          </SelectTrigger>
          <SelectContent>
            {suppliers?.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name} ({s.country})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 w-full">
        <label className="block text-sm font-medium mb-2">Target Warehouse (Optional)</label>
        <Select value={warehouseId} onValueChange={setWarehouseId}>
          <SelectTrigger>
            <SelectValue placeholder="All warehouses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Analyze all options</SelectItem>
            {warehouses?.map(w => (
              <SelectItem key={w.id} value={w.id}>{w.name} ({w.country})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 w-full md:w-auto">
        <Button variant="outline" onClick={handleShow} disabled={!supplierId || isPending} className="flex-1 md:flex-none h-10">
          <Eye className="w-4 h-4 mr-2" />
          Show Analysis
        </Button>
        <Button onClick={handleRun} disabled={!supplierId || isPending} className="flex-1 md:flex-none h-10">
          {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
          Run Analysis
        </Button>
      </div>
    </div>
  )
}
