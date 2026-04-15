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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
} from "lucide-react";
import PatientForm from "@/components/PatientForm";
import { dataManager, Patient, Appointment, Treatment } from "@/lib/dataManager";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const Patients = () => {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [viewingHistory, setViewingHistory] = useState<Patient | null>(null);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const filtered = patients.filter(
      (patient) =>
        patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (patient.email && patient.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (patient.phone && patient.phone.includes(searchTerm))
    );
    setFilteredPatients(filtered);
  }, [patients, searchTerm]);

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
      setShowAddDialog(false);
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

  const calculateAge = (dateOfBirth: string | undefined) => {
    if (!dateOfBirth) return "N/A";
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {user?.role === "DOCTOR" ? "Patient Records" : "Patient Management"}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {user?.role === "DOCTOR" ? "View and manage clinical patient data" : "Manage patient registrations and contacts"}
          </p>
        </div>
        {user?.role === "RECEPTION" && (
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-white rounded-sm">
                <Plus className="h-4 w-4 mr-2" />
                Add New Patient
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Patient</DialogTitle>
                <DialogDescription>
                  Enter the patient's information to create a new record.
                </DialogDescription>
              </DialogHeader>
              <PatientForm onSave={handleAddPatient} onCancel={()=>{}} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search */}
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
      </div>

      {/* Patients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPatients.map((patient) => (
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
                    {user?.role === "RECEPTION" && (
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
            {!searchTerm && user?.role === "RECEPTION" && (
              <Button
                onClick={() => setShowAddDialog(true)}
                className="bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Patient
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* History Dialog */}
      <Dialog open={!!viewingHistory} onOpenChange={() => setViewingHistory(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Clinical History: {viewingHistory?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            
            <div className="bg-blue-50 p-4 rounded-xl">
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Medical Alerts
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-blue-700 uppercase">Allergies</p>
                  <p className="text-sm text-blue-900">{viewingHistory?.allergies || "None reported"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-blue-700 uppercase">Chronic Conditions</p>
                  <p className="text-sm text-blue-900">{viewingHistory?.medical_history || "None reported"}</p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Patient Dialog */}
      <Dialog
        open={!!editingPatient}
        onOpenChange={() => setEditingPatient(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Patient</DialogTitle>
          </DialogHeader>
          {editingPatient && (
            <PatientForm
              patient={editingPatient}
              onSave={handleEditPatient}
              onCancel={()=>{}}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Patients;
