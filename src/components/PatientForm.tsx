import { useState } from "react";
import { calculateAge, cn } from "@/lib/utils";
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
import { CalendarIcon } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string;
  date_of_birth: string;
  address: string;
  medical_history: string;
  allergies: string;
  emergency_contact: string;
  emergency_phone: string;
}

interface PatientFormProps {
  patient?: Patient;
  onSave: (patient: Omit<Patient, "id">) => void;
  onCancel: () => void;
}

const PatientForm = ({ patient, onSave, onCancel }: PatientFormProps) => {
  const { user } = useAuth();
  const isReceptionist = user?.role === "RECEPTION";

  const [formData, setFormData] = useState<Omit<Patient, "id">>({
    name: patient?.name || "",
    phone: patient?.phone || "",
    email: patient?.email || "",
    date_of_birth: patient?.date_of_birth || "",
    address: patient?.address || "",
    medical_history: patient?.medical_history || "",
    allergies: patient?.allergies || "",
    emergency_contact: patient?.emergency_contact || "",
    emergency_phone: patient?.emergency_phone || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setFormData((prev) => ({ ...prev, date_of_birth: format(date, "yyyy-MM-dd") }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Full Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="Enter full name"
            className="h-9 text-sm rounded-sm border-gray-200"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Phone Number</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            placeholder="(555) 123-4567"
            className="h-9 text-sm rounded-sm border-gray-200"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            placeholder="patient@example.com"
            className="h-9 text-sm rounded-sm border-gray-200"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="date_of_birth" className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Date of Birth {formData.date_of_birth && `(Age: ${calculateAge(formData.date_of_birth)})`}
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal h-9 text-sm rounded-sm border-gray-200",
                  !formData.date_of_birth && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.date_of_birth && isValid(parseISO(formData.date_of_birth)) ? (
                  format(parseISO(formData.date_of_birth), "PPP")
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={formData.date_of_birth && isValid(parseISO(formData.date_of_birth)) ? parseISO(formData.date_of_birth) : undefined}
                onSelect={handleDateChange}
                disabled={(date) =>
                  date > new Date() || date < new Date("1900-01-01")
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Address</Label>
        <Input
          id="address"
          value={formData.address}
          onChange={(e) => handleChange("address", e.target.value)}
          placeholder="Street address, city, state, zip"
          className="h-9 text-sm rounded-sm border-gray-200"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="emergency_contact" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Emergency Contact</Label>
          <Input
            id="emergency_contact"
            value={formData.emergency_contact}
            onChange={(e) => handleChange("emergency_contact", e.target.value)}
            placeholder="Contact person name"
            className="h-9 text-sm rounded-sm border-gray-200"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="emergency_phone" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Emergency Phone</Label>
          <Input
            id="emergency_phone"
            type="tel"
            value={formData.emergency_phone}
            onChange={(e) => handleChange("emergency_phone", e.target.value)}
            placeholder="(555) 123-4567"
            className="h-9 text-sm rounded-sm border-gray-200"
          />
        </div>
      </div>

      {!isReceptionist && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="medical_history" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Medical History</Label>
            <Textarea
              id="medical_history"
              value={formData.medical_history}
              onChange={(e) => handleChange("medical_history", e.target.value)}
              placeholder="Previous medical conditions, surgeries, medications..."
              rows={2}
              className="text-sm rounded-sm border-gray-200"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="allergies" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Allergies & Medications</Label>
            <Textarea
              id="allergies"
              value={formData.allergies}
              onChange={(e) => handleChange("allergies", e.target.value)}
              placeholder="Known allergies, current medications..."
              rows={2}
              className="text-sm rounded-sm border-gray-200"
            />
          </div>
        </>
      )}

      <div className="flex space-x-3 pt-2">
        <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-sm h-9 text-sm font-semibold">
          {patient ? "Update Patient" : "Register Patient"}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1 rounded-sm h-9 text-sm font-semibold border-gray-200"
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
};

export default PatientForm;
