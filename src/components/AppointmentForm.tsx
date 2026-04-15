import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { dataManager, Patient, Appointment } from "@/lib/dataManager";
import { invoke } from "@tauri-apps/api/core";

interface User {
  id: string;
  full_name: string;
  role: string;
}

interface AppointmentFormProps {
  appointment?: Appointment;
  onSave: (appointment: Omit<Appointment, "id" | "created_at" | "updated_at">) => void;
  onCancel: () => void;
}

const appointmentTypes = [
  "Routine Cleaning",
  "Dental Examination",
  "Filling",
  "Root Canal",
  "Crown/Bridge",
  "Tooth Extraction",
  "Orthodontic Consultation",
  "Teeth Whitening",
  "Emergency Visit",
  "Follow-up",
];

const timeSlots = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
];

const AppointmentForm = ({
  appointment,
  onSave,
  onCancel,
}: AppointmentFormProps) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [formData, setFormData] = useState({
    patient_id: appointment?.patient_id || "",
    patient_name: appointment?.patient_name || "",
    doctor_id: appointment?.doctor_id || "",
    doctor_name: appointment?.doctor_name || "",
    date: appointment?.date || "",
    time: appointment?.time || "",
    status: appointment?.status || "scheduled",
    appointment_type: appointment?.appointment_type || "",
    notes: appointment?.notes || "",
    duration: appointment?.duration || 30,
    reception_fee_paid: appointment?.reception_fee_paid || false,
    reception_fee_waived: appointment?.reception_fee_waived || false,
  });

  useEffect(() => {
    const loadData = async () => {
        const [pts, users] = await Promise.all([
          dataManager.getPatients(),
          invoke<User[]>("list_users")
        ]);
        setPatients(pts);
        setDoctors(users.filter(u => u.role === 'DOCTOR'));
    };
    loadData();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.patient_id ||
      !formData.date ||
      !formData.time ||
      !formData.appointment_type ||
      !formData.doctor_id
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    onSave(formData);
  };

  const handlePatientChange = (patient_id: string) => {
    const selectedPatient = patients.find((p) => p.id === patient_id);
    setFormData((prev) => ({
      ...prev,
      patient_id,
      patient_name: selectedPatient?.name || "",
    }));
  };

  const handleDoctorChange = (doctor_id: string) => {
    const selectedDoctor = doctors.find((d) => d.id === doctor_id);
    setFormData((prev) => ({
      ...prev,
      doctor_id,
      doctor_name: selectedDoctor?.full_name || "",
    }));
  };

  const handleChange = (
    field: string,
    value: string | number
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="patient" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Patient *</Label>
          <Select value={formData.patient_id} onValueChange={handlePatientChange}>
            <SelectTrigger className="h-9 text-sm rounded-sm border-gray-200">
              <SelectValue placeholder="Select a patient" />
            </SelectTrigger>
            <SelectContent>
              {patients.map((patient) => (
                <SelectItem key={patient.id} value={patient.id}>
                  {patient.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="doctor" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Doctor *</Label>
          <Select value={formData.doctor_id} onValueChange={handleDoctorChange}>
            <SelectTrigger className="h-9 text-sm rounded-sm border-gray-200">
              <SelectValue placeholder="Select a doctor" />
            </SelectTrigger>
            <SelectContent>
              {doctors.map((doctor) => (
                <SelectItem key={doctor.id} value={doctor.id}>
                  {doctor.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="date" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Date *</Label>
          <Input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => handleChange("date", e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="h-9 text-sm rounded-sm border-gray-200"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="time" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Time *</Label>
          <Select
            value={formData.time}
            onValueChange={(value) => handleChange("time", value)}
          >
            <SelectTrigger className="h-9 text-sm rounded-sm border-gray-200">
              <SelectValue placeholder="Select time" />
            </SelectTrigger>
            <SelectContent>
              {timeSlots.map((time) => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="appointment_type" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Type *</Label>
          <Select
            value={formData.appointment_type}
            onValueChange={(value) => handleChange("appointment_type", value)}
          >
            <SelectTrigger className="h-9 text-sm rounded-sm border-gray-200">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {appointmentTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="duration" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Duration</Label>
          <Select
            value={formData.duration.toString()}
            onValueChange={(value) => handleChange("duration", parseInt(value))}
          >
            <SelectTrigger className="h-9 text-sm rounded-sm border-gray-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 minutes</SelectItem>
              <SelectItem value="30">30 minutes</SelectItem>
              <SelectItem value="45">45 minutes</SelectItem>
              <SelectItem value="60">1 hour</SelectItem>
              <SelectItem value="90">1.5 hours</SelectItem>
              <SelectItem value="120">2 hours</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {appointment && (
        <div className="space-y-1.5">
          <Label htmlFor="status" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) =>
              handleChange("status", value)
            }
          >
            <SelectTrigger className="h-9 text-sm rounded-sm border-gray-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="admitted">Admitted</SelectItem>
              <SelectItem value="in_consultation">In Consultation</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="notes" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          placeholder="Additional notes or special instructions..."
          rows={2}
          className="text-sm rounded-sm border-gray-200"
        />
      </div>

      <div className="flex space-x-3 pt-2">
        <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-sm h-9 text-sm font-semibold">
          {appointment ? "Update Appointment" : "Schedule Appointment"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1 rounded-sm h-9 text-sm font-semibold border-gray-200"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
};

export default AppointmentForm;
