import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  Filter,
  DollarSign,
  Calendar,
  CreditCard,
  MoreVertical,
  Download,
  FileText,
  TrendingUp,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { dataManager, Patient, Treatment, Payment } from "@/lib/dataManager";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const Payments = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMethod, setFilterMethod] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // New payment form state
  const [newPayment, setNewPayment] = useState<Omit<Payment, "id" | "created_at" | "updated_at">>({
    patient_id: "",
    patient_name: "",
    treatment_id: "",
    amount: 0,
    date: new Date().toISOString().split("T")[0],
    method: "cash",
    status: "paid",
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
        const [loadedPayments, loadedPatients, loadedTreatments] = await Promise.all([
            dataManager.getPayments(),
            dataManager.getPatients(),
            dataManager.getTreatments()
        ]);
        setPayments(loadedPayments);
        setPatients(loadedPatients);
        setTreatments(loadedTreatments);
    } catch {
        toast.error("Failed to load payments data");
    } finally {
        setIsLoading(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayment.patient_id || newPayment.amount <= 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await dataManager.addPayment(newPayment);
      await loadData();
      setShowAddDialog(false);
      setNewPayment({
        patient_id: "",
        patient_name: "",
        treatment_id: "",
        amount: 0,
        date: new Date().toISOString().split("T")[0],
        method: "cash",
        status: "paid",
        notes: "",
      });
      toast.success("Payment processed successfully");
    } catch {
      toast.error("Failed to process payment");
    }
  };

  const handlePatientChange = (patient_id: string) => {
    const patient = patients.find((p) => p.id === patient_id);
    setNewPayment((prev) => ({
      ...prev,
      patient_id,
      patient_name: patient?.name || "",
      treatment_id: "",
    }));
  };

  const handleTreatmentChange = (treatment_id: string) => {
    const treatment = treatments.find((t) => t.id === treatment_id);
    setNewPayment((prev) => ({
      ...prev,
      treatment_id,
      amount: treatment?.cost || prev.amount,
    }));
  };

  const filteredPayments = payments.filter((p) => {
    const matchesSearch = p.patient_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMethod = filterMethod === "all" || p.method === filterMethod;
    return matchesSearch && matchesMethod;
  });

  const totalRevenue = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

  const formatCurrency = (amount: number) => {
    return `KSH ${amount.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Payments & Billing</h1>
          <p className="text-xs text-gray-500 mt-0.5">Track revenue and process patient billing</p>
        </div>
        {user?.role === "RECEPTION" && (
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-white rounded-sm">
                <Plus className="h-4 w-4 mr-2" />
                Process Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Process New Payment</DialogTitle>
                <DialogDescription>
                  Record a payment from a patient for their treatment.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddPayment} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Patient *</Label>
                  <Select
                    value={newPayment.patient_id}
                    onValueChange={handlePatientChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select patient" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Related Treatment</Label>
                  <Select
                    value={newPayment.treatment_id}
                    onValueChange={handleTreatmentChange}
                    disabled={!newPayment.patient_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select treatment (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {treatments
                        .filter((t) => t.patient_id === newPayment.patient_id)
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.date} - {t.diagnosis} ({formatCurrency(t.cost)})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount (KSH) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newPayment.amount}
                      onChange={(e) =>
                        setNewPayment((prev) => ({
                          ...prev,
                          amount: parseFloat(e.target.value) || 0,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <Select
                      value={newPayment.method}
                      onValueChange={(value: "cash" | "card" | "transfer") =>
                        setNewPayment((prev) => ({ ...prev, method: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="transfer">Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={newPayment.date}
                    onChange={(e) =>
                      setNewPayment((prev) => ({ ...prev, date: e.target.value }))
                    }
                  />
                </div>

                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">
                  Record Payment
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-gray-200 shadow-sm rounded-sm bg-white">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Filtered Revenue</p>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {formatCurrency(totalRevenue)}
                </p>
              </div>
              <div className="p-2 bg-green-50 rounded-sm">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-sm rounded-sm bg-white">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Transactions</p>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {filteredPayments.length}
                </p>
              </div>
              <div className="p-2 bg-blue-50 rounded-sm">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-sm rounded-sm bg-white">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Average Payment</p>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {formatCurrency(filteredPayments.length > 0 ? totalRevenue / filteredPayments.length : 0)}
                </p>
              </div>
              <div className="p-2 bg-indigo-50 rounded-sm">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-3.5 w-3.5" />
          <Input
            placeholder="Search by patient name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-sm rounded-sm border-gray-200"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="h-3.5 w-3.5 text-gray-400" />
          <div className="flex bg-gray-100 p-1 rounded-sm border border-gray-200">
            {["all", "cash", "card", "transfer"].map((method) => (
              <button
                key={method}
                onClick={() => setFilterMethod(method)}
                className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-sm transition-all ${
                  filterMethod === method
                    ? "bg-white text-primary shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Payments List */}
      <div className="grid grid-cols-1 gap-3">
        {isLoading ? (
            <div className="text-center py-12 text-sm text-gray-500">Loading payments...</div>
        ) : filteredPayments.length > 0 ? (
          filteredPayments
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map((payment) => (
              <Card key={payment.id} className="border border-gray-200 shadow-sm hover:border-primary/50 transition-colors bg-white overflow-hidden rounded-sm">
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row items-center p-4 gap-4">
                    <div className="h-10 w-10 bg-green-50 rounded-sm flex items-center justify-center text-green-600 shrink-0">
                      <DollarSign className="h-5 w-5" />
                    </div>

                    <div className="flex-1 text-center sm:text-left">
                      <h3 className="text-sm font-semibold text-gray-900">{payment.patient_name}</h3>
                      <div className="flex flex-wrap justify-center sm:justify-start gap-3 mt-0.5 text-[10px] font-medium text-gray-500 uppercase tracking-tight">
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1 text-gray-400" />
                          {payment.date}
                        </span>
                        <span className="flex items-center capitalize">
                          <CreditCard className="h-3 w-3 mr-1 text-gray-400" />
                          {payment.method}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-center sm:items-end gap-1">
                      <p className="text-base font-bold text-gray-900">
                        {formatCurrency(payment.amount)}
                      </p>
                      <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0 h-5 rounded-sm border-green-200 bg-green-50 text-green-700 uppercase">
                        {payment.status}
                      </Badge>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4 text-gray-400" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="cursor-pointer">
                          <FileText className="h-4 w-4 mr-2" /> View Invoice
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer">
                          <Download className="h-4 w-4 mr-2" /> Download Receipt
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))
        ) : (
          <div className="text-center py-16 bg-white rounded-sm border border-dashed border-gray-200">
            <CreditCard className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <h3 className="text-sm font-semibold text-gray-900 mb-1">No payments found</h3>
            <p className="text-xs text-gray-400">No payment records match your current filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Payments;
