import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useApiClient } from "@/api/client"
import { Warehouse, Port } from "@/types"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Warehouse as WarehouseIcon, Plus, Trash2 } from "lucide-react"
import { WarehouseForm } from "@/components/warehouses/WarehouseForm"
import { toast } from "sonner"

export default function WarehousesPage() {
  const api = useApiClient()

  const { data: warehouses, isLoading, isError, refetch } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const res = await api.get<Warehouse[]>("/api/warehouses")
      return res.data
    },
  })

  const { data: ports } = useQuery({
    queryKey: ["ports"],
    queryFn: async () => {
      const res = await api.get<Port[]>("/api/ports")
      return res.data
    },
  })

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/warehouses/${id}`)
      toast.success("Warehouse deleted successfully")
      refetch()
    } catch (error) {
      toast.error("Failed to delete warehouse")
    }
  }

  const [isFormOpen, setIsFormOpen] = useState(false)

  return (
    <div>
      <PageHeader 
        title="Warehouses" 
        subtitle="Manage your distribution centers and inventory hubs."
        action={
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Warehouse
          </Button>
        }
      />

      <WarehouseForm 
        open={isFormOpen} 
        onOpenChange={setIsFormOpen} 
        onSuccess={() => refetch()} 
      />

      {isLoading ? (
        <LoadingSpinner text="Loading warehouses..." />
      ) : isError ? (
        <div className="text-red-500">Failed to load warehouses</div>
      ) : !warehouses || warehouses.length === 0 ? (
        <EmptyState 
          icon={WarehouseIcon} 
          title="No warehouses found" 
          description="Add your first warehouse to enable route analysis." 
        />
      ) : (
        <div className="bg-card rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Import Port</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouses.map((wh) => (
                <TableRow key={wh.id}>
                  <TableCell className="font-medium">{wh.name}</TableCell>
                  <TableCell>{wh.country}</TableCell>
                  <TableCell className="text-muted-foreground truncate max-w-[200px]">{wh.address}</TableCell>
                  <TableCell>
                    {ports?.find((p) => p.id === wh.importPortId)?.name || "None"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(wh.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
