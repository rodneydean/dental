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
    const doc = new jsPDF();
    let y = addLetterhead(doc, branding);

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("PRESCRIPTION", 105, y, { align: "center" });
    y += 15;

    doc.setFontSize(12);
    doc.text(`Patient: ${treatment.patient_name}`, 20, y);
    doc.text(`Date: ${treatment.date}`, 150, y);
    y += 10;

    doc.setFontSize(24);
    doc.setTextColor(0, 120, 212);
    doc.text("Rx", 20, y);
    y += 10;
    doc.setTextColor(33, 33, 33);

    const medRows = medications.map(m => [
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
      theme: 'grid',
      headStyles: { fillColor: [0, 120, 212] },
    });

    y = doc.lastAutoTable.finalY + 30;
    doc.line(130, y, 180, y);
    doc.setFontSize(10);
    doc.text("Doctor's Signature", 135, y + 5);

    addFooter(doc, branding);
    doc.save(`Prescription_${treatment.patient_name.replace(/\s+/g, '_')}.pdf`);
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
  }
};
