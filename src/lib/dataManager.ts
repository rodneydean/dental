import { invoke } from "@tauri-apps/api/core";

export interface Patient {
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
  preferred_payment_method?: "cash" | "insurance";
  preferred_insurance_provider_id?: string;
  created_at: string;
  updated_at: string;
}

export interface InsuranceProvider {
  id: string;
  name: string;
  pays_reception_fee: boolean;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  patient_name: string;
  doctor_id?: string;
  doctor_name?: string;
  date: string;
  time: string;
  status: "scheduled" | "admitted" | "in_consultation" | "awaiting_checkout" | "completed" | "cancelled";
  appointment_type: string;
  notes: string;
  duration: number;
  reception_fee_paid: boolean;
  reception_fee_waived: boolean;
  created_at: string;
  updated_at: string;
}

export interface WaiverRequest {
  id: string;
  appointment_id: string;
  patient_id: string;
  patient_name: string;
  doctor_id: string;
  requested_by: string;
  status: "pending" | "approved" | "denied";
  created_at: string;
  updated_at: string;
}

export interface DoctorStatus {
  doctor_id: string;
  current_appointment_id: string | null;
  updated_at: string;
}

export interface Setting {
  key: string;
  value: string;
}

export interface Service {
  id: string;
  name: string;
  standard_fee: number;
  created_at: string;
  updated_at: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface PatientNote {
  id: string;
  patient_id: string;
  doctor_id: string;
  doctor_name: string;
  note_type: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface SickSheet {
  id: string;
  patient_id: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  start_date: string;
  end_date: string;
  reason: string;
  created_at: string;
  updated_at: string;
}

export interface Treatment {
  id: string;
  patient_id: string;
  patient_name: string;
  doctor_id?: string;
  doctor_name?: string;
  appointment_id?: string;
  date: string;
  diagnosis: string;
  treatment: string;
  medications: Medication[];
  notes: string;
  follow_up_date: string;
  cost: number;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  patient_id: string;
  patient_name: string;
  treatment_id?: string;
  amount: number;
  date: string;
  method: "cash" | "insurance";
  status: "pending" | "paid";
  notes: string;
  insurance_provider_id?: string;
  created_at: string;
  updated_at: string;
}

export interface BackupEntry {
    id: string;
    type: string;
    date: string;
    patient_count: number;
    appointment_count: number;
    treatment_count: number;
    payment_count: number;
}

export interface DbStats {
  total_patients: number;
  total_appointments: number;
  total_treatments: number;
  storage_used: string;
  last_backup: string | null;
}

export interface ValidationResults {
  orphaned_appointments: number;
  orphaned_treatments: number;
  duplicate_patients: number;
}

class DataManager {
  private static instance: DataManager;

  private constructor() {}

  public static getInstance(): DataManager {
    if (!DataManager.instance) {
      DataManager.instance = new DataManager();
    }
    return DataManager.instance;
  }

  // Patient methods
  public async getPatients(): Promise<Patient[]> {
    return await invoke<Patient[]>("list_patients");
  }

  public async getPatient(id: string): Promise<Patient> {
    return await invoke<Patient>("get_patient", { id });
  }

  public async addPatient(
    patient: Omit<Patient, "id" | "created_at" | "updated_at">
  ): Promise<Patient> {
    return await invoke<Patient>("create_patient", {
      name: patient.name,
      phone: patient.phone,
      email: patient.email,
      dateOfBirth: patient.date_of_birth,
      address: patient.address,
      medicalHistory: patient.medical_history,
      allergies: patient.allergies,
      emergencyContact: patient.emergency_contact,
      emergencyPhone: patient.emergency_phone,
      preferredPaymentMethod: patient.preferred_payment_method,
      preferredInsuranceProviderId: patient.preferred_insurance_provider_id
    });
  }

  public async updatePatient(id: string, updates: Partial<Patient>): Promise<void> {
    const patients = await this.getPatients();
    const current = patients.find(p => p.id === id);
    if (!current) throw new Error("Patient not found");

    await invoke("update_patient", {
      id,
      name: updates.name ?? current.name,
      phone: updates.phone ?? current.phone,
      email: updates.email ?? current.email,
      dateOfBirth: updates.date_of_birth ?? current.date_of_birth,
      address: updates.address ?? current.address,
      medicalHistory: updates.medical_history ?? current.medical_history,
      allergies: updates.allergies ?? current.allergies,
      emergencyContact: updates.emergency_contact ?? current.emergency_contact,
      emergencyPhone: updates.emergency_phone ?? current.emergency_phone,
      preferredPaymentMethod: updates.preferred_payment_method ?? current.preferred_payment_method,
      preferredInsuranceProviderId: updates.preferred_insurance_provider_id ?? current.preferred_insurance_provider_id,
    });
  }

  public async deletePatient(id: string): Promise<void> {
    await invoke("delete_patient", { id });
  }

  public async getPatientNotes(patient_id: string): Promise<PatientNote[]> {
    return await invoke<PatientNote[]>("list_patient_notes", { patientId: patient_id });
  }

  public async addPatientNote(note: Omit<PatientNote, "id" | "created_at" | "updated_at">): Promise<PatientNote> {
    return await invoke<PatientNote>("create_patient_note", {
      patientId: note.patient_id,
      doctorId: note.doctor_id,
      doctorName: note.doctor_name,
      noteType: note.note_type,
      note: note.note
    });
  }

  public async updatePatientNote(id: string, note_type: string, note: string): Promise<void> {
    await invoke("update_patient_note", { id, noteType: note_type, note });
  }

  public async deletePatientNote(id: string): Promise<void> {
    await invoke("delete_patient_note", { id });
  }

  public async getSickSheets(patient_id: string): Promise<SickSheet[]> {
    return await invoke<SickSheet[]>("list_sick_sheets", { patientId: patient_id });
  }

  public async addSickSheet(sheet: Omit<SickSheet, "id" | "created_at" | "updated_at">): Promise<SickSheet> {
    return await invoke<SickSheet>("create_sick_sheet", {
      patientId: sheet.patient_id,
      patientName: sheet.patient_name,
      doctorId: sheet.doctor_id,
      doctorName: sheet.doctor_name,
      startDate: sheet.start_date,
      endDate: sheet.end_date,
      reason: sheet.reason
    });
  }

  // Appointment methods
  public async getAppointments(): Promise<Appointment[]> {
    return await invoke<Appointment[]>("list_appointments");
  }

  public async addAppointment(
    appointment: Omit<Appointment, "id" | "created_at" | "updated_at">
  ): Promise<Appointment> {
    return await invoke<Appointment>("create_appointment", {
      patientId: appointment.patient_id,
      patientName: appointment.patient_name,
      doctorId: appointment.doctor_id,
      doctorName: appointment.doctor_name,
      date: appointment.date,
      time: appointment.time,
      status: appointment.status,
      appointmentType: appointment.appointment_type,
      notes: appointment.notes,
      duration: appointment.duration
    });
  }

  public async updateAppointment(
    id: string,
    updates: Partial<Appointment>
  ): Promise<void> {
    const appointments = await this.getAppointments();
    const current = appointments.find(a => a.id === id);
    if (!current) throw new Error("Appointment not found");

    await invoke("update_appointment", {
      id,
      doctorId: updates.doctor_id ?? current.doctor_id,
      doctorName: updates.doctor_name ?? current.doctor_name,
      date: updates.date ?? current.date,
      time: updates.time ?? current.time,
      status: updates.status ?? current.status,
      appointmentType: updates.appointment_type ?? current.appointment_type,
      notes: updates.notes ?? current.notes,
      duration: updates.duration ?? current.duration,
      receptionFeePaid: updates.reception_fee_paid ?? current.reception_fee_paid,
      receptionFeeWaived: updates.reception_fee_waived ?? current.reception_fee_waived,
    });
  }

  public async deleteAppointment(id: string): Promise<void> {
    await invoke("delete_appointment", { id });
  }

  // Treatment methods
  public async getTreatments(): Promise<Treatment[]> {
    return await invoke<Treatment[]>("list_treatments");
  }

  public async addTreatment(
    treatment: Omit<Treatment, "id" | "created_at" | "updated_at">
  ): Promise<Treatment> {
    return await invoke<Treatment>("create_treatment", {
      patientId: treatment.patient_id,
      patientName: treatment.patient_name,
      doctorId: treatment.doctor_id || undefined,
      doctorName: treatment.doctor_name || undefined,
      appointmentId: treatment.appointment_id || undefined,
      date: treatment.date,
      diagnosis: treatment.diagnosis,
      treatmentDesc: treatment.treatment,
      medications: treatment.medications,
      notes: treatment.notes,
      followUpDate: treatment.follow_up_date,
      cost: treatment.cost
    });
  }

  public async updateTreatment(
    id: string,
    treatment: Omit<Treatment, "id" | "created_at" | "updated_at">
  ): Promise<void> {
    await invoke("update_treatment", {
      id,
      patientId: treatment.patient_id,
      patientName: treatment.patient_name,
      doctorId: treatment.doctor_id || undefined,
      doctorName: treatment.doctor_name || undefined,
      appointmentId: treatment.appointment_id || undefined,
      date: treatment.date,
      diagnosis: treatment.diagnosis,
      treatmentDesc: treatment.treatment,
      medications: treatment.medications,
      notes: treatment.notes,
      followUpDate: treatment.follow_up_date,
      cost: treatment.cost
    });
  }

  public async deleteTreatment(id: string): Promise<void> {
    await invoke("delete_treatment", { id });
  }

  // Payment methods
  public async getPayments(): Promise<Payment[]> {
    return await invoke<Payment[]>("list_payments");
  }

  public async addPayment(
    payment: Omit<Payment, "id" | "created_at" | "updated_at">
  ): Promise<Payment> {
    return await invoke<Payment>("create_payment", {
      patientId: payment.patient_id,
      patientName: payment.patient_name,
      treatmentId: payment.treatment_id,
      amount: payment.amount,
      date: payment.date,
      method: payment.method,
      status: payment.status,
      notes: payment.notes,
      insuranceProviderId: payment.insurance_provider_id
    });
  }

  public async updatePayment(id: string, updates: Partial<Payment>): Promise<void> {
    const payments = await this.getPayments();
    const current = payments.find(p => p.id === id);
    if (!current) throw new Error("Payment not found");

    await invoke("update_payment", {
      id,
      patientId: updates.patient_id ?? current.patient_id,
      patientName: updates.patient_name ?? current.patient_name,
      treatmentId: updates.treatment_id ?? current.treatment_id,
      amount: updates.amount ?? current.amount,
      date: updates.date ?? current.date,
      method: updates.method ?? current.method,
      status: updates.status ?? current.status,
      notes: updates.notes ?? current.notes,
      insuranceProviderId: updates.insurance_provider_id ?? current.insurance_provider_id,
    });
  }

  public async deletePayment(id: string): Promise<void> {
    await invoke("delete_payment", { id });
  }

  // Backup and Restore methods
  public async getBackupHistory(): Promise<BackupEntry[]> {
    return await invoke<BackupEntry[]>("get_backup_history");
  }

  public async restoreFromBackup(id: string): Promise<{ success: boolean; message: string }> {
    return await invoke<{ success: boolean; message: string }>("restore_db", { backupId: id });
  }

  public async exportToCSV(dataType: string): Promise<string> {
    return await invoke("export_to_csv", { dataType });
  }

  public async importFromFile(file: File): Promise<{ success: boolean; message: string }> {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = async () => {
        try {
          const content = (reader.result as string).split(',')[1] || reader.result as string;
          const result = await invoke<{ success: boolean; message: string }>("import_db", { content });
          resolve(result);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  }

  // Settings methods
  public async getSettings(): Promise<Setting[]> {
    return await invoke<Setting[]>("list_settings");
  }

  public async getSetting(key: string): Promise<string | null> {
    return await invoke<string | null>("get_setting", { key });
  }

  public async setSetting(key: string, value: string): Promise<void> {
    await invoke("set_setting", { key, value });
  }

  // Clinical Note Types methods
  public async getNoteTypes(): Promise<string[]> {
    const types = await this.getSetting("clinical_note_types");
    if (!types) {
      const defaultTypes = [
        "Chief complaints",
        "History of complain",
        "Medical history",
        "Dental history",
        "Social history",
        "Extra-oral examination",
        "Intra-oral examination",
        "Diagnosis",
        "Treatment plan",
        "General"
      ];
      await this.setSetting("clinical_note_types", JSON.stringify(defaultTypes));
      return defaultTypes;
    }
    try {
      return JSON.parse(types);
    } catch {
      return ["General"];
    }
  }

  public async addNoteType(type: string): Promise<void> {
    const types = await this.getNoteTypes();
    if (!types.includes(type)) {
      types.push(type);
      await this.setSetting("clinical_note_types", JSON.stringify(types));
    }
  }

  public async deleteNoteType(type: string): Promise<void> {
    let types = await this.getNoteTypes();
    types = types.filter(t => t !== type);
    await this.setSetting("clinical_note_types", JSON.stringify(types));
  }

  // Service methods
  public async getServices(): Promise<Service[]> {
    return await invoke<Service[]>("list_services");
  }

  public async addService(service: { name: string; standard_fee: number }): Promise<Service> {
    return await invoke<Service>("create_service", {
      name: service.name,
      standardFee: service.standard_fee
    });
  }

  public async updateService(id: string, service: { name: string; standard_fee: number }): Promise<void> {
    await invoke("update_service", {
      id,
      name: service.name,
      standardFee: service.standard_fee
    });
  }

  public async deleteService(id: string): Promise<void> {
    await invoke("delete_service", { id });
  }

  // Insurance provider methods
  public async getInsuranceProviders(): Promise<InsuranceProvider[]> {
    return await invoke<InsuranceProvider[]>("list_insurance_providers");
  }

  public async addInsuranceProvider(provider: { name: string; pays_reception_fee: boolean }): Promise<InsuranceProvider> {
    return await invoke<InsuranceProvider>("create_insurance_provider", {
      name: provider.name,
      paysReceptionFee: provider.pays_reception_fee
    });
  }

  public async updateInsuranceProvider(id: string, provider: { name: string; pays_reception_fee: boolean }): Promise<void> {
    await invoke("update_insurance_provider", {
      id,
      name: provider.name,
      paysReceptionFee: provider.pays_reception_fee
    });
  }

  public async deleteInsuranceProvider(id: string): Promise<void> {
    await invoke("delete_insurance_provider", { id });
  }

  // Logo methods
  public async saveLogo(base64Image: string): Promise<string> {
    return await invoke<string>("save_logo", { base64Image });
  }

  public async getLogo(): Promise<string | null> {
    return await invoke<string | null>("get_logo");
  }

  // Lifecycle methods
  public async getWaiverRequests(): Promise<WaiverRequest[]> {
    return await invoke<WaiverRequest[]>("list_waiver_requests");
  }

  public async createWaiverRequest(request: Omit<WaiverRequest, "id" | "status" | "created_at" | "updated_at">): Promise<WaiverRequest> {
    return await invoke<WaiverRequest>("create_waiver_request", {
      appointmentId: request.appointment_id,
      patientId: request.patient_id,
      patientName: request.patient_name,
      doctorId: request.doctor_id,
      requestedBy: request.requested_by,
    });
  }

  public async updateWaiverStatus(id: string, status: "approved" | "denied"): Promise<void> {
    await invoke("update_waiver_status", { id, status });
  }

  public async getDoctorStatuses(): Promise<DoctorStatus[]> {
    return await invoke<DoctorStatus[]>("list_doctor_statuses");
  }

  public async updateDoctorStatus(doctorId: string, currentAppointmentId: string | null): Promise<void> {
    await invoke("update_doctor_status", { doctorId, currentAppointmentId });
  }

  // Data Management methods
  public async getStorageStats(): Promise<DbStats> {
    return await invoke<DbStats>("get_db_stats");
  }

  public async validateData(): Promise<ValidationResults> {
    return await invoke<ValidationResults>("validate_db_data");
  }

  public async cleanupOrphanedData(): Promise<{ cleaned: number }> {
    const cleaned = await invoke<number>("cleanup_db_data");
    return { cleaned };
  }

  public async createBackup(): Promise<string> {
    return await invoke<string>("backup_db");
  }

  public clearAllData(): void {}
}

export const dataManager = DataManager.getInstance();