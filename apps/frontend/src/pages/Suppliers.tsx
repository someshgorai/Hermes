import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useApiClient } from "@/api/client"
import { Supplier } from "@/types"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { EmptyState } from "@/components/shared/EmptyState"
import { Button } from "@/components/ui/button"
import { Plus, Package } from "lucide-react"
import { SupplierTable } from "@/components/suppliers/SupplierTable"
import { SupplierDetail } from "@/components/suppliers/SupplierDetail"
import { SupplierForm } from "@/components/suppliers/SupplierForm"
import { toast } from "sonner"

export default function SuppliersPage() {
  const api = useApiClient()
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>()
  const [isFormOpen, setIsFormOpen] = useState(false)

  const { data: suppliers, isLoading, isError, refetch } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const res = await api.get<Supplier[]>("/api/suppliers")
      // Sort by risk score desc
      return res.data.sort((a, b) => b.riskScore - a.riskScore)
    },
  })

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/suppliers/${id}`)
      toast.success("Supplier deleted successfully")
      if (selectedSupplierId === id) setSelectedSupplierId(undefined)
      refetch()
    } catch (error) {
      toast.error("Failed to delete supplier")
    }
  }

  const selectedSupplier = suppliers?.find(s => s.id === selectedSupplierId)

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Suppliers" 
        subtitle="Monitor risk across your entire supplier network."
        action={
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Supplier
          </Button>
        }
      />

      <SupplierForm 
        open={isFormOpen} 
        onOpenChange={setIsFormOpen} 
        onSuccess={() => refetch()} 
      />

      {isLoading ? (
        <LoadingSpinner text="Loading suppliers..." />
      ) : isError ? (
        <div className="text-red-500">Failed to load suppliers</div>
      ) : !suppliers || suppliers.length === 0 ? (
        <EmptyState 
          icon={Package} 
          title="No suppliers found" 
          description="Add your first supplier to begin monitoring risk." 
        />
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <SupplierTable 
            suppliers={suppliers} 
            onSelect={(s) => setSelectedSupplierId(s.id)}
            onDelete={handleDelete}
            selectedId={selectedSupplierId}
          />

          {selectedSupplier && (
            <div className="mt-8">
              <SupplierDetail 
                supplier={selectedSupplier} 
                onDelete={handleDelete} 
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
