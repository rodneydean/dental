import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Plus,
  MoreVertical,
  Edit,
  Users,
  History as HistoryIcon,
  FileText,
  Trash2,
} from "lucide-react";
import PatientForm from "@/components/PatientForm";
import { dataManager, Patient } from "@/lib/dataManager";
import { calculateAge } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const Patients = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [showAllPatients, setShowAllPatients] = useState(user?.role !== "RECEPTION");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const patientsPerPage = 30;

  useEffect(() => {
    loadData();
  }, []);

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
      const loadedPatients = await dataManager.getPatients();
      setPatients(loadedPatients);
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

  const handleDeletePatient = async () => {
    if (!patientToDelete) return;

    try {
      await dataManager.deletePatient(patientToDelete.id);
      await loadData();
      setPatientToDelete(null);
      toast.success("Patient deleted successfully");
    } catch {
      toast.error("Failed to delete patient");
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
            <Button size="sm" onClick={() => setShowAddSheet(true)} className="bg-primary hover:bg-primary/90 text-white rounded-sm">
              <Plus className="h-4 w-4 mr-2" />
              Add New Patient
            </Button>
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

      {/* Patients List Table */}
      <div className="border border-gray-200 rounded-sm overflow-hidden bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
              <TableHead className="w-[60px] py-3 px-4">Avatar</TableHead>
              <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Name</TableHead>
              <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Age</TableHead>
              <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Phone</TableHead>
              <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Email</TableHead>
              <TableHead className="py-3 px-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentPatients.map((patient) => (
              <TableRow
                key={patient.id}
                className="cursor-pointer hover:bg-gray-50/80 transition-colors border-b border-gray-100 last:border-0"
                onClick={() => navigate(`/patients/${patient.id}`)}
              >
                <TableCell className="py-2.5 px-4">
                  <Avatar className="h-8 w-8 rounded-sm">
                    <AvatarFallback className="bg-blue-50 text-primary font-semibold text-[10px] rounded-sm">
                      {getPatientInitials(patient.name)}
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell className="py-2.5 px-4 font-medium text-gray-900 text-sm">
                  {patient.name}
                </TableCell>
                <TableCell className="py-2.5 px-4 text-gray-600 text-sm">
                  {calculateAge(patient.date_of_birth)}
                </TableCell>
                <TableCell className="py-2.5 px-4 text-gray-600 text-sm">
                  {patient.phone || <span className="text-gray-400 italic">No phone</span>}
                </TableCell>
                <TableCell className="py-2.5 px-4 text-gray-600 text-sm">
                  {patient.email || <span className="text-gray-400 italic">No email</span>}
                </TableCell>
                <TableCell className="py-2.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-primary"
                      onClick={() => navigate(`/patients/${patient.id}`)}
                      title="View Records"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/patients/${patient.id}`)}>
                            <HistoryIcon className="h-4 w-4 mr-2" />
                          Clinical History
                        </DropdownMenuItem>
                        {(user?.role === "DOCTOR" || user?.role === "ADMIN") && (
                          <>
                            <DropdownMenuItem onClick={() => setEditingPatient(patient)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Details
                            </DropdownMenuItem>
                            {user?.role === "ADMIN" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={() => setPatientToDelete(patient)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Patient
                                </DropdownMenuItem>
                              </>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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


      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!patientToDelete}
        onOpenChange={(open) => !open && setPatientToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the record for{" "}
              <span className="font-semibold">{patientToDelete?.name}</span>.
              This action cannot be undone and will be synced across all connected devices.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePatient}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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