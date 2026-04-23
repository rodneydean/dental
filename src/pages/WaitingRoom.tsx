import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { dataManager, Appointment, WaiverRequest, DoctorStatus, InsuranceProvider } from "@/lib/dataManager";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users,
  Clock,
  CheckCircle2,
  Stethoscope,
  XCircle,
  CreditCard,
  UserCheck,
  ChevronDown,
} from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckoutDialog } from "@/components/CheckoutDialog";

const WaitingRoom = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [waivers, setWaivers] = useState<WaiverRequest[]>([]);
  const [doctorStatuses, setDoctorStatuses] = useState<DoctorStatus[]>([]);
  const [receptionFee, setReceptionFee] = useState<number>(0);
  const [requirePaymentBeforeAdmit, setRequirePaymentBeforeAdmit] = useState<boolean>(true);
  const [insuranceProviders, setInsuranceProviders] = useState<InsuranceProvider[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    loadData();
    const unlisten = listen<{ type: string; name?: string; doctor_id?: string; patient_name?: string }>("sync-event", (event) => {
      const payload = event.payload;
      loadData();
      if (payload.type === "waiver_request" && user?.role === "DOCTOR") {
        toast.info("New waiver request received");
      }
      if (payload.type === "waiver_status_updated" && user?.role === "RECEPTION") {
        toast.success("A waiver request has been processed");
      }
      if (payload.type === "patient_registered" && (user?.role === "DOCTOR" || user?.role === "ADMIN")) {
        toast.info(`New patient registered: ${payload.name}`);
      }
      if (payload.type === "patient_admitted" && user?.role === "DOCTOR") {
        if (!payload.doctor_id || payload.doctor_id === user.id) {
          toast.info(`Patient admitted and waiting for you: ${payload.patient_name}`);
        }
      }
    });

    // Background polling fallback for network reliability
    const intervalId = setInterval(() => {
      loadData();
    }, 30000); // 30 seconds

    return () => {
      unlisten.then(f => f());
      clearInterval(intervalId);
    };
  }, [user]);

  const loadData = async () => {
    try {
      const [appts, reqs, statuses, fee, reqPay, providers] = await Promise.all([
        dataManager.getAppointments(),
        dataManager.getWaiverRequests(),
        dataManager.getDoctorStatuses(),
        dataManager.getSetting("reception_fee"),
        dataManager.getSetting("require_payment_before_admit"),
        dataManager.getInsuranceProviders()
      ]);
      setAppointments(appts.filter(a => a.status !== 'completed' && a.status !== 'cancelled'));
      setWaivers(reqs);
      setDoctorStatuses(statuses);
      setReceptionFee(Number(fee || 0));
      setRequirePaymentBeforeAdmit(reqPay === "true");
      setInsuranceProviders(providers);
    } catch {
      toast.error("Failed to load waiting room data");
    }
  };

  const handleAdmit = async (appt: Appointment) => {
    // Check if patient is already in the active queue
    const activeAppointment = appointments.find(a =>
      a.patient_id === appt.patient_id &&
      (a.status === 'admitted' || a.status === 'in_consultation' || a.status === 'awaiting_checkout')
    );

    if (activeAppointment) {
      toast.error(`${appt.patient_name} is already in the queue or in consultation.`);
      return;
    }

    if (requirePaymentBeforeAdmit && !appt.reception_fee_paid && !appt.reception_fee_waived) {
      toast.error("Reception fee must be paid or waived before admission");
      return;
    }
    try {
      await dataManager.updateAppointment(appt.id, { status: "admitted" });
      toast.success("Patient admitted to waiting room");
      loadData();
    } catch {
      toast.error("Failed to admit patient");
    }
  };

  const handlePayFee = async (appt: Appointment, method: "cash" | "insurance" = "cash", providerId?: string) => {
    try {
      await dataManager.updateAppointment(appt.id, { reception_fee_paid: true });
      // Create a payment record
      await dataManager.addPayment({
        patient_id: appt.patient_id,
        patient_name: appt.patient_name,
        amount: receptionFee,
        date: new Date().toISOString(),
        method: method,
        insurance_provider_id: providerId,
        status: "paid",
        notes: "Reception/Consultation Fee",
      });
      toast.success("Payment recorded");
      loadData();
    } catch {
      toast.error("Failed to record payment");
    }
  };

  const handleRequestWaiver = async (appt: Appointment) => {
    if (!appt.doctor_id) {
      toast.error("A doctor must be assigned to the appointment to request a waiver");
      return;
    }
    try {
      await dataManager.createWaiverRequest({
        appointment_id: appt.id,
        patient_id: appt.patient_id,
        patient_name: appt.patient_name,
        doctor_id: appt.doctor_id,
        requested_by: user?.full_name || "Reception",
      });
      toast.success("Waiver request sent to doctor");
      loadData();
    } catch {
      toast.error("Failed to request waiver");
    }
  };

  const handleApproveWaiver = async (waiver: WaiverRequest) => {
    try {
      await dataManager.updateWaiverStatus(waiver.id, "approved");
      toast.success("Waiver approved");
      loadData();
    } catch {
      toast.error("Failed to approve waiver");
    }
  };

  const handleDenyWaiver = async (waiver: WaiverRequest) => {
    try {
      await dataManager.updateWaiverStatus(waiver.id, "denied");
      toast.success("Waiver denied");
      loadData();
    } catch {
      toast.error("Failed to deny waiver");
    }
  };

  const handleCallPatient = async (appt: Appointment) => {
    try {
      // Set previous patient to completed if any
      const currentStatus = doctorStatuses.find(s => s.doctor_id === user?.id);
      if (currentStatus?.current_appointment_id) {
         // Optionally prompt to checkout first? For now just switch.
      }

      await dataManager.updateAppointment(appt.id, { status: "in_consultation" });
      await dataManager.updateDoctorStatus(user?.id || "", appt.id);
      toast.success(`Calling ${appt.patient_name}`);
      loadData();
    } catch {
      toast.error("Failed to call patient");
    }
  };

  const handleCheckout = (appt: Appointment) => {
    setSelectedAppointment(appt);
    setShowCheckout(true);
  };

  const handleCancelVisit = async (appt: Appointment) => {
    if (!confirm(`Are you sure you want to cancel ${appt.patient_name}'s visit? This will remove them from the queue.`)) return;
    try {
      await dataManager.updateAppointment(appt.id, { status: "cancelled" });
      await dataManager.updateDoctorStatus(appt.doctor_id || "", null);
      toast.success("Visit cancelled");
      loadData();
    } catch {
      toast.error("Failed to cancel visit");
    }
  };

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        size="icon"
        className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg bg-white border-primary/20 text-primary hover:bg-blue-50 z-50"
        onClick={() => {
          loadData();
          toast.success("Data refreshed");
        }}
      >
        <Users className="h-6 w-6" />
      </Button>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Waiting Room</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage patient arrivals and consultations</p>
        </div>
      </div>

      <Tabs defaultValue="arrivals" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[360px] h-9 p-1 bg-gray-100 border border-gray-200 rounded-sm">
          <TabsTrigger value="arrivals" className="text-xs font-semibold uppercase tracking-wider rounded-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Arrivals</TabsTrigger>
          <TabsTrigger value="queue" className="text-xs font-semibold uppercase tracking-wider rounded-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Queue</TabsTrigger>
          {user?.role !== 'RECEPTION' && <TabsTrigger value="waivers" className="text-xs font-semibold uppercase tracking-wider rounded-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Waivers</TabsTrigger>}
        </TabsList>

        <TabsContent value="arrivals" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {appointments.filter(a => a.status === 'scheduled').map(appt => (
              <Card key={appt.id} className="border border-gray-200 shadow-sm rounded-sm bg-white overflow-hidden">
                <CardHeader className="pb-3 pt-4 px-4">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-sm font-semibold text-gray-900">{appt.patient_name}</CardTitle>
                    <Badge variant="outline" className="text-[10px] font-bold h-5 rounded-sm border-gray-200">{appt.time}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 px-4 pb-4">
                  <div className="text-[11px] font-medium text-gray-500 uppercase tracking-tight">
                    <p>Doctor: <span className="text-gray-900">{appt.doctor_name || "Not assigned"}</span></p>
                    <p className="mt-0.5">Type: <span className="text-gray-900">{appt.appointment_type}</span></p>
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    {!appt.reception_fee_paid && !appt.reception_fee_waived ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1 h-8 text-xs font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-sm" onClick={() => handlePayFee(appt)}>
                            <CreditCard className="h-3.5 w-3.5 mr-1.5 text-green-600" /> Pay Cash
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs font-medium border-gray-200 text-gray-700 hover:bg-gray-50 rounded-sm" onClick={() => handleRequestWaiver(appt)}>
                            Waiver
                          </Button>
                        </div>
                        {insuranceProviders.filter(p => p.pays_reception_fee).length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs font-medium border-purple-100 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-sm"
                              >
                                <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                                Insurance
                                <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {insuranceProviders.filter(p => p.pays_reception_fee).map(p => (
                                <DropdownMenuItem
                                  key={p.id}
                                  onClick={() => handlePayFee(appt, "insurance", p.id)}
                                  className="text-xs font-medium"
                                >
                                  Use {p.name}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    ) : (
                      <Badge variant="outline" className="w-fit text-[10px] font-bold px-2 py-0 h-5 rounded-sm border-green-200 bg-green-50 text-green-700 uppercase">
                        {appt.reception_fee_paid ? "Fee Paid" : "Fee Waived"}
                      </Badge>
                    )}

                    <Button
                      size="sm"
                      className="w-full bg-primary hover:bg-primary/90 text-white h-8 text-xs font-medium rounded-sm"
                      onClick={() => handleAdmit(appt)}
                      disabled={requirePaymentBeforeAdmit && !appt.reception_fee_paid && !appt.reception_fee_waived}
                    >
                      <UserCheck className="h-3.5 w-3.5 mr-2" /> Admit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="queue" className="mt-6">
          <div className="space-y-3">
            {appointments.filter(a => a.status === 'admitted' || a.status === 'in_consultation' || a.status === 'awaiting_checkout').map(appt => (
              <Card key={appt.id} className={`border border-gray-200 shadow-sm rounded-sm bg-white overflow-hidden border-l-4 ${appt.status === 'in_consultation' ? 'border-l-green-500' : appt.status === 'awaiting_checkout' ? 'border-l-blue-500' : 'border-l-primary'}`}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-sm ${appt.status === 'in_consultation' ? 'bg-green-50 text-green-600' : appt.status === 'awaiting_checkout' ? 'bg-blue-50 text-blue-600' : 'bg-blue-50 text-primary'}`}>
                      {appt.status === 'in_consultation' ? <Stethoscope className="h-5 w-5" /> : appt.status === 'awaiting_checkout' ? <CreditCard className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-gray-900">{appt.patient_name}</h3>
                      <p className="text-[11px] font-medium text-gray-500 uppercase tracking-tight">
                        Doctor: <span className="text-gray-900">{appt.doctor_name}</span> | Status: <span className={`font-bold ${appt.status === 'in_consultation' ? 'text-green-600' : appt.status === 'awaiting_checkout' ? 'text-blue-600' : 'text-primary'}`}>{appt.status.replace('_', ' ').toUpperCase()}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {user?.role === 'DOCTOR' && appt.status === 'admitted' && (
                      <Button size="sm" className="h-8 text-xs font-medium bg-primary text-white rounded-sm" onClick={() => handleCallPatient(appt)}>Call Patient</Button>
                    )}
                    {(user?.role === 'RECEPTION' || user?.role === 'ADMIN') && appt.status === 'admitted' && (
                       <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-sm"
                        onClick={() => handleCancelVisit(appt)}
                      >
                        Cancel
                      </Button>
                    )}
                    {(user?.role === 'RECEPTION' || user?.role === 'ADMIN') && (appt.status === 'in_consultation' || appt.status === 'awaiting_checkout') && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-8 text-xs font-medium border-gray-200 rounded-sm" onClick={() => handleCheckout(appt)}>Checkout</Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-sm"
                          onClick={() => handleCancelVisit(appt)}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                    {appt.status === 'in_consultation' && (
                       <Badge variant="outline" className="h-6 text-[10px] font-bold border-green-200 bg-green-50 text-green-700 uppercase px-2 rounded-sm">In Consultation</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {appointments.filter(a => a.status === 'admitted' || a.status === 'in_consultation' || a.status === 'awaiting_checkout').length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Queue is empty</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="waivers" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {waivers.filter(w => w.status === 'pending').map(waiver => (
              <Card key={waiver.id}>
                <CardHeader>
                  <CardTitle className="text-lg">Waiver Request: {waiver.patient_name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm">Requested by {waiver.requested_by} for Doctor {waiver.doctor_id}</p>
                  {(user?.role === 'DOCTOR' && user.id === waiver.doctor_id) || user?.role === 'ADMIN' ? (
                    <div className="flex gap-3">
                      <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleApproveWaiver(waiver)}>
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
                      </Button>
                      <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => handleDenyWaiver(waiver)}>
                        <XCircle className="h-4 w-4 mr-2" /> Deny
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded">Only the assigned doctor or an Administrator can process this waiver.</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      <CheckoutDialog
        open={showCheckout}
        onOpenChange={setShowCheckout}
        appointment={selectedAppointment}
        onComplete={loadData}
      />
    </div>
  );
};

export default WaitingRoom;
