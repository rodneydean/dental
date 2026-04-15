import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  MoreVertical,
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
    } catch {
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
    } catch {
      toast.error("Failed to record treatment");
    }
  };

  const filteredTreatments = treatments.filter(
    (t) =>
      t.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.diagnosis.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return `KSH ${amount.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Treatments & Diagnoses</h1>
          <p className="text-xs text-gray-500 mt-0.5">Record and manage patient clinical records</p>
        </div>
        {user?.role === "DOCTOR" && (
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-white rounded-sm">
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
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-3.5 w-3.5" />
          <Input
            placeholder="Search by patient name or diagnosis..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-sm rounded-sm border-gray-200"
          />
        </div>
        <Button variant="outline" size="sm" className="flex items-center space-x-2 border-gray-200 h-9 rounded-sm text-xs font-medium">
          <Filter className="h-3.5 w-3.5" />
          <span>Filters</span>
        </Button>
      </div>

      {/* Treatments List */}
      <div className="grid grid-cols-1 gap-3">
        {isLoading ? (
            <div className="text-center py-12 text-sm text-gray-500">Loading treatments...</div>
        ) : filteredTreatments.length > 0 ? (
          filteredTreatments
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map((treatment) => (
              <Card
                key={treatment.id}
                className="border border-gray-200 shadow-sm hover:border-primary/50 transition-colors bg-white overflow-hidden rounded-sm"
              >
                <CardContent className="p-0">
                  <div className="flex flex-col lg:flex-row">
                    {/* Date Column */}
                    <div className="lg:w-40 bg-gray-50 p-4 flex flex-col justify-center items-center border-r border-gray-100">
                      <div className="text-primary/70 mb-0.5">
                        <Calendar className="h-3.5 w-3.5 mx-auto mb-1" />
                        <span className="text-xs font-semibold">{treatment.date}</span>
                      </div>
                      <Badge variant="outline" className="mt-1 bg-white text-[10px] h-5 px-1.5 rounded-sm border-gray-200">
                        {formatCurrency(treatment.cost)}
                      </Badge>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="p-2 bg-purple-50 rounded-sm text-purple-600">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">
                              {treatment.patient_name}
                            </h3>
                            <p className="text-[11px] font-medium text-purple-600 uppercase tracking-tight">
                              Diagnosis: {treatment.diagnosis}
                            </p>
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4 text-gray-400" />
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

                      <div className="space-y-3">
                        <div className="bg-gray-50 rounded-sm p-3 border border-gray-100">
                          <p className="text-[10px] font-bold text-gray-500 mb-1 flex items-center uppercase tracking-widest">
                            <Stethoscope className="h-3 w-3 mr-2 text-primary" />
                            Treatment Performed
                          </p>
                          <p className="text-xs text-gray-600 leading-relaxed">
                            {treatment.treatment}
                          </p>
                        </div>

                        {treatment.medications.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {treatment.medications.map((med, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="bg-blue-50/50 text-primary border-blue-100 py-0 h-5 text-[10px] font-medium rounded-sm"
                              >
                                <Pill className="h-2.5 w-2.5 mr-1" />
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
