import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  CheckCircle2,
  XCircle,
  CalendarDays,
  User,
  Search,
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
import { dataManager, Appointment } from "@/lib/dataManager";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const Appointments = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    setIsLoading(true);
    try {
        const loadedAppointments = await dataManager.getAppointments();
        setAppointments(loadedAppointments);
    } catch (error) {
        toast.error("Failed to load appointments");
    } finally {
        setIsLoading(false);
    }
  };

  const handleAddAppointment = async (
    appointmentData: Omit<Appointment, "id" | "created_at" | "updated_at">
  ) => {
    try {
      await dataManager.addAppointment(appointmentData);
      await loadAppointments();
      setShowAddDialog(false);
      toast.success("Appointment scheduled successfully");
    } catch (error) {
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
    } catch (error) {
      toast.error("Failed to update appointment");
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;

    try {
      await dataManager.deleteAppointment(id);
      await loadAppointments();
      toast.success("Appointment cancelled successfully");
    } catch (error) {
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200">
            <Clock className="h-3 w-3 mr-1" /> Scheduled
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Completed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200">
            <XCircle className="h-3 w-3 mr-1" /> Cancelled
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Appointments</h1>
          <p className="text-gray-600 mt-1">Manage patient schedule and visits</p>
        </div>
        {user?.role === "RECEPTION" && (
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg text-white">
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
      <Card className="border-0 shadow-lg">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by patient or type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <div className="flex bg-gray-100 p-1 rounded-lg">
                {["all", "scheduled", "completed", "cancelled"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      filterStatus === status
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <span className="capitalize">{status}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appointments List */}
      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
           <div className="text-center py-12">Loading appointments...</div>
        ) : filteredAppointments.length > 0 ? (
          filteredAppointments
            .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime())
            .map((apt) => (
              <Card
                key={apt.id}
                className="border-0 shadow-md hover:shadow-lg transition-shadow bg-white overflow-hidden group"
              >
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    <div className="md:w-48 bg-gray-50 p-4 flex flex-col justify-center items-center border-r border-gray-100">
                      <div className="flex items-center text-blue-600 mb-1">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        <span className="font-bold">{apt.date}</span>
                      </div>
                      <div className="flex items-center text-gray-900">
                        <Clock className="h-4 w-4 mr-2" />
                        <span className="text-lg font-bold">{apt.time}</span>
                      </div>
                      <span className="text-xs text-gray-500 mt-1">
                        {apt.duration} minutes
                      </span>
                    </div>

                    <div className="flex-1 p-6 flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 bg-blue-50 rounded-full text-blue-600">
                          <User className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">
                            {apt.patient_name}
                          </h3>
                          <p className="text-gray-600 flex items-center mt-1">
                            <span className="w-2 h-2 bg-blue-400 rounded-full mr-2" />
                            {apt.appointment_type}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6">
                        <div className="hidden lg:block text-right">
                          <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">
                            Status
                          </p>
                          {getStatusBadge(apt.status)}
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-5 w-5 text-gray-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => setEditingAppointment(apt)}
                              className="cursor-pointer"
                            >
                              <Edit className="h-4 w-4 mr-2" /> Edit Appointment
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
    </div>
  );
};

export default Appointments;
