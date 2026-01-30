// Data Manager for local storage and export/import functionality
export interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  address: string;
  medicalHistory: string;
  allergies: string;
  emergencyContact: string;
  emergencyPhone: string;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  time: string;
  status: "scheduled" | "completed" | "cancelled";
  type: string;
  notes: string;
  duration: number;
  createdAt: string;
  updatedAt: string;
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
  patientId: string;
  patientName: string;
  appointmentId: string;
  date: string;
  diagnosis: string;
  treatment: string;
  medications: Medication[];
  notes: string;
  followUpDate: string;
  cost: number;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseBackup {
  patients: Patient[];
  appointments: Appointment[];
  treatments: Treatment[];
  exportDate: string;
  version: string;
}

export interface BackupEntry {
  id: string;
  type: string;
  date: string;
  patientCount: number;
  appointmentCount: number;
  treatmentCount: number;
  data: DatabaseBackup;
}

class DataManager {
  private static instance: DataManager;
  private readonly STORAGE_KEYS = {
    PATIENTS: "dentalcare_patients",
    APPOINTMENTS: "dentalcare_appointments",
    TREATMENTS: "dentalcare_treatments",
    BACKUP_HISTORY: "dentalcare_backup_history",
  };

  private constructor() {}

  public static getInstance(): DataManager {
    if (!DataManager.instance) {
      DataManager.instance = new DataManager();
    }
    return DataManager.instance;
  }

