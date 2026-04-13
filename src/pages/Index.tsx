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
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
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
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
            {user?.role} Dashboard
          </h1>
          <p className="text-gray-600 mt-2 text-lg">
            Welcome back, {user?.full_name}! Here's what's happening today at DentalCare.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {user?.role === "RECEPTION" ? (
            <>
              <Link to="/patients">
                <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg text-white">
                  <UserPlus className="mr-2 h-4 w-4" />
                  New Patient
                </Button>
              </Link>
              <Link to="/appointments">
                <Button variant="outline" className="shadow-sm">
                  <Calendar className="mr-2 h-4 w-4" />
                  Book Appointment
                </Button>
              </Link>
            </>
          ) : user?.role === "DOCTOR" ? (
            <Link to="/treatments">
              <Button className="bg-purple-600 hover:bg-purple-700 shadow-lg text-white">
                <Plus className="mr-2 h-4 w-4" />
                New Treatment
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 shadow-xl bg-linear-to-br from-blue-600 to-indigo-700 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Today's Appointments</p>
                <p className="text-3xl font-bold mt-1">{getTodayAppointments().length}</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md">
                <CalendarDays className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-blue-100">
              <TrendingUp className="h-4 w-4 mr-1" />
              <span>{appointments.filter(a => a.status === 'scheduled').length} upcoming</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl bg-linear-to-br from-emerald-500 to-teal-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm font-medium">Total Revenue</p>
                <p className="text-3xl font-bold mt-1">{formatCurrency(getTotalRevenue())}</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md">
                <DollarSign className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-emerald-100">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              <span>{payments.length} transactions</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl bg-linear-to-br from-purple-500 to-indigo-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Total Patients</p>
                <p className="text-3xl font-bold mt-1">{patients.length}</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md">
                <Users className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-purple-100">
              <Activity className="h-4 w-4 mr-1" />
              <span>Active database</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl bg-linear-to-br from-amber-500 to-orange-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm font-medium">Treatments Done</p>
                <p className="text-3xl font-bold mt-1">{treatments.length}</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md">
                <Stethoscope className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-amber-100">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              <span>Success records</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Feed */}
        <div className="lg:col-span-2 space-y-8">
          {/* Today's Schedule */}
          <Card className="border-0 shadow-lg bg-white overflow-hidden">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
                  <Clock className="mr-2 h-5 w-5 text-blue-600" />
                  Today's Schedule
                </CardTitle>
                <Link to="/appointments" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                  View full calendar
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {getTodayAppointments().length > 0 ? (
                  getTodayAppointments().map((apt) => (
                    <div key={apt.id} className="p-6 hover:bg-gray-50 transition-colors flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="text-center min-w-[60px]">
                          <p className="text-sm font-bold text-gray-900">{apt.time}</p>
                          <p className="text-xs text-gray-500">{apt.duration}m</p>
                        </div>
                        <div className="h-10 w-[2px] bg-blue-200 rounded-full" />
                        <div>
                          <p className="font-bold text-gray-900">{apt.patient_name}</p>
                          <p className="text-sm text-gray-600">{apt.appointment_type}</p>
                        </div>
                      </div>
                      <Badge className={
                        apt.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : 
                        apt.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                        'bg-red-100 text-red-700'
                      }>
                        {apt.status}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center">
                    <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">No appointments scheduled for today</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {user?.role === "RECEPTION" ? (
                <>
                  <Link to="/patients">
                    <Button variant="outline" className="w-full justify-start text-gray-700 border-gray-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200">
                      <UserPlus className="mr-2 h-4 w-4" /> Register Patient
                    </Button>
                  </Link>
                  <Link to="/payments">
                    <Button variant="outline" className="w-full justify-start text-gray-700 border-gray-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200">
                      <CreditCard className="mr-2 h-4 w-4" /> Process Payment
                    </Button>
                  </Link>
                </>
              ) : user?.role === "DOCTOR" ? (
                <>
                  <Link to="/treatments">
                    <Button variant="outline" className="w-full justify-start text-gray-700 border-gray-200 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200">
                      <Stethoscope className="mr-2 h-4 w-4" /> New Diagnosis
                    </Button>
                  </Link>
                  <Link to="/patients">
                    <Button variant="outline" className="w-full justify-start text-gray-700 border-gray-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200">
                      <Users className="mr-2 h-4 w-4" /> Patient Records
                    </Button>
                  </Link>
                </>
              ) : (
                <Link to="/users">
                  <Button variant="outline" className="w-full justify-start text-gray-700 border-gray-200 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200">
                    <Users className="mr-2 h-4 w-4" /> Manage Staff
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-6">
              <div className="space-y-4 px-6">
                {getRecentActivity().map((item, i) => (
                  <div key={i} className="flex items-start space-x-3">
                    <div className={`mt-1 p-1.5 rounded-full ${
                      item.type === 'patient' ? 'bg-blue-100 text-blue-600' :
                      item.type === 'appointment' ? 'bg-amber-100 text-amber-600' :
                      item.type === 'treatment' ? 'bg-purple-100 text-purple-600' :
                      'bg-emerald-100 text-emerald-600'
                    }`}>
                      {item.type === 'patient' ? <Users className="h-3 w-3" /> :
                       item.type === 'appointment' ? <Calendar className="h-3 w-3" /> :
                       item.type === 'treatment' ? <Stethoscope className="h-3 w-3" /> :
                       <DollarSign className="h-3 w-3" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-500">{item.name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
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
