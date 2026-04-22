import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Search,
  Plus,
  UserPlus,
  Clock,
  Users,
  CreditCard,
  LogOut,
  Activity,
  UserCheck,
  Calendar,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { dataManager, Patient, Appointment, InsuranceProvider } from "@/lib/dataManager";
import { toast } from "sonner";
import PatientForm from "@/components/PatientForm";
import AppointmentForm from "@/components/AppointmentForm";
import { listen } from "@tauri-apps/api/event";
import { cn } from "@/lib/utils";

const Reception = () => {
  const { user, logout } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [showAddAppointment, setShowAddAppointment] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [receptionFee, setReceptionFee] = useState<number>(0);
  const [requirePayment, setRequirePayment] = useState<boolean>(true);
  const [insuranceProviders, setInsuranceProviders] = useState<InsuranceProvider[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [pts, apts, , fee, reqPay, providers] = await Promise.all([
        dataManager.getPatients(),
        dataManager.getAppointments(),
        dataManager.getPayments(),
        dataManager.getSetting("reception_fee"),
        dataManager.getSetting("require_payment_before_admit"),
        dataManager.getInsuranceProviders()
      ]);
      setPatients(pts);
      setAppointments(apts);
      setReceptionFee(Number(fee || 0));
      setRequirePayment(reqPay === "true");
      setInsuranceProviders(providers);
    } catch (error) {
      console.error("Failed to load reception data", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const setupListener = async () => {
      const unlisten = await listen("sync-event", () => {
        loadData();
      });
      return unlisten;
    };

    const unlistenPromise = setupListener();
    return () => {
      unlistenPromise.then(f => f());
    };
  }, [loadData]);

  useEffect(() => {
    if (searchTerm.length > 1) {
      const filtered = patients.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.phone.includes(searchTerm)
      ).slice(0, 5);
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, patients]);

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    setSearchTerm("");
    setSearchResults([]);

    // Check if patient has an appointment today
    const today = new Date().toISOString().split("T")[0];
    const todayApt = appointments.find(a => a.patient_id === patient.id && a.date === today && a.status === 'scheduled');

    if (todayApt) {
      toast.info(`Found scheduled appointment for ${patient.name} today.`);
    } else {
      setShowAddAppointment(true);
    }
  };

  const handleAddPatient = async (patientData: Omit<Patient, "id" | "created_at" | "updated_at">) => {
    try {
      const newPatient = await dataManager.addPatient(patientData);
      await loadData();
      setShowAddPatient(false);
      handlePatientSelect(newPatient);
      toast.success("Patient registered successfully");
    } catch {
      toast.error("Failed to register patient");
    }
  };

  const handleAddAppointment = async (apptData: Omit<Appointment, "id" | "created_at" | "updated_at">) => {
    try {
      await dataManager.addAppointment(apptData);
      await loadData();
      setShowAddAppointment(false);
      toast.success("Appointment created");
    } catch {
      toast.error("Failed to create appointment");
    }
  };

  const handleAdmit = async (appt: Appointment) => {
    if (requirePayment && !appt.reception_fee_paid && !appt.reception_fee_waived) {
      toast.error("Reception fee must be paid before admission");
      return;
    }
    try {
      await dataManager.updateAppointment(appt.id, { status: "admitted" });
      toast.success(`${appt.patient_name} admitted to waiting room`);
      loadData();
    } catch {
      toast.error("Failed to admit patient");
    }
  };

  const handlePayFee = async (appt: Appointment, method: "cash" | "insurance" = "cash", providerId?: string) => {
    try {
      await dataManager.updateAppointment(appt.id, { reception_fee_paid: true });
      await dataManager.addPayment({
        patient_id: appt.patient_id,
        patient_name: appt.patient_name,
        amount: receptionFee,
        date: new Date().toISOString().split("T")[0],
        method: method,
        insurance_provider_id: providerId,
        status: "paid",
        notes: "Reception Fee",
      });
      toast.success("Payment recorded");
      loadData();
    } catch {
      toast.error("Failed to record payment");
    }
  };

  const today = new Date().toISOString().split("T")[0];
  const todayAppointments = appointments.filter(a => a.date === today);
  const scheduledToday = todayAppointments.filter(a => a.status === 'scheduled');
  const inQueue = todayAppointments.filter(a => a.status === 'admitted' || a.status === 'in_consultation');

  const stats = [
    { label: "Today's Arrivals", value: todayAppointments.length, icon: Calendar, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Currently Waiting", value: inQueue.filter(a => a.status === 'admitted').length, icon: Clock, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "In Consultation", value: inQueue.filter(a => a.status === 'in_consultation').length, icon: Activity, color: "text-green-600", bg: "bg-green-50" },
    { label: "Pending Fees", value: scheduledToday.filter(a => !a.reception_fee_paid && !a.reception_fee_waived).length, icon: CreditCard, color: "text-red-600", bg: "bg-red-50" },
  ];

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading Command Center...</div>;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Premium Header */}
      <header className="bg-[#0078d4] text-white px-6 h-14 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-white/10 rounded-sm">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight">Skryme Dental <span className="font-normal opacity-80">| Reception Hub</span></h1>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3 pr-4 border-r border-white/20">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold leading-none">{user?.full_name}</p>
              <p className="text-[10px] opacity-70 leading-tight">Receptionist On Duty</p>
            </div>
            <Avatar className="h-8 w-8 rounded-sm border border-white/20">
              <AvatarFallback className="bg-white/20 text-white text-xs font-bold rounded-sm">
                {user ? getInitials(user.full_name) : "?"}
              </AvatarFallback>
            </Avatar>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10 h-8 px-2 rounded-sm"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            <span className="text-xs font-semibold">Logout</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-6 overflow-y-auto">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <Card key={i} className="border-none shadow-sm bg-white overflow-hidden">
              <CardContent className="p-4 flex items-center space-x-4">
                <div className={cn("p-2.5 rounded-sm", stat.bg)}>
                  <stat.icon className={cn("h-5 w-5", stat.color)} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 leading-none mt-0.5">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Quick Admission & Today's Appointments */}
          <div className="lg:col-span-8 space-y-6">
            {/* Quick Admission Command Pane */}
            <Card className="border-none shadow-sm bg-white overflow-visible">
              <CardHeader className="pb-3 border-b border-gray-50">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-500 flex items-center">
                  <UserPlus className="h-4 w-4 mr-2 text-[#0078d4]" />
                  Patient Admission & Registration
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search patient by name or phone to admit..."
                      className="pl-10 h-11 text-base border-gray-200 focus:ring-[#0078d4] rounded-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />

                    {searchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 shadow-xl rounded-sm z-50 overflow-hidden divide-y divide-gray-50">
                        {searchResults.map((p) => (
                          <button
                            key={p.id}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                            onClick={() => handlePatientSelect(p)}
                          >
                            <div>
                              <p className="text-sm font-bold text-gray-900">{p.name}</p>
                              <p className="text-[10px] text-gray-500">{p.phone} • {p.email || 'No email'}</p>
                            </div>
                            <UserCheck className="h-4 w-4 text-[#0078d4] opacity-0 group-hover:opacity-100" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    className="h-11 px-6 bg-[#0078d4] hover:bg-[#005a9e] text-white font-bold rounded-sm shadow-sm"
                    onClick={() => setShowAddPatient(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Walk-in
                  </Button>
                </div>

                {selectedPatient && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-sm flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-12 w-12 rounded-sm border-2 border-white shadow-sm">
                        <AvatarFallback className="bg-[#0078d4] text-white font-bold text-sm rounded-sm">
                          {getInitials(selectedPatient.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-0.5">
                        <p className="text-base font-bold text-gray-900">{selectedPatient.name}</p>
                        <div className="flex items-center space-x-3 text-[10px] text-gray-500 font-bold uppercase tracking-tight">
                          <span>{selectedPatient.phone}</span>
                          <span>•</span>
                          <span>{selectedPatient.email || "No Email"}</span>
                        </div>
                        <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest">Selected for Admission</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm" className="h-8 text-xs border-gray-200" onClick={() => setSelectedPatient(null)}>Cancel</Button>
                      <Button size="sm" className="h-8 text-xs bg-[#0078d4] text-white" onClick={() => setShowAddAppointment(true)}>Create Appointment</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Today's Schedule Pane */}
            <Card className="border-none shadow-sm bg-white overflow-hidden">
              <CardHeader className="pb-3 border-b border-gray-50 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-500 flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-[#0078d4]" />
                  Today's Expected Arrivals
                </CardTitle>
                <Badge variant="outline" className="rounded-sm border-gray-200 text-gray-500">{scheduledToday.length} Pending</Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-50">
                  {scheduledToday.length > 0 ? (
                    scheduledToday.map((appt) => (
                      <div key={appt.id} className="p-4 hover:bg-gray-50/50 transition-colors flex items-center justify-between group">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 text-center">
                            <p className="text-sm font-bold text-gray-900">{appt.time}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase">{appt.duration}m</p>
                          </div>
                          <div className="h-10 w-[2px] bg-blue-100 group-hover:bg-[#0078d4] transition-colors" />
                          <div>
                            <p className="text-sm font-bold text-gray-900">{appt.patient_name}</p>
                            <p className="text-[10px] text-gray-500 font-medium">{appt.appointment_type}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <div className="flex flex-col items-end gap-1.5">
                             {!appt.reception_fee_paid && !appt.reception_fee_waived ? (
                               <>
                                 <div className="flex items-center gap-1.5">
                                   <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[10px] font-bold uppercase border-green-200 text-green-700 hover:bg-green-50 rounded-sm"
                                    onClick={() => handlePayFee(appt)}
                                   >
                                     <CreditCard className="h-3 w-3 mr-1" /> Pay KSH {receptionFee}
                                   </Button>
                                 </div>
                                 {insuranceProviders.filter(p => p.pays_reception_fee).length > 0 && (
                                   <div className="flex flex-wrap justify-end gap-1 max-w-[200px]">
                                     {insuranceProviders.filter(p => p.pays_reception_fee).map(p => (
                                       <Button
                                         key={p.id}
                                         size="sm"
                                         variant="outline"
                                         className="h-6 px-2 text-[9px] font-bold uppercase tracking-wider border-purple-100 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-sm"
                                         onClick={() => handlePayFee(appt, "insurance", p.id)}
                                       >
                                         Use {p.name}
                                       </Button>
                                     ))}
                                   </div>
                                 )}
                               </>
                             ) : (
                               <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none text-[9px] font-bold uppercase px-2 h-5 rounded-sm">
                                 {appt.reception_fee_paid ? "Fee Paid" : "Fee Waived"}
                               </Badge>
                             )}
                          </div>
                          <Button
                            size="sm"
                            className="h-8 px-4 bg-[#0078d4] text-white font-bold text-xs rounded-sm opacity-90 hover:opacity-100"
                            onClick={() => handleAdmit(appt)}
                          >
                            Admit
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center">
                      <Calendar className="h-10 w-10 text-gray-100 mx-auto mb-3" />
                      <p className="text-sm text-gray-400 font-medium">No more scheduled arrivals for today.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Live Queue */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-none shadow-sm bg-white overflow-hidden h-full flex flex-col">
              <CardHeader className="pb-3 border-b border-gray-50">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-500 flex items-center">
                  <Users className="h-4 w-4 mr-2 text-green-600" />
                  Live Queue & Status
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-y-auto">
                <div className="p-4 space-y-4">
                  {/* In Consultation Section */}
                  <div>
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2 animate-pulse" />
                      In Consultation ({inQueue.filter(a => a.status === 'in_consultation').length})
                    </h4>
                    <div className="space-y-2">
                      {inQueue.filter(a => a.status === 'in_consultation').map(appt => (
                        <div key={appt.id} className="p-3 bg-green-50/50 border border-green-100 rounded-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-bold text-gray-900">{appt.patient_name}</p>
                              <p className="text-[10px] text-green-700 font-semibold uppercase">{appt.doctor_name || 'Assigned Doctor'}</p>
                            </div>
                            <Activity className="h-4 w-4 text-green-500" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Waiting Section */}
                  <div className="pt-2">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center">
                      <Clock className="h-3 w-3 mr-2 text-orange-400" />
                      Waiting Room ({inQueue.filter(a => a.status === 'admitted').length})
                    </h4>
                    <div className="space-y-2">
                      {inQueue.filter(a => a.status === 'admitted').map(appt => (
                        <div key={appt.id} className="p-3 bg-white border border-gray-100 rounded-sm shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm font-bold text-gray-900">{appt.patient_name}</p>
                              <p className="text-[10px] text-gray-500 font-medium">Checked in at {new Date(appt.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            <Badge variant="outline" className="text-[9px] font-bold border-orange-100 bg-orange-50 text-orange-600 px-1.5 h-5 rounded-sm">WAITING</Badge>
                          </div>
                        </div>
                      ))}
                      {inQueue.filter(a => a.status === 'admitted').length === 0 && (
                        <div className="py-6 text-center border border-dashed border-gray-100 rounded-sm">
                          <p className="text-[11px] text-gray-400 font-medium">No patients waiting.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Forms & Dialogs */}
      <Sheet open={showAddPatient} onOpenChange={setShowAddPatient}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Register New Patient</SheetTitle>
            <SheetDescription>Enter patient details for first-time registration.</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <PatientForm onSave={handleAddPatient} onCancel={() => setShowAddPatient(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={showAddAppointment} onOpenChange={setShowAddAppointment}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Admission Record</DialogTitle>
            <DialogDescription>Setup appointment for {selectedPatient?.name}</DialogDescription>
          </DialogHeader>
          {selectedPatient && (
            <AppointmentForm
              onSave={handleAddAppointment}
              onCancel={() => setShowAddAppointment(false)}
              patient={selectedPatient}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reception;
