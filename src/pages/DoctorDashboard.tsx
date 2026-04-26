import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Stethoscope,
  Users,
  Clock,
  Calendar,
  Search,
  Activity,
  ArrowRight,
  UserCheck,
  ChevronRight,
  FileText,
  History,
  ClipboardList,
  AlertCircle,
} from "lucide-react";
import { dataManager, Appointment, Patient, Treatment, PatientNote } from "@/lib/dataManager";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { listen } from "@tauri-apps/api/event";
import { format, parseISO } from "date-fns";
import TreatmentForm from "@/components/TreatmentForm";

const DoctorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [activePatientNotes, setActivePatientNotes] = useState<PatientNote[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [newNote, setNewNote] = useState("");

  const currentAppointment = useMemo(() => {
    return appointments.find(a =>
      a.status === 'in_consultation' && a.doctor_id === user?.id
    );
  }, [appointments, user?.id]);

  const loadData = useCallback(async () => {
    try {
      const [apts, trts, pts] = await Promise.all([
        dataManager.getAppointments(),
        dataManager.getTreatments(),
        dataManager.getPatients(),
      ]);
      setAppointments(apts);
      setTreatments(trts);
      setPatients(pts);

      // If there's an active patient, load their specific notes
      const activeAppt = apts.find(a => a.status === 'in_consultation' && a.doctor_id === user?.id);
      if (activeAppt) {
        const notes = await dataManager.getPatientNotes(activeAppt.patient_id);
        setActivePatientNotes(notes);
      } else {
        setActivePatientNotes([]);
      }
    } catch (error) {
      console.error("Failed to load doctor dashboard data", error);
      toast.error("Failed to refresh dashboard");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const myQueue = useMemo(() => {
    return appointments.filter(a =>
      a.status === 'admitted' && a.doctor_id === user?.id
    ).sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, user?.id]);

  const generalPool = useMemo(() => {
    return appointments.filter(a =>
      a.status === 'admitted' && (!a.doctor_id || a.doctor_id === "")
    ).sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments]);

  const handleCallPatient = useCallback(async (appt: Appointment) => {
    try {
      await dataManager.updateAppointment(appt.id, {
        status: "in_consultation",
        doctor_id: user?.id,
        doctor_name: user?.full_name
      });
      await dataManager.updateDoctorStatus(user?.id || "", appt.id);
      toast.success(`Calling ${appt.patient_name}`);
      navigate(`/patients/${appt.patient_id}`);
    } catch {
      toast.error("Failed to call patient");
    }
  }, [user?.id, user?.full_name, navigate]);

  const handleMoveToCheckout = useCallback(async (appt: Appointment) => {
    try {
      await dataManager.updateAppointment(appt.id, { status: "awaiting_checkout" });
      await dataManager.updateDoctorStatus(user?.id || "", null);
      toast.success("Patient moved to checkout");
      loadData();
    } catch {
      toast.error("Failed to move patient to checkout");
    }
  }, [user?.id, loadData]);

  const handleCallNext = useCallback(() => {
    if (currentAppointment) {
      toast.warning("You already have a patient in consultation. Please finish or checkout first.");
      return;
    }
    const next = myQueue[0] || generalPool[0];
    if (next) {
      handleCallPatient(next);
    } else {
      toast.info("No patients waiting in queue");
    }
  }, [currentAppointment, myQueue, generalPool, handleCallPatient]);

  const handleQuickNote = async () => {
    if (!currentAppointment || !newNote.trim()) return;
    setIsSubmittingNote(true);
    try {
      await dataManager.addPatientNote({
        patient_id: currentAppointment.patient_id,
        doctor_id: user?.id || "unknown",
        doctor_name: user?.full_name || "Doctor",
        note_type: "General",
        note: newNote,
      });
      setNewNote("");
      const updatedNotes = await dataManager.getPatientNotes(currentAppointment.patient_id);
      setActivePatientNotes(updatedNotes);
      toast.success("Clinical note added");
    } catch {
      toast.error("Failed to add note");
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleAddTreatment = async (treatmentData: Omit<Treatment, "id" | "created_at" | "updated_at">) => {
    try {
      const saved = await dataManager.addTreatment(treatmentData);
      loadData();
      return saved;
    } catch {
      toast.error("Failed to record treatment");
    }
  };

  useEffect(() => {
    loadData();

    const unlisten = listen("sync-event", () => {
      loadData();
    });

    const intervalId = setInterval(loadData, 30000);

    // Keyboard Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "n") {
        e.preventDefault();
        handleCallNext();
      } else if (e.altKey && e.key === "s") {
        e.preventDefault();
        document.getElementById("patient-search")?.focus();
      } else if (e.altKey && e.key === "t") {
        e.preventDefault();
        navigate("/appointments");
      } else if (e.altKey && e.key === "h") {
        e.preventDefault();
        navigate("/");
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      unlisten.then(f => f());
      clearInterval(intervalId);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [loadData, navigate, handleCallNext]);

  const filteredPatients = useMemo(() => {
    if (searchTerm.length < 2) return [];
    return patients.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone.includes(searchTerm)
    ).slice(0, 5);
  }, [searchTerm, patients]);

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const currentPatient = useMemo(() => {
    if (!currentAppointment) return null;
    return patients.find(p => p.id === currentAppointment.patient_id);
  }, [currentAppointment, patients]);

  const activePatientTreatments = useMemo(() => {
    if (!currentAppointment) return [];
    return treatments
      .filter(t => t.patient_id === currentAppointment.patient_id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [currentAppointment, treatments]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin text-[#0078d4] mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Loading Clinical Workbench...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f3f4f6] flex flex-col -m-4 md:-m-8">
      {/* High Density Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center space-x-4">
          <div className="p-2 bg-[#0078d4] rounded-sm">
            <Stethoscope className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-none">Clinical Workbench</h1>
            <p className="text-xs text-gray-500 font-medium mt-1">Dr. {user?.full_name} | {format(new Date(), "PPPP")}</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <Button
            className="bg-[#0078d4] hover:bg-[#005a9e] text-white font-bold rounded-sm h-9 px-4 shadow-sm text-sm"
            onClick={handleCallNext}
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            Call Next (Alt+N)
          </Button>
        </div>
      </div>

      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        {/* Left Column: Active Patient Workbench */}
        <div className="lg:col-span-8 space-y-6 overflow-y-auto pr-2 custom-scrollbar">

          {currentAppointment ? (
            <div className="space-y-6">
              {/* Patient Hero Widget */}
              <Card className="border-none shadow-sm bg-white overflow-hidden rounded-sm">
                <CardContent className="p-0">
                  <div className="h-2 bg-[#0078d4]" />
                  <div className="p-6 flex items-center justify-between">
                    <div className="flex items-center space-x-6">
                      <Avatar className="h-16 w-16 rounded-sm border border-gray-100 shadow-sm">
                        <AvatarFallback className="bg-blue-50 text-[#0078d4] font-bold text-xl">
                          {getInitials(currentAppointment.patient_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center space-x-3 mb-1">
                          <h2 className="text-2xl font-bold text-gray-900">{currentAppointment.patient_name}</h2>
                          <Badge className="bg-blue-50 text-[#0078d4] border-none text-[10px] font-bold uppercase">Active</Badge>
                        </div>
                        <div className="flex items-center space-x-4 text-xs font-medium text-gray-500">
                          <span className="flex items-center"><Clock className="h-3.5 w-3.5 mr-1.5 text-gray-400" /> Started at {format(parseISO(currentAppointment.updated_at), "p")}</span>
                          <span className="flex items-center"><Activity className="h-3.5 w-3.5 mr-1.5 text-gray-400" /> {currentAppointment.appointment_type}</span>
                          {currentPatient && (
                             <span className="flex items-center"><AlertCircle className="h-3.5 w-3.5 mr-1.5 text-red-400" /> {currentPatient.allergies || "No Allergies"}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                       <Button
                          variant="outline"
                          size="sm"
                          className="border-gray-200 text-gray-600 font-bold rounded-sm h-9"
                          onClick={() => navigate(`/patients/${currentAppointment.patient_id}`)}
                       >
                          View Full Sheet
                       </Button>
                       <Button
                          className="bg-[#0078d4] hover:bg-[#005a9e] text-white font-bold rounded-sm h-9"
                          onClick={() => handleMoveToCheckout(currentAppointment)}
                       >
                          Complete & Checkout
                       </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Integrated Tools Workbench */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                  <Tabs defaultValue="notes" className="w-full">
                    <TabsList className="bg-white p-1 border border-gray-100 rounded-sm w-full justify-start space-x-2 h-12">
                      <TabsTrigger value="notes" className="rounded-sm data-[state=active]:bg-blue-50 data-[state=active]:text-[#0078d4] font-bold text-xs uppercase tracking-wider px-6">
                        <FileText className="h-4 w-4 mr-2" />
                        Clinical Notes
                      </TabsTrigger>
                      <TabsTrigger value="treatment" className="rounded-sm data-[state=active]:bg-blue-50 data-[state=active]:text-[#0078d4] font-bold text-xs uppercase tracking-wider px-6">
                        <ClipboardList className="h-4 w-4 mr-2" />
                        Record Treatment
                      </TabsTrigger>
                    </TabsList>

                    <div className="mt-4">
                      <TabsContent value="notes">
                        <Card className="border-none shadow-sm bg-white rounded-sm">
                          <CardContent className="p-6 space-y-4">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold uppercase text-gray-400">Quick Clinical Observations</Label>
                              <Textarea
                                placeholder="Enter findings, observations or notes for this session..."
                                className="min-h-[250px] text-sm border-gray-100 focus:ring-blue-500 rounded-sm shadow-inner"
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                              />
                            </div>
                            <div className="flex justify-between items-center">
                              <p className="text-[10px] text-gray-400 italic">Notes will be saved to patient's clinical record.</p>
                              <Button
                                onClick={handleQuickNote}
                                disabled={isSubmittingNote || !newNote.trim()}
                                className="bg-[#0078d4] hover:bg-[#005a9e] text-white font-bold rounded-sm h-9 px-6"
                              >
                                Save Clinical Note
                              </Button>
                            </div>

                            {activePatientNotes.length > 0 && (
                              <div className="mt-6 pt-6 border-t border-gray-50">
                                <h4 className="text-[10px] font-bold uppercase text-gray-400 mb-4 tracking-widest">Previous Notes (This Session)</h4>
                                <div className="space-y-3">
                                  {activePatientNotes.slice(0, 3).map((note) => (
                                    <div key={note.id} className="p-3 bg-gray-50 rounded-sm border border-gray-100">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-bold text-[#0078d4]">{note.note_type}</span>
                                        <span className="text-[10px] text-gray-400">{format(parseISO(note.created_at), "p")}</span>
                                      </div>
                                      <p className="text-xs text-gray-700">{note.note}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </TabsContent>

                      <TabsContent value="treatment">
                        <Card className="border-none shadow-sm bg-white rounded-sm">
                          <CardContent className="p-6">
                            <TreatmentForm
                              patient={currentPatient || undefined}
                              onSave={handleAddTreatment}
                              onCancel={() => {}}
                            />
                          </CardContent>
                        </Card>
                      </TabsContent>
                    </div>
                  </Tabs>
                </div>

                <div className="xl:col-span-1 space-y-6">
                  {/* Simplified History Widget - Always Visible */}
                  <Card className="border-none shadow-sm bg-white rounded-sm h-full">
                    <CardHeader className="pb-3 border-b border-gray-50 bg-gray-50/30">
                      <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center">
                        <History className="h-3.5 w-3.5 mr-2 text-gray-400" />
                        Patient History
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y divide-gray-50">
                        {activePatientTreatments.map((t) => (
                          <div key={t.id} className="p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-sm">
                                {format(parseISO(t.date), "MMM d, yy")}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-gray-900 leading-tight">{t.treatment}</p>
                            <p className="text-[10px] text-gray-500 italic line-clamp-2">{t.diagnosis}</p>
                            {t.medications.length > 0 && (
                               <div className="flex flex-wrap gap-1 mt-2">
                                  {t.medications.slice(0, 2).map((m, idx) => (
                                     <Badge key={idx} variant="outline" className="text-[8px] font-bold uppercase border-blue-100 bg-blue-50 text-[#0078d4] py-0 h-4">{m.name}</Badge>
                                  ))}
                               </div>
                            )}
                          </div>
                        ))}
                        {activePatientTreatments.length === 0 && (
                          <div className="p-12 text-center text-gray-400 text-[10px] font-bold uppercase tracking-widest italic">No History</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
               <Card className="border-2 border-dashed border-gray-200 shadow-none bg-transparent rounded-sm">
                  <CardContent className="p-12 text-center">
                     <div className="p-4 bg-gray-100 rounded-full w-fit mx-auto mb-4">
                        <Users className="h-8 w-8 text-gray-400" />
                     </div>
                     <h3 className="text-lg font-bold text-gray-900">Workbench Ready</h3>
                     <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">Call the next patient from the queue or search for a patient to begin a session.</p>
                  </CardContent>
               </Card>

               {/* Quick Stats Summary for Empty State */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-none shadow-sm bg-white rounded-sm">
                     <CardHeader className="pb-3 border-b border-gray-50">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-500">Next Scheduled</CardTitle>
                     </CardHeader>
                     <CardContent className="p-6">
                        {appointments.filter(a => a.date === today && a.status === 'scheduled').slice(0, 1).map(a => (
                           <div key={a.id} className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                 <div className="bg-blue-50 text-[#0078d4] p-3 rounded-sm font-black text-xs">{a.time}</div>
                                 <div>
                                    <p className="text-sm font-bold text-gray-900">{a.patient_name}</p>
                                    <p className="text-[10px] text-gray-500 font-medium">{a.appointment_type}</p>
                                 </div>
                              </div>
                              <Button
                                 size="sm"
                                 variant="ghost"
                                 className="text-[#0078d4] hover:bg-blue-50 font-bold text-[10px] uppercase"
                                 onClick={() => navigate(`/patients/${a.patient_id}`)}
                              >
                                 Sheet
                              </Button>
                           </div>
                        ))}
                        {appointments.filter(a => a.date === today && a.status === 'scheduled').length === 0 && (
                           <p className="text-xs text-gray-400 text-center italic">No upcoming appointments for today.</p>
                        )}
                     </CardContent>
                  </Card>

                  <Card className="border-none shadow-sm bg-white rounded-sm">
                     <CardHeader className="pb-3 border-b border-gray-50">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-500">Queue Summary</CardTitle>
                     </CardHeader>
                     <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                           <span className="text-xs font-medium text-gray-500">Assigned Patients</span>
                           <span className="text-sm font-black text-[#0078d4]">{myQueue.length}</span>
                        </div>
                        <div className="flex items-center justify-between">
                           <span className="text-xs font-medium text-gray-500">General Pool</span>
                           <span className="text-sm font-black text-gray-900">{generalPool.length}</span>
                        </div>
                     </CardContent>
                  </Card>
               </div>
            </div>
          )}
        </div>

        {/* Right Column: Global Context Sidebar */}
        <div className="lg:col-span-4 space-y-6 overflow-y-auto custom-scrollbar">
          {/* Quick Search */}
          <Card className="border-none shadow-sm bg-white rounded-sm overflow-visible">
            <CardHeader className="pb-3">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Patient Lookup (Alt+S)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
                <Input
                  id="patient-search"
                  placeholder="Search by name or phone..."
                  className="pl-10 h-10 text-sm border-gray-100 focus:ring-[#0078d4] rounded-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {filteredPatients.length > 0 && (
                   <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 shadow-xl rounded-sm z-50 overflow-hidden divide-y divide-gray-50">
                      {filteredPatients.map(p => (
                         <button
                            key={p.id}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between group"
                            onClick={() => navigate(`/patients/${p.id}`)}
                         >
                            <div>
                               <p className="text-sm font-bold text-gray-900">{p.name}</p>
                               <p className="text-[10px] text-gray-500">{p.phone}</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-[#0078d4] opacity-0 group-hover:opacity-100" />
                         </button>
                      ))}
                   </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Unified Queue Sidebar */}
          <Card className="border-none shadow-sm bg-white rounded-sm">
             <CardHeader className="pb-3 border-b border-gray-50 flex flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Waiting Queue</CardTitle>
                <Badge className="bg-blue-50 text-[#0078d4] border-none text-[9px] font-bold">{myQueue.length + generalPool.length}</Badge>
             </CardHeader>
             <CardContent className="p-0">
                <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
                   {/* My Queue Section */}
                   {myQueue.length > 0 && (
                      <div className="bg-blue-50/30 px-3 py-1.5 text-[9px] font-black text-[#0078d4] uppercase tracking-tighter">Assigned to Me</div>
                   )}
                   {myQueue.map((appt) => (
                    <div key={appt.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group">
                      <div className="flex items-center space-x-3">
                        <div className="text-center w-10">
                          <p className="text-xs font-bold text-gray-900">{appt.time}</p>
                        </div>
                        <div className="h-8 w-[2px] bg-blue-100 group-hover:bg-[#0078d4]" />
                        <div>
                          <p className="text-xs font-bold text-gray-900">{appt.patient_name}</p>
                          <p className="text-[9px] text-gray-500 font-medium uppercase">{appt.appointment_type}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-[#0078d4] hover:bg-blue-50"
                        onClick={() => handleCallPatient(appt)}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </div>
                  ))}

                  {/* General Pool Section */}
                  {generalPool.length > 0 && (
                      <div className="bg-gray-50 px-3 py-1.5 text-[9px] font-black text-gray-400 uppercase tracking-tighter">General Pool</div>
                   )}
                  {generalPool.map((appt) => (
                    <div key={appt.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group">
                      <div className="flex items-center space-x-3">
                        <div className="text-center w-10">
                          <p className="text-xs font-bold text-gray-900">{appt.time}</p>
                        </div>
                        <div className="h-8 w-[2px] bg-gray-100 group-hover:bg-green-500" />
                        <div>
                          <p className="text-xs font-bold text-gray-900">{appt.patient_name}</p>
                          <p className="text-[9px] text-gray-500 font-medium uppercase">{appt.appointment_type}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-gray-400 hover:text-green-600 hover:bg-green-50"
                        onClick={() => handleCallPatient(appt)}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </div>
                  ))}

                  {myQueue.length === 0 && generalPool.length === 0 && (
                    <div className="p-12 text-center text-gray-300 text-[10px] font-bold uppercase tracking-widest italic">Queue is Empty</div>
                  )}
                </div>
             </CardContent>
          </Card>

          {/* Schedule Summary */}
          <Card className="border-none shadow-sm bg-white rounded-sm">
            <CardHeader className="pb-3 border-b border-gray-50 flex flex-row items-center justify-between">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center">
                <Calendar className="h-3 w-3 mr-2 text-gray-400" />
                Remaining Schedule
              </CardTitle>
              <Link to="/appointments" className="text-[9px] font-bold text-[#0078d4] hover:underline uppercase">View All</Link>
            </CardHeader>
            <CardContent className="p-0">
               <div className="divide-y divide-gray-50 max-h-[300px] overflow-y-auto">
                  {appointments.filter(a => a.date === today && a.status === 'scheduled').map(appt => (
                     <div key={appt.id} className="p-3 flex items-center justify-between group">
                        <div className="flex items-center space-x-3">
                           <p className="text-[11px] font-black text-gray-900">{appt.time}</p>
                           <div>
                              <p className="text-xs font-bold text-gray-700">{appt.patient_name}</p>
                              <p className="text-[9px] text-gray-400 font-medium">{appt.appointment_type}</p>
                           </div>
                        </div>
                        <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 border-none text-[8px] font-bold uppercase px-1.5 h-4 rounded-sm">CONFIRMED</Badge>
                     </div>
                  ))}
                  {appointments.filter(a => a.date === today && a.status === 'scheduled').length === 0 && (
                     <div className="p-8 text-center text-gray-300 text-[10px] font-bold uppercase italic">No more scheduled.</div>
                  )}
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// Internal Link wrapper to avoid needing another import
const Link = ({ to, children, className }: { to: string, children: React.ReactNode, className?: string }) => {
   const navigate = useNavigate();
   return <button onClick={() => navigate(to)} className={className}>{children}</button>;
};

export default DoctorDashboard;
