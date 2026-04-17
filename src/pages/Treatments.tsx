import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  Download,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import TreatmentForm from "@/components/TreatmentForm";
import { dataManager, Treatment } from "@/lib/dataManager";
import { pdfGenerator } from "@/lib/pdfGenerator";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const Treatments = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [viewingTreatment, setViewingTreatment] = useState<Treatment | null>(null);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
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
      throw new Error("Failed to record treatment");
    }
  };

  const handleEditTreatment = async (
    treatmentData: Omit<Treatment, "id" | "created_at" | "updated_at">
  ) => {
    if (!editingTreatment) return;
    try {
      await dataManager.updateTreatment(editingTreatment.id, treatmentData);
      setEditingTreatment(null);
      toast.success("Treatment updated successfully");
      loadTreatments();
    } catch {
      toast.error("Failed to update treatment");
      throw new Error("Failed to update treatment");
    }
  };

  const handleDeleteTreatment = async (id: string) => {
    if (!confirm("Are you sure you want to delete this treatment record?")) return;
    try {
      await dataManager.deleteTreatment(id);
      await loadTreatments();
      toast.success("Treatment record deleted");
    } catch {
      toast.error("Failed to delete treatment");
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
                className="border border-gray-200 shadow-sm hover:border-primary/50 transition-colors bg-white overflow-hidden rounded-sm cursor-pointer"
                onClick={() => setViewingTreatment(treatment)}
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
                          <div className="cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/patients/${treatment.patient_id}`); }}>
                            <h3 className="text-sm font-semibold text-gray-900 hover:text-primary transition-colors">
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
                              <DropdownMenuItem onClick={() => setEditingTreatment(treatment)}>
                                <Plus className="h-4 w-4 mr-2" /> Edit Record
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => pdfGenerator.generatePrescription(treatment, treatment.medications)}>
                              <Download className="h-4 w-4 mr-2" /> Download Med Card (A5)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => pdfGenerator.generateTreatmentRecord(treatment)}>
                              <FileText className="h-4 w-4 mr-2" /> Download Full Record (A4)
                            </DropdownMenuItem>
                            {user?.role === "DOCTOR" && (
                              <DropdownMenuItem
                                onClick={() => handleDeleteTreatment(treatment.id)}
                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                              >
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

      {/* Edit Treatment Dialog */}
      <Dialog
        open={!!editingTreatment}
        onOpenChange={() => setEditingTreatment(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Treatment</DialogTitle>
            <DialogDescription>
              Update diagnosis and treatment details.
            </DialogDescription>
          </DialogHeader>
          {editingTreatment && (
            <TreatmentForm
              treatment={editingTreatment}
              onSave={handleEditTreatment}
              onCancel={() => setEditingTreatment(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* View Treatment Details Sheet */}
      <Sheet
        open={!!viewingTreatment}
        onOpenChange={() => setViewingTreatment(null)}
      >
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader className="border-b border-gray-100 pb-4 mb-6">
            <SheetTitle className="text-xl font-bold text-gray-900">Treatment Details</SheetTitle>
            <SheetDescription>
              Clinical record and medication details.
            </SheetDescription>
          </SheetHeader>

          {viewingTreatment && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6 bg-gray-50 p-4 rounded-sm border border-gray-100">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Patient</Label>
                  <p className="font-bold text-gray-900">{viewingTreatment.patient_name}</p>
                </div>
                <div className="space-y-1 text-right">
                  <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Date</Label>
                  <p className="font-bold text-gray-900">{viewingTreatment.date}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">Diagnosis</Label>
                <div className="bg-purple-50 p-4 rounded-sm border border-purple-100">
                  <p className="text-purple-900 font-semibold text-sm">{viewingTreatment.diagnosis}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Treatment Performed</Label>
                <div className="bg-white p-4 rounded-sm border border-gray-200 shadow-sm">
                  <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{viewingTreatment.treatment}</p>
                </div>
              </div>

              {viewingTreatment.medications.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Prescribed Medications</Label>
                  <div className="space-y-3">
                    {viewingTreatment.medications.map((med, idx) => (
                      <div key={idx} className="flex items-start bg-blue-50/50 p-4 rounded-sm border border-blue-100 relative group">
                        <div className="p-2 bg-blue-100 rounded-sm text-blue-600 mr-4">
                          <Pill className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-bold text-blue-900 text-sm">{med.name}</p>
                            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 text-[9px] h-5">
                              {med.dosage}
                            </Badge>
                          </div>
                          <p className="text-xs text-blue-800 font-medium mb-1">
                            {med.frequency} • {med.duration}
                          </p>
                          {med.instructions && (
                            <p className="text-[11px] text-blue-600 mt-2 bg-white/50 p-2 rounded italic border border-blue-50">
                              Note: {med.instructions}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewingTreatment.notes && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Additional Notes</Label>
                  <div className="bg-gray-50 p-4 rounded-sm border border-gray-100 italic text-sm text-gray-600">
                    {viewingTreatment.notes}
                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-gray-100 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Cost</p>
                    <p className="text-2xl font-black text-gray-900">{formatCurrency(viewingTreatment.cost)}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={() => pdfGenerator.generatePrescription(viewingTreatment, viewingTreatment.medications)}
                      className="bg-primary hover:bg-primary/90 text-white rounded-sm px-6 h-9 text-xs"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Medication Card (A5)
                    </Button>
                    <Button
                      onClick={() => pdfGenerator.generateTreatmentRecord(viewingTreatment)}
                      variant="outline"
                      className="border-primary text-primary hover:bg-primary/5 rounded-sm px-6 h-9 text-xs"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Full Record (A4)
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium uppercase tracking-tighter">
                  <span>Record ID: {viewingTreatment.id.split('-')[0]}</span>
                  <span>Created: {new Date(viewingTreatment.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Treatments;
