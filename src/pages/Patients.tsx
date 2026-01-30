import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Trash2,
  Phone,
  Mail,
  Calendar,
  AlertTriangle,
  Users,
  UserPlus,
  Filter,
} from "lucide-react";
import PatientForm from "@/components/PatientForm";
import { dataManager, Patient } from "@/lib/dataManager";
import { toast } from "sonner";

const Patients = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);

  useEffect(() => {
    loadPatients();
  }, []);

  useEffect(() => {
    const filtered = patients.filter(
      (patient) =>
        patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.phone.includes(searchTerm)
    );
    setFilteredPatients(filtered);
  }, [patients, searchTerm]);

  const loadPatients = () => {
    const loadedPatients = dataManager.getPatients();
    setPatients(loadedPatients);
  };

  const handleAddPatient = (
    patientData: Omit<Patient, "id" | "createdAt" | "updatedAt">
  ) => {
    try {
      dataManager.addPatient(patientData);
      loadPatients();
      setShowAddDialog(false);
      toast.success("Patient added successfully");
    } catch (error) {
      console.log(error);
      toast.error("Failed to add patient");
    }
  };

  const handleEditPatient = (
    patientData: Omit<Patient, "id" | "createdAt" | "updatedAt">
  ) => {
    if (!editingPatient) return;

    try {
      dataManager.updatePatient(editingPatient.id, patientData);
      loadPatients();
      setEditingPatient(null);
      toast.success("Patient updated successfully");
    } catch (error) {
      console.log(error);
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

  const calculateAge = (dateOfBirth: string) => {
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

  const getNewPatientsCount = () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return patients.filter(
      (patient) => new Date(patient.createdAt) > thirtyDaysAgo
    ).length;
  };

  const getPatientsWithAllergies = () => {
    return patients.filter(
      (patient) => patient.allergies && patient.allergies.trim() !== ""
    ).length;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Patient Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage patient records and information
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg">
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
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg bg-linear-to-br from-blue-50 to-blue-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">
                  Total Patients
                </p>
                <p className="text-3xl font-bold text-blue-900">
                  {patients.length}
                </p>
              </div>
              <div className="p-3 bg-blue-200 rounded-full">
                <Users className="h-6 w-6 text-blue-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-linear-to-br from-green-50 to-green-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">
                  New This Month
                </p>
                <p className="text-3xl font-bold text-green-900">
                  {getNewPatientsCount()}
                </p>
              </div>
              <div className="p-3 bg-green-200 rounded-full">
                <UserPlus className="h-6 w-6 text-green-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-linear-to-br from-orange-50 to-orange-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-600 text-sm font-medium">
                  With Allergies
                </p>
                <p className="text-3xl font-bold text-orange-900">
                  {getPatientsWithAllergies()}
                </p>
              </div>
              <div className="p-3 bg-orange-200 rounded-full">
                <AlertTriangle className="h-6 w-6 text-orange-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-linear-to-br from-purple-50 to-purple-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium">
                  Active Records
                </p>
                <p className="text-3xl font-bold text-purple-900">
                  {patients.length}
                </p>
              </div>
              <div className="p-3 bg-purple-200 rounded-full">
                <Filter className="h-6 w-6 text-purple-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="border-0 shadow-lg">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search patients by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPatients.map((patient) => (
          <Card
            key={patient.id}
            className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white"
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src="" alt={patient.name} />
                    <AvatarFallback className="bg-linear-to-br from-blue-500 to-indigo-600 text-white font-semibold">
                      {getPatientInitials(patient.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg text-gray-900">
                      {patient.name}
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      Age: {calculateAge(patient.dateOfBirth)}
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
                    <DropdownMenuItem
                      onClick={() => setEditingPatient(patient)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="h-4 w-4 mr-2 text-blue-500" />
                  {patient.phone}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="h-4 w-4 mr-2 text-green-500" />
                  {patient.email}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="h-4 w-4 mr-2 text-purple-500" />
                  Born: {formatDate(patient.dateOfBirth)}
                </div>
              </div>

              {patient.allergies && (
                <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                  <div className="flex items-center text-red-700 mb-1">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    <span className="font-medium text-sm">Allergies</span>
                  </div>
                  <p className="text-sm text-red-600">{patient.allergies}</p>
                </div>
              )}

              {patient.medicalHistory && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <p className="text-sm text-blue-700 font-medium mb-1">
                    Medical History
                  </p>
                  <p className="text-sm text-blue-600 line-clamp-2">
                    {patient.medicalHistory}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <Badge variant="secondary" className="text-xs">
                  Patient ID: {patient.id.slice(-6)}
                </Badge>
                <span className="text-xs text-gray-500">
                  Added: {formatDate(patient.createdAt)}
                </span>
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
            {!searchTerm && (
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

      {/* Edit Patient Dialog */}
      <Dialog
        open={!!editingPatient}
        onOpenChange={() => setEditingPatient(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Patient</DialogTitle>
            <DialogDescription>
              Update the patient's information.
            </DialogDescription>
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
