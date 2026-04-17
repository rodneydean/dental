import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { dataManager, Patient, Appointment, Treatment, Payment, SickSheet, Medication, PatientNote } from "./dataManager";

// Extend jsPDF with autotable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: object) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

interface ClinicBranding {
  name: string;
  address: string;
  phone: string;
  website: string;
  taxId: string;
  footer: string;
  logo: string | null;
}

const getBranding = async (): Promise<ClinicBranding> => {
  const [name, address, phone, website, taxId, footer, logo] = await Promise.all([
    dataManager.getSetting("clinic_name"),
    dataManager.getSetting("clinic_address"),
    dataManager.getSetting("clinic_phone"),
    dataManager.getSetting("clinic_website"),
    dataManager.getSetting("clinic_tax_id"),
    dataManager.getSetting("clinic_footer"),
    dataManager.getLogo()
  ]);

  return {
    name: name || "Dental Clinic",
    address: address || "",
    phone: phone || "",
    website: website || "",
    taxId: taxId || "",
    footer: footer || "",
    logo: logo
  };
};

const addLetterhead = (doc: jsPDF, branding: ClinicBranding, yPos: number = 20): number => {
  if (branding.logo) {
    try {
      doc.addImage(branding.logo, 'PNG', 20, yPos - 10, 30, 30);
    } catch (e) {
      console.error("Failed to add logo to PDF", e);
    }
  }

  doc.setFontSize(20);
  doc.setTextColor(0, 120, 212); // Azure primary
  doc.setFont("helvetica", "bold");
  doc.text(branding.name, 60, yPos);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  let currentY = yPos + 7;
  if (branding.address) {
    doc.text(branding.address, 60, currentY);
    currentY += 5;
  }
  if (branding.phone || branding.website) {
    doc.text(`${branding.phone}${branding.phone && branding.website ? ' | ' : ''}${branding.website}`, 60, currentY);
    currentY += 5;
  }
  if (branding.taxId) {
    doc.text(`License/Tax ID: ${branding.taxId}`, 60, currentY);
    currentY += 5;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(20, currentY + 5, 190, currentY + 5);

  return currentY + 20;
};

const addFooter = (doc: jsPDF, branding: ClinicBranding) => {
  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(branding.footer || "Thank you for choosing our clinic.", 105, 285, { align: "center" });
    doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: "right" });
  }
};

