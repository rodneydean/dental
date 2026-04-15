import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogHeader as DialogHeaderComponent,
  DialogTitle as DialogTitleComponent,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Search,
  Plus,
  MoreVertical,
  Edit,
  Phone,
  Mail,
  Calendar,
  AlertTriangle,
  Users,
  History,
  FileText,
  Stethoscope,
  Send,
  Download,
} from "lucide-react";
import PatientForm from "@/components/PatientForm";
import { dataManager, Patient, Appointment, Treatment, PatientNote, SickSheet } from "@/lib/dataManager";
import { pdfGenerator } from "@/lib/pdfGenerator";
import { calculateAge } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const Patients = () => {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [viewingHistory, setViewingHistory] = useState<Patient | null>(null);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [showAllPatients, setShowAllPatients] = useState(user?.role !== "RECEPTION");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const patientsPerPage = 9;

  // Notes and Sick Sheets state
  const [patientNotes, setPatientNotes] = useState<PatientNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [sickSheets, setSickSheets] = useState<SickSheet[]>([]);
  const [showAddSickSheet, setShowAddSickSheet] = useState(false);
  const [newSickSheet, setNewSickSheet] = useState({
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date().toISOString().split("T")[0],
    reason: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (viewingHistory) {
      loadPatientExtras(viewingHistory.id);
    }
  }, [viewingHistory]);

  const loadPatientExtras = async (patientId: string) => {
    try {
      const [notes, sheets] = await Promise.all([
        dataManager.getPatientNotes(patientId),
        dataManager.getSickSheets(patientId),
      ]);
      setPatientNotes(notes);
      setSickSheets(sheets);
    } catch {
      toast.error("Failed to load clinical details");
    }
  };

  useEffect(() => {
    const filtered = patients.filter(
      (patient) => {
        const matchesSearch = patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (patient.email && patient.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (patient.phone && patient.phone.includes(searchTerm));

        if (!showAllPatients && user?.role === "RECEPTION") {
          const today = new Date().toISOString().split("T")[0];
          const patientDate = patient.created_at.split("T")[0];
          return matchesSearch && patientDate === today;
        }

        return matchesSearch;
      }
    );
    setFilteredPatients(filtered);
    setCurrentPage(1); // Reset to first page on search/filter
  }, [patients, searchTerm, showAllPatients, user?.role]);

  const indexOfLastPatient = currentPage * patientsPerPage;
  const indexOfFirstPatient = indexOfLastPatient - patientsPerPage;
  const currentPatients = filteredPatients.slice(indexOfFirstPatient, indexOfLastPatient);
  const totalPages = Math.ceil(filteredPatients.length / patientsPerPage);

  const loadData = async () => {
    try {
      const [loadedPatients, loadedAppointments, loadedTreatments] = await Promise.all([
        dataManager.getPatients(),
        dataManager.getAppointments(),
        dataManager.getTreatments()
      ]);
      setPatients(loadedPatients);
      setAppointments(loadedAppointments);
      setTreatments(loadedTreatments);
    } catch {
      toast.error("Failed to load data");
    }
  };

  const handleAddPatient = async (
    patientData: Omit<Patient, "id" | "created_at" | "updated_at">
  ) => {
    try {
      await dataManager.addPatient(patientData);
      await loadData();
      setShowAddSheet(false);
      toast.success("Patient added successfully");
    } catch {
      toast.error("Failed to add patient");
    }
  };

  const handleEditPatient = async (
    patientData: Omit<Patient, "id" | "created_at" | "updated_at">
  ) => {
    if (!editingPatient) return;

    try {
      await dataManager.updatePatient(editingPatient.id, patientData);
      await loadData();
      setEditingPatient(null);
      toast.success("Patient updated successfully");
    } catch {
      toast.error("Failed to update patient");
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
    return new Date(dateString).toLocaleDateString();
  };

  const handleAddNote = async () => {
    if (!viewingHistory || !newNote.trim()) return;
    setIsSubmittingNote(true);
    try {
      await dataManager.addPatientNote({
        patient_id: viewingHistory.id,
        doctor_id: user?.id || "unknown",
        doctor_name: user?.full_name || "Doctor",
        note: newNote,
      });
      setNewNote("");
      await loadPatientExtras(viewingHistory.id);
      toast.success("Note added");
    } catch {
      toast.error("Failed to add note");
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleCreateSickSheet = async () => {
    if (!viewingHistory || !newSickSheet.reason) {
      toast.error("Please provide a reason");
      return;
    }
    try {
      await dataManager.addSickSheet({
        patient_id: viewingHistory.id,
        patient_name: viewingHistory.name,
        doctor_id: user?.id || "unknown",
        doctor_name: user?.full_name || "Doctor",
        ...newSickSheet,
      });
      setShowAddSickSheet(false);
      setNewSickSheet({
        start_date: new Date().toISOString().split("T")[0],
        end_date: new Date().toISOString().split("T")[0],
        reason: "",
      });
      await loadPatientExtras(viewingHistory.id);
      toast.success("Sick sheet created");
    } catch {
      toast.error("Failed to create sick sheet");
    }
  };

  const exportSickSheet = (sheet: SickSheet) => {
    pdfGenerator.generateSickSheet(sheet);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {user?.role === "DOCTOR" || user?.role === "ADMIN" ? "Patient Records" : "Patient Management"}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {user?.role === "DOCTOR" || user?.role === "ADMIN" ? "View and manage clinical patient data" : "Manage patient registrations and contacts"}
          </p>
        </div>
        {(user?.role === "RECEPTION" || user?.role === "DOCTOR" || user?.role === "ADMIN") && (
          <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
            <SheetTrigger asChild>
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-white rounded-sm">
                <Plus className="h-4 w-4 mr-2" />
                Add New Patient
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-2xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Add New Patient</SheetTitle>
                <SheetDescription>
                  Enter the patient's information to create a new record.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6">
                <PatientForm onSave={handleAddPatient} onCancel={() => setShowAddSheet(false)} />
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-3.5 w-3.5" />
          <Input
            placeholder="Search patients by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-sm rounded-sm border-gray-200"
          />
        </div>
        {user?.role === "RECEPTION" && (
          <div className="flex bg-gray-100 p-1 rounded-sm border border-gray-200">
            <button
              onClick={() => setShowAllPatients(false)}
              className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-sm transition-all ${
                !showAllPatients
                  ? "bg-white text-primary shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Today's Patients
            </button>
            <button
              onClick={() => setShowAllPatients(true)}
              className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-sm transition-all ${
                showAllPatients
                  ? "bg-white text-primary shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              All Patients
            </button>
          </div>
        )}
      </div>

      {/* Patients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentPatients.map((patient) => (
          <Card
            key={patient.id}
            className="border border-gray-200 shadow-sm hover:border-primary/50 transition-colors bg-white rounded-sm"
          >
            <CardHeader className="pb-3 px-4 pt-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10 rounded-sm">
                    <AvatarFallback className="bg-blue-50 text-primary font-semibold text-sm rounded-sm">
                      {getPatientInitials(patient.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-sm font-semibold text-gray-900">
                      {patient.name}
                    </CardTitle>
                    <p className="text-xs text-gray-500">
                      Age: {calculateAge(patient.date_of_birth)}
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
                    <DropdownMenuItem onClick={() => setViewingHistory(patient)}>
                      <History className="h-4 w-4 mr-2" />
                      Clinical History
                    </DropdownMenuItem>
                    {(user?.role === "DOCTOR" || user?.role === "ADMIN") && (
                      <DropdownMenuItem onClick={() => setEditingPatient(patient)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Details
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              <div className="space-y-1.5">
                <div className="flex items-center text-xs text-gray-600">
                  <Phone className="h-3.5 w-3.5 mr-2 text-primary/70" />
                  {patient.phone || "No phone"}
                </div>
                <div className="flex items-center text-xs text-gray-600">
                  <Mail className="h-3.5 w-3.5 mr-2 text-primary/70" />
                  {patient.email || "No email"}
                </div>
              </div>

              {patient.allergies && (
                <div className="bg-red-50 p-2 rounded-sm border border-red-100">
                  <div className="flex items-center text-red-700 mb-0.5">
                    <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                    <span className="font-semibold text-[10px] uppercase tracking-wider">Allergies</span>
                  </div>
                  <p className="text-xs text-red-600">{patient.allergies}</p>
                </div>
              )}

              {user?.role === "DOCTOR" && patient.medical_history && (
                <div className="bg-blue-50 p-2 rounded-sm border border-blue-100">
                  <p className="text-[10px] text-primary font-semibold uppercase tracking-wider mb-0.5">
                    Medical History
                  </p>
                  <p className="text-xs text-primary/80 line-clamp-2">
                    {patient.medical_history}
                  </p>
                </div>
              )}

              <div className="pt-1">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full text-primary border-gray-200 hover:bg-gray-50 h-8 text-xs font-medium rounded-sm"
                  onClick={() => setViewingHistory(patient)}
                >
                  <FileText className="h-3.5 w-3.5 mr-2" />
                  View Records
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination Controls */}
      {filteredPatients.length > patientsPerPage && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <p className="text-xs text-gray-500">
            Showing <span className="font-medium">{indexOfFirstPatient + 1}</span> to <span className="font-medium">{Math.min(indexOfLastPatient, filteredPatients.length)}</span> of <span className="font-medium">{filteredPatients.length}</span> patients
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="h-8 rounded-sm border-gray-200 text-xs"
            >
              Previous
            </Button>
            <div className="flex items-center">
              {[...Array(totalPages)].map((_, i) => (
                <Button
                  key={i + 1}
                  variant={currentPage === i + 1 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(i + 1)}
                  className={`h-8 w-8 p-0 rounded-sm text-xs ${
                    currentPage === i + 1
                      ? "bg-primary text-white hover:bg-primary/90"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {i + 1}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="h-8 rounded-sm border-gray-200 text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {filteredPatients.length === 0 && (
        <Card className="border-0 shadow-lg">
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No patients found
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm
                ? "No patients match your search criteria."
                : "Get started by adding your first patient."}
            </p>
            {!searchTerm && (user?.role === "RECEPTION" || user?.role === "DOCTOR" || user?.role === "ADMIN") && (
              <Button
                onClick={() => setShowAddSheet(true)}
                className="bg-primary hover:bg-primary/90 text-white rounded-sm h-9"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Patient
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* History Sheet */}
      <Sheet open={!!viewingHistory} onOpenChange={(open) => !open && setViewingHistory(null)}>
        <SheetContent side="right" className="sm:max-w-3xl overflow-y-auto border-l border-gray-200 p-0">
          <SheetHeader className="bg-gray-50/50 p-6 border-b border-gray-100 sticky top-0 z-10">
            <div className="flex items-center space-x-4">
              <Avatar className="h-12 w-12 rounded-sm border-2 border-white shadow-sm">
                <AvatarFallback className="bg-primary text-white font-bold rounded-sm">
                  {viewingHistory ? getPatientInitials(viewingHistory.name) : ""}
                </AvatarFallback>
              </Avatar>
              <div>
                <SheetTitle className="text-xl font-bold text-gray-900">
                  {viewingHistory?.name}
                </SheetTitle>
                <div className="flex items-center text-xs text-gray-500 mt-1">
                  <span className="bg-blue-100 text-primary px-2 py-0.5 rounded-sm font-semibold mr-3">
                    ID: {viewingHistory?.id.slice(0, 8).toUpperCase()}
                  </span>
                  <Calendar className="h-3 w-3 mr-1" />
                  Born: {viewingHistory?.date_of_birth} ({calculateAge(viewingHistory?.date_of_birth || "")} yrs)
                </div>
              </div>
            </div>
          </SheetHeader>
          <div className="space-y-8 p-6">
            {/* Quick Contact & Alerts Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-3 rounded-sm border border-gray-100 shadow-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Contact Info</p>
                <div className="space-y-1">
                  <p className="text-xs font-medium flex items-center"><Phone className="h-3 w-3 mr-2 text-primary/60" /> {viewingHistory?.phone}</p>
                  <p className="text-xs font-medium flex items-center"><Mail className="h-3 w-3 mr-2 text-primary/60" /> {viewingHistory?.email || "N/A"}</p>
                </div>
              </div>
              <div className="bg-red-50 p-3 rounded-sm border border-red-100 shadow-sm">
                <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1 flex items-center">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Allergies
                </p>
                <p className="text-xs font-bold text-red-700">{viewingHistory?.allergies || "None Reported"}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-sm border border-blue-100 shadow-sm">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Medical History</p>
                <p className="text-xs font-semibold text-primary line-clamp-2">{viewingHistory?.medical_history || "No significant history"}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-blue-500" />
                    Past Appointments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {appointments
                      .filter(a => a.patient_id === viewingHistory?.id)
                      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map(apt => (
                        <div key={apt.id} className="text-sm border-l-2 border-blue-200 pl-3 py-1">
                          <p className="font-medium">{formatDate(apt.date)} at {apt.time}</p>
                          <p className="text-gray-600">{apt.appointment_type} - <span className="capitalize">{apt.status}</span></p>
                        </div>
                      ))
                    }
                    {appointments.filter(a => a.patient_id === viewingHistory?.id).length === 0 && (
                      <p className="text-sm text-gray-500">No appointments found</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <Stethoscope className="h-4 w-4 mr-2 text-purple-500" />
                    Treatments & Diagnoses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {treatments
                      .filter(t => t.patient_id === viewingHistory?.id)
                      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map(t => (
                        <div key={t.id} className="text-sm bg-gray-50 p-3 rounded-lg">
                          <p className="font-semibold text-purple-700">{formatDate(t.date)}</p>
                          <p className="font-medium mt-1">Diagnosis: {t.diagnosis}</p>
                          <p className="text-gray-600 mt-1">Treatment: {t.treatment}</p>
                          {t.notes && <p className="text-xs italic mt-1 text-gray-500">Notes: {t.notes}</p>}
                        </div>
                      ))
                    }
                    {treatments.filter(t => t.patient_id === viewingHistory?.id).length === 0 && (
                      <p className="text-sm text-gray-500">No treatment records found</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
            

            <Separator />

            {/* Notes Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900 flex items-center text-sm uppercase tracking-wider">
                  <FileText className="h-4 w-4 mr-2 text-primary" />
                  Clinical Notes
                </h4>
              </div>

              {(user?.role === "DOCTOR" || user?.role === "ADMIN") && (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Add a new clinical note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="text-sm rounded-sm border-gray-200"
                    rows={2}
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleAddNote}
                      disabled={isSubmittingNote || !newNote.trim()}
                      className="bg-primary hover:bg-primary/90 text-white rounded-sm h-8"
                    >
                      <Send className="h-3.5 w-3.5 mr-2" />
                      Add Note
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {patientNotes.map((note) => (
                  <div key={note.id} className="bg-gray-50 p-3 rounded-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-[10px] font-bold text-primary uppercase">Dr. {note.doctor_name}</p>
                      <p className="text-[10px] text-gray-400">{new Date(note.created_at).toLocaleString()}</p>
                    </div>
                    <p className="text-xs text-gray-700">{note.note}</p>
                  </div>
                ))}
                {patientNotes.length === 0 && (
                  <p className="text-xs text-gray-500 italic text-center py-4">No clinical notes recorded.</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Sick Sheets Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900 flex items-center text-sm uppercase tracking-wider">
                  <Calendar className="h-4 w-4 mr-2 text-primary" />
                  Sick Sheets
                </h4>
                {(user?.role === "DOCTOR" || user?.role === "ADMIN") && (
                  <Dialog open={showAddSickSheet} onOpenChange={setShowAddSickSheet}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="h-8 text-xs rounded-sm border-gray-200">
                        <Plus className="h-3.5 w-3.5 mr-2" />
                        Create Sick Sheet
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeaderComponent>
                        <DialogTitleComponent>Create Sick Sheet</DialogTitleComponent>
                      </DialogHeaderComponent>
                      <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase text-gray-500">Start Date</Label>
                            <Input
                              type="date"
                              value={newSickSheet.start_date}
                              onChange={(e) => setNewSickSheet(prev => ({ ...prev, start_date: e.target.value }))}
                              className="h-9 text-sm rounded-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase text-gray-500">End Date</Label>
                            <Input
                              type="date"
                              value={newSickSheet.end_date}
                              onChange={(e) => setNewSickSheet(prev => ({ ...prev, end_date: e.target.value }))}
                              className="h-9 text-sm rounded-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-gray-500">Reason / Diagnosis</Label>
                          <Textarea
                            placeholder="Enter reason for sick leave..."
                            value={newSickSheet.reason}
                            onChange={(e) => setNewSickSheet(prev => ({ ...prev, reason: e.target.value }))}
                            className="text-sm rounded-sm"
                            rows={3}
                          />
                        </div>
                        <Button onClick={handleCreateSickSheet} className="w-full bg-primary hover:bg-primary/90 text-white rounded-sm">
                          Generate Sick Sheet
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sickSheets.map((sheet) => (
                  <Card key={sheet.id} className="border border-gray-200 shadow-none rounded-sm">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase">Period</p>
                          <p className="text-xs font-semibold">{sheet.start_date} to {sheet.end_date}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary"
                          onClick={() => exportSickSheet(sheet)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase mt-2">Reason</p>
                      <p className="text-xs text-gray-700 line-clamp-2">{sheet.reason}</p>
                    </CardContent>
                  </Card>
                ))}
                {sickSheets.length === 0 && (
                  <p className="text-xs text-gray-500 italic col-span-2 text-center py-4">No sick sheets issued.</p>
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Patient Sheet */}
      <Sheet
        open={!!editingPatient}
        onOpenChange={(open) => !open && setEditingPatient(null)}
      >
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Patient</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            {editingPatient && (
              <PatientForm
                patient={editingPatient}
                onSave={handleEditPatient}
                onCancel={() => setEditingPatient(null)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Patients;