import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  CreditCard,
  Plus,
  Trash2,
  Save,
  Split,
  ChevronRight,
  Info,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { dataManager, Payment, InsuranceProvider } from "@/lib/dataManager";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface InsuranceMetadata {
  claimId?: string;
  approvalCode?: string;
  transactionRef?: string;
  extraFields?: { key: string; value: string }[];
}

interface InsuranceClaimsProps {
  embedded?: boolean;
}

const InsuranceClaims = ({ embedded = false }: InsuranceClaimsProps) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [insuranceProviders, setInsuranceProviders] = useState<InsuranceProvider[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Edit form state
  const [metadata, setMetadata] = useState<InsuranceMetadata>({});
  const [amount, setAmount] = useState<number>(0);
  const [status, setStatus] = useState<"pending" | "paid">("pending");
  const [notes, setNotes] = useState("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [allPayments, providers] = await Promise.all([
        dataManager.getPayments(),
        dataManager.getInsuranceProviders(),
      ]);
      setPayments(allPayments.filter((p) => p.method === "insurance"));
      setInsuranceProviders(providers);
    } catch (_error) {
      console.error("Failed to load data", _error);
      toast.error("Failed to load insurance claims");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEditClick = (payment: Payment) => {
    setSelectedPayment(payment);
    setAmount(payment.amount);
    setStatus(payment.status as "pending" | "paid");
    setNotes(payment.notes || "");

    try {
      const parsedMetadata = payment.metadata ? JSON.parse(payment.metadata) : {};
      setMetadata({
        claimId: parsedMetadata.claimId || "",
        approvalCode: parsedMetadata.approvalCode || "",
        transactionRef: parsedMetadata.transactionRef || "",
        extraFields: parsedMetadata.extraFields || [],
      });
    } catch {
      setMetadata({ extraFields: [] });
    }

    setIsEditDialogOpen(true);
  };

  const handleAddExtraField = () => {
    setMetadata((prev) => ({
      ...prev,
      extraFields: [...(prev.extraFields || []), { key: "", value: "" }],
    }));
  };

  const handleExtraFieldChange = (index: number, field: "key" | "value", value: string) => {
    const newFields = [...(metadata.extraFields || [])];
    newFields[index][field] = value;
    setMetadata((prev) => ({ ...prev, extraFields: newFields }));
  };

  const handleRemoveExtraField = (index: number) => {
    const newFields = [...(metadata.extraFields || [])];
    newFields.splice(index, 1);
    setMetadata((prev) => ({ ...prev, extraFields: newFields }));
  };

  const handleSave = async () => {
    if (!selectedPayment) return;

    try {
      await dataManager.updatePayment(selectedPayment.id, {
        amount,
        status,
        notes,
        metadata: JSON.stringify(metadata),
      });
      toast.success("Claim updated successfully");
      setIsEditDialogOpen(false);
      loadData();
    } catch {
      toast.error("Failed to update claim");
    }
  };

  const handleQuickMarkPaid = async (e: React.MouseEvent, payment: Payment) => {
    e.stopPropagation();
    try {
      await dataManager.updatePayment(payment.id, { status: "paid" });
      toast.success("Claim marked as paid");
      loadData();
    } catch {
      toast.error("Failed to update claim");
    }
  };

  const handleSplitPayment = async () => {
    if (!selectedPayment) return;

    const paidAmount = prompt("Enter the amount paid by insurance:", amount.toString());
    if (paidAmount === null) return;

    const paid = parseFloat(paidAmount);
    if (isNaN(paid) || paid <= 0 || paid >= amount) {
      toast.error("Invalid amount for splitting. Must be less than the total.");
      return;
    }

    const remaining = amount - paid;

    try {
      // 1. Update current payment with the paid amount and mark as paid
      await dataManager.updatePayment(selectedPayment.id, {
        amount: paid,
        status: "paid",
        metadata: JSON.stringify(metadata),
        notes: `${notes} (Insurance part-payment)`.trim(),
      });

      // 2. Create a new pending payment for the remaining balance (as cash)
      await dataManager.addPayment({
        patient_id: selectedPayment.patient_id,
        patient_name: selectedPayment.patient_name,
        treatment_id: selectedPayment.treatment_id,
        amount: remaining,
        date: selectedPayment.date,
        method: "cash",
        status: "pending",
        notes: `Balance from insurance claim ${metadata.claimId || ""}`.trim(),
      });

      toast.success("Payment split successfully. Balance moved to cash/pending.");
      setIsEditDialogOpen(false);
      loadData();
    } catch {
      toast.error("Failed to split payment");
    }
  };

  const filteredPayments = payments.filter((p) => {
    const matchesSearch = p.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.notes || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || p.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    pending: payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0),
    paid: payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0),
    count: payments.length
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Insurance Claims</h1>
          <p className="text-sm text-gray-500">Manage insurance billing and provider approvals</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Claims</p>
            <p className="text-2xl font-bold text-gray-900">{stats.count}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Pending Amount</p>
            <p className="text-2xl font-bold text-orange-600">{stats.pending.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Received Amount</p>
            <p className="text-2xl font-bold text-green-600">{stats.paid.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by patient or notes..."
            className="pl-10 h-10 rounded-sm border-gray-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex bg-gray-100 p-1 rounded-sm border border-gray-200 w-full md:w-auto">
          {["all", "pending", "paid"].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                "flex-1 md:flex-none px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-all",
                filterStatus === status
                  ? "bg-white text-[#0078d4] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {isLoading ? (
          <div className="py-20 text-center text-gray-500">Loading claims...</div>
        ) : filteredPayments.length > 0 ? (
          filteredPayments.map((payment) => {
            const meta = payment.metadata ? JSON.parse(payment.metadata) : {};
            return (
              <Card
                key={payment.id}
                className="hover:border-[#0078d4] transition-colors cursor-pointer group rounded-sm border-gray-200 shadow-sm"
                onClick={() => handleEditClick(payment)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-2.5 bg-blue-50 rounded-sm">
                      <CreditCard className="h-5 w-5 text-[#0078d4]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">{payment.patient_name}</h3>
                      <div className="flex items-center space-x-2 text-[10px] text-gray-500 font-medium">
                        <span>{payment.date}</span>
                        <span>•</span>
                        <span>{insuranceProviders.find(p => p.id === payment.insurance_provider_id)?.name || "Insurance"}</span>
                      </div>
                      {meta.claimId && (
                        <p className="text-[10px] font-mono text-[#0078d4] mt-1 uppercase font-bold tracking-tighter">Claim: {meta.claimId}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 sm:space-x-8">
                    <div className="text-right">
                      <p className="text-base font-black text-gray-900">{payment.amount.toLocaleString()}</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "uppercase text-[9px] font-black rounded-sm px-1.5 h-5 border-none",
                          payment.status === "paid"
                            ? "bg-green-100 text-green-700"
                            : "bg-orange-100 text-orange-700"
                        )}
                      >
                        {payment.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                       {payment.status === 'pending' && (
                         <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 rounded-sm border-green-200 text-green-600 hover:bg-green-50"
                            onClick={(e) => handleQuickMarkPaid(e, payment)}
                            title="Quick Mark as Paid"
                         >
                            <CheckCircle2 className="h-4 w-4" />
                         </Button>
                       )}
                       <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-[#0078d4] transition-colors" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="py-20 text-center bg-white border border-dashed border-gray-200 rounded-sm">
            <Info className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">No insurance claims found matching your criteria.</p>
          </div>
        )}
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Insurance Claim</DialogTitle>
            <DialogDescription>
              Update insurance approval details for {selectedPayment?.patient_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-gray-500">Billed Amount</Label>
                <Input
                  type="number"
                  value={amount}
                  className="h-9 rounded-sm"
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-gray-500">Status</Label>
                <Select value={status} onValueChange={(v: "pending" | "paid") => setStatus(v)}>
                  <SelectTrigger className="h-9 rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-400">Provider Approval Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-gray-500">Claim ID</Label>
                  <Input
                    value={metadata.claimId}
                    className="h-9 rounded-sm"
                    onChange={(e) => setMetadata({ ...metadata, claimId: e.target.value })}
                    placeholder="Enter Claim #"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-gray-500">Approval Code</Label>
                  <Input
                    value={metadata.approvalCode}
                    className="h-9 rounded-sm"
                    onChange={(e) => setMetadata({ ...metadata, approvalCode: e.target.value })}
                    placeholder="Enter Code"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-gray-500">Transaction Ref</Label>
                  <Input
                    value={metadata.transactionRef}
                    className="h-9 rounded-sm"
                    onChange={(e) => setMetadata({ ...metadata, transactionRef: e.target.value })}
                    placeholder="Ref #"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-400">Extra Fields</h4>
                <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold uppercase rounded-sm" onClick={handleAddExtraField}>
                  <Plus className="h-3 w-3 mr-1" /> Add Field
                </Button>
              </div>
              <div className="space-y-3">
                {metadata.extraFields?.map((field, index) => (
                  <div key={index} className="flex gap-3 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-[10px] font-bold text-gray-500">Key</Label>
                      <Input
                        value={field.key}
                        className="h-9 rounded-sm"
                        onChange={(e) => handleExtraFieldChange(index, "key", e.target.value)}
                        placeholder="e.g. Policy #"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-[10px] font-bold text-gray-500">Value</Label>
                      <Input
                        value={field.value}
                        className="h-9 rounded-sm"
                        onChange={(e) => handleExtraFieldChange(index, "value", e.target.value)}
                        placeholder="Value"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 h-9 w-9"
                      onClick={() => handleRemoveExtraField(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label className="text-xs font-bold uppercase text-gray-500">Notes</Label>
              <Input
                value={notes}
                className="h-9 rounded-sm"
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional comments..."
              />
            </div>

            <div className="flex items-center justify-between gap-4 pt-4">
              <Button
                variant="outline"
                className="flex-1 border-orange-200 text-orange-700 hover:bg-orange-50 h-10 font-bold uppercase text-xs rounded-sm"
                onClick={handleSplitPayment}
              >
                <Split className="h-4 w-4 mr-2" /> Split / Partial
              </Button>
              <Button className="flex-1 bg-[#0078d4] text-white h-10 font-bold uppercase text-xs rounded-sm" onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" /> Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InsuranceClaims;