  // Generic storage methods
  private setItem<T>(key: string, data: T[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`Error saving ${key}:`, error);
      throw new Error(`Failed to save data to local storage`);
    }
  }

  private getItem<T>(key: string): T[] {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error(`Error loading ${key}:`, error);
      return [];
    }
  }

  // Patient methods
  public getPatients(): Patient[] {
    return this.getItem<Patient>(this.STORAGE_KEYS.PATIENTS);
  }

  public savePatients(patients: Patient[]): void {
    this.setItem(this.STORAGE_KEYS.PATIENTS, patients);
  }

  public addPatient(
    patient: Omit<Patient, "id" | "createdAt" | "updatedAt">
  ): Patient {
    const patients = this.getPatients();
    const newPatient: Patient = {
      ...patient,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    patients.push(newPatient);
    this.savePatients(patients);
    return newPatient;
  }

  public updatePatient(id: string, updates: Partial<Patient>): Patient | null {
    const patients = this.getPatients();
    const index = patients.findIndex((p) => p.id === id);
    if (index === -1) return null;

    patients[index] = {
      ...patients[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.savePatients(patients);
    return patients[index];
  }

  // Appointment methods
  public getAppointments(): Appointment[] {
    return this.getItem<Appointment>(this.STORAGE_KEYS.APPOINTMENTS);
  }

  public saveAppointments(appointments: Appointment[]): void {
    this.setItem(this.STORAGE_KEYS.APPOINTMENTS, appointments);
  }

  public addAppointment(
    appointment: Omit<Appointment, "id" | "createdAt" | "updatedAt">
  ): Appointment {
    const appointments = this.getAppointments();
    const newAppointment: Appointment = {
      ...appointment,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    appointments.push(newAppointment);
    this.saveAppointments(appointments);
    return newAppointment;
  }

  public updateAppointment(
    id: string,
    updates: Partial<Appointment>
  ): Appointment | null {
    const appointments = this.getAppointments();
    const index = appointments.findIndex((a) => a.id === id);
    if (index === -1) return null;

    appointments[index] = {
      ...appointments[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveAppointments(appointments);
    return appointments[index];
  }

  // Treatment methods
  public getTreatments(): Treatment[] {
    return this.getItem<Treatment>(this.STORAGE_KEYS.TREATMENTS);
  }

  public saveTreatments(treatments: Treatment[]): void {
    this.setItem(this.STORAGE_KEYS.TREATMENTS, treatments);
  }

  public addTreatment(
    treatment: Omit<Treatment, "id" | "createdAt" | "updatedAt">
  ): Treatment {
    const treatments = this.getTreatments();
    const newTreatment: Treatment = {
      ...treatment,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    treatments.push(newTreatment);
    this.saveTreatments(treatments);
    return newTreatment;
  }

  public updateTreatment(
    id: string,
    updates: Partial<Treatment>
  ): Treatment | null {
    const treatments = this.getTreatments();
    const index = treatments.findIndex((t) => t.id === id);
    if (index === -1) return null;

    treatments[index] = {
      ...treatments[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveTreatments(treatments);
    return treatments[index];
  }

  // Export/Import methods
  public exportData(): DatabaseBackup {
    const backup: DatabaseBackup = {
      patients: this.getPatients(),
      appointments: this.getAppointments(),
      treatments: this.getTreatments(),
      exportDate: new Date().toISOString(),
      version: "1.0.0",
    };

    // Save to backup history
    this.saveBackupToHistory(backup);

    return backup;
  }

  public exportToFile(): void {
    const backup = this.exportData();
    const dataStr = JSON.stringify(backup, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(dataBlob);
    link.download = `dentalcare-backup-${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  public exportToCSV(
    dataType: "patients" | "appointments" | "treatments"
  ): void {
    //eslint-disable-next-line
    let data: any[] = [];
    let filename = "";

    switch (dataType) {
      case "patients":
        data = this.getPatients();
        filename = "patients";
        break;
      case "appointments":
        data = this.getAppointments() ;
        filename = "appointments";
        break;
      case "treatments":
        data = this.getTreatments().map((t) => ({
          ...t,
          medications: t.medications
            .map((m) => `${m.name} (${m.dosage})`)
            .join("; "),
        }));
        filename = "treatments";
        break;
    }

    if (data.length === 0) {
      alert(`No ${dataType} data to export`);
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            // Escape commas and quotes in CSV
            if (
              typeof value === "string" &&
              (value.includes(",") || value.includes('"'))
            ) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value || "";
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `dentalcare-${filename}-${
      new Date().toISOString().split("T")[0]
    }.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  public importData(backup: DatabaseBackup): {
    success: boolean;
    message: string;
  } {
    try {
      // Validate backup structure
      if (!backup.patients || !backup.appointments || !backup.treatments) {
        return { success: false, message: "Invalid backup file structure" };
      }

      // Backup current data before import
      const currentBackup = this.exportData();
      this.saveBackupToHistory(currentBackup, "pre-import-backup");

      // Import data
      this.savePatients(backup.patients);
      this.saveAppointments(backup.appointments);
      this.saveTreatments(backup.treatments);

      return {
        success: true,
        message: `Successfully imported ${backup.patients.length} patients, ${backup.appointments.length} appointments, and ${backup.treatments.length} treatments`,
      };
    } catch (error) {
      console.error("Import error:", error);
      return {
        success: false,
        message: "Failed to import data. Please check the file format.",
      };
    }
  }

  public importFromFile(
    file: File
  ): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const backup = JSON.parse(e.target?.result as string);
          resolve(this.importData(backup));
        } catch (error) {
          console.log(error)
          resolve({ success: false, message: "Invalid JSON file format" });
        }
      };
      reader.onerror = () => {
        resolve({ success: false, message: "Failed to read file" });
      };
      reader.readAsText(file);
    });
  }

  // Backup history methods
  private saveBackupToHistory(
    backup: DatabaseBackup,
    type: string = "manual"
  ): void {
    const history = this.getBackupHistory();
    const backupEntry: BackupEntry = {
      id: Date.now().toString(),
      type,
      date: backup.exportDate,
      patientCount: backup.patients.length,
      appointmentCount: backup.appointments.length,
      treatmentCount: backup.treatments.length,
      data: backup,
    };

    history.unshift(backupEntry);
    // Keep only last 10 backups
    const limitedHistory = history.slice(0, 10);
    localStorage.setItem(
      this.STORAGE_KEYS.BACKUP_HISTORY,
      JSON.stringify(limitedHistory)
    );
  }

  public getBackupHistory(): BackupEntry[] {
    return this.getItem<BackupEntry>(this.STORAGE_KEYS.BACKUP_HISTORY);
  }

  public restoreFromBackup(backupId: string): {
    success: boolean;
    message: string;
  } {
    const history = this.getBackupHistory();
    const backup = history.find((b) => b.id === backupId);

    if (!backup) {
      return { success: false, message: "Backup not found" };
    }

    return this.importData(backup.data);
  }

  // Statistics and analytics
  public getStorageStats(): {
    totalPatients: number;
    totalAppointments: number;
    totalTreatments: number;
    storageUsed: string;
    lastBackup: string | null;
  } {
    const patients = this.getPatients();
    const appointments = this.getAppointments();
    const treatments = this.getTreatments();
    const backupHistory = this.getBackupHistory();

    // Calculate approximate storage usage
    const dataSize = JSON.stringify({
      patients,
      appointments,
      treatments,
    }).length;
    const storageUsed = `${(dataSize / 1024).toFixed(2)} KB`;

    return {
      totalPatients: patients.length,
      totalAppointments: appointments.length,
      totalTreatments: treatments.length,
      storageUsed,
      lastBackup: backupHistory.length > 0 ? backupHistory[0].date : null,
    };
  }

  // Data validation and cleanup
  public validateData(): {
    orphanedAppointments: number;
    orphanedTreatments: number;
    duplicatePatients: number;
  } {
    const patients = this.getPatients();
    const appointments = this.getAppointments();
    const treatments = this.getTreatments();

    const patientIds = new Set(patients.map((p) => p.id));
    const orphanedAppointments = appointments.filter(
      (a) => !patientIds.has(a.patientId)
    ).length;
    const orphanedTreatments = treatments.filter(
      (t) => !patientIds.has(t.patientId)
    ).length;

    // Check for duplicate patients (same email or phone)
    const emails = new Set();
    const phones = new Set();
    let duplicatePatients = 0;

    patients.forEach((patient) => {
      if (emails.has(patient.email) || phones.has(patient.phone)) {
        duplicatePatients++;
      }
      emails.add(patient.email);
      phones.add(patient.phone);
    });

    return { orphanedAppointments, orphanedTreatments, duplicatePatients };
  }

  public cleanupOrphanedData(): { cleaned: number } {
    const patients = this.getPatients();
    const appointments = this.getAppointments();
    const treatments = this.getTreatments();

    const patientIds = new Set(patients.map((p) => p.id));

    const validAppointments = appointments.filter((a) =>
      patientIds.has(a.patientId)
    );
    const validTreatments = treatments.filter((t) =>
      patientIds.has(t.patientId)
    );

    const cleanedCount =
      appointments.length -
      validAppointments.length +
      (treatments.length - validTreatments.length);

    this.saveAppointments(validAppointments);
    this.saveTreatments(validTreatments);

    return { cleaned: cleanedCount };
  }
}

export const dataManager = DataManager.getInstance();
