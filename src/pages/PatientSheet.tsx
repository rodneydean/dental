import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
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
import {
  Phone,
  Mail,
  Calendar as CalendarIcon,
  AlertTriangle,
  History as HistoryIcon,
  FileText,
  Stethoscope,
  Send,
  Download,
  Plus,
  ArrowLeft,
  User,
  Clock,
  MapPin,
  Heart,
  MoreVertical,
  Edit,
  Trash2,
} from "lucide-react";
import { dataManager, Patient, Appointment, Treatment, PatientNote, SickSheet } from "@/lib/dataManager";
import { pdfGenerator } from "@/lib/pdfGenerator";
import { calculateAge } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AppointmentForm from "@/components/AppointmentForm";
import TreatmentForm from "@/components/TreatmentForm";

const PatientSheet = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [patientNotes, setPatientNotes] = useState<PatientNote[]>([]);
  const [sickSheets, setSickSheets] = useState<SickSheet[]>([]);
  const [noteTypes, setNoteTypes] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [selectedNoteType, setSelectedNoteType] = useState("General");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  const [showAddAppointment, setShowAddAppointment] = useState(false);
  const [showAddTreatment, setShowAddTreatment] = useState(false);

  const activeConsultation = appointments.find(a => a.status === 'in_consultation' && a.doctor_id === user?.id);

  const handleMoveToCheckout = async () => {
    if (!activeConsultation) return;
    try {
      await dataManager.updateAppointment(activeConsultation.id, { status: "awaiting_checkout" });
      await dataManager.updateDoctorStatus(user?.id || "", null);
      toast.success("Patient moved to checkout");
      if (id) loadData(id);
    } catch {
      toast.error("Failed to update status");
    }
  };
  const [showAddSickSheet, setShowAddSickSheet] = useState(false);
  const [editingNote, setEditingNote] = useState<PatientNote | null>(null);

  const [newSickSheet, setNewSickSheet] = useState({
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date().toISOString().split("T")[0],
    reason: "",
  });

  const loadData = useCallback(async (patientId: string) => {
    setIsLoading(true);
    try {
      const [
        loadedPatient,
        allAppointments,
        allTreatments,
        notes,
        sheets,
        types
      ] = await Promise.all([
        dataManager.getPatient(patientId),
        dataManager.getAppointments(),
        dataManager.getTreatments(),
        dataManager.getPatientNotes(patientId),
        dataManager.getSickSheets(patientId),
        dataManager.getNoteTypes()
      ]);

      setPatient(loadedPatient);
      setAppointments(allAppointments.filter(a => a.patient_id === patientId));
      setTreatments(allTreatments.filter(t => t.patient_id === patientId));
      setPatientNotes(notes);
      setSickSheets(sheets);
      setNoteTypes(types);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load patient data");
      navigate("/patients");
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (id) {
      loadData(id);
    }
  }, [id, loadData]);

  const handleAddNote = async () => {
    if (!patient || !newNote.trim()) return;
    setIsSubmittingNote(true);
    try {
      await dataManager.addPatientNote({
        patient_id: patient.id,
        doctor_id: user?.id || "unknown",
        doctor_name: user?.full_name || "Doctor",
        note_type: selectedNoteType,
        note: newNote,
      });
      setNewNote("");
      const updatedNotes = await dataManager.getPatientNotes(patient.id);
      setPatientNotes(updatedNotes);
      toast.success("Note added");
    } catch {
      toast.error("Failed to add note");
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleUpdateNote = async () => {
    if (!editingNote || !patient) return;
    try {
      await dataManager.updatePatientNote(editingNote.id, editingNote.note_type, editingNote.note);
      const updatedNotes = await dataManager.getPatientNotes(patient.id);
      setPatientNotes(updatedNotes);
      setEditingNote(null);
      toast.success("Note updated");
    } catch {
      toast.error("Failed to update note");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!patient) return;
    if (!confirm("Are you sure you want to delete this clinical note?")) return;
    try {
      await dataManager.deletePatientNote(noteId);
      const updatedNotes = await dataManager.getPatientNotes(patient.id);
      setPatientNotes(updatedNotes);
      toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete note");
    }
  };

  const handleAddAppointment = async (appointmentData: Omit<Appointment, "id" | "created_at" | "updated_at">) => {
    try {
      await dataManager.addAppointment(appointmentData);
      setShowAddAppointment(false);
      const allAppointments = await dataManager.getAppointments();
      setAppointments(allAppointments.filter(a => a.patient_id === id));
      toast.success("Appointment scheduled");
    } catch {
      toast.error("Failed to schedule appointment");
    }
  };

  const handleAddTreatment = async (treatmentData: Omit<Treatment, "id" | "created_at" | "updated_at">) => {
    try {
      const savedTreatment = await dataManager.addTreatment(treatmentData);
      setShowAddTreatment(false);
      const allTreatments = await dataManager.getTreatments();
      setTreatments(allTreatments.filter(t => t.patient_id === id));
      return savedTreatment;
    } catch {
      toast.error("Failed to record treatment");
    }
  };

  const handleSickSheetDateChange = (field: 'start_date' | 'end_date', date: Date | undefined) => {
    if (date) {
      setNewSickSheet(prev => ({ ...prev, [field]: format(date, "yyyy-MM-dd") }));
    }
  };

  const handleCreateSickSheet = async () => {
    if (!patient || !newSickSheet.reason) {
      toast.error("Please provide a reason");
      return;
    }
    try {
      await dataManager.addSickSheet({
        patient_id: patient.id,
        patient_name: patient.name,
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
      const updatedSheets = await dataManager.getSickSheets(patient.id);
      setSickSheets(updatedSheets);
      toast.success("Sick sheet created");
    } catch {
      toast.error("Failed to create sick sheet");
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Loading patient sheet...</p>
        </div>
      </div>
    );
  }

  if (!patient) return null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header / Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/patients")}
          className="text-gray-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Patients
        </Button>
        <div className="flex space-x-3">
          {(user?.role === "DOCTOR" || user?.role === "ADMIN" || user?.role === "RECEPTION") && (
            <Dialog open={showAddAppointment} onOpenChange={setShowAddAppointment}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-white text-primary border border-primary hover:bg-primary hover:text-white transition-all rounded-sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Appointment
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Schedule Appointment</DialogTitle>
                </DialogHeader>
                <AppointmentForm
                  patient={patient}
                  onSave={handleAddAppointment}
                  onCancel={() => setShowAddAppointment(false)}
                />
              </DialogContent>
            </Dialog>
          )}

          {activeConsultation && (
             <Button
                size="sm"
                variant="outline"
                className="border-green-600 text-green-600 hover:bg-green-50 rounded-sm"
                onClick={handleMoveToCheckout}
             >
                Move to Checkout
             </Button>
          )}

          {(user?.role === "DOCTOR" || user?.role === "ADMIN") && (
            <Dialog open={showAddTreatment} onOpenChange={setShowAddTreatment}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-white rounded-sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Treatment
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Record New Treatment</DialogTitle>
                </DialogHeader>
                <TreatmentForm
                  onSave={handleAddTreatment}
                  onCancel={() => setShowAddTreatment(false)}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Patient Profile Card */}
      <Card className="border-none shadow-sm bg-white overflow-hidden rounded-sm">
        <div className="h-24 bg-gradient-to-r from-primary/10 to-blue-50/50" />
        <CardContent className="relative px-6 pb-6">
          <div className="flex flex-col md:flex-row items-start md:items-end -mt-12 gap-6">
            <Avatar className="h-24 w-24 rounded-sm border-4 border-white shadow-md">
              <AvatarFallback className="bg-primary text-white text-2xl font-bold">
                {getPatientInitials(patient.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
              <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-sm text-gray-500">
                <span className="flex items-center"><User className="h-3.5 w-3.5 mr-1.5 text-primary/70" /> {patient.id.slice(0, 8).toUpperCase()}</span>
                <span className="flex items-center"><CalendarIcon className="h-3.5 w-3.5 mr-1.5 text-primary/70" /> {patient.date_of_birth} ({calculateAge(patient.date_of_birth)} yrs)</span>
                <span className="flex items-center"><Phone className="h-3.5 w-3.5 mr-1.5 text-primary/70" /> {patient.phone}</span>
                {patient.email && <span className="flex items-center"><Mail className="h-3.5 w-3.5 mr-1.5 text-primary/70" /> {patient.email}</span>}
                {patient.address && <span className="flex items-center"><MapPin className="h-3.5 w-3.5 mr-1.5 text-primary/70" /> {patient.address}</span>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Alerts and History */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border border-red-100 bg-red-50/30 rounded-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-red-700 uppercase tracking-wider flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Allergies & Medical Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Drug Allergies</p>
                  <p className="text-sm font-semibold text-red-900">{patient.allergies || "None Reported"}</p>
                </div>
                <Separator className="bg-red-100" />
                <div>
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Medical History</p>
                  <p className="text-sm font-medium text-gray-700">{patient.medical_history || "No significant history recorded"}</p>
                </div>
                {patient.emergency_contact && (
                  <>
                    <Separator className="bg-red-100" />
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Emergency Contact</p>
                      <p className="text-sm font-semibold text-gray-800">{patient.emergency_contact}</p>
                      <p className="text-xs text-gray-500">{patient.emergency_phone}</p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-100 shadow-sm rounded-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center">
                <Clock className="h-4 w-4 mr-2 text-primary" />
                Recent Appointments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {appointments
                  .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 5)
                  .map(apt => (
                    <div key={apt.id} className="text-sm border-l-2 border-primary/20 pl-3 py-1 bg-gray-50/50 rounded-r-sm">
                      <p className="font-semibold text-gray-900">{format(parseISO(apt.date), "PPP")} <span className="text-xs font-normal text-gray-500">at {apt.time}</span></p>
                      <p className="text-xs text-gray-600 flex items-center mt-0.5">
                        <Stethoscope className="h-3 w-3 mr-1 text-primary/60" />
                        {apt.appointment_type}
                        <span className={cn(
                          "ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase",
                          apt.status === "completed" ? "bg-green-100 text-green-700" :
                          apt.status === "cancelled" ? "bg-red-100 text-red-700" :
                          "bg-blue-100 text-blue-700"
                        )}>
                          {apt.status}
                        </span>
                      </p>
                    </div>
                  ))
                }
                {appointments.length === 0 && (
                  <p className="text-xs text-gray-500 italic text-center py-4">No appointment history.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-100 shadow-sm rounded-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center">
                <Heart className="h-4 w-4 mr-2 text-purple-500" />
                Sick Sheets
              </CardTitle>
              {(user?.role === "DOCTOR" || user?.role === "ADMIN") && (
                <Dialog open={showAddSickSheet} onOpenChange={setShowAddSickSheet}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create Sick Sheet</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-gray-500">Start Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant={"outline"} className="w-full justify-start text-left font-normal h-9 text-sm rounded-sm">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(parseISO(newSickSheet.start_date), "PPP")}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={parseISO(newSickSheet.start_date)}
                                onSelect={(date) => handleSickSheetDateChange('start_date', date)}
                                captionLayout="dropdown"
                                startMonth={new Date(new Date().getFullYear() - 10, 0)}
                                endMonth={new Date(new Date().getFullYear() + 10, 11)}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-gray-500">End Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant={"outline"} className="w-full justify-start text-left font-normal h-9 text-sm rounded-sm">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(parseISO(newSickSheet.end_date), "PPP")}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={parseISO(newSickSheet.end_date)}
                                onSelect={(date) => handleSickSheetDateChange('end_date', date)}
                                captionLayout="dropdown"
                                startMonth={new Date(new Date().getFullYear() - 10, 0)}
                                endMonth={new Date(new Date().getFullYear() + 10, 11)}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase text-gray-500">Reason / Diagnosis</Label>
                        <Textarea
                          placeholder="Reason for sick leave..."
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
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sickSheets.slice(0, 3).map((sheet) => (
                  <div key={sheet.id} className="flex justify-between items-center p-2 bg-purple-50/50 border border-purple-100 rounded-sm">
                    <div>
                      <p className="text-xs font-semibold text-purple-900">{sheet.start_date} to {sheet.end_date}</p>
                      <p className="text-[10px] text-purple-700 line-clamp-1">{sheet.reason}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-purple-600"
                      onClick={async () => {
                        await pdfGenerator.generateSickSheet(sheet);
                        toast.success("Sick sheet downloaded");
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {sickSheets.length === 0 && (
                  <p className="text-xs text-gray-500 italic text-center py-4">No sick sheets issued.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Clinical Progress */}
        <div className="lg:col-span-2 space-y-6">
          {/* Clinical Notes Entry */}
          {(user?.role === "DOCTOR" || user?.role === "ADMIN") && (
            <Card className="border border-primary/10 shadow-sm rounded-sm overflow-hidden">
              <CardHeader className="bg-primary/5 py-3 px-6 border-b border-primary/10">
                <CardTitle className="text-sm font-bold text-primary uppercase tracking-wider flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  New Clinical Note
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase text-gray-500">Note Category</Label>
                      <Select value={selectedNoteType} onValueChange={setSelectedNoteType}>
                        <SelectTrigger className="h-9 text-sm rounded-sm">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {noteTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-gray-500">Observation & Details</Label>
                    <Textarea
                      placeholder="Enter clinical observations, findings, or notes..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="text-sm rounded-sm border-gray-200"
                      rows={4}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={handleAddNote}
                      disabled={isSubmittingNote || !newNote.trim()}
                      className="bg-primary hover:bg-primary/90 text-white rounded-sm"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Add to Progress Notes
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Clinical History Tabs / Timeline */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center px-1">
              <HistoryIcon className="h-5 w-5 mr-2 text-primary" />
              Patient Clinical History
            </h2>

            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">

              {/* Combine notes and treatments into a timeline */}
              {[
                ...patientNotes.map(n => ({ ...n, timelineType: 'note' as const })),
                ...treatments.map(t => ({ ...t, timelineType: 'treatment' as const }))
              ]
                .sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((item) => (
                  <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    {/* Icon on timeline */}
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 group-[.is-active]:bg-primary text-slate-500 group-[.is-active]:text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      {item.timelineType === 'note' ? <FileText className="h-4 w-4" /> : <Stethoscope className="h-4 w-4" />}
                    </div>
                    {/* Content card */}
                    <div className="w-[calc(100%-4rem)] md:w-[45%] p-4 rounded-sm border border-gray-100 bg-white shadow-sm">
                      <div className="flex items-center justify-between space-x-2 mb-1">
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-gray-900 text-sm">
                            {item.timelineType === 'note' ? (item as PatientNote).note_type : "Treatment: " + (item as Treatment).treatment}
                          </div>
                          {item.timelineType === 'note' && (user?.role === 'ADMIN' || user?.role === 'DOCTOR') && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem onClick={() => setEditingNote(item as PatientNote)}>
                                  <Edit className="h-3.5 w-3.5 mr-2" />
                                  Edit Note
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteNote(item.id)}>
                                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                                  Delete Note
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                        <time className="font-mono text-xs font-medium text-primary bg-primary/5 px-2 py-0.5 rounded-sm whitespace-nowrap">
                          {format(parseISO(item.created_at), "MMM d, yyyy")}
                        </time>
                      </div>
                      <div className="text-xs text-gray-500 mb-2 font-medium flex items-center">
                        <User className="h-3 w-3 mr-1" />
                        {item.timelineType === 'note' ? `Dr. ${(item as PatientNote).doctor_name}` : "Clinical Staff"}
                      </div>
                      <div className="text-xs text-gray-600 leading-relaxed">
                        {item.timelineType === 'note' ? (item as PatientNote).note : (
                          <div className="space-y-1">
                            <p><span className="font-semibold text-gray-800">Diagnosis:</span> {(item as Treatment).diagnosis}</p>
                            {(item as Treatment).notes && <p className="italic">{(item as Treatment).notes}</p>}
                            {(item as Treatment).medications?.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-50">
                                    <p className="text-[10px] font-bold uppercase text-gray-400 mb-1">Prescriptions</p>
                                    <div className="flex flex-wrap gap-1">
                                        {(item as Treatment).medications.map((med) => (
                                            <span key={med.id} className="bg-blue-50 text-primary px-2 py-0.5 rounded-sm text-[10px] font-semibold border border-blue-100">
                                                {med.name} ({med.dosage})
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              }

              {patientNotes.length === 0 && treatments.length === 0 && (
                <div className="bg-gray-50 border border-dashed border-gray-200 rounded-sm p-12 text-center relative z-10">
                  <HistoryIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-400 font-medium italic">No clinical records found for this patient.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Note Dialog */}
      <Dialog open={!!editingNote} onOpenChange={(open) => !open && setEditingNote(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Clinical Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-gray-500">Note Category</Label>
              <Select
                value={editingNote?.note_type}
                onValueChange={(val) => setEditingNote(prev => prev ? { ...prev, note_type: val } : null)}
              >
                <SelectTrigger className="h-9 text-sm rounded-sm">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {noteTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-gray-500">Observation & Details</Label>
              <Textarea
                value={editingNote?.note}
                onChange={(e) => setEditingNote(prev => prev ? { ...prev, note: e.target.value } : null)}
                className="text-sm rounded-sm border-gray-200"
                rows={5}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setEditingNote(null)} className="rounded-sm h-9 text-sm">
                Cancel
              </Button>
              <Button onClick={handleUpdateNote} className="bg-primary hover:bg-primary/90 text-white rounded-sm h-9 text-sm">
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PatientSheet;
