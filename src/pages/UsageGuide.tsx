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
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
          <BookOpen className="h-10 w-10 text-blue-600" />
          Usage Guide
        </h1>
        <p className="text-gray-600 text-lg">
          Learn how to use DentalCare to manage your clinic efficiently.
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto p-1 bg-gray-100 rounded-xl">
          <TabsTrigger value="general" className="py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">General Info</TabsTrigger>
          <TabsTrigger value="reception" className="py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Reception</TabsTrigger>
          <TabsTrigger value="doctor" className="py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Doctor</TabsTrigger>
          <TabsTrigger value="admin" className="py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Admin</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-blue-50/50">
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-blue-600" />
                Hub-and-Spoke Architecture
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <p>
                DentalCare uses a unique architecture designed for reliability and speed in local networks:
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <h4 className="font-bold text-blue-700 mb-2">The Hub</h4>
                  <p className="text-sm text-gray-600">
                    The central server that stores the master database. Only one instance in your clinic should be the Hub.
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <h4 className="font-bold text-indigo-700 mb-2">The Spoke</h4>
                  <p className="text-sm text-gray-600">
                    Client instances that connect to the Hub. They maintain a local cache, allowing you to work even if the connection is temporarily lost.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-100">
                <Shield className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-800">Automatic Sync</h4>
                  <p className="text-sm text-amber-700">
                    Changes made on Spokes are automatically synced to the Hub. If a conflict occurs, the newest change (based on timestamp) wins.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gray-50/50">
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-gray-600" />
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
