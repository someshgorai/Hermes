import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useApiClient } from "@/api/client"
import { Port } from "@/types"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Anchor, Plus, Trash2 } from "lucide-react"
import { PortForm } from "@/components/ports/PortForm"
import { toast } from "sonner"

export default function PortsPage() {
  const api = useApiClient()

  const { data: ports, isLoading, isError, refetch } = useQuery({
    queryKey: ["ports"],
    queryFn: async () => {
      const res = await api.get<Port[]>("/api/ports")
      return res.data
    },
  })

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/ports/${id}`)
      toast.success("Port deleted successfully")
      refetch()
    } catch (error) {
      toast.error("Failed to delete port")
    }
  }

  const [isFormOpen, setIsFormOpen] = useState(false)

  return (
    <div>
      <PageHeader 
        title="Ports" 
        subtitle="Manage import and export ports for your supply chain routes."
        action={
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Port
          </Button>
        }
      />

      <PortForm 
        open={isFormOpen} 
        onOpenChange={setIsFormOpen} 
        onSuccess={() => refetch()} 
      />

      {isLoading ? (
        <LoadingSpinner text="Loading ports..." />
      ) : isError ? (
        <div className="text-red-500">Failed to load ports</div>
      ) : !ports || ports.length === 0 ? (
        <EmptyState 
          icon={Anchor} 
          title="No ports found" 
          description="Add your first port to start building routes." 
        />
      ) : (
        <div className="bg-card rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Coordinates</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ports.map((port) => (
                <TableRow key={port.id}>
                  <TableCell className="font-medium">{port.name}</TableCell>
                  <TableCell>{port.country}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {port.lat.toFixed(4)}, {port.lng.toFixed(4)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(port.id)}>
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
