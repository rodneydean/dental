import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, parseISO, isValid, startOfToday } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Pill, DollarSign, Briefcase, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { dataManager, Patient, Appointment, Treatment, Medication, Service, InsuranceProvider } from "@/lib/dataManager";
import { calculateAge } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface TreatmentFormProps {
  treatment?: Treatment;
  onSave: (treatment: Omit<Treatment, "id" | "created_at" | "updated_at">) => Promise<void>;
  onCancel: () => void;
}

const frequencies = [
  "Once daily",
  "Twice daily",
  "Three times daily",
  "Four times daily",
  "Every 4 hours",
  "Every 6 hours",
  "Every 8 hours",
  "As needed",
  "Before meals",
  "After meals",
];

const TreatmentForm = ({ treatment, onSave, onCancel }: TreatmentFormProps) => {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [insuranceProviders, setInsuranceProviders] = useState<InsuranceProvider[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "insurance">("cash");
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [formData, setFormData] = useState<Omit<Treatment, "id" | "created_at" | "updated_at">>({
    patient_id: treatment?.patient_id || "",
    patient_name: treatment?.patient_name || "",
    appointment_id: treatment?.appointment_id || "",
    date: treatment?.date || new Date().toISOString().split("T")[0],
    diagnosis: treatment?.diagnosis || "",
    treatment: treatment?.treatment || "",
    medications: treatment?.medications || [],
    notes: treatment?.notes || "",
    follow_up_date: treatment?.follow_up_date || "",
    cost: treatment?.cost || 0,
  });

  useEffect(() => {
    const loadOptions = async () => {
        const [pts, apts, svcs, providers] = await Promise.all([
            dataManager.getPatients(),
            dataManager.getAppointments(),
            dataManager.getServices(),
            dataManager.getInsuranceProviders()
        ]);
        setPatients(pts);
        setAppointments(apts);
        setServices(svcs);
        setInsuranceProviders(providers);
    };
    loadOptions();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.patient_id || !formData.diagnosis || !formData.treatment) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const submissionData = {
        ...formData,
        appointment_id: formData.appointment_id || undefined,
        doctor_id: treatment?.doctor_id || user?.id,
        doctor_name: treatment?.doctor_name || user?.full_name,
      };

      await onSave(submissionData);

      // Create a pending payment if there's a cost
      if (formData.cost > 0) {
        try {
          await dataManager.addPayment({
            patient_id: formData.patient_id,
            patient_name: formData.patient_name,
            amount: formData.cost,
            date: formData.date,
            method: paymentMethod,
            insurance_provider_id: paymentMethod === "insurance" ? selectedProviderId : undefined,
            status: "pending",
            notes: `Service Fee for Treatment: ${formData.diagnosis}`,
          });
        } catch (error) {
          console.error("Failed to create pending payment", error);
        }
      }
    } catch (error) {
      console.error("Form submission failed", error);
      // Let the parent handle specific error messaging if needed,
      // but we shouldn't show success here if it failed.
    }
  };

  const handlePatientChange = (patient_id: string) => {
    const selectedPatient = patients.find((p) => p.id === patient_id);
    setFormData((prev) => ({
      ...prev,
      patient_id,
      patient_name: selectedPatient?.name || "",
      appointment_id: "",
    }));
  };

  const handleAppointmentChange = (appointment_id: string) => {
    const selectedAppointment = appointments.find(
      (a) => a.id === appointment_id
    );
    setFormData((prev) => ({
      ...prev,
      appointment_id,
      date: selectedAppointment?.date || prev.date,
    }));
  };

  const handleServiceChange = (serviceName: string) => {
    const selectedService = services.find(s => s.name === serviceName);
    if (selectedService) {
      setFormData(prev => ({
        ...prev,
        treatment: selectedService.name,
        cost: selectedService.standard_fee,
      }));
    }
  };

  const addMedication = () => {
    setFormData((prev) => ({
      ...prev,
      medications: [
        ...prev.medications,
        {
          id: crypto.randomUUID(),
          name: "",
          dosage: "",
          frequency: "",
          duration: "",
          instructions: "",
        },
      ],
    }));
  };

  const removeMedication = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index),
    }));
  };

  const updateMedication = (
    index: number,
    field: keyof Medication,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      medications: prev.medications.map((med, i) =>
        i === index ? { ...med, [field]: value } : med
      ),
    }));
  };

  const patientAppointments = appointments.filter(
    (a) => a.patient_id === formData.patient_id
  );

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setFormData((prev) => ({ ...prev, date: format(date, "yyyy-MM-dd") }));
    }
  };

  const handleFollowUpDateChange = (date: Date | undefined) => {
    if (date) {
      setFormData((prev) => ({ ...prev, follow_up_date: format(date, "yyyy-MM-dd") }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Patient and Appointment Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="patient" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Patient *</Label>
          <Select
            value={formData.patient_id}
            onValueChange={handlePatientChange}
          >
            <SelectTrigger className="h-9 text-sm rounded-sm border-gray-200">
              <SelectValue placeholder="Select a patient" />
            </SelectTrigger>
            <SelectContent>
              {patients.map((patient) => (
                <SelectItem key={patient.id} value={patient.id}>
                  {patient.name} ({calculateAge(patient.date_of_birth)} yrs) - {patient.phone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="appointment" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Related Appointment</Label>
          <Select
            value={formData.appointment_id}
            onValueChange={handleAppointmentChange}
            disabled={!formData.patient_id}
          >
            <SelectTrigger className="h-9 text-sm rounded-sm border-gray-200">
              <SelectValue placeholder="Select appointment (optional)" />
            </SelectTrigger>
            <SelectContent>
              {patientAppointments.map((appointment) => (
                <SelectItem key={appointment.id} value={appointment.id}>
                  {appointment.date} - {appointment.appointment_type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Treatment Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="service" className="flex items-center text-xs font-semibold uppercase tracking-wider text-gray-500">
            <Briefcase className="h-3 w-3 mr-1 text-primary" />
            Select Service (Autofills Treatment & Fee)
          </Label>
          <Select onValueChange={handleServiceChange}>
            <SelectTrigger className="h-9 text-sm rounded-sm border-gray-200">
              <SelectValue placeholder="Select a service" />
            </SelectTrigger>
            <SelectContent>
              {services.map((service) => (
                <SelectItem key={service.id} value={service.name}>
                  {service.name} (KSH {service.standard_fee.toLocaleString()})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="date" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Treatment Date *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal h-9 text-sm rounded-sm border-gray-200",
                  !formData.date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.date && isValid(parseISO(formData.date)) ? (
                  format(parseISO(formData.date), "PPP")
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={formData.date && isValid(parseISO(formData.date)) ? parseISO(formData.date) : undefined}
                onSelect={handleDateChange}
                disabled={(date) =>
                  date > new Date()
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cost" className="flex items-center text-xs font-semibold uppercase tracking-wider text-gray-500">
            <DollarSign className="h-3 w-3 mr-1 text-green-600" />
            Service Fee / Cost (KSH)
          </Label>
          <Input
            id="cost"
            type="number"
            step="0.01"
            min="0"
            value={formData.cost}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                cost: parseFloat(e.target.value) || 0,
              }))
            }
            placeholder="0.00"
            className="h-9 text-sm rounded-sm border-gray-200"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Payment Method</Label>
          <Select
            value={paymentMethod}
            onValueChange={(value: "cash" | "insurance") => setPaymentMethod(value)}
          >
            <SelectTrigger className="h-9 text-sm rounded-sm border-gray-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="insurance">Insurance</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {paymentMethod === "insurance" && (
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Insurance Provider</Label>
            <Select
              value={selectedProviderId}
              onValueChange={setSelectedProviderId}
            >
              <SelectTrigger className="h-9 text-sm rounded-sm border-gray-200">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {insuranceProviders.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="diagnosis" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Diagnosis *</Label>
        <Textarea
          id="diagnosis"
          value={formData.diagnosis}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, diagnosis: e.target.value }))
          }
          placeholder="Enter patient diagnosis..."
          rows={2}
          className="text-sm rounded-sm border-gray-200"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="treatment" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Treatment Performed *</Label>
        <Textarea
          id="treatment"
          value={formData.treatment}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, treatment: e.target.value }))
          }
          placeholder="Describe the treatment performed..."
          rows={2}
          className="text-sm rounded-sm border-gray-200"
          required
        />
      </div>

      {/* Medications Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <Label className="text-xs font-bold uppercase tracking-widest text-gray-900">
            Prescribed Medications
          </Label>
          <Button
            type="button"
            onClick={addMedication}
            variant="outline"
            size="sm"
            className="h-7 text-[10px] font-bold uppercase tracking-wider rounded-sm border-gray-200"
          >
            <Plus className="h-3 w-3 mr-1.5" />
            Add Medication
          </Button>
        </div>

        {formData.medications.length === 0 ? (
          <div className="text-center py-6 text-gray-400 bg-gray-50 border border-gray-100 rounded-sm">
            <Pill className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-[10px] font-medium uppercase tracking-tight">No medications prescribed</p>
          </div>
        ) : (
          <div className="space-y-3">
            {formData.medications.map((medication, index) => (
              <Card key={index} className="p-3 bg-blue-50/30 border-blue-100 rounded-sm">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="text-[9px] font-bold uppercase border-blue-200 bg-blue-50 text-primary h-5 px-2">Medication {index + 1}</Badge>
                  <Button
                    type="button"
                    onClick={() => removeMedication(index)}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-sm"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-tight">Medication Name *</Label>
                    <Input
                      value={medication.name}
                      onChange={(e) =>
                        updateMedication(index, "name", e.target.value)
                      }
                      placeholder="e.g., Amoxicillin"
                      className="h-8 text-xs rounded-sm border-gray-200 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-tight">Dosage *</Label>
                    <Input
                      value={medication.dosage}
                      onChange={(e) =>
                        updateMedication(index, "dosage", e.target.value)
                      }
                      placeholder="e.g., 500mg"
                      className="h-8 text-xs rounded-sm border-gray-200 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-tight">Frequency *</Label>
                    <Select
                      value={medication.frequency}
                      onValueChange={(value) =>
                        updateMedication(index, "frequency", value)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs rounded-sm border-gray-200 bg-white">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        {frequencies.map((freq) => (
                          <SelectItem key={freq} value={freq}>
                            {freq}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-tight">Duration</Label>
                    <Input
                      value={medication.duration}
                      onChange={(e) =>
                        updateMedication(index, "duration", e.target.value)
                      }
                      placeholder="e.g., 7 days"
                      className="h-8 text-xs rounded-sm border-gray-200 bg-white"
                    />
                  </div>
                </div>

                <div className="mt-2 space-y-1">
                  <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-tight">Instructions</Label>
                  <Textarea
                    value={medication.instructions}
                    onChange={(e) =>
                      updateMedication(index, "instructions", e.target.value)
                    }
                    placeholder="Special instructions..."
                    rows={1}
                    className="text-xs rounded-sm border-gray-200 bg-white min-h-[40px]"
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Separator className="bg-gray-100" />

      {/* Additional Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="follow_up_date" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Follow-up Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal h-9 text-sm rounded-sm border-gray-200",
                  !formData.follow_up_date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.follow_up_date && isValid(parseISO(formData.follow_up_date)) ? (
                  format(parseISO(formData.follow_up_date), "PPP")
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={formData.follow_up_date && isValid(parseISO(formData.follow_up_date)) ? parseISO(formData.follow_up_date) : undefined}
                onSelect={handleFollowUpDateChange}
                disabled={(date) =>
                  date < startOfToday()
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Additional Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, notes: e.target.value }))
          }
          placeholder="Post-treatment care instructions, observations, etc..."
          rows={2}
          className="text-sm rounded-sm border-gray-200"
        />
      </div>

      <div className="flex space-x-3 pt-2">
        <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-sm h-9 text-sm font-semibold">
          {treatment ? "Update Treatment" : "Save Treatment"}
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

export default TreatmentForm;
