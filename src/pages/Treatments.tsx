import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Calendar,
  Stethoscope,
  Filter,
  FileText,
  Clock,
  User,
  Pill,
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
import { Label } from "@/components/ui/label";
import TreatmentForm from "@/components/TreatmentForm";
import { dataManager, Treatment } from "@/lib/dataManager";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const Treatments = () => {
  const { user } = useAuth();
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
  const [viewingTreatment, setViewingTreatment] = useState<Treatment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTreatments();
  }, []);

  const loadTreatments = async () => {
    setIsLoading(true);
    try {
        const loadedTreatments = await dataManager.getTreatments();
        setTreatments(loadedTreatments);
    } catch (error) {
        toast.error("Failed to load treatments");
    } finally {
        setIsLoading(false);
    }
  };

  const handleAddTreatment = async (
    treatmentData: Omit<Treatment, "id" | "created_at" | "updated_at">
  ) => {
    try {
      await dataManager.addTreatment(treatmentData);
      await loadTreatments();
      setShowAddDialog(false);
      toast.success("Treatment recorded successfully");
    } catch (error) {
      toast.error("Failed to record treatment");
    }
  };

  const filteredTreatments = treatments.filter(
    (t) =>
      t.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.diagnosis.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Treatments & Diagnoses</h1>
          <p className="text-gray-600 mt-1">Record and manage patient clinical records</p>
        </div>
        {user?.role === "DOCTOR" && (
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg text-white">
                <Plus className="h-4 w-4 mr-2" />
                New Treatment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Record Treatment</DialogTitle>
                <DialogDescription>
                  Enter diagnosis and treatment details for the patient.
                </DialogDescription>
              </DialogHeader>
              <TreatmentForm
                onSave={handleAddTreatment}
                onCancel={() => setShowAddDialog(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search & Filter */}
      <Card className="border-0 shadow-lg">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by patient name or diagnosis..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="flex items-center space-x-2">
              <Filter className="h-4 w-4" />
              <span>Filters</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Treatments List */}
      <div className="grid grid-cols-1 gap-6">
        {isLoading ? (
            <div className="text-center py-12">Loading treatments...</div>
        ) : filteredTreatments.length > 0 ? (
          filteredTreatments
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map((treatment) => (
              <Card
                key={treatment.id}
                className="border-0 shadow-md hover:shadow-lg transition-all bg-white overflow-hidden group"
              >
                <CardContent className="p-0">
                  <div className="flex flex-col lg:flex-row">
                    {/* Date Column */}
                    <div className="lg:w-48 bg-gray-50 p-6 flex flex-col justify-center items-center border-r border-gray-100">
                      <div className="text-blue-600 mb-1">
                        <Calendar className="h-5 w-5 mx-auto mb-1" />
                        <span className="font-bold">{treatment.date}</span>
                      </div>
                      <Badge variant="outline" className="mt-2 bg-white">
                        {formatCurrency(treatment.cost)}
                      </Badge>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-4 mb-4">
                          <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                            <User className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900">
                              {treatment.patient_name}
                            </h3>
                            <p className="text-sm font-medium text-purple-600">
                              Diagnosis: {treatment.diagnosis}
                            </p>
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-5 w-5 text-gray-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewingTreatment(treatment)}>
                              <FileText className="h-4 w-4 mr-2" /> View Details
                            </DropdownMenuItem>
                            {user?.role === "DOCTOR" && (
                              <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50">
                                <Trash2 className="h-4 w-4 mr-2" /> Delete Record
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="space-y-4">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-sm font-bold text-gray-700 mb-1 flex items-center">
                            <Stethoscope className="h-4 w-4 mr-2 text-blue-500" />
                            Treatment Performed
                          </p>
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {treatment.treatment}
                          </p>
                        </div>

                        {treatment.medications.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {treatment.medications.map((med, idx) => (
                              <Badge
                                key={idx}
                                variant="secondary"
                                className="bg-blue-50 text-blue-700 border-blue-100 py-1"
                              >
                                <Pill className="h-3 w-3 mr-1" />
                                {med.name} ({med.dosage})
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      {treatment.follow_up_date && (
                        <div className="mt-4 flex items-center text-xs font-medium text-orange-600 bg-orange-50 w-fit px-2 py-1 rounded">
                          <Clock className="h-3 w-3 mr-1" />
                          Follow-up: {treatment.follow_up_date}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
        ) : (
          <Card className="border-0 shadow-lg">
            <CardContent className="text-center py-20">
              <Stethoscope className="h-16 w-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                No treatment records found
              </h3>
              <p className="text-gray-500 max-w-xs mx-auto">
                No records match your search or filters.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* View Treatment Details Dialog */}
      <Dialog
        open={!!viewingTreatment}
        onOpenChange={() => setViewingTreatment(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Treatment Details</DialogTitle>
          </DialogHeader>
          {viewingTreatment && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500 uppercase">Patient</Label>
                  <p className="font-bold text-lg">{viewingTreatment.patient_name}</p>
                </div>
                <div className="text-right">
                  <Label className="text-xs text-gray-500 uppercase">Date</Label>
                  <p className="font-bold text-lg">{viewingTreatment.date}</p>
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg">
                <Label className="text-xs text-purple-600 uppercase font-bold">Diagnosis</Label>
                <p className="text-purple-900 font-medium">{viewingTreatment.diagnosis}</p>
              </div>

              <div>
                <Label className="text-xs text-gray-500 uppercase font-bold">Treatment Performed</Label>
                <p className="text-gray-700 mt-1 whitespace-pre-wrap">{viewingTreatment.treatment}</p>
              </div>

              {viewingTreatment.medications.length > 0 && (
                <div>
                  <Label className="text-xs text-gray-500 uppercase font-bold block mb-2">Prescriptions</Label>
                  <div className="space-y-2">
                    {viewingTreatment.medications.map((med, idx) => (
                      <div key={idx} className="flex items-start bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <Pill className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
                        <div>
                          <p className="font-bold text-blue-900">{med.name} - {med.dosage}</p>
                          <p className="text-sm text-blue-700">{med.frequency} for {med.duration}</p>
                          {med.instructions && (
                            <p className="text-xs text-blue-600 mt-1 italic">Note: {med.instructions}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewingTreatment.notes && (
                <div>
                  <Label className="text-xs text-gray-500 uppercase font-bold">Notes</Label>
                  <p className="text-sm text-gray-600 mt-1">{viewingTreatment.notes}</p>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-xs text-gray-400">
                  Recorded: {new Date(viewingTreatment.created_at).toLocaleString()}
                </div>
                <div className="font-bold text-xl">
                  Total: {formatCurrency(viewingTreatment.cost)}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Treatments;
