import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Stethoscope,
  Users,
  Clock,
  Calendar,
  Search,
  Activity,
  ArrowRight,
  TrendingUp,
  UserCheck,
  Timer,
  ChevronRight,
} from "lucide-react";
import { dataManager, Appointment, Patient, Treatment } from "@/lib/dataManager";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { listen } from "@tauri-apps/api/event";
import { format, parseISO, subDays } from "date-fns";

const DoctorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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
    } catch (error) {
      console.error("Failed to load doctor dashboard data", error);
      toast.error("Failed to refresh dashboard");
    } finally {
      setIsLoading(false);
    }
  }, []);

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
  }, [loadData, navigate]);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const stats = useMemo(() => {
    const todayTreatments = treatments.filter(t => t.date === today && t.doctor_id === user?.id);
    const waitingPatients = appointments.filter(a => a.status === 'admitted').length;

    // Simple average consultation time calculation (mock logic based on duration if not available)
    const avgTime = todayTreatments.length > 0
      ? Math.round(todayTreatments.reduce((acc) => acc + 30, 0) / todayTreatments.length)
      : 0;

    return {
      served: todayTreatments.length,
      waiting: waitingPatients,
      avgTime: avgTime || 25,
      efficiency: 92
    };
  }, [treatments, appointments, today, user?.id]);

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

  const currentAppointment = useMemo(() => {
    return appointments.find(a =>
      a.status === 'in_consultation' && a.doctor_id === user?.id
    );
  }, [appointments, user?.id]);

  const handleCallPatient = async (appt: Appointment) => {
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
  };

  const handleCallNext = () => {
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
  };

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

  const weeklyTrend = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      const dateStr = d.toISOString().split("T")[0];
      const count = treatments.filter(t => t.date === dateStr).length;
      return { date: format(d, "EEE"), count };
    });
    return days;
  }, [treatments]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading Clinical Command Center...</div>;
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
            <h1 className="text-lg font-bold text-gray-900 leading-none">Clinical Command Center</h1>
            <p className="text-xs text-gray-500 font-medium mt-1">Dr. {user?.full_name} | {format(new Date(), "PPPP")}</p>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-8">
            <div className="text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Served Today</p>
              <p className="text-xl font-bold text-gray-900">{stats.served}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">In Queue</p>
              <p className="text-xl font-bold text-[#0078d4]">{stats.waiting}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Avg Consultation</p>
              <p className="text-xl font-bold text-gray-900">{stats.avgTime}m</p>
            </div>
          </div>
          <Button
            className="bg-[#0078d4] hover:bg-[#005a9e] text-white font-bold rounded-sm h-10 px-6 shadow-sm"
            onClick={handleCallNext}
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            Call Next (Alt+N)
          </Button>
        </div>
      </div>

      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        {/* Main Workbench Area */}
        <div className="lg:col-span-8 space-y-6 overflow-y-auto pr-2 custom-scrollbar">

          {/* Active Patient Hero */}
          {currentAppointment ? (
            <Card className="border-none shadow-sm bg-linear-to-r from-[#0078d4] to-[#005a9e] text-white overflow-hidden rounded-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-6">
                    <Avatar className="h-16 w-16 rounded-sm border-2 border-white/20 shadow-lg">
                      <AvatarFallback className="bg-white/10 text-white font-bold text-xl">
                        {getInitials(currentAppointment.patient_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <Badge className="bg-white/20 text-white border-none text-[10px] font-bold uppercase mb-1">Current Consultation</Badge>
                      <h2 className="text-2xl font-bold leading-tight">{currentAppointment.patient_name}</h2>
                      <div className="flex items-center space-x-4 text-xs font-medium opacity-90">
                        <span className="flex items-center"><Clock className="h-3.5 w-3.5 mr-1.5" /> Started at {format(parseISO(currentAppointment.updated_at), "p")}</span>
                        <span className="flex items-center"><Activity className="h-3.5 w-3.5 mr-1.5" /> {currentAppointment.appointment_type}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    className="bg-white text-[#0078d4] hover:bg-white/90 font-bold rounded-sm"
                    onClick={() => navigate(`/patients/${currentAppointment.patient_id}`)}
                  >
                    Open Patient Sheet
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
             <Card className="border-2 border-dashed border-gray-200 shadow-none bg-transparent rounded-sm">
                <CardContent className="p-12 text-center">
                   <div className="p-4 bg-gray-100 rounded-full w-fit mx-auto mb-4">
                      <Users className="h-8 w-8 text-gray-400" />
                   </div>
                   <h3 className="text-lg font-bold text-gray-900">No active consultation</h3>
                   <p className="text-sm text-gray-500 mt-1">Select a patient from the queue or click "Call Next" to begin.</p>
                </CardContent>
             </Card>
          )}

          {/* Double Pool Queue */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* My Queue */}
            <Card className="border-none shadow-sm bg-white rounded-sm">
              <CardHeader className="pb-3 border-b border-gray-50 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-500 flex items-center">
                  <UserCheck className="h-4 w-4 mr-2 text-[#0078d4]" />
                  Assigned to Me
                </CardTitle>
                <Badge variant="outline" className="rounded-sm border-[#0078d4]/20 text-[#0078d4] bg-blue-50 font-bold">{myQueue.length}</Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-50">
                  {myQueue.map((appt) => (
                    <div key={appt.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group">
                      <div className="flex items-center space-x-3">
                        <div className="text-center w-12">
                          <p className="text-xs font-bold text-gray-900">{appt.time}</p>
                          <p className="text-[9px] text-gray-400 font-bold uppercase">{appt.duration}m</p>
                        </div>
                        <div className="h-8 w-[2px] bg-blue-100 group-hover:bg-[#0078d4]" />
                        <div>
                          <p className="text-sm font-bold text-gray-900">{appt.patient_name}</p>
                          <p className="text-[10px] text-gray-500 font-medium">{appt.appointment_type}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-[#0078d4] hover:bg-blue-50 hover:text-[#005a9e]"
                        onClick={() => handleCallPatient(appt)}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </div>
                  ))}
                  {myQueue.length === 0 && (
                    <div className="p-8 text-center text-gray-400 text-xs font-medium">No assigned patients waiting.</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* General Pool */}
            <Card className="border-none shadow-sm bg-white rounded-sm">
              <CardHeader className="pb-3 border-b border-gray-50 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-500 flex items-center">
                  <Users className="h-4 w-4 mr-2 text-green-600" />
                  General Waiting Pool
                </CardTitle>
                <Badge variant="outline" className="rounded-sm border-gray-200 text-gray-500 font-bold">{generalPool.length}</Badge>
              </CardHeader>
              <CardContent className="p-0">
                 <div className="divide-y divide-gray-50">
                  {generalPool.map((appt) => (
                    <div key={appt.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group">
                      <div className="flex items-center space-x-3">
                        <div className="text-center w-12">
                          <p className="text-xs font-bold text-gray-900">{appt.time}</p>
                          <p className="text-[9px] text-gray-400 font-bold uppercase">{appt.duration}m</p>
                        </div>
                        <div className="h-8 w-[2px] bg-gray-100 group-hover:bg-green-500" />
                        <div>
                          <p className="text-sm font-bold text-gray-900">{appt.patient_name}</p>
                          <p className="text-[10px] text-gray-500 font-medium">{appt.appointment_type}</p>
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
                  {generalPool.length === 0 && (
                    <div className="p-8 text-center text-gray-400 text-xs font-medium">No general walk-ins waiting.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Sidebar Analytics & Search */}
        <div className="lg:col-span-4 space-y-6 overflow-y-auto custom-scrollbar">
          {/* Quick Search */}
          <Card className="border-none shadow-sm bg-white rounded-sm overflow-visible">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-500">Patient Lookup (Alt+S)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="patient-search"
                  placeholder="Search by name or phone..."
                  className="pl-10 h-10 text-sm border-gray-200 focus:ring-[#0078d4] rounded-sm"
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

          {/* Efficiency Analytics */}
          <Card className="border-none shadow-sm bg-white rounded-sm">
            <CardHeader className="pb-3 border-b border-gray-50">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-500 flex items-center">
                <TrendingUp className="h-4 w-4 mr-2 text-primary" />
                Patient Volume Trend
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-end justify-between h-32 px-2">
                {weeklyTrend.map((day, i) => (
                  <div key={i} className="flex flex-col items-center flex-1">
                    <div
                      className="w-4 bg-[#0078d4] rounded-t-sm transition-all duration-500 ease-out hover:bg-[#005a9e] relative group"
                      style={{ height: `${Math.max((day.count / Math.max(...weeklyTrend.map(d => d.count), 1)) * 100, 5)}%` }}
                    >
                       <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                          {day.count} Patients
                       </div>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-tighter">{day.date}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t border-gray-50">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center text-xs font-bold text-gray-500">
                       <Timer className="h-3.5 w-3.5 mr-1.5 text-orange-500" />
                       Efficiency Rating
                    </div>
                    <span className="text-sm font-black text-gray-900">{stats.efficiency}%</span>
                 </div>
                 <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2">
                    <div className="bg-orange-500 h-full rounded-full" style={{ width: `${stats.efficiency}%` }} />
                 </div>
              </div>
            </CardContent>
          </Card>

          {/* Today's Stats Cards */}
          <div className="grid grid-cols-2 gap-4">
             <Card className="border-none shadow-sm bg-white rounded-sm">
                <CardContent className="p-4">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Completed</p>
                   <p className="text-xl font-black text-gray-900 mt-1">{stats.served}</p>
                   <div className="flex items-center text-[9px] font-bold text-green-600 mt-1">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +12% vs LW
                   </div>
                </CardContent>
             </Card>
             <Card className="border-none shadow-sm bg-white rounded-sm">
                <CardContent className="p-4">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">In Queue</p>
                   <p className="text-xl font-black text-[#0078d4] mt-1">{stats.waiting}</p>
                   <div className="flex items-center text-[9px] font-bold text-[#0078d4] mt-1">
                      <Clock className="h-3 w-3 mr-1" />
                      ~{stats.waiting * 20}m total
                   </div>
                </CardContent>
             </Card>
          </div>

          {/* Schedule Summary */}
          <Card className="border-none shadow-sm bg-white rounded-sm">
            <CardHeader className="pb-3 border-b border-gray-50 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-500 flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-primary" />
                Remaining Schedule
              </CardTitle>
              <Link to="/appointments" className="text-[10px] font-bold text-[#0078d4] hover:underline uppercase">Full Calendar</Link>
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
                     <div className="p-8 text-center text-gray-400 text-[10px] font-medium uppercase italic">No more scheduled patients.</div>
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