export const pdfGenerator = {
  async generateAppointmentCard(appointment: Appointment) {
    const branding = await getBranding();
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "in",
      format: [4, 6]
    });

    // Branding Background
    doc.setFillColor(240, 247, 255);
    doc.rect(0, 0, 6, 4, 'F');

    if (branding.logo) {
      try {
        doc.addImage(branding.logo, 'PNG', 0.3, 0.3, 0.8, 0.8);
      } catch {
        // Ignore logo errors in PDF
      }
    }

    doc.setFontSize(16);
    doc.setTextColor(0, 120, 212);
    doc.setFont("helvetica", "bold");
    doc.text(branding.name, 1.2, 0.6);

    doc.setFontSize(18);
    doc.setTextColor(33, 33, 33);
    doc.text("APPOINTMENT CARD", 3, 1.5, { align: "center" });

    doc.setDrawColor(0, 120, 212);
    doc.setLineWidth(0.02);
    doc.line(1, 1.7, 5, 1.7);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    let y = 2.1;
    doc.text(`Patient: ${appointment.patient_name}`, 1, y);
    y += 0.3;
    doc.text(`Doctor: Dr. ${appointment.doctor_name || "TBA"}`, 1, y);
    y += 0.3;
    doc.text(`Date: ${appointment.date}`, 1, y);
    y += 0.3;
    doc.text(`Time: ${appointment.time}`, 1, y);
    y += 0.3;
    doc.text(`Type: ${appointment.appointment_type}`, 1, y);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(branding.address, 3, 3.5, { align: "center" });
    doc.text(`Phone: ${branding.phone}`, 3, 3.7, { align: "center" });

    doc.save(`Appointment_${appointment.patient_name.replace(/\s+/g, '_')}.pdf`);
  },

  async generateMedicalHistory(patient: Patient, _appointments: Appointment[], treatments: Treatment[], notes: PatientNote[]) {
    const branding = await getBranding();
    const doc = new jsPDF();
    let y = addLetterhead(doc, branding);

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(33, 33, 33);
    doc.text("MEDICAL HISTORY REPORT", 105, y, { align: "center" });
    y += 10;

    // Patient Info
    doc.setFontSize(12);
    doc.text("Patient Information", 20, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Name: ${patient.name}`, 20, y);
    doc.text(`DOB: ${patient.date_of_birth}`, 120, y);
    y += 5;
    doc.text(`Phone: ${patient.phone}`, 20, y);
    doc.text(`Email: ${patient.email}`, 120, y);
    y += 10;

    // Alerts
    if (patient.allergies || patient.medical_history) {
      doc.setFillColor(255, 240, 240);
      doc.rect(20, y, 170, 20, 'F');
      doc.setFont("helvetica", "bold");
      doc.setTextColor(200, 0, 0);
      doc.text("MEDICAL ALERTS", 25, y + 7);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Allergies: ${patient.allergies || "None"}`, 25, y + 12);
      doc.text(`Conditions: ${patient.medical_history || "None"}`, 25, y + 17);
      y += 25;
      doc.setTextColor(33, 33, 33);
    }

    // Treatments
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Treatment History", 20, y);
    y += 5;

    const treatmentRows = treatments
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(t => [t.date, t.diagnosis, t.treatment]);

    doc.autoTable({
      startY: y,
      head: [['Date', 'Diagnosis', 'Treatment']],
      body: treatmentRows,
      theme: 'striped',
      headStyles: { fillColor: [0, 120, 212] },
      margin: { left: 20, right: 20 }
    });

    y = doc.lastAutoTable.finalY + 15;

    // Notes
    if (notes.length > 0) {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Clinical Notes", 20, y);
        y += 7;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        notes.forEach(note => {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.setFont("helvetica", "bold");
            doc.text(`${note.doctor_name} - ${new Date(note.created_at).toLocaleDateString()}`, 20, y);
            y += 4;
            doc.setFont("helvetica", "normal");
            const lines = doc.splitTextToSize(note.note, 160);
            doc.text(lines, 20, y);
            y += (lines.length * 4) + 4;
        });
    }

    addFooter(doc, branding);
    doc.save(`Medical_History_${patient.name.replace(/\s+/g, '_')}.pdf`);
  },

  async generatePrescription(treatment: Treatment, medications: Medication[]) {
    const branding = await getBranding();
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "in",
      format: [4, 6]
    });

    // Branding Background
    doc.setFillColor(240, 247, 255);
    doc.rect(0, 0, 6, 4, 'F');

    if (branding.logo) {
      try {
        doc.addImage(branding.logo, 'PNG', 0.3, 0.3, 0.8, 0.8);
      } catch {
        // Ignore logo errors in PDF
      }
    }

    doc.setFontSize(16);
    doc.setTextColor(0, 120, 212);
    doc.setFont("helvetica", "bold");
    doc.text(branding.name, 1.2, 0.6);

    doc.setFontSize(18);
    doc.setTextColor(33, 33, 33);
    doc.text("MEDICATION CARD", 3, 1.3, { align: "center" });

    doc.setDrawColor(0, 120, 212);
    doc.setLineWidth(0.02);
    doc.line(0.5, 1.5, 5.5, 1.5);

    // Patient and Info
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 120, 212);
    doc.text("PATIENT:", 0.5, 1.8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(33, 33, 33);
    doc.text(treatment.patient_name, 1.2, 1.8);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 120, 212);
    doc.text("DATE:", 3.5, 1.8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(33, 33, 33);
    doc.text(treatment.date, 4.0, 1.8);

    doc.setFontSize(20);
    doc.setTextColor(0, 120, 212);
    doc.setFont("times", "italic", "bold");
    doc.text("Rx", 0.5, 2.2);
    doc.setTextColor(33, 33, 33);

    const medRows = medications.map(m => [
        m.name,
        m.dosage,
        m.frequency,
        m.duration,
        m.instructions || ""
    ]);

    doc.autoTable({
      startY: 2.3,
      head: [['Medication', 'Dosage', 'Freq.', 'Dur.', 'Instructions']],
      body: medRows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 0.05 },
      headStyles: { fillColor: [0, 120, 212], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 1.2 },
        1: { cellWidth: 0.7 },
        2: { cellWidth: 0.7 },
        3: { cellWidth: 0.7 },
        4: { cellWidth: 'auto' }
      },
      margin: { left: 0.5, right: 0.5 }
    });

    const y = doc.lastAutoTable.finalY + 0.3;

    // Signature area
    doc.setDrawColor(200, 200, 200);
    doc.line(3.5, y + 0.4, 5.5, y + 0.4);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`Dr. ${treatment.doctor_name || "_________________"}`, 4.5, y + 0.55, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Authorized Medical Practitioner", 4.5, y + 0.7, { align: "center" });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(branding.address, 3, 3.6, { align: "center" });
    doc.text(`Phone: ${branding.phone}`, 3, 3.75, { align: "center" });

    doc.save(`Medication_Card_${treatment.patient_name.replace(/\s+/g, '_')}.pdf`);
  },

  async generateTreatmentRecord(treatment: Treatment) {
    const branding = await getBranding();
    const doc = new jsPDF();
    let y = addLetterhead(doc, branding);

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(33, 33, 33);
    doc.text("CLINICAL TREATMENT RECORD", 105, y, { align: "center" });
    y += 15;

    // Patient Info Header
    doc.setFillColor(245, 247, 250);
    doc.rect(20, y, 170, 25, 'F');

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 120, 212);
    doc.text("PATIENT DETAILS", 25, y + 8);
    doc.text("RECORD DETAILS", 110, y + 8);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(33, 33, 33);
    doc.text(`Name: ${treatment.patient_name}`, 25, y + 14);
    doc.text(`ID: ${treatment.patient_id.split('-')[0].toUpperCase()}`, 25, y + 19);

    doc.text(`Date: ${treatment.date}`, 110, y + 14);
    doc.text(`Doctor: Dr. ${treatment.doctor_name || "N/A"}`, 110, y + 19);
    y += 35;

    // Diagnosis Section
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 120, 212);
    doc.text("DIAGNOSIS", 20, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(33, 33, 33);
    const diagnosisLines = doc.splitTextToSize(treatment.diagnosis || "No diagnosis recorded.", 170);
    doc.text(diagnosisLines, 20, y);
    y += (diagnosisLines.length * 6) + 10;

    // Treatment Section
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 120, 212);
    doc.text("TREATMENT PERFORMED", 20, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(33, 33, 33);
    const treatmentLines = doc.splitTextToSize(treatment.treatment || "No treatment details recorded.", 170);
    doc.text(treatmentLines, 20, y);
    y += (treatmentLines.length * 6) + 10;

    // Medications Section
    if (treatment.medications.length > 0) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 120, 212);
      doc.text("PRESCRIBED MEDICATIONS", 20, y);
      y += 5;

      const medRows = treatment.medications.map(m => [
        m.name,
        m.dosage,
        m.frequency,
        m.duration,
        m.instructions
      ]);

      doc.autoTable({
        startY: y,
        head: [['Medication', 'Dosage', 'Frequency', 'Duration', 'Instructions']],
        body: medRows,
        theme: 'striped',
        headStyles: { fillColor: [0, 120, 212] },
        styles: { fontSize: 9 },
        margin: { left: 20, right: 20 }
      });
      y = doc.lastAutoTable.finalY + 15;
    }

    // Notes Section
    if (treatment.notes) {
      if (y > 250) { doc.addPage(); y = 30; }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 120, 212);
      doc.text("CLINICAL NOTES", 20, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(33, 33, 33);
      const notesLines = doc.splitTextToSize(treatment.notes, 170);
      doc.text(notesLines, 20, y);
      y += (notesLines.length * 6) + 10;
    }

    // Financial Summary
    if (y > 240) { doc.addPage(); y = 30; }
    doc.setDrawColor(230, 230, 230);
    doc.line(20, y, 190, y);
    y += 10;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL COST:", 140, y);
    doc.text(`KSH ${treatment.cost.toLocaleString()}`, 190, y, { align: "right" });
    y += 25;

    // Signature Line
    if (y > 260) { doc.addPage(); y = 30; }
    doc.line(130, y, 190, y);
    doc.setFontSize(10);
    doc.text(`Dr. ${treatment.doctor_name || "_________________"}`, 160, y + 6, { align: "center" });
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Authorized Signature", 160, y + 10, { align: "center" });

    addFooter(doc, branding);
    doc.save(`Treatment_Record_${treatment.patient_name.replace(/\s+/g, '_')}.pdf`);
  },

  async generateReceipt(payment: Payment) {
    const branding = await getBranding();
    const doc = new jsPDF();
    let y = addLetterhead(doc, branding);

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("PAYMENT RECEIPT", 105, y, { align: "center" });
    y += 15;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Receipt No: ${payment.id.slice(0,8).toUpperCase()}`, 20, y);
    doc.text(`Date: ${payment.date}`, 150, y);
    y += 10;

    doc.autoTable({
      startY: y,
      head: [['Description', 'Amount']],
      body: [
        ['Dental Treatment Services', `$${payment.amount.toFixed(2)}`],
      ],
      foot: [['TOTAL PAID', `$${payment.amount.toFixed(2)}`]],
      theme: 'striped',
      headStyles: { fillColor: [46, 125, 50] }, // Green for payments
    });

    y = doc.lastAutoTable.finalY + 10;
    doc.text(`Payment Method: ${payment.method.toUpperCase()}`, 20, y);

    if (payment.notes) {
        y += 10;
        doc.text(`Notes: ${payment.notes}`, 20, y);
    }

    addFooter(doc, branding);
    doc.save(`Receipt_${payment.patient_name.replace(/\s+/g, '_')}.pdf`);
  },

  async generateInvoice(payment: Payment) {
    const branding = await getBranding();
    const doc = new jsPDF();
    let y = addLetterhead(doc, branding);

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE", 105, y, { align: "center" });
    y += 15;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Invoice No: INV-${payment.id.slice(0,8).toUpperCase()}`, 20, y);
    doc.text(`Date: ${payment.date}`, 150, y);
    y += 10;

    doc.text(`Bill To:`, 20, y);
    doc.setFont("helvetica", "bold");
    doc.text(payment.patient_name, 20, y + 5);
    y += 20;

    doc.autoTable({
      startY: y,
      head: [['Description', 'Quantity', 'Unit Price', 'Total']],
      body: [
        ['Dental Services / Treatment', '1', `$${payment.amount.toFixed(2)}`, `$${payment.amount.toFixed(2)}`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [33, 33, 33] },
    });

    y = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.text(`Total Amount: $${payment.amount.toFixed(2)}`, 190, y, { align: "right" });

    addFooter(doc, branding);
    doc.save(`Invoice_${payment.patient_name.replace(/\s+/g, '_')}.pdf`);
  },

  async generateSickSheet(sheet: SickSheet) {
    const branding = await getBranding();
    const doc = new jsPDF();
    let y = addLetterhead(doc, branding);

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("MEDICAL CERTIFICATE / SICK SHEET", 105, y, { align: "center" });
    y += 20;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    const content = `This is to certify that ${sheet.patient_name} was examined and found to be unfit for work/duty for the period from ${sheet.start_date} to ${sheet.end_date}.`;

    const lines = doc.splitTextToSize(content, 170);
    doc.text(lines, 20, y);
    y += (lines.length * 7) + 10;

    doc.setFont("helvetica", "bold");
    doc.text("Reason / Diagnosis:", 20, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    const reasonLines = doc.splitTextToSize(sheet.reason, 170);
    doc.text(reasonLines, 20, y);
    y += (reasonLines.length * 7) + 30;

    doc.line(20, y, 70, y);
    doc.text(`Dr. ${sheet.doctor_name}`, 20, y + 5);
    doc.setFontSize(8);
    doc.text("Medical Practitioner Signature", 20, y + 10);

    addFooter(doc, branding);
    doc.save(`Sick_Sheet_${sheet.patient_name.replace(/\s+/g, '_')}.pdf`);
  },

  async generateReport(
    startDate: string,
    endDate: string,
    appointments: Appointment[],
    treatments: Treatment[],
    payments: Payment[],
    patients: Patient[]
  ) {
    const branding = await getBranding();
    const doc = new jsPDF();
    let y = addLetterhead(doc, branding);

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(33, 33, 33);
    doc.text("CLINIC PERFORMANCE REPORT", 105, y, { align: "center" });
    y += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Period: ${startDate} to ${endDate}`, 105, y, { align: "center" });
    y += 15;

    // Summary Section
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalBilled = treatments.reduce((sum, t) => sum + t.cost, 0);
    const completedAppts = appointments.filter(a => a.status === 'completed').length;
    const cancelledAppts = appointments.filter(a => a.status === 'cancelled').length;

    doc.setFillColor(245, 247, 250);
    doc.rect(20, y, 170, 50, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Executive Summary", 25, y + 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    // Left Column
    doc.text(`Total Appointments: ${appointments.length}`, 25, y + 20);
    doc.text(`Completed Appointments: ${completedAppts}`, 25, y + 26);
    doc.text(`Cancelled Appointments: ${cancelledAppts}`, 25, y + 32);
    doc.text(`New Patients Registered: ${patients.length}`, 25, y + 38);

    // Right Column
    doc.setFont("helvetica", "bold");
    doc.text(`Total Billed: KSH ${totalBilled.toLocaleString()}`, 110, y + 20);
    doc.setTextColor(46, 125, 50); // Green
    doc.text(`Total Collected: KSH ${totalRevenue.toLocaleString()}`, 110, y + 26);
    doc.setTextColor(33, 33, 33); // Reset
    doc.setFont("helvetica", "normal");
    doc.text(`Collection Rate: ${totalBilled > 0 ? ((totalRevenue / totalBilled) * 100).toFixed(1) : 0}%`, 110, y + 32);
    doc.text(`Avg. Revenue / Appointment: KSH ${completedAppts > 0 ? (totalRevenue / completedAppts).toFixed(0) : 0}`, 110, y + 38);

    y += 65;

    // 1. New Patients
    if (patients.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("New Patients Registered", 20, y);
      y += 7;

      const patientRows = patients.map(p => [
        new Date(p.created_at).toLocaleDateString(),
        p.name,
        p.phone,
        p.email || 'N/A'
      ]);

      doc.autoTable({
        startY: y,
        head: [['Date Registered', 'Patient Name', 'Phone', 'Email']],
        body: patientRows,
        theme: 'striped',
        headStyles: { fillColor: [0, 120, 212] },
      });
      y = doc.lastAutoTable.finalY + 15;
    }

    // 2. Active Appointments
    const activeAppts = appointments.filter(a => a.status !== 'cancelled');
    if (activeAppts.length > 0) {
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Appointments (Active/Completed)", 20, y);
      y += 7;

      const apptRows = activeAppts.map(a => [
        a.date,
        a.time,
        a.patient_name,
        a.appointment_type,
        a.status.toUpperCase()
      ]);

      doc.autoTable({
        startY: y,
        head: [['Date', 'Time', 'Patient', 'Type', 'Status']],
        body: apptRows,
        theme: 'striped',
        headStyles: { fillColor: [0, 120, 212] },
      });
      y = doc.lastAutoTable.finalY + 15;
    }

    // 3. Cancelled Appointments
    if (cancelledAppts > 0) {
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(200, 0, 0);
      doc.text("Cancelled Appointments", 20, y);
      doc.setTextColor(33, 33, 33);
      y += 7;

      const cancelledRows = appointments.filter(a => a.status === 'cancelled').map(a => [
        a.date,
        a.patient_name,
        a.appointment_type,
        a.notes || 'No reason provided'
      ]);

      doc.autoTable({
        startY: y,
        head: [['Date', 'Patient', 'Type', 'Cancellation Notes']],
        body: cancelledRows,
        theme: 'striped',
        headStyles: { fillColor: [180, 0, 0] },
      });
      y = doc.lastAutoTable.finalY + 15;
    }

    // 4. Detailed Transaction Log
    if (payments.length > 0) {
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Detailed Transaction Log", 20, y);
      y += 7;

      const paymentRows = payments.map(p => [
        p.date,
        p.patient_name,
        p.method.toUpperCase(),
        `KSH ${p.amount.toLocaleString()}`
      ]);

      doc.autoTable({
        startY: y,
        head: [['Date', 'Patient', 'Method', 'Amount']],
        body: paymentRows,
        theme: 'grid',
        headStyles: { fillColor: [46, 125, 50] },
      });
    }

    addFooter(doc, branding);
    doc.save(`Full_Clinic_Report_${startDate}_to_${endDate}.pdf`);
  }
};
