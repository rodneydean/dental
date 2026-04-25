import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Users,
  Stethoscope,
  CreditCard,
  Settings,
  Database,
  Cloud,
  Shield,
  History as HistoryIcon,
  Wifi,
  Network,
  AlertCircle,
  CheckCircle2,
  FileBarChart,
  Zap,
  Printer,
} from "lucide-react";

/**
 * UsageGuide component provides a comprehensive manual for Skryme Dental.
 */
const UsageGuide = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <BookOpen className="h-6 w-6 mr-3 text-primary" />
            System Operations Manual
          </h1>
          <p className="text-sm text-gray-500 mt-1">Complete guide for clinic administrators, doctors, and receptionists.</p>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-11 p-1 bg-gray-100 border border-gray-200 rounded-sm">
          <TabsTrigger value="general" className="text-xs font-bold uppercase tracking-wider rounded-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Networking & General</TabsTrigger>
          <TabsTrigger value="reception" className="text-xs font-bold uppercase tracking-wider rounded-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Reception Workflow</TabsTrigger>
          <TabsTrigger value="doctor" className="text-xs font-bold uppercase tracking-wider rounded-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Clinical (Doctor)</TabsTrigger>
          <TabsTrigger value="admin" className="text-xs font-bold uppercase tracking-wider rounded-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Admin & Reports</TabsTrigger>
        </TabsList>

        {/* --- GENERAL / NETWORKING TAB --- */}
        <TabsContent value="general" className="mt-8 space-y-8">
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <Network className="h-5 w-5 mr-2 text-primary" />
              Hub-and-Spoke Architecture
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Skryme Dental operates as a distributed system designed for maximum uptime. Unlike cloud-based systems, it lives entirely within your clinic's local network.
            </p>

            <div className="grid md:grid-cols-2 gap-6 mt-4">
              <Card className="border border-blue-100 bg-blue-50/20 shadow-sm rounded-sm">
                <CardHeader className="py-3 px-4 border-b border-blue-100 bg-blue-50/50">
                  <CardTitle className="text-xs font-bold uppercase tracking-widest text-primary flex items-center">
                    <Database className="h-4 w-4 mr-2" />
                    The Hub (Master)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    The central server of your clinic. It holds the <strong>Master Database</strong> and handles all data synchronization.
                  </p>
                  <ul className="text-[11px] text-gray-500 space-y-1 list-disc pl-4">
                    <li>Must be powered on for Spokes to sync.</li>
                    <li>Only one Hub is allowed per clinic.</li>
                    <li>All backups should be performed on this machine.</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border border-indigo-100 bg-indigo-50/20 shadow-sm rounded-sm">
                <CardHeader className="py-3 px-4 border-b border-indigo-100 bg-indigo-50/50">
                  <CardTitle className="text-xs font-bold uppercase tracking-widest text-indigo-700 flex items-center">
                    <Cloud className="h-4 w-4 mr-2" />
                    The Spoke (Client)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Workstation instances used by Doctors or Receptionists. They connect to the Hub via WiFi or Ethernet.
                  </p>
                  <ul className="text-[11px] text-gray-500 space-y-1 list-disc pl-4">
                    <li>Maintains a local cache for speed.</li>
                    <li>Syncs changes to the Hub in real-time.</li>
                    <li>Can view data even if the network is temporarily disconnected.</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <Wifi className="h-5 w-5 mr-2 text-primary" />
              Connecting Spokes to the Hub
            </h2>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold shrink-0">1</div>
                <div className="space-y-1">
                  <p className="font-bold text-sm text-gray-800">Identify Hub Connection Info</p>
                  <p className="text-xs text-gray-600">On the <strong>Hub machine</strong>, go to <strong>Settings &gt; Network</strong>. Note down the 6-character <strong>Pairing Code</strong> and the <strong>Hub IP Address</strong> (e.g., 192.168.1.15).</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold shrink-0">2</div>
                <div className="space-y-1">
                  <p className="font-bold text-sm text-gray-800">Standard Setup (WiFi/Ethernet)</p>
                  <p className="text-xs text-gray-600">Open Skryme Dental on the <strong>Spoke machine</strong>. During initial setup, select "Spoke Mode" and enter the <strong>Pairing Code</strong>. The system will attempt automatic discovery via mDNS.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold shrink-0">3</div>
                <div className="space-y-1">
                  <p className="font-bold text-sm text-gray-800">Manual IP Fallback</p>
                  <p className="text-xs text-gray-600">If automatic discovery fails (common on restricted Ethernet networks), click <strong>"Advanced Connection"</strong> and enter the <strong>Hub IP Address</strong> directly.</p>
                </div>
              </div>
            </div>

            {/* TROUBLESHOOTING BOX */}
            <div className="p-5 bg-amber-50 border border-amber-200 rounded-sm space-y-3">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertCircle className="h-5 w-5" />
                <h4 className="text-sm font-bold uppercase tracking-tight">Troubleshooting: Connection Failures</h4>
              </div>
              <ul className="text-xs text-amber-700 space-y-2 list-disc pl-5">
                <li><strong>Same Subnet:</strong> Ensure both Hub and Spoke are on the same network. If Hub is on Ethernet and Spoke on WiFi, ensure the router allows cross-communication.</li>
                <li><strong>Windows Firewall:</strong> Ensure "Skryme Dental" is allowed through the Windows Firewall on the Hub machine. It needs to listen on the local network port.</li>
                <li><strong>Antivirus:</strong> Some third-party antivirus software blocks mDNS (discovery). Use the <strong>Manual IP Address</strong> if this occurs.</li>
                <li><strong>Ethernet vs WiFi:</strong> Ethernet is significantly more stable. If using WiFi, ensure the signal is strong.</li>
              </ul>
            </div>

            {/* PRO TIP BOX */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-sm flex items-start gap-3">
              <Zap className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-800 uppercase tracking-tight">Pro-Tip: Static IPs</p>
                <p className="text-xs text-emerald-700 mt-1">Assign a <strong>Static IP</strong> to your Hub machine in your router settings. This prevents the connection from breaking if the Hub's IP address changes after a router restart.</p>
              </div>
            </div>
          </section>
        </TabsContent>

        {/* --- RECEPTION TAB --- */}
        <TabsContent value="reception" className="mt-8 space-y-8">
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <Users className="h-5 w-5 mr-2 text-primary" />
              Reception Command Center
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              The Reception Hub is the "Air Traffic Control" for your clinic. It manages the entire patient flow from arrival to admission.
            </p>

            <div className="space-y-6 mt-6 border-l-2 border-gray-100 ml-4 pl-8 relative">
              <div className="relative">
                <div className="absolute -left-[41px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-white shadow-sm" />
                <h4 className="font-bold text-sm text-gray-800">1. Verification & Search</h4>
                <p className="text-xs text-gray-500 mt-1">Use the search bar to find existing patients by Name or Phone. For new patients, use the <strong>"New Walk-in"</strong> button to quickly register them.</p>
              </div>

              <div className="relative">
                <div className="absolute -left-[41px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-white shadow-sm" />
                <h4 className="font-bold text-sm text-gray-800">2. Fee Collection (Cash or Insurance)</h4>
                <p className="text-xs text-gray-500 mt-1">If the clinic requires a Reception Fee, it must be recorded before admission.
                  <br /><span className="text-blue-600 font-medium italic">— Insurance:</span> If a patient's insurance provider is configured to "Pay Reception Fee", you can select them from the list to waive the cash payment.
                </p>
              </div>

              <div className="relative">
                <div className="absolute -left-[41px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-white shadow-sm" />
                <h4 className="font-bold text-sm text-gray-800">3. Admission to Waiting Room</h4>
                <p className="text-xs text-gray-500 mt-1">Click <strong>"Admit"</strong>. This moves the patient into the Waiting Room queue and sends an instant notification to all Doctors on the network.</p>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-sm flex items-start gap-3 mt-6">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-xs font-bold text-primary uppercase tracking-tight">Queue Monitoring</p>
                <p className="text-xs text-primary/80 mt-1">The right panel of the Reception Hub shows the <strong>Live Queue</strong>. You can see who is currently in consultation and who is still waiting, including their wait time.</p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <CreditCard className="h-5 w-5 mr-2 text-primary" />
              Payments & Billing
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Once a doctor completes a treatment, it appears in the <strong>Payments</strong> page.
            </p>
            <ul className="text-xs text-gray-600 space-y-2 list-disc pl-5">
              <li><strong>Pending Payments:</strong> All treatments that haven't been paid for.</li>
              <li><strong>Invoices:</strong> Automatically generated based on the service fees set by the Admin.</li>
              <li><strong>Waivers:</strong> If a patient cannot pay the full amount, use "Request Waiver". This requires real-time approval from an Admin or Doctor account.</li>
            </ul>
          </section>
        </TabsContent>

        {/* --- DOCTOR TAB --- */}
        <TabsContent value="doctor" className="mt-8 space-y-8">
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <Zap className="h-5 w-5 mr-2 text-primary" />
              Clinical Command Center (Doctor Dashboard)
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              The new <strong>Doctor Dashboard</strong> is a high-efficiency workbench designed for rapid patient serving and real-time clinical management.
            </p>

            <div className="grid md:grid-cols-2 gap-6 mt-4">
              <div className="space-y-4">
                <p className="text-sm font-bold text-gray-800">Keyboard Shortcuts</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-gray-50 border border-gray-100 rounded-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Call Next Patient</p>
                    <p className="text-xs font-bold text-primary mt-0.5">Alt + N</p>
                  </div>
                  <div className="p-2 bg-gray-50 border border-gray-100 rounded-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Search Patients</p>
                    <p className="text-xs font-bold text-primary mt-0.5">Alt + S</p>
                  </div>
                  <div className="p-2 bg-gray-50 border border-gray-100 rounded-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Today's Schedule</p>
                    <p className="text-xs font-bold text-primary mt-0.5">Alt + T</p>
                  </div>
                  <div className="p-2 bg-gray-50 border border-gray-100 rounded-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Go Home / Dashboard</p>
                    <p className="text-xs font-bold text-primary mt-0.5">Alt + H</p>
                  </div>
                </div>

                <p className="text-sm font-bold text-gray-800 mt-6">Smart Queue Logic</p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  When you click <strong>"Call Next"</strong>, the system automatically prioritizes:
                  <br />1. Patients specifically assigned to you by Reception.
                  <br />2. General walk-in patients (if no assigned patients remain).
                </p>
              </div>

              <div className="space-y-4">
                <p className="text-sm font-bold text-gray-800">Clinical Analytics</p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Monitor your daily efficiency with real-time metrics:
                </p>
                <ul className="text-[11px] text-gray-500 space-y-1 list-disc pl-4">
                  <li><strong>Served Today:</strong> Count of patients you have treated.</li>
                  <li><strong>Avg Consultation:</strong> Your average time per patient today.</li>
                  <li><strong>Volume Trend:</strong> A 7-day chart of clinical activity.</li>
                </ul>
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-sm mt-2">
                   <p className="text-[10px] font-bold text-[#0078d4] uppercase tracking-widest mb-1">Enterprise Workbench</p>
                   <p className="text-[11px] text-[#0078d4]/80 italic">The dashboard is designed to remain open as your primary tool throughout the day.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <Stethoscope className="h-5 w-5 mr-2 text-primary" />
              Clinical Workflow
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <p className="text-sm font-bold text-gray-800">Starting a Consultation</p>
                <p className="text-xs text-gray-600 leading-relaxed">
                   Patients appear in your dashboard queue as soon as they are admitted by Reception. Click <strong>"Call Next"</strong> or the <strong>"Call"</strong> icon next to a specific patient to begin. This will automatically open the <strong>Patient Sheet</strong>.
                </p>

                <p className="text-sm font-bold text-gray-800">Recording Treatment</p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Use the <strong>Treatment Form</strong> to record:
                </p>
                <ul className="text-[11px] text-gray-500 space-y-1 list-disc pl-4">
                  <li><strong>Diagnosis:</strong> Clinical findings.</li>
                  <li><strong>Services:</strong> Select from the clinic's fee schedule. Fees are auto-applied but can be manually overridden.</li>
                  <li><strong>Medications:</strong> Prescribe drugs with specific dosages and frequencies.</li>
                </ul>
              </div>

              <Card className="border-none shadow-sm bg-gray-50 p-4 rounded-sm">
                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3 flex items-center">
                  <Printer className="h-4 w-4 mr-2" />
                  Professional Documents
                </h4>
                <p className="text-[11px] text-gray-600 mb-4 italic">Generate branded PDFs with your digital signature line:</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-white rounded-sm border border-gray-100">
                    <span className="text-[11px] font-bold">Sick Sheets</span>
                    <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none text-[9px] rounded-sm">A5 FORMAT</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white rounded-sm border border-gray-100">
                    <span className="text-[11px] font-bold">Medication Cards</span>
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none text-[9px] rounded-sm">PHARMACY READY</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white rounded-sm border border-gray-100">
                    <span className="text-[11px] font-bold">Clinical Records</span>
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[9px] rounded-sm">A4 FORMAT</Badge>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <HistoryIcon className="h-5 w-5 mr-2 text-primary" />
              Patient Sheet & Clinical History
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              The <strong>Patient Sheet</strong> is the central hub for a patient's medical life. It provides a <strong>Unified Timeline</strong> of every note, treatment, and prescription ever recorded.
            </p>

            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-sm">
              <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-tight">Clinical Note Categories</h4>
              <p className="text-[11px] text-indigo-700 mt-1">
                Admins can configure Note Categories (e.g., Chief Complaints, Dental History, Observations). Using these ensures consistent record-keeping across all doctors.
              </p>
            </div>

            {/* PRO TIP BOX */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-sm flex items-start gap-3">
              <Zap className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-800 uppercase tracking-tight">Pro-Tip: Auto-Attribution</p>
                <p className="text-xs text-emerald-700 mt-1">Every treatment and note is automatically tagged with your Name and ID. Ensure you are logged into your own account before recording clinical data.</p>
              </div>
            </div>
          </section>
        </TabsContent>

        {/* --- ADMIN TAB --- */}
        <TabsContent value="admin" className="mt-8 space-y-8">
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <Shield className="h-5 w-5 mr-2 text-primary" />
              System Administration & Security
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 border border-gray-100 rounded-sm bg-white">
                <h4 className="font-bold text-sm flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-primary" />
                  User Roles (RBAC)
                </h4>
                <ul className="text-xs text-gray-600 space-y-2">
                  <li><strong>ADMIN:</strong> Full access to settings, users, and all clinical data.</li>
                  <li><strong>DOCTOR:</strong> Access to clinical workflows, patient history, and reports.</li>
                  <li><strong>RECEPTION:</strong> Restricted to the Command Center, registration, and payments. Cannot see clinical notes.</li>
                </ul>
              </div>
              <div className="p-4 border border-gray-100 rounded-sm bg-white">
                <h4 className="font-bold text-sm flex items-center gap-2 mb-2">
                  <Settings className="h-4 w-4 text-primary" />
                  Services & Fees
                </h4>
                <p className="text-xs text-gray-600">
                  Configure the list of treatments your clinic provides. Set standard fees in Kenyan Shillings (KSH). These populate the dropdowns in treatment forms.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <FileBarChart className="h-5 w-5 mr-2 text-primary" />
              Clinic Reports & Analytics
            </h2>
            <p className="text-sm text-gray-600">The <strong>Reports</strong> page provides high-level financial and operational insights.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 bg-gray-50 border border-gray-100 rounded-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Billed</p>
                <p className="text-xs font-bold text-gray-700 mt-1">Cost of all treatments recorded.</p>
              </div>
              <div className="p-3 bg-gray-50 border border-gray-100 rounded-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Collected</p>
                <p className="text-xs font-bold text-green-700 mt-1">Actual cash/insurance payments received.</p>
              </div>
              <div className="p-3 bg-gray-50 border border-gray-100 rounded-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Collection Rate</p>
                <p className="text-xs font-bold text-blue-700 mt-1">The percentage of billed revenue actually collected.</p>
              </div>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-sm flex items-start gap-3">
              <Database className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-800 uppercase tracking-tight">Data Safety & Backups</p>
                <p className="text-xs text-emerald-700 mt-1">Regularly export your database from the <strong>Data Management</strong> page. Store these exports on an external drive or cloud storage to ensure you never lose patient history.</p>
              </div>
            </div>
          </section>
        </TabsContent>
      </Tabs>

      {/* Footer Support */}
      <div className="border-t border-gray-200 pt-8 text-center">
        <p className="text-sm text-gray-500">Need more help? Contact your system administrator or refer to the technical documentation.</p>
        <p className="text-[10px] text-gray-400 mt-2 font-mono uppercase tracking-widest">Skryme Dental v2.0.0 • Local Network First Architecture</p>
      </div>
    </div>
  );
};

export default UsageGuide;
