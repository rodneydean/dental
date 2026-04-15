import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText,
  Calendar,
  Download,
  TrendingUp,
  Stethoscope,
  DollarSign,
  BarChart3
} from "lucide-react";
import { dataManager, Appointment, Treatment, Payment } from "@/lib/dataManager";
import { pdfGenerator } from "@/lib/pdfGenerator";
import { toast } from "sonner";

const Reports = () => {
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [appts, treats, pays] = await Promise.all([
        dataManager.getAppointments(),
        dataManager.getTreatments(),
        dataManager.getPayments()
      ]);
      setAppointments(appts);
      setTreatments(treats);
      setPayments(pays);
    } catch (error) {
      console.error("Failed to load reports data", error);
      toast.error("Failed to load report data");
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredData = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const filteredAppts = appointments.filter(a => {
      const d = new Date(a.date);
      return d >= start && d <= end;
    });

    const filteredTreats = treatments.filter(t => {
      const d = new Date(t.date);
      return d >= start && d <= end;
    });

    const filteredPays = payments.filter(p => {
      const d = new Date(p.date);
      return d >= start && d <= end;
    });

    return { filteredAppts, filteredTreats, filteredPays };
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const { filteredAppts, filteredTreats, filteredPays } = getFilteredData();

      await pdfGenerator.generateReport(
        startDate,
        endDate,
        filteredAppts,
        filteredTreats,
        filteredPays
      );

      toast.success("Report generated and downloaded successfully");
    } catch (error) {
      console.error("Failed to generate report", error);
      toast.error("Failed to generate report");
    } finally {
      setIsGenerating(false);
    }
  };

  const { filteredAppts, filteredTreats, filteredPays } = getFilteredData();
  const totalRevenue = filteredPays.reduce((sum, p) => sum + p.amount, 0);

  const formatCurrency = (amount: number) => {
    return `KSH ${amount.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-xl font-semibold text-gray-900">Clinic Reports</h1>
        <p className="text-xs text-gray-500 mt-0.5">Generate and download performance reports for any period</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <Card className="lg:col-span-1 border-gray-200 shadow-sm rounded-sm">
          <CardHeader className="py-4 px-5 border-b border-gray-100">
            <CardTitle className="text-sm font-semibold flex items-center uppercase tracking-wider">
              <Calendar className="mr-2 h-4 w-4 text-primary" />
              Report Period
            </CardTitle>
            <CardDescription className="text-[10px]">Select the time frame for the report</CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="start-date" className="text-xs">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 text-sm rounded-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date" className="text-xs">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 text-sm rounded-sm"
              />
            </div>
            <Button
              className="w-full mt-2 bg-[#0078d4] hover:bg-[#005a9e] text-white rounded-sm"
              onClick={handleGenerateReport}
              disabled={isGenerating || isLoading}
            >
              {isGenerating ? "Generating..." : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Generate PDF Report
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Preview Stats */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border-gray-200 shadow-sm rounded-sm">
              <CardContent className="pt-4 pb-4 px-4 flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Revenue</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalRevenue)}</p>
                </div>
                <div className="p-2 bg-green-50 rounded-sm text-green-600">
                  <DollarSign className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200 shadow-sm rounded-sm">
              <CardContent className="pt-4 pb-4 px-4 flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Appointments</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{filteredAppts.length}</p>
                </div>
                <div className="p-2 bg-blue-50 rounded-sm text-primary">
                  <Calendar className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200 shadow-sm rounded-sm">
              <CardContent className="pt-4 pb-4 px-4 flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Treatments</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{filteredTreats.length}</p>
                </div>
                <div className="p-2 bg-orange-50 rounded-sm text-orange-600">
                  <Stethoscope className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200 shadow-sm rounded-sm">
              <CardContent className="pt-4 pb-4 px-4 flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Transactions</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{filteredPays.length}</p>
                </div>
                <div className="p-2 bg-purple-50 rounded-sm text-purple-600">
                  <BarChart3 className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-gray-200 shadow-sm rounded-sm bg-white overflow-hidden">
            <CardHeader className="bg-gray-50/50 border-b border-gray-200 py-3 px-4">
              <CardTitle className="text-xs font-semibold text-gray-900 flex items-center uppercase tracking-wider">
                <TrendingUp className="mr-2 h-4 w-4 text-primary" />
                Period Summary Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-6 text-center">
                {isLoading ? (
                  <p className="text-sm text-gray-500">Loading period data...</p>
                ) : filteredAppts.length === 0 && filteredTreats.length === 0 && filteredPays.length === 0 ? (
                  <div className="space-y-2">
                    <FileText className="h-10 w-10 text-gray-200 mx-auto" />
                    <p className="text-sm font-medium text-gray-500">No data found for the selected period</p>
                  </div>
                ) : (
                  <div className="space-y-4 text-left">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                      <div className="flex justify-between border-b border-gray-100 pb-1">
                        <span className="text-xs text-gray-500">Avg. Revenue per Day</span>
                        <span className="text-xs font-semibold">
                          {formatCurrency(totalRevenue / Math.max(1, (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)))}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-gray-100 pb-1">
                        <span className="text-xs text-gray-500">Avg. Revenue per Treatment</span>
                        <span className="text-xs font-semibold">
                          {formatCurrency(filteredTreats.length > 0 ? totalRevenue / filteredTreats.length : 0)}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-gray-100 pb-1">
                        <span className="text-xs text-gray-500">Appointment Completion Rate</span>
                        <span className="text-xs font-semibold">
                          {filteredAppts.length > 0
                            ? ((filteredAppts.filter(a => a.status === 'completed').length / filteredAppts.length) * 100).toFixed(1)
                            : 0}%
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-gray-100 pb-1">
                        <span className="text-xs text-gray-500">New Patients Found</span>
                        <span className="text-xs font-semibold">
                          {/* We don't have patient creation date filtered here yet, but we could add it if needed */}
                          Data analysis pending
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Reports;
