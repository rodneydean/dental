import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Users,
  Stethoscope,
  DollarSign,
  Clock,
  Plus,
  TrendingUp,
  Activity,
  CheckCircle2,
  CalendarDays,
  CreditCard,
  UserPlus,
} from "lucide-react";
import { Link } from "react-router-dom";
import { dataManager, Patient, Appointment, Treatment, Payment } from "@/lib/dataManager";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [loadedPatients, loadedAppointments, loadedTreatments, loadedPayments] = await Promise.all([
        dataManager.getPatients(),
        dataManager.getAppointments(),
        dataManager.getTreatments(),
        dataManager.getPayments()
      ]);
      setPatients(loadedPatients);
      setAppointments(loadedAppointments);
      setTreatments(loadedTreatments);
      setPayments(loadedPayments);
    } catch (error) {
      console.error("Failed to load dashboard data", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTodayAppointments = () => {
    const today = new Date().toISOString().split("T")[0];
    return appointments.filter((apt) => apt.date === today);
  };

  const getTotalRevenue = () => {
    return payments.reduce((total, p) => total + p.amount, 0);
  };

  const formatCurrency = (amount: number) => {
    return `KSH ${amount.toLocaleString()}`;
  };

  const getRecentActivity = () => {
    const activity = [
      ...patients.map(p => ({ type: 'patient', date: p.created_at, title: 'New Patient Registered', name: p.name })),
      ...appointments.map(a => ({ type: 'appointment', date: a.created_at, title: 'Appointment Scheduled', name: a.patient_name })),
      ...treatments.map(t => ({ type: 'treatment', date: t.created_at, title: 'Treatment Recorded', name: t.patient_name })),
      ...payments.map(p => ({ type: 'payment', date: p.created_at, title: 'Payment Received', name: p.patient_name, amount: p.amount })),
    ];
    return activity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px]">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
            {user?.role ? user.role.charAt(0) + user.role.slice(1).toLowerCase() : 'User'} Dashboard
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Welcome back, {user?.full_name}. Here's the current status of DentalCare clinic.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {user?.role === "RECEPTION" ? (
            <>
              <Link to="/patients">
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-white">
                  <UserPlus className="mr-2 h-4 w-4" />
                  New Patient
                </Button>
              </Link>
              <Link to="/appointments">
                <Button variant="outline" size="sm" className="border-gray-300">
                  <Calendar className="mr-2 h-4 w-4" />
                  Book Appointment
                </Button>
              </Link>
            </>
          ) : user?.role === "DOCTOR" ? (
            <Link to="/treatments">
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-white">
                <Plus className="mr-2 h-4 w-4" />
                New Treatment
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-gray-200 shadow-sm rounded-sm">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Today's Appointments</p>
                <p className="text-2xl font-bold mt-1 text-gray-900">{getTodayAppointments().length}</p>
              </div>
              <div className="p-2 bg-blue-50 rounded-sm">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="mt-3 flex items-center text-xs text-gray-500">
              <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
              <span className="font-medium text-green-600">{appointments.filter(a => a.status === 'scheduled').length}</span>
              <span className="ml-1">upcoming scheduled</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-sm rounded-sm">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Total Revenue</p>
                <p className="text-2xl font-bold mt-1 text-gray-900">{formatCurrency(getTotalRevenue())}</p>
              </div>
              <div className="p-2 bg-green-50 rounded-sm">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <div className="mt-3 flex items-center text-xs text-gray-500">
              <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
              <span className="font-medium text-green-600">{payments.length}</span>
              <span className="ml-1">processed transactions</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-sm rounded-sm">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Total Patients</p>
                <p className="text-2xl font-bold mt-1 text-gray-900">{patients.length}</p>
              </div>
              <div className="p-2 bg-purple-50 rounded-sm">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
            </div>
            <div className="mt-3 flex items-center text-xs text-gray-500">
              <Activity className="h-3 w-3 mr-1 text-primary" />
              <span className="font-medium text-primary">Active</span>
              <span className="ml-1">patient database</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-sm rounded-sm">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Treatments Done</p>
                <p className="text-2xl font-bold mt-1 text-gray-900">{treatments.length}</p>
              </div>
              <div className="p-2 bg-orange-50 rounded-sm">
                <Stethoscope className="h-5 w-5 text-orange-600" />
              </div>
            </div>
            <div className="mt-3 flex items-center text-xs text-gray-500">
              <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
              <span className="font-medium text-green-600">Verified</span>
              <span className="ml-1">clinical records</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Schedule */}
          <Card className="border border-gray-200 shadow-sm rounded-sm bg-white overflow-hidden">
            <CardHeader className="bg-gray-50/50 border-b border-gray-200 py-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-900 flex items-center uppercase tracking-wider">
                  <Clock className="mr-2 h-4 w-4 text-primary" />
                  Today's Schedule
                </CardTitle>
                <Link to="/appointments" className="text-xs font-medium text-primary hover:underline">
                  View Full Calendar
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {getTodayAppointments().length > 0 ? (
                  getTodayAppointments().map((apt) => (
                    <div key={apt.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="text-center min-w-[50px]">
                          <p className="text-sm font-semibold text-gray-900">{apt.time}</p>
                          <p className="text-[10px] text-gray-500">{apt.duration} min</p>
                        </div>
                        <div className="h-8 w-[1px] bg-gray-200" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{apt.patient_name}</p>
                          <p className="text-xs text-gray-500">{apt.appointment_type}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[10px] font-semibold px-2 py-0 h-5 rounded-sm ${
                        apt.status === 'scheduled' ? 'border-blue-200 bg-blue-50 text-blue-700' :
                        apt.status === 'completed' ? 'border-green-200 bg-green-50 text-green-700' :
                        'border-red-200 bg-red-50 text-red-700'
                      }`}>
                        {apt.status.toUpperCase()}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center">
                    <Calendar className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 font-medium">No appointments scheduled for today</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="border border-gray-200 shadow-sm rounded-sm">
            <CardHeader className="py-3 px-4 border-b border-gray-100">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 p-4">
              {user?.role === "RECEPTION" ? (
                <>
                  <Link to="/patients">
                    <Button variant="outline" size="sm" className="w-full justify-start text-xs font-medium border-gray-200 hover:bg-gray-50">
                      <UserPlus className="mr-2 h-3.5 w-3.5 text-primary" /> Register Patient
                    </Button>
                  </Link>
                  <Link to="/payments">
                    <Button variant="outline" size="sm" className="w-full justify-start text-xs font-medium border-gray-200 hover:bg-gray-50">
                      <CreditCard className="mr-2 h-3.5 w-3.5 text-green-600" /> Process Payment
                    </Button>
                  </Link>
                </>
              ) : user?.role === "DOCTOR" ? (
                <>
                  <Link to="/treatments">
                    <Button variant="outline" size="sm" className="w-full justify-start text-xs font-medium border-gray-200 hover:bg-gray-50">
                      <Stethoscope className="mr-2 h-3.5 w-3.5 text-primary" /> New Diagnosis
                    </Button>
                  </Link>
                  <Link to="/patients">
                    <Button variant="outline" size="sm" className="w-full justify-start text-xs font-medium border-gray-200 hover:bg-gray-50">
                      <Users className="mr-2 h-3.5 w-3.5 text-primary" /> Patient Records
                    </Button>
                  </Link>
                </>
              ) : (
                <Link to="/users">
                  <Button variant="outline" size="sm" className="w-full justify-start text-xs font-medium border-gray-200 hover:bg-gray-50">
                    <Users className="mr-2 h-3.5 w-3.5 text-primary" /> Manage Staff
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm rounded-sm">
            <CardHeader className="py-3 px-4 border-b border-gray-100">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-4">
              <div className="space-y-3 px-4 pt-4">
                {getRecentActivity().map((item, i) => (
                  <div key={i} className="flex items-start space-x-3">
                    <div className={`mt-0.5 p-1 rounded-sm ${
                      item.type === 'patient' ? 'bg-blue-50 text-primary' :
                      item.type === 'appointment' ? 'bg-orange-50 text-orange-600' :
                      item.type === 'treatment' ? 'bg-purple-50 text-purple-600' :
                      'bg-green-50 text-green-600'
                    }`}>
                      {item.type === 'patient' ? <Users className="h-3 w-3" /> :
                       item.type === 'appointment' ? <Calendar className="h-3 w-3" /> :
                       item.type === 'treatment' ? <Stethoscope className="h-3 w-3" /> :
                       <DollarSign className="h-3 w-3" />}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-900">{item.title}</p>
                      <p className="text-[10px] text-gray-500">{item.name}</p>
                      <p className="text-[9px] text-gray-400 mt-0.5 font-medium">{new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
