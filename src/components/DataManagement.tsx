import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Download,
  Upload,
  Database,
  FileText,
  AlertTriangle,
  CheckCircle2,
  History,
  BarChart3,
  Settings,
  RefreshCw,
  HardDrive,
} from "lucide-react";
import { dataManager, BackupEntry } from "@/lib/dataManager";
import { toast } from "sonner";

const DataManagement = () => {
  const [stats, setStats] = useState({
    totalPatients: 0,
    totalAppointments: 0,
    totalTreatments: 0,
    storageUsed: "0 KB",
    lastBackup: null as string | null,
  });
  const [backupHistory, setBackupHistory] = useState<BackupEntry[]>([]);
  const [validationResults, setValidationResults] = useState({
    orphanedAppointments: 0,
    orphanedTreatments: 0,
    duplicatePatients: 0,
  });
  const [isValidating, setIsValidating] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  useEffect(() => {
    loadStats();
    loadBackupHistory();
    validateData();
  }, []);

  const loadStats = () => {
    const currentStats = dataManager.getStorageStats();
    setStats(currentStats);
  };

  const loadBackupHistory = () => {
    const history = dataManager.getBackupHistory();
    setBackupHistory(history);
  };

  const validateData = async () => {
    setIsValidating(true);
    // Add small delay to show loading state
    setTimeout(() => {
      const results = dataManager.validateData();
      setValidationResults(results);
      setIsValidating(false);
    }, 500);
  };

  const handleExportJSON = () => {
    try {
      dataManager.exportToFile();
      toast.success("Data exported successfully");
      loadStats();
      loadBackupHistory();
    } catch (error) {
      console.log(error);
      toast.error("Failed to export data");
    }
  };

  const handleExportCSV = (
    dataType: "patients" | "appointments" | "treatments"
  ) => {
    try {
      dataManager.exportToCSV(dataType);
      toast.success(`${dataType} data exported to CSV`);
    } catch (error) {
      console.log(error)
      toast.error(`Failed to export ${dataType} data`);
    }
  };

  const handleImportFile = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await dataManager.importFromFile(file);
      if (result.success) {
        toast.success(result.message);
        loadStats();
        loadBackupHistory();
        validateData();
        setShowImportDialog(false);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.log(error);
      toast.error("Failed to import file");
    }

    // Reset file input
    event.target.value = "";
  };

  const handleRestoreBackup = (backupId: string) => {
    const result = dataManager.restoreFromBackup(backupId);
    if (result.success) {
      toast.success(result.message);
      loadStats();
      validateData();
    } else {
      toast.error(result.message);
    }
  };

  const handleCleanupData = () => {
    const result = dataManager.cleanupOrphanedData();
    toast.success(`Cleaned up ${result.cleaned} orphaned records`);
    validateData();
    loadStats();
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Data Management</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Backup, export, and manage your practice data
          </p>
        </div>
      </div>

      {/* Storage Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-gray-200 shadow-sm rounded-sm bg-white">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                  Patients
                </p>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {stats.totalPatients}
                </p>
              </div>
              <div className="p-2 bg-blue-50 rounded-sm">
                <Database className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-sm rounded-sm bg-white">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                  Appointments
                </p>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {stats.totalAppointments}
                </p>
              </div>
              <div className="p-2 bg-green-50 rounded-sm">
                <BarChart3 className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-sm rounded-sm bg-white">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                  Treatments
                </p>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {stats.totalTreatments}
                </p>
              </div>
              <div className="p-2 bg-purple-50 rounded-sm">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-sm rounded-sm bg-white">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                  Storage
                </p>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {stats.storageUsed}
                </p>
              </div>
              <div className="p-2 bg-orange-50 rounded-sm">
                <HardDrive className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export & Backup */}
        <Card className="border border-gray-200 shadow-sm rounded-sm bg-white overflow-hidden">
          <CardHeader className="bg-gray-50/50 border-b border-gray-200 py-3 px-4">
            <CardTitle className="flex items-center text-xs font-semibold uppercase tracking-wider text-gray-900">
              <Download className="h-4 w-4 mr-2 text-primary" />
              Export & Backup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <div className="space-y-3">
              <Button
                size="sm"
                onClick={handleExportJSON}
                className="w-full justify-start bg-primary hover:bg-primary/90 text-white rounded-sm h-9 text-xs font-semibold"
              >
                <Database className="h-3.5 w-3.5 mr-2" />
                Export Complete Database (JSON)
              </Button>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportCSV("patients")}
                  className="justify-start border-gray-200 text-[10px] h-8 font-semibold uppercase tracking-tight"
                >
                  <FileText className="h-3 w-3 mr-2 text-primary" />
                  Patients
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportCSV("appointments")}
                  className="justify-start border-gray-200 text-[10px] h-8 font-semibold uppercase tracking-tight"
                >
                  <FileText className="h-3 w-3 mr-2 text-primary" />
                  Appointments
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportCSV("treatments")}
                  className="justify-start border-gray-200 text-[10px] h-8 font-semibold uppercase tracking-tight"
                >
                  <FileText className="h-3 w-3 mr-2 text-primary" />
                  Treatments
                </Button>
              </div>
            </div>

            <div className="text-[10px] font-medium text-gray-500 bg-blue-50/50 p-2 rounded-sm border border-blue-100 flex items-center justify-between">
              <span className="uppercase tracking-widest font-bold">Last Backup:</span>
              <span className="text-primary font-bold">
                {stats.lastBackup
                  ? formatDate(stats.lastBackup)
                  : "NONE"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Import & Restore */}
        <Card className="border border-gray-200 shadow-sm rounded-sm bg-white overflow-hidden">
          <CardHeader className="bg-gray-50/50 border-b border-gray-200 py-3 px-4">
            <CardTitle className="flex items-center text-xs font-semibold uppercase tracking-wider text-gray-900">
              <Upload className="h-4 w-4 mr-2 text-green-600" />
              Import & Restore
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full justify-start bg-green-600 hover:bg-green-700 text-white rounded-sm h-9 text-xs font-semibold">
                  <Upload className="h-3.5 w-3.5 mr-2" />
                  Import Database File
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Database</DialogTitle>
                  <DialogDescription>
                    Select a JSON backup file to import. This will replace all
                    current data.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="import-file">Select Backup File</Label>
                    <Input
                      id="import-file"
                      type="file"
                      accept=".json"
                      onChange={handleImportFile}
                      className="mt-2"
                    />
                  </div>
                  <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                    <div className="flex items-center text-yellow-800">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      <span className="text-sm font-medium">Warning</span>
                    </div>
                    <p className="text-sm text-yellow-700 mt-1">
                      Importing will replace all current data. A backup will be
                      created automatically.
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-start border-gray-200 h-9 text-xs font-semibold">
                  <History className="h-3.5 w-3.5 mr-2 text-primary" />
                  View Backup History
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Backup History</DialogTitle>
                  <DialogDescription>
                    Restore from previous backups
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {backupHistory.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">
                      No backup history available
                    </p>
                  ) : (
                    backupHistory.map((backup) => (
                      <div
                        key={backup.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <div className="font-medium">
                            {formatDate(backup.date)}
                          </div>
                          <div className="text-sm text-gray-600">
                            {backup.patientCount} patients,{" "}
                            {backup.appointmentCount} appointments,{" "}
                            {backup.treatmentCount} treatments
                          </div>
                          <Badge variant="secondary" className="text-xs mt-1">
                            {backup.type}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleRestoreBackup(backup.id)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          Restore
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      {/* Data Validation */}
      <Card className="border border-gray-200 shadow-sm rounded-sm bg-white overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b border-gray-200 py-3 px-4">
          <CardTitle className="flex items-center text-xs font-semibold uppercase tracking-wider text-gray-900">
            <Settings className="h-4 w-4 mr-2 text-purple-600" />
            Validation & Cleanup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Data Integrity Check</h3>
              <p className="text-xs text-gray-500">Scan for orphaned records and duplicates</p>
            </div>
            <Button
              onClick={validateData}
              disabled={isValidating}
              variant="outline"
              size="sm"
              className="h-8 border-gray-200 text-xs font-semibold"
            >
              {isValidating ? (
                <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-green-600" />
              )}
              {isValidating ? "Validating..." : "Validate"}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-blue-50/50 p-3 rounded-sm border border-blue-100 text-center">
              <div className="text-xl font-bold text-primary">
                {validationResults.orphanedAppointments}
              </div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Orphaned Appointments</div>
            </div>
            <div className="bg-purple-50/50 p-3 rounded-sm border border-purple-100 text-center">
              <div className="text-xl font-bold text-purple-700">
                {validationResults.orphanedTreatments}
              </div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Orphaned Treatments</div>
            </div>
            <div className="bg-orange-50/50 p-3 rounded-sm border border-orange-100 text-center">
              <div className="text-xl font-bold text-orange-700">
                {validationResults.duplicatePatients}
              </div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Duplicates</div>
            </div>
          </div>

          {(validationResults.orphanedAppointments > 0 ||
            validationResults.orphanedTreatments > 0) && (
            <div className="flex items-center justify-between bg-yellow-50/50 p-3 rounded-sm border border-yellow-200">
              <div className="flex items-center">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mr-3" />
                <div>
                  <div className="text-xs font-bold text-yellow-800 uppercase tracking-tight">
                    Data Issues Found
                  </div>
                  <div className="text-[10px] text-yellow-700">
                    Orphaned records detected that can be cleaned up
                  </div>
                </div>
              </div>
              <Button
                onClick={handleCleanupData}
                size="sm"
                className="h-7 bg-yellow-600 hover:bg-yellow-700 text-white text-[10px] font-bold uppercase rounded-sm"
              >
                Clean Up
              </Button>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
};

export default DataManagement;
