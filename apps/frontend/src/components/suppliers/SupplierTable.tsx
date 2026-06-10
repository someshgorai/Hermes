import { Supplier } from "@/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { RiskBadge } from "@/components/shared/RiskBadge"

interface SupplierTableProps {
  suppliers: Supplier[]
  onSelect: (supplier: Supplier) => void
  selectedId?: string
}

/**
 * Sortable supplier table showing key metrics and risk badges.
 */
export function SupplierTable({ suppliers, onSelect, selectedId }: SupplierTableProps) {
  return (
    <div className="bg-card rounded-md border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Risk Score</TableHead>
            <TableHead>Risk Level</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.map((supplier) => (
            <TableRow 
              key={supplier.id} 
              className={`cursor-pointer transition-colors ${selectedId === supplier.id ? "bg-green-50/50" : ""}`}
              onClick={() => onSelect(supplier)}
            >
              <TableCell className="font-medium">{supplier.name}</TableCell>
              <TableCell>{supplier.country}</TableCell>
              <TableCell>Tier {supplier.tier}</TableCell>
              <TableCell className="capitalize">{supplier.category}</TableCell>
              <TableCell>
                <span className="font-medium">{supplier.riskScore.toFixed(1)}</span>
              </TableCell>
              <TableCell>
                <RiskBadge level={supplier.riskLevel} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
