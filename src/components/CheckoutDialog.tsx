import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dataManager, Appointment, Payment, InsuranceProvider } from "@/lib/dataManager";
import { pdfGenerator } from "@/lib/pdfGenerator";
import { toast } from "sonner";

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  onComplete: () => void;
}

export const CheckoutDialog = ({ open, onOpenChange, appointment, onComplete }: CheckoutDialogProps) => {
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [insuranceProviders, setInsuranceProviders] = useState<InsuranceProvider[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadCheckoutData = useCallback(async () => {
    if (!appointment) return;
    setIsLoading(true);
    try {
      const [allPayments, providers] = await Promise.all([
        dataManager.getPayments(),
        dataManager.getInsuranceProviders()
      ]);
      const ptPayments = allPayments.filter(p => p.patient_id === appointment.patient_id && p.status === 'pending');
      setPendingPayments(ptPayments);
      setInsuranceProviders(providers);
    } catch (error) {
      console.error("Failed to load checkout data", error);
      toast.error("Failed to load billing information");
    } finally {
      setIsLoading(false);
    }
  }, [appointment]);

  useEffect(() => {
    if (open && appointment) {
      loadCheckoutData();
    }
  }, [open, appointment, loadCheckoutData]);

  const handleCompleteCheckout = async (method: "cash" | "insurance", providerId?: string) => {
    if (!appointment) return;

    try {
      // 1. Update all pending payments to 'paid'
      for (const payment of pendingPayments) {
        await dataManager.updatePayment(payment.id, {
          method,
          insurance_provider_id: providerId,
          status: "paid",
          date: new Date().toISOString().split("T")[0],
        });
      }

      // 2. Complete appointment
      await dataManager.updateAppointment(appointment.id, { status: "completed" });
      await dataManager.updateDoctorStatus(appointment.doctor_id || "", null);

      toast.success("Checkout completed successfully");
      onOpenChange(false);
      onComplete();

      // 3. Generate Receipt
      const total = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
      const summaryPayment = {
        id: crypto.randomUUID(),
        patient_id: appointment.patient_id,
        patient_name: appointment.patient_name,
        amount: total,
        date: new Date().toISOString().split("T")[0],
        method: method,
        status: "paid" as const,
        notes: "Checkout Settlement",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await pdfGenerator.generateReceipt(summaryPayment);

    } catch (error) {
      console.error("Checkout failed", error);
      toast.error("Failed to complete checkout");
    }
  };

  if (!appointment) return null;

  const totalDue = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Patient Checkout</DialogTitle>
          <DialogDescription>Settle billing for {appointment.patient_name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="bg-gray-50 p-4 rounded-sm border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Pending Charges</p>
            <div className="space-y-2">
              {pendingPayments.map((p, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-600 truncate mr-4">{p.notes}</span>
                  <span className="font-bold text-gray-900 whitespace-nowrap">KSH {p.amount.toLocaleString()}</span>
                </div>
              ))}
              {pendingPayments.length === 0 && !isLoading && (
                <p className="text-sm text-gray-500 italic">No pending charges found.</p>
              )}
              {isLoading && <p className="text-sm text-gray-500 animate-pulse">Loading billing...</p>}

              <div className="pt-2 mt-2 border-t border-gray-200 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-900">Total Due</span>
                <span className="text-lg font-black text-primary">
                  KSH {totalDue.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Select Payment Method</p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-12 border-gray-200 hover:border-primary hover:bg-blue-50 flex flex-col gap-1 rounded-sm"
                onClick={() => handleCompleteCheckout("cash")}
                disabled={isLoading}
              >
                <CreditCard className="h-4 w-4" />
                <span className="text-xs font-bold">CASH</span>
              </Button>

              {insuranceProviders.length > 0 ? (
                 <DropdownMenu>
                   <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-12 border-gray-200 hover:border-purple-600 hover:bg-purple-50 flex flex-col gap-1 rounded-sm"
                        disabled={isLoading}
                      >
                        <Plus className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase">Insurance</span>
                      </Button>
                   </DropdownMenuTrigger>
                   <DropdownMenuContent align="end" className="w-48">
                      {insuranceProviders.map(p => (
                        <DropdownMenuItem key={p.id} onClick={() => handleCompleteCheckout("insurance", p.id)}>
                          {p.name}
                        </DropdownMenuItem>
                      ))}
                   </DropdownMenuContent>
                 </DropdownMenu>
              ) : (
                <Button disabled variant="outline" className="h-12 opacity-50 rounded-sm">No Insurance</Button>
              )}
            </div>
          </div>

          {totalDue === 0 && !isLoading && (
            <Button
                className="w-full bg-primary text-white rounded-sm"
                onClick={() => handleCompleteCheckout("cash")}
            >
                Complete Without Payment
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
