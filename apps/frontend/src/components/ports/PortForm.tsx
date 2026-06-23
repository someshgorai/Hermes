import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useApiClient } from "@/api/client"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

const formSchema = z.object({
  name: z.string().min(1, "Port name is required"),
  country: z.string().min(1, "Country is required"),
  address: z.string().min(5, "Address must be at least 5 characters"),
})

type PortFormValues = z.infer<typeof formSchema>

interface PortFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}


// Dialog Form for adding a new Port.
// Relies on the backend geocoding the address via OpenCage.
export function PortForm({ open, onOpenChange, onSuccess }: PortFormProps) {
  const [isPending, setIsPending] = useState(false)
  const api = useApiClient()

  const form = useForm<PortFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      country: "",
      address: "",
    },
  })

  const onSubmit = async (values: PortFormValues) => {
    setIsPending(true)
    try {
      await api.post("/api/ports", values)
      toast.success("Port created successfully")
      form.reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error("Failed to create port. Please check the address and try again.")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Port</DialogTitle>
          <DialogDescription>
            Enter details for the import/export port. The coordinates will be automatically geocoded.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Port Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Port of Rotterdam" {...field} />
                  </FormControl>
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
                    <Input placeholder="Netherlands" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Geocoding Address</FormLabel>
                  <FormControl>
                    <Input placeholder="Maasvlakte, Rotterdam" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isPending ? "Geocoding..." : "Create Port"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
