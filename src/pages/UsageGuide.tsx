import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  Users,
  Stethoscope,
  CreditCard,
  Settings,
  Database,
  Cloud,
  Shield,
  HelpCircle,
  ArrowRight,
} from "lucide-react";

/**
 * UsageGuide component provides a comprehensive guide for users.
 * Note: When adding new role-specific instructions, ensure they align with RBAC permissions.
 */
const UsageGuide = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center">
            <BookOpen className="h-5 w-5 mr-3 text-primary" />
            System Usage Guide
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Learn how to use DentalCare to manage your clinic efficiently.</p>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-9 p-1 bg-gray-100 border border-gray-200 rounded-sm">
          <TabsTrigger value="general" className="text-xs font-semibold uppercase tracking-wider rounded-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">General</TabsTrigger>
          <TabsTrigger value="reception" className="text-xs font-semibold uppercase tracking-wider rounded-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Reception</TabsTrigger>
          <TabsTrigger value="doctor" className="text-xs font-semibold uppercase tracking-wider rounded-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Doctor</TabsTrigger>
          <TabsTrigger value="admin" className="text-xs font-semibold uppercase tracking-wider rounded-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Admin</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-4">
          <Card className="border border-gray-200 shadow-sm rounded-sm bg-white overflow-hidden">
            <CardHeader className="bg-gray-50/50 border-b border-gray-200 py-3 px-4">
              <CardTitle className="flex items-center text-xs font-bold uppercase tracking-widest text-gray-900">
                <Cloud className="h-4 w-4 mr-2 text-primary" />
                Hub-and-Spoke Architecture
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                DentalCare uses a unique architecture designed for reliability and speed in local networks:
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50/50 rounded-sm border border-gray-100">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">The Hub</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    The central server that stores the master database. Only one instance in your clinic should be the Hub.
                  </p>
                </div>
                <div className="p-4 bg-gray-50/50 rounded-sm border border-gray-100">
                  <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">The Spoke</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Client instances that connect to the Hub. They maintain a local cache, allowing you to work even if the connection is temporarily lost.
                  </p>
                </div>
              </div>

              <div className="mt-6 border-t border-gray-100 pt-6">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-4">Pairing & Setup</h4>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0">1</div>
                    <div>
                      <p className="text-xs font-bold text-gray-700">Get the Code from the Hub</p>
                      <p className="text-xs text-gray-500 mt-1">Go to <strong>Settings</strong> on your Hub instance. Look for the "Pairing Code" in the Network section.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0">2</div>
                    <div>
                      <p className="text-xs font-bold text-gray-700">Enter Code on Spoke</p>
                      <p className="text-xs text-gray-500 mt-1">When setting up a Spoke, enter the 6-character code. The Spoke will try to find the Hub automatically using mDNS.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0">3</div>
                    <div>
                      <p className="text-xs font-bold text-gray-700">Manual Connection (Fallback)</p>
                      <p className="text-xs text-gray-500 mt-1">If automatic discovery fails, enter the Hub's IP address (displayed in the Hub's Settings page) in the "Hub Address" field on the Spoke.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-blue-50/50 rounded-sm border border-blue-100">
                <Shield className="h-4 w-4 text-primary mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-primary uppercase tracking-tight">Automatic Sync</h4>
                  <p className="text-xs text-primary/70 mt-1">
                    Changes made on Spokes are automatically synced to the Hub. If a conflict occurs, the newest change (based on timestamp) wins.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm rounded-sm bg-white overflow-hidden">
            <CardHeader className="bg-gray-50/50 border-b border-gray-200 py-3 px-4">
              <CardTitle className="flex items-center text-xs font-bold uppercase tracking-widest text-gray-900">
                <HelpCircle className="h-4 w-4 mr-2 text-gray-500" />
                Basic Navigation
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="p-1 bg-blue-100 rounded text-blue-600 mt-1">
                    <ArrowRight className="h-3 w-3" />
                  </div>
                  <span><strong>Dashboard:</strong> Quick overview of today's stats and recent activity.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-1 bg-blue-100 rounded text-blue-600 mt-1">
                    <ArrowRight className="h-3 w-3" />
                  </div>
                  <span><strong>Connection Status:</strong> Check the cloud icon in the top navigation bar to see if you're connected to the Hub.</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reception" className="mt-6 space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-emerald-50/50">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-600" />
                Patient & Appointment Management
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-4">
                <h4 className="font-bold flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">1</span>
                  Registering a Patient
                </h4>
                <p className="text-sm text-gray-600 ml-8">
                  Go to the <strong>Patients</strong> page and click "New Patient". Fill in the details. Patients can be searched by name or ID.
                </p>

                <h4 className="font-bold flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">2</span>
                  Booking Appointments
                </h4>
                <p className="text-sm text-gray-600 ml-8">
                  Use the <strong>Appointments</strong> page to schedule visits. You can select an existing patient and choose a time slot.
                </p>

                <h4 className="font-bold flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">3</span>
                  Admission Process
                </h4>
                <div className="ml-8 p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                  <p className="text-sm text-emerald-800">
                    When a patient arrives, go to the <strong>Waiting Room</strong> and "Admit" them. This notifies the doctors that a patient is ready.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gray-50/50">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-gray-600" />
                Payments & Billing
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm">
                Once a treatment is completed, the payment record is generated. Go to <strong>Payments</strong> to process the transaction.
              </p>
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
                <h4 className="font-bold text-amber-800 text-sm mb-1">Fee Waivers</h4>
                <p className="text-xs text-amber-700">
                  If a patient requests a discount or waiver, you can "Request Waiver" in the payment screen. An Admin or Doctor must approve it in real-time before it's applied.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="doctor" className="mt-6 space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-purple-50/50">
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-purple-600" />
                Clinical Workflow
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-4">
                <h4 className="font-bold flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs">1</span>
                  Serving Patients
                </h4>
                <p className="text-sm text-gray-600 ml-8">
                  Check the <strong>Waiting Room</strong>. Admitted patients appear here. Click "Start Consultation" to begin.
                </p>

                <h4 className="font-bold flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs">2</span>
                  Recording Treatments
                </h4>
                <p className="text-sm text-gray-600 ml-8">
                  During consultation, record diagnoses, treatments, and prescribed medications. This information becomes part of the patient's permanent clinical record.
                </p>

                <h4 className="font-bold flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs">3</span>
                  Authorizing Waivers
                </h4>
                <p className="text-sm text-gray-600 ml-8">
                  Doctors have the authority to approve fee waiver requests from the Reception. You'll receive a notification when a request is pending.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admin" className="mt-6 space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-indigo-50/50">
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-indigo-600" />
                System Administration
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 border border-gray-100 rounded-lg">
                  <h4 className="font-bold flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-indigo-600" />
                    User Management
                  </h4>
                  <p className="text-xs text-gray-600">
                    Create and manage staff accounts. Assign roles (Admin, Reception, Doctor) carefully as they control access to sensitive medical data.
                  </p>
                </div>
                <div className="p-4 border border-gray-100 rounded-lg">
                  <h4 className="font-bold flex items-center gap-2 mb-2">
                    <Settings className="h-4 w-4 text-indigo-600" />
                    System Settings
                  </h4>
                  <p className="text-xs text-gray-600">
                    Configure clinic-wide settings like the standard Reception Fee and application preferences.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gray-50/50">
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-gray-600" />
                Data & Backups
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-sm mb-4">
                The <strong>Data Management</strong> page allows you to safeguard your clinic's data.
              </p>
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                <p className="text-sm text-indigo-800">
                  <strong>Recommendation:</strong> Perform regular backups from the Hub instance. Backups include all patients, clinical records, and financial history.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UsageGuide;
