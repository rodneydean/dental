import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import {
  FileText,
  Calendar,
  Download,
  TrendingUp,
  Stethoscope,
  DollarSign,
  BarChart3
} from "lucide-react";
import { dataManager, Appointment, Treatment, Payment, Patient } from "@/lib/dataManager";
import { pdfGenerator } from "@/lib/pdfGenerator";
import { toast } from "sonner";

const Reports = () => {
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const handleStartDateChange = (date: Date | undefined) => {
    if (date) {
      setStartDate(format(date, "yyyy-MM-dd"));
    }
  };

  const handleEndDateChange = (date: Date | undefined) => {
    if (date) {
      setEndDate(format(date, "yyyy-MM-dd"));
    }
  };

  const [patients, setPatients] = useState<Patient[]>([]);
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
      const [pts, appts, treats, pays] = await Promise.all([
        dataManager.getPatients(),
        dataManager.getAppointments(),
        dataManager.getTreatments(),
        dataManager.getPayments()
      ]);
      setPatients(pts);
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

    const filteredPatients = patients.filter(p => {
      const d = new Date(p.created_at);
      return d >= start && d <= end;
    });

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

    return { filteredPatients, filteredAppts, filteredTreats, filteredPays };
  };

  const setPreset = (preset: 'today' | 'week' | 'month' | 'quarter' | 'year') => {
    const today = new Date();
    let start = new Date();

    switch(preset) {
      case 'today': {
        start = new Date(today);
        break;
      }
      case 'week': {
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        start = new Date(today.setDate(diff));
        break;
      }
      case 'month': {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      }
      case 'quarter': {
        const quarter = Math.floor((today.getMonth() / 3));
        start = new Date(today.getFullYear(), quarter * 3, 1);
        break;
      }
      case 'year': {
        start = new Date(today.getFullYear(), 0, 1);
        break;
      }
    }

    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(new Date().toISOString().split("T")[0]);
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const { filteredPatients, filteredAppts, filteredTreats, filteredPays } = getFilteredData();

      await pdfGenerator.generateReport(
        startDate,
        endDate,
        filteredAppts,
        filteredTreats,
        filteredPays,
        filteredPatients
      );

      toast.success("Report generated and downloaded successfully");
    } catch (error) {
      console.error("Failed to generate report", error);
      toast.error("Failed to generate report");
    } finally {
      setIsGenerating(false);
    }
  };

  const { filteredPatients, filteredAppts, filteredTreats, filteredPays } = getFilteredData();
  const totalRevenue = filteredPays.reduce((sum, p) => sum + p.amount, 0);
  const totalBilled = filteredTreats.reduce((sum, t) => sum + t.cost, 0);

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
            <div className="grid grid-cols-2 gap-2 pb-2">
              <Button variant="outline" size="sm" className="text-[10px] h-7" onClick={() => setPreset('today')}>Today</Button>
              <Button variant="outline" size="sm" className="text-[10px] h-7" onClick={() => setPreset('week')}>This Week</Button>
              <Button variant="outline" size="sm" className="text-[10px] h-7" onClick={() => setPreset('month')}>This Month</Button>
              <Button variant="outline" size="sm" className="text-[10px] h-7" onClick={() => setPreset('quarter')}>This Quarter</Button>
              <Button variant="outline" size="sm" className="text-[10px] h-7" onClick={() => setPreset('year')}>This Year</Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="start-date" className="text-xs">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal h-9 text-sm rounded-sm border-gray-200",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {startDate && isValid(parseISO(startDate)) ? (
                      format(parseISO(startDate), "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={startDate && isValid(parseISO(startDate)) ? parseISO(startDate) : undefined}
                    onSelect={handleStartDateChange}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date" className="text-xs">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal h-9 text-sm rounded-sm border-gray-200",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {endDate && isValid(parseISO(endDate)) ? (
                      format(parseISO(endDate), "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={endDate && isValid(parseISO(endDate)) ? parseISO(endDate) : undefined}
                    onSelect={handleEndDateChange}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="border-gray-200 shadow-sm rounded-sm">
              <CardContent className="pt-4 pb-4 px-4 flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Collected Revenue</p>
                  <p className="text-xl font-bold text-[#2e7d32] mt-1">{formatCurrency(totalRevenue)}</p>
                </div>
                <div className="p-2 bg-green-50 rounded-sm text-green-600">
                  <DollarSign className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200 shadow-sm rounded-sm">
              <CardContent className="pt-4 pb-4 px-4 flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Total Billed</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalBilled)}</p>
                </div>
                <div className="p-2 bg-blue-50 rounded-sm text-[#0078d4]">
                  <TrendingUp className="h-5 w-5" />
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
                        <span className="text-xs text-gray-500">Collection Rate</span>
                        <span className="text-xs font-semibold text-[#2e7d32]">
                          {totalBilled > 0 ? ((totalRevenue / totalBilled) * 100).toFixed(1) : 0}%
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
                          {filteredPatients.length}
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
