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
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  patient_name: string;
  date: string;
  time: string;
  status: "scheduled" | "completed" | "cancelled";
  appointment_type: string;
  notes: string;
  duration: number;
  created_at: string;
  updated_at: string;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface Treatment {
  id: string;
  patient_id: string;
  patient_name: string;
  appointment_id: string;
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
  method: "cash" | "card" | "transfer";
  status: "pending" | "paid";
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface BackupEntry {
    id: string;
    type: string;
    date: string;
    patientCount: number;
    appointmentCount: number;
    treatmentCount: number;
    paymentCount: number;
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

  public async addPatient(
    patient: Omit<Patient, "id" | "created_at" | "updated_at">
  ): Promise<Patient> {
    return await invoke<Patient>("create_patient", { ...patient });
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
      date_of_birth: updates.date_of_birth ?? current.date_of_birth,
      address: updates.address ?? current.address,
      medical_history: updates.medical_history ?? current.medical_history,
      allergies: updates.allergies ?? current.allergies,
      emergency_contact: updates.emergency_contact ?? current.emergency_contact,
      emergency_phone: updates.emergency_phone ?? current.emergency_phone,
    });
  }

  // Appointment methods
  public async getAppointments(): Promise<Appointment[]> {
    return await invoke<Appointment[]>("list_appointments");
  }

  public async addAppointment(
    appointment: Omit<Appointment, "id" | "created_at" | "updated_at">
  ): Promise<Appointment> {
    return await invoke<Appointment>("create_appointment", { ...appointment });
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
      date: updates.date ?? current.date,
      time: updates.time ?? current.time,
      status: updates.status ?? current.status,
      appointment_type: updates.appointment_type ?? current.appointment_type,
      notes: updates.notes ?? current.notes,
      duration: updates.duration ?? current.duration,
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
        ...treatment,
        treatment_desc: treatment.treatment
    });
  }

  // Payment methods
  public async getPayments(): Promise<Payment[]> {
    return await invoke<Payment[]>("list_payments");
  }

  public async addPayment(
    payment: Omit<Payment, "id" | "created_at" | "updated_at">
  ): Promise<Payment> {
    return await invoke<Payment>("create_payment", { ...payment });
  }

  // Mocked for DataManagement component to avoid errors for now
  public getStorageStats(): any { return { totalPatients: 0, totalAppointments: 0, totalTreatments: 0, storageUsed: "0 KB", lastBackup: null }; }
  public getBackupHistory(): BackupEntry[] { return []; }
  public validateData(): any { return { orphanedAppointments: 0, orphanedTreatments: 0, duplicatePatients: 0 }; }
  public exportToFile(): void {}
  public exportToCSV(type: string): void {}
  public async importFromFile(file: File): Promise<any> { return { success: true, message: "Imported" }; }
  public restoreFromBackup(id: string): any { return { success: true, message: "Restored" }; }
  public cleanupOrphanedData(): any { return { cleaned: 0 }; }
  public clearAllData(): void {}
}

export const dataManager = DataManager.getInstance();
