import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useQuery } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useApiClient } from "@/api/client"
import { Port } from "@/types"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  aliases: z.string().optional(),
  tier: z.enum(["1", "2", "3"]),
  country: z.string().min(2),
  category: z.string().min(2),
  originAddress: z.string().min(5),
  leadTimeDays: z.string().refine((value) => Number(value) >= 1, {
    message: "Lead time must be at least 1 day",
  }),
  dependency: z.enum(["low", "medium", "high", "sole_source"]),
  shippingRatePerKm: z.string().refine((value) => Number(value) >= 0, {
    message: "Shipping rate must be 0 or greater",
  }),
  exportPortIds: z.array(z.string().uuid()),
  primaryPortId: z.string().uuid().optional().or(z.literal("")),
})

type SupplierFormValues = z.infer<typeof formSchema>

interface SupplierFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

/**
 * Add supplier modal. Handles geocoding simulation on backend and creation.
 */
export function SupplierForm({ open, onOpenChange, onSuccess }: SupplierFormProps) {
  const [isPending, setIsPending] = useState(false)
  const api = useApiClient()

  const { data: ports } = useQuery({
    queryKey: ["ports"],
    queryFn: async () => (await api.get<Port[]>("/api/ports")).data,
  })

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      aliases: "",
      tier: "1",
      country: "",
      category: "",
      originAddress: "",
      leadTimeDays: "14",
      dependency: "medium",
      shippingRatePerKm: "1.5",
      exportPortIds: [],
      primaryPortId: "",
    },
  })

  const selectedPortIds = form.watch("exportPortIds") || []
  const primaryPortId = form.watch("primaryPortId")

  const onSubmit = async (values: SupplierFormValues) => {
    setIsPending(true)
    try {
      // Simulate backend call
      const payload = {
        ...values,
        tier: Number(values.tier),
        category: values.category.trim(),
        leadTimeDays: Number(values.leadTimeDays),
        shippingRatePerKm: Number(values.shippingRatePerKm),
        aliases: values.aliases ? values.aliases.split(",").map(s => s.trim()) : [],
        primaryPortId: values.exportPortIds.length > 0 ? (values.primaryPortId || values.exportPortIds[0]) : undefined
      }
      await api.post("/api/suppliers", payload)
      toast.success("Supplier created successfully")
      form.reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error("Failed to create supplier. Please try again.")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Supplier</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Corp" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="aliases"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aliases (comma separated)</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme, Acme Logistics" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="tier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tier</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select tier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1">Tier 1</SelectItem>
                        <SelectItem value="2">Tier 2</SelectItem>
                        <SelectItem value="3">Tier 3</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input placeholder="Germany" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input placeholder="Electronics" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="originAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Origin Address</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Factory St, Berlin" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="leadTimeDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Time (Days)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="shippingRatePerKm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate per km ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dependency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dependency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="sole_source">Sole Source</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* multi-select for export ports */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                Export Ports (Select all that apply)
              </label>
              <div className="border border-border rounded-md p-3 max-h-[160px] overflow-y-auto space-y-2 bg-background">
                {ports?.map((port) => (
                  <div key={port.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`port-${port.id}`}
                      checked={selectedPortIds.includes(port.id)}
                      onChange={(e) => {
                        const updated = e.target.checked
                          ? [...selectedPortIds, port.id]
                          : selectedPortIds.filter((id) => id !== port.id);
                        form.setValue("exportPortIds", updated);
                        // if we just unchecked the primary port, pick a new one
                        if (!updated.includes(primaryPortId || "")) {
                          form.setValue("primaryPortId", updated[0] || "");
                        }
                      }}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <label htmlFor={`port-${port.id}`} className="text-sm font-medium text-foreground cursor-pointer">
                      {port.name} ({port.country})
                    </label>
                  </div>
                ))}
                {(!ports || ports.length === 0) && (
                  <div className="text-sm text-muted-foreground text-center py-2">
                    No ports available. Add ports first.
                  </div>
                )}
              </div>
            </div>

            {selectedPortIds.length > 0 && (
              <FormField
                control={form.control}
                name="primaryPortId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                      Primary Export Port
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || selectedPortIds[0]}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select primary port" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {selectedPortIds.map((id) => {
                          const port = ports?.find((p) => p.id === id);
                          return (
                            <SelectItem key={id} value={id}>
                              {port ? `${port.name} (${port.country})` : id}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isPending ? "Geocoding & Creating..." : "Create Supplier"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
