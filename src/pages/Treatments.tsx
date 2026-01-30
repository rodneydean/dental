import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Stethoscope,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Calendar,
  User,
  DollarSign,
  Pill,
  FileText,
  TrendingUp,
  Activity,
  Search,
} from "lucide-react";
import TreatmentForm from "@/components/TreatmentForm";
import { dataManager, Treatment } from "@/lib/dataManager";
import { toast } from "sonner";

const Treatments = () => {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(
    null
  );
  const [filteredTreatments, setFilteredTreatments] = useState<Treatment[]>([]);

  useEffect(() => {
    loadTreatments();
  }, []);

  useEffect(() => {
    const filtered = treatments.filter(
      (treatment) =>
        treatment.patientName
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        treatment.diagnosis.toLowerCase().includes(searchTerm.toLowerCase()) ||
        treatment.treatment.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort by date (most recent first)
    filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    setFilteredTreatments(filtered);
  }, [treatments, searchTerm]);

  const loadTreatments = () => {
    const loadedTreatments = dataManager.getTreatments();
    setTreatments(loadedTreatments);
  };

  const handleAddTreatment = (
    treatmentData: Omit<Treatment, "id" | "createdAt" | "updatedAt">
  ) => {
    try {
      dataManager.addTreatment(treatmentData);
      loadTreatments();
      setShowAddDialog(false);
      toast.success("Treatment record added successfully");
    } catch (error) {
      console.log(error);
      toast.error("Failed to add treatment record");
    }
  };

  const handleEditTreatment = (
    treatmentData: Omit<Treatment, "id" | "createdAt" | "updatedAt">
  ) => {
    if (!editingTreatment) return;

    try {
      dataManager.updateTreatment(editingTreatment.id, treatmentData);
      loadTreatments();
      setEditingTreatment(null);
      toast.success("Treatment record updated successfully");
    } catch (error) {
      console.log(error);
      toast.error("Failed to update treatment record");
    }
  };

  const getPatientInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getTotalRevenue = () => {
    return treatments.reduce((total, treatment) => total + treatment.cost, 0);
  };

  const getTotalMedications = () => {
    return treatments.reduce(
      (total, treatment) => total + treatment.medications.length,
      0
    );
  };

  const getThisMonthTreatments = () => {
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    return treatments.filter((treatment) => {
      const treatmentDate = new Date(treatment.date);
      return (
        treatmentDate.getMonth() === thisMonth &&
        treatmentDate.getFullYear() === thisYear
      );
    }).length;
  };

  const getRevenueGrowth = () => {
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

    const thisMonthRevenue = treatments
      .filter((t) => {
        const date = new Date(t.date);
        return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
      })
      .reduce((sum, t) => sum + t.cost, 0);

    const lastMonthRevenue = treatments
      .filter((t) => {
        const date = new Date(t.date);
        return (
          date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear
        );
      })
      .reduce((sum, t) => sum + t.cost, 0);

    if (lastMonthRevenue === 0) return 0;
    return Math.round(
      ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Treatment Management
          </h1>
          <p className="text-gray-600 mt-1">
            Record treatments and prescriptions
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg">
              <Plus className="h-4 w-4 mr-2" />
              Add Treatment Record
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Treatment Record</DialogTitle>
              <DialogDescription>
                Record a new treatment and prescriptions for a patient.
              </DialogDescription>
            </DialogHeader>
            <TreatmentForm onSave={handleAddTreatment} onCancel={() => {}} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg bg-linear-to-br from-purple-50 to-purple-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium">
                  Total Treatments
                </p>
                <p className="text-3xl font-bold text-purple-900">
                  {treatments.length}
                </p>
              </div>
              <div className="p-3 bg-purple-200 rounded-full">
                <Stethoscope className="h-6 w-6 text-purple-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-linear-to-br from-green-50 to-green-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">
                  Total Revenue
                </p>
                <p className="text-3xl font-bold text-green-900">
                  {formatCurrency(getTotalRevenue())}
                </p>
              </div>
              <div className="p-3 bg-green-200 rounded-full">
                <DollarSign className="h-6 w-6 text-green-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-linear-to-br from-blue-50 to-blue-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">This Month</p>
                <p className="text-3xl font-bold text-blue-900">
                  {getThisMonthTreatments()}
                </p>
              </div>
              <div className="p-3 bg-blue-200 rounded-full">
                <Activity className="h-6 w-6 text-blue-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-linear-to-br from-orange-50 to-orange-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-600 text-sm font-medium">
                  Prescriptions
                </p>
                <p className="text-3xl font-bold text-orange-900">
                  {getTotalMedications()}
                </p>
              </div>
              <div className="p-3 bg-orange-200 rounded-full">
                <Pill className="h-6 w-6 text-orange-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Growth Card */}
      <Card className="border-0 shadow-lg bg-linear-to-r from-emerald-50 to-teal-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-700 text-sm font-medium">
                Monthly Revenue Growth
              </p>
              <div className="flex items-center space-x-2">
                <p className="text-3xl font-bold text-emerald-900">
                  {getRevenueGrowth()}%
                </p>
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-emerald-600">Compared to last month</p>
              <p className="text-lg font-semibold text-emerald-800">
                {formatCurrency(
                  treatments
                    .filter((t) => {
                      const date = new Date(t.date);
                      const thisMonth = new Date().getMonth();
                      const thisYear = new Date().getFullYear();
                      return (
                        date.getMonth() === thisMonth &&
                        date.getFullYear() === thisYear
                      );
                    })
                    .reduce((sum, t) => sum + t.cost, 0)
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card className="border-0 shadow-lg">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search treatments by patient name, diagnosis, or treatment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Treatments Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {filteredTreatments.map((treatment) => (
          <Card
            key={treatment.id}
            className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white"
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-linear-to-br from-purple-500 to-indigo-600 text-white font-semibold">
                      {getPatientInitials(treatment.patientName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg text-gray-900">
                      {treatment.patientName}
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      {treatment.diagnosis}
                    </p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setEditingTreatment(treatment)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="h-4 w-4 mr-2 text-blue-500" />
                  {formatDate(treatment.date)}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <User className="h-4 w-4 mr-2 text-purple-500" />
                  Patient ID: {treatment.patientId.slice(-6)}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <DollarSign className="h-4 w-4 mr-2 text-green-500" />
                  Cost: {formatCurrency(treatment.cost)}
                </div>
              </div>

              {/* Treatment Details */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-700 font-medium mb-2">
                  Treatment Performed
                </p>
                <p className="text-sm text-blue-600">{treatment.treatment}</p>
              </div>

              {/* Medications */}
              {treatment.medications.length > 0 && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                  <div className="flex items-center text-green-700 mb-2">
                    <Pill className="h-4 w-4 mr-2" />
                    <span className="font-medium text-sm">
                      Prescribed Medications
                    </span>
                  </div>
                  <div className="space-y-2">
                    {treatment.medications.map((medication, index) => (
                      <div
                        key={index}
                        className="bg-white p-2 rounded border border-green-200"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm text-green-800">
                            {medication.name}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {medication.dosage}
                          </Badge>
                        </div>
                        <p className="text-xs text-green-600 mt-1">
                          {medication.frequency} for {medication.duration}
                        </p>
                        {medication.instructions && (
                          <p className="text-xs text-green-600 italic mt-1">
                            {medication.instructions}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {treatment.notes && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <div className="flex items-center text-gray-700 mb-2">
                    <FileText className="h-4 w-4 mr-2" />
                    <span className="font-medium text-sm">Treatment Notes</span>
                  </div>
                  <p className="text-sm text-gray-600">{treatment.notes}</p>
                </div>
              )}

              {/* Follow-up */}
              {treatment.followUpDate && (
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                  <div className="flex items-center text-yellow-700">
                    <Calendar className="h-4 w-4 mr-2" />
                    <span className="font-medium text-sm">
                      Follow-up Scheduled
                    </span>
                  </div>
                  <p className="text-sm text-yellow-600 mt-1">
                    {formatDate(treatment.followUpDate)}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <Badge variant="secondary" className="text-xs">
                  ID: {treatment.id.slice(-6)}
                </Badge>
                <span className="text-xs text-gray-500">
                  Recorded: {formatDate(treatment.createdAt)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTreatments.length === 0 && (
        <Card className="border-0 shadow-lg">
          <CardContent className="text-center py-12">
            <Stethoscope className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No treatment records found
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm
                ? "No treatment records match your search criteria."
                : "Get started by adding your first treatment record."}
            </p>
            {!searchTerm && (
              <Button
                onClick={() => setShowAddDialog(true)}
                className="bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Treatment Record
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Treatment Dialog */}
      <Dialog
        open={!!editingTreatment}
        onOpenChange={() => setEditingTreatment(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Treatment Record</DialogTitle>
            <DialogDescription>
              Update the treatment details and prescriptions.
            </DialogDescription>
          </DialogHeader>
          {editingTreatment && (
            <TreatmentForm
              treatment={editingTreatment}
              onSave={handleEditTreatment}
              onCancel={() => {}}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Treatments;
