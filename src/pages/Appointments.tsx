import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  MoreVertical,
  Edit,
  Trash2,
  Filter,
  CalendarDays,
  Download,
  User,
  Search,
  Stethoscope,
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
import { Input } from "@/components/ui/input";
import AppointmentForm from "@/components/AppointmentForm";
import TreatmentForm from "@/components/TreatmentForm";
import { dataManager, Appointment, Treatment } from "@/lib/dataManager";
import { pdfGenerator } from "@/lib/pdfGenerator";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { listen } from "@tauri-apps/api/event";

const Appointments = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [recordingTreatmentFor, setRecordingTreatmentFor] = useState<Appointment | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  const loadAppointments = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
        const loadedAppointments = await dataManager.getAppointments();
        setAppointments(loadedAppointments);
    } catch {
        toast.error("Failed to load appointments");
    } finally {
        if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      unlisten = await listen("sync-event", (event: { payload: { type: string } }) => {
        if (event.payload?.type === "appointment") {
          loadAppointments(false);
          toast.info("Schedule updated");
        }
      });
    };

    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, [loadAppointments]);

  const handleAddAppointment = async (
    appointmentData: Omit<Appointment, "id" | "created_at" | "updated_at">
  ) => {
    try {
      await dataManager.addAppointment(appointmentData);
      await loadAppointments();
      setShowAddDialog(false);
      toast.success("Appointment scheduled successfully");
    } catch {
      toast.error("Failed to schedule appointment");
    }
  };

  const handleEditAppointment = async (
    appointmentData: Omit<Appointment, "id" | "created_at" | "updated_at">
  ) => {
    if (!editingAppointment) return;

    try {
      await dataManager.updateAppointment(editingAppointment.id, appointmentData);
      await loadAppointments();
      setEditingAppointment(null);
      toast.success("Appointment updated successfully");
    } catch {
      toast.error("Failed to update appointment");
    }
  };

  const handleRecordTreatment = async (
    treatmentData: Omit<Treatment, "id" | "created_at" | "updated_at">
  ) => {
    try {
      await dataManager.addTreatment(treatmentData);
      // Update appointment status to completed when treatment is recorded
      if (recordingTreatmentFor) {
        await dataManager.updateAppointment(recordingTreatmentFor.id, {
          status: "completed"
        });
      }
      await loadAppointments();
      setRecordingTreatmentFor(null);
      toast.success("Treatment recorded and appointment completed");
    } catch {
      toast.error("Failed to record treatment");
      throw new Error("Failed to record treatment");
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;

    try {
      await dataManager.deleteAppointment(id);
      await loadAppointments();
      toast.success("Appointment cancelled successfully");
    } catch {
      toast.error("Failed to cancel appointment");
    }
  };

  const filteredAppointments = appointments.filter((apt) => {
    const matchesSearch =
      apt.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.appointment_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || apt.status === filterStatus;
    return matchesSearch && matchesStatus;
  });


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Appointments</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage patient schedule and visits</p>
        </div>
        {(user?.role === "RECEPTION" || user?.role === "DOCTOR") && (
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-white rounded-sm">
                <Plus className="h-4 w-4 mr-2" />
                New Appointment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Schedule Appointment</DialogTitle>
                <DialogDescription>
                  Choose a patient and pick a time slot.
                </DialogDescription>
              </DialogHeader>
              <AppointmentForm
                onSave={handleAddAppointment}
                onCancel={() => setShowAddDialog(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-3.5 w-3.5" />
          <Input
            placeholder="Search by patient or procedure..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-sm rounded-sm border-gray-200"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="h-3.5 w-3.5 text-gray-400" />
          <div className="flex bg-gray-100 p-1 rounded-sm border border-gray-200">
            {["all", "scheduled", "completed", "cancelled"].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-sm transition-all ${
                  filterStatus === status
                    ? "bg-white text-primary shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Appointments List */}
      <div className="grid grid-cols-1 gap-3">
        {isLoading ? (
           <div className="text-center py-12 text-sm text-gray-500">Loading appointments...</div>
        ) : filteredAppointments.length > 0 ? (
          filteredAppointments
            .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime())
            .map((apt) => (
              <Card
                key={apt.id}
                className="border border-gray-200 shadow-sm hover:border-primary/50 transition-colors bg-white overflow-hidden rounded-sm"
              >
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    <div className="md:w-40 bg-gray-50 p-4 flex flex-col justify-center items-center border-r border-gray-100">
                      <div className="flex items-center text-primary/70 mb-0.5">
                        <CalendarIcon className="h-3.5 w-3.5 mr-2" />
                        <span className="text-xs font-semibold">{apt.date}</span>
                      </div>
                      <div className="flex items-center text-gray-900">
                        <Clock className="h-3.5 w-3.5 mr-2 text-gray-400" />
                        <span className="text-base font-bold">{apt.time}</span>
                      </div>
                      <span className="text-[10px] font-medium text-gray-400 mt-0.5 uppercase tracking-wider">
                        {apt.duration} MIN
                      </span>
                    </div>

                    <div className="flex-1 p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-blue-50 rounded-sm text-primary">
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900">
                            {apt.patient_name}
                          </h3>
                          <p className="text-xs text-gray-500 flex items-center mt-0.5">
                            {apt.appointment_type}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="hidden lg:block text-right">
                          <p className="text-[9px] text-gray-400 uppercase font-bold tracking-widest mb-1">
                            Status
                          </p>
                          <Badge variant="outline" className={`text-[10px] font-semibold px-2 py-0 h-5 rounded-sm ${
                            apt.status === 'scheduled' ? 'border-blue-200 bg-blue-50 text-blue-700' :
                            apt.status === 'completed' ? 'border-green-200 bg-green-50 text-green-700' :
                            'border-red-200 bg-red-50 text-red-700'
                          }`}>
                            {apt.status.toUpperCase()}
                          </Badge>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4 text-gray-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => setEditingAppointment(apt)}
                              className="cursor-pointer"
                            >
                              <Edit className="h-4 w-4 mr-2" /> Edit Appointment
                            </DropdownMenuItem>
                            {user?.role === "DOCTOR" && apt.status !== "completed" && apt.status !== "cancelled" && (
                              <DropdownMenuItem
                                onClick={() => setRecordingTreatmentFor(apt)}
                                className="cursor-pointer"
                              >
                                <Stethoscope className="h-4 w-4 mr-2" /> Record Treatment
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={async () => {
                                await pdfGenerator.generateAppointmentCard(apt);
                                toast.success("Appointment card downloaded");
                              }}
                              className="cursor-pointer"
                            >
                              <Download className="h-4 w-4 mr-2" /> Download Card
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteAppointment(apt.id)}
                              className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Cancel Appointment
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                  {apt.notes && (
                    <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100 text-sm text-gray-500 italic">
                      Note: {apt.notes}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
        ) : (
          <Card className="border-0 shadow-lg">
            <CardContent className="text-center py-20">
              <CalendarDays className="h-16 w-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                No appointments found
              </h3>
              <p className="text-gray-500 max-w-xs mx-auto">
                {searchTerm || filterStatus !== "all"
                  ? "Try adjusting your filters to find what you're looking for."
                  : "Start by scheduling your first patient appointment."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Appointment Dialog */}
      <Dialog
        open={!!editingAppointment}
        onOpenChange={() => setEditingAppointment(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Appointment</DialogTitle>
          </DialogHeader>
          {editingAppointment && (
            <AppointmentForm
              appointment={editingAppointment}
              onSave={handleEditAppointment}
              onCancel={() => setEditingAppointment(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Record Treatment Dialog */}
      <Dialog
        open={!!recordingTreatmentFor}
        onOpenChange={() => setRecordingTreatmentFor(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Treatment</DialogTitle>
            <DialogDescription>
              Record clinical findings for {recordingTreatmentFor?.patient_name}.
            </DialogDescription>
          </DialogHeader>
          {recordingTreatmentFor && (
            <TreatmentForm
              treatment={{
                id: "",
                patient_id: recordingTreatmentFor.patient_id,
                patient_name: recordingTreatmentFor.patient_name,
                appointment_id: recordingTreatmentFor.id,
                date: recordingTreatmentFor.date,
                diagnosis: "",
                treatment: recordingTreatmentFor.appointment_type,
                medications: [],
                notes: "",
                follow_up_date: "",
                cost: 0,
                created_at: "",
                updated_at: "",
              }}
              onSave={handleRecordTreatment}
              onCancel={() => setRecordingTreatmentFor(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Appointments;
