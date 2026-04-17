import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { dataManager, Service, InsuranceProvider } from "@/lib/dataManager";
import { Save, Settings as SettingsIcon, Server, Laptop, RefreshCw, Copy, Check, Plus, Trash2, Stethoscope, Upload, Image as ImageIcon, ShieldCheck, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { checkForUpdates } from "@/lib/updater";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface NetworkInfo {
  mode: string;
  pairing_code: string | null;
  local_ips: string[];
}

const Settings = () => {
  const { user } = useAuth();
  const [receptionFee, setReceptionFee] = useState<string>("0");
  const [requirePaymentBeforeAdmit, setRequirePaymentBeforeAdmit] = useState<boolean>(true);
  const [autoUpdate, setAutoUpdate] = useState<boolean>(false);

  // Branding settings
  const [clinicName, setClinicName] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [clinicPhone, setClinicPhone] = useState("");
  const [clinicWebsite, setClinicWebsite] = useState("");
  const [clinicTaxId, setClinicTaxId] = useState("");
  const [clinicFooter, setClinicFooter] = useState("");
  const [logo, setLogo] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceFee, setNewServiceFee] = useState("");

  const [insuranceProviders, setInsuranceProviders] = useState<InsuranceProvider[]>([]);
  const [newProviderName, setNewProviderName] = useState("");
  const [providerPaysReception, setProviderPaysReception] = useState(false);

  const [noteTypes, setNoteTypes] = useState<string[]>([]);
  const [newNoteType, setNewNoteType] = useState("");

  const userRole = user?.role;
  useEffect(() => {
    loadSettings();
    loadNetworkInfo();
    if (userRole === 'ADMIN') {
      loadServices();
      loadInsuranceProviders();
      loadNoteTypes();
    }

    let unlisten: (() => void) | undefined;
    const setupListener = async () => {
      unlisten = await listen("sync-event", (event: { payload: { type: string } }) => {
        if (event.payload?.type === "spoke_connected") {
          toast.success("A new device has connected to the Hub!");
        }
      });
    };
    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [userRole]);

  const loadServices = async () => {
    try {
      const loadedServices = await dataManager.getServices();
      setServices(loadedServices);
    } catch {
      toast.error("Failed to load services");
    }
  };

  const loadInsuranceProviders = async () => {
    try {
      const loadedProviders = await dataManager.getInsuranceProviders();
      setInsuranceProviders(loadedProviders);
    } catch {
      toast.error("Failed to load insurance providers");
    }
  };

  const loadNoteTypes = async () => {
    try {
      const loadedTypes = await dataManager.getNoteTypes();
      setNoteTypes(loadedTypes);
    } catch {
      toast.error("Failed to load clinical note types");
    }
  };

  const loadSettings = async () => {
    try {
      const [
        fee,
        requirePay,
        autoUpd,
        name,
        address,
        phone,
        website,
        taxId,
        footer,
        logoData
      ] = await Promise.all([
        dataManager.getSetting("reception_fee"),
        dataManager.getSetting("require_payment_before_admit"),
        dataManager.getSetting("auto_update"),
        dataManager.getSetting("clinic_name"),
        dataManager.getSetting("clinic_address"),
        dataManager.getSetting("clinic_phone"),
        dataManager.getSetting("clinic_website"),
        dataManager.getSetting("clinic_tax_id"),
        dataManager.getSetting("clinic_footer"),
        dataManager.getLogo()
      ]);
      setReceptionFee(fee || "0");
      setRequirePaymentBeforeAdmit(requirePay === "true");
      setAutoUpdate(autoUpd === "true");
      setClinicName(name || "");
      setClinicAddress(address || "");
      setClinicPhone(phone || "");
      setClinicWebsite(website || "");
      setClinicTaxId(taxId || "");
      setClinicFooter(footer || "");
      setLogo(logoData);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  };

  const loadNetworkInfo = async () => {
    try {
      const info = await invoke<NetworkInfo>("get_network_info");
      setNetworkInfo(info);
    } catch (error) {
      console.error("Failed to load network info", error);
    }
  };

  const handleStartHub = async () => {
    try {
      await invoke<string>("start_as_hub");
      toast.success("Hub server started successfully!");
      loadNetworkInfo();
    } catch (error) {
      toast.error(error as string);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      const promises: Promise<unknown>[] = [
        dataManager.setSetting("auto_update", autoUpdate.toString())
      ];

      if (user?.role === 'ADMIN' || user?.role === 'DOCTOR') {
        promises.push(dataManager.setSetting("clinic_name", clinicName));
        promises.push(dataManager.setSetting("clinic_address", clinicAddress));
        promises.push(dataManager.setSetting("clinic_phone", clinicPhone));
        promises.push(dataManager.setSetting("clinic_website", clinicWebsite));
        promises.push(dataManager.setSetting("clinic_tax_id", clinicTaxId));
        promises.push(dataManager.setSetting("clinic_footer", clinicFooter));
        if (logo && logo.startsWith('data:image')) {
          promises.push(dataManager.saveLogo(logo));
        }
      }

      if (user?.role === 'ADMIN') {
        promises.push(dataManager.setSetting("reception_fee", receptionFee));
        promises.push(dataManager.setSetting("require_payment_before_admit", requirePaymentBeforeAdmit.toString()));
      }

      await Promise.all(promises);
      toast.success("Settings saved successfully");
    } catch {
      toast.error("Failed to save settings");
    }
  };

  const handleAddService = async () => {
    if (!newServiceName || !newServiceFee) {
      toast.error("Please fill in both name and fee");
      return;
    }
    try {
      await dataManager.addService({
        name: newServiceName,
        standard_fee: parseFloat(newServiceFee)
      });
      setNewServiceName("");
      setNewServiceFee("");
      loadServices();
      toast.success("Service added");
    } catch {
      toast.error("Failed to add service");
    }
  };

  const handleDeleteService = async (id: string) => {
    try {
      await dataManager.deleteService(id);
      loadServices();
      toast.success("Service deleted");
    } catch {
      toast.error("Failed to delete service");
    }
  };

  const handleAddProvider = async () => {
    if (!newProviderName) {
      toast.error("Please fill in provider name");
      return;
    }
    try {
      await dataManager.addInsuranceProvider({
        name: newProviderName,
        pays_reception_fee: providerPaysReception
      });
      setNewProviderName("");
      setProviderPaysReception(false);
      loadInsuranceProviders();
      toast.success("Insurance provider added");
    } catch {
      toast.error("Failed to add insurance provider");
    }
  };

  const handleDeleteProvider = async (id: string) => {
    try {
      await dataManager.deleteInsuranceProvider(id);
      loadInsuranceProviders();
      toast.success("Insurance provider deleted");
    } catch {
      toast.error("Failed to delete insurance provider");
    }
  };

  const handleAddNoteType = async () => {
    if (!newNoteType) {
      toast.error("Please enter a note type");
      return;
    }
    try {
      await dataManager.addNoteType(newNoteType);
      setNewNoteType("");
      loadNoteTypes();
      toast.success("Clinical note type added");
    } catch {
      toast.error("Failed to add note type");
    }
  };

  const handleDeleteNoteType = async (type: string) => {
    try {
      await dataManager.deleteNoteType(type);
      loadNoteTypes();
      toast.success("Clinical note type deleted");
    } catch {
      toast.error("Failed to delete note type");
    }
  };

  if (isLoading) return <div>Loading settings...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center">
            <SettingsIcon className="mr-3 h-5 w-5 text-primary" />
            Application Settings
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Configure clinic rules and fees</p>
        </div>
      </div>

      {(user?.role === 'ADMIN' || user?.role === 'DOCTOR') && (
        <Card className="border border-gray-200 shadow-sm rounded-sm bg-white overflow-hidden">
          <CardHeader className="bg-gray-50/50 border-b border-gray-200 py-3 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-900">Clinic Branding & Documents</CardTitle>
            <CardDescription className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">Configure how your clinic appears on printed documents</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="clinicName">Clinic Name</Label>
                  <Input id="clinicName" value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="Main Dental Clinic" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="clinicAddress">Address</Label>
                  <Input id="clinicAddress" value={clinicAddress} onChange={(e) => setClinicAddress(e.target.value)} placeholder="123 Medical Way, City" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="clinicPhone">Phone Number</Label>
                  <Input id="clinicPhone" value={clinicPhone} onChange={(e) => setClinicPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="clinicWebsite">Website</Label>
                  <Input id="clinicWebsite" value={clinicWebsite} onChange={(e) => setClinicWebsite(e.target.value)} placeholder="www.dentalclinic.com" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="clinicTaxId">Tax ID / License Number</Label>
                  <Input id="clinicTaxId" value={clinicTaxId} onChange={(e) => setClinicTaxId(e.target.value)} placeholder="TX-123456789" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="clinicFooter">Custom Footer Text</Label>
                  <Input id="clinicFooter" value={clinicFooter} onChange={(e) => setClinicFooter(e.target.value)} placeholder="Thank you for choosing our clinic." />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Clinic Logo</Label>
              <div className="flex items-center space-x-4">
                <div className="h-20 w-20 border-2 border-dashed border-gray-200 rounded-sm flex items-center justify-center bg-gray-50 overflow-hidden">
                  {logo ? (
                    <img src={logo} alt="Logo Preview" className="h-full w-full object-contain" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-gray-300" />
                  )}
                </div>
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="logo-upload"
                  />
                  <Label
                    htmlFor="logo-upload"
                    className="flex items-center justify-center h-9 px-4 rounded-sm border border-gray-200 bg-white text-xs font-semibold cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Logo
                  </Label>
                  <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-tight">Recommended: Square PNG with transparent background</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {user?.role === 'ADMIN' && (
        <>
          <Card className="border border-gray-200 shadow-sm rounded-sm bg-white overflow-hidden">
            <CardHeader className="bg-gray-50/50 border-b border-gray-200 py-3 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-900">Financial Settings</CardTitle>
              <CardDescription className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">Manage consultation fees and payment rules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="receptionFee">Standard Reception Fee (KSH)</Label>
                <Input
                  type="number"
                  id="receptionFee"
                  value={receptionFee}
                  onChange={(e) => setReceptionFee(e.target.value)}
                  placeholder="50"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="requirePayment"
                  checked={requirePaymentBeforeAdmit}
                  onChange={(e) => setRequirePaymentBeforeAdmit(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                />
                <Label htmlFor="requirePayment">Require payment/waiver before admitting patient</Label>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm rounded-sm bg-white overflow-hidden">
            <CardHeader className="bg-gray-50/50 border-b border-gray-200 py-3 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-900">Insurance Providers</CardTitle>
              <CardDescription className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">Setup insurance providers and their coverage rules</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-gray-50 p-4 rounded-sm border border-gray-100">
                <div className="space-y-1.5 md:col-span-1">
                  <Label htmlFor="providerName" className="text-[10px] font-bold uppercase text-gray-500">Provider Name</Label>
                  <Input
                    id="providerName"
                    value={newProviderName}
                    onChange={(e) => setNewProviderName(e.target.value)}
                    placeholder="e.g., Aetna"
                    className="h-9 text-sm rounded-sm"
                  />
                </div>
                <div className="flex items-center space-x-2 pb-2 md:pb-0 h-9">
                  <input
                    type="checkbox"
                    id="paysReception"
                    checked={providerPaysReception}
                    onChange={(e) => setProviderPaysReception(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                  />
                  <Label htmlFor="paysReception" className="text-[10px] font-bold uppercase text-gray-500">Covers Reception Fee</Label>
                </div>
                <Button onClick={handleAddProvider} className="h-9 bg-primary hover:bg-primary/90 text-white font-semibold rounded-sm">
                  <Plus className="h-4 w-4 mr-2" /> Add Provider
                </Button>
              </div>

              <div className="space-y-2">
                {insuranceProviders.map((provider) => (
                  <div key={provider.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-sm hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-purple-50 text-purple-600 rounded-sm">
                        <ShieldCheck size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{provider.name}</p>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                          {provider.pays_reception_fee ? "Covers Reception Fee" : "Treatments Only"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteProvider(provider.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
                {insuranceProviders.length === 0 && (
                  <div className="text-center py-10 border border-dashed border-gray-200 rounded-sm">
                    <p className="text-sm text-gray-400 italic">No insurance providers configured yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm rounded-sm bg-white overflow-hidden">
            <CardHeader className="bg-gray-50/50 border-b border-gray-200 py-3 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-900">Clinical Note Types</CardTitle>
              <CardDescription className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">Setup clinical note types for doctors to use during consultation</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end bg-gray-50 p-4 rounded-sm border border-gray-100">
                <div className="space-y-1.5 flex-1">
                  <Label htmlFor="noteType" className="text-[10px] font-bold uppercase text-gray-500">Note Type Name</Label>
                  <Input
                    id="noteType"
                    value={newNoteType}
                    onChange={(e) => setNewNoteType(e.target.value)}
                    placeholder="e.g., Surgery Details"
                    className="h-9 text-sm rounded-sm"
                  />
                </div>
                <Button onClick={handleAddNoteType} className="h-9 bg-primary hover:bg-primary/90 text-white font-semibold rounded-sm">
                  <Plus className="h-4 w-4 mr-2" /> Add Note Type
                </Button>
              </div>

              <div className="space-y-2">
                {noteTypes.map((type) => (
                  <div key={type} className="flex items-center justify-between p-3 border border-gray-100 rounded-sm hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-50 text-primary rounded-sm">
                        <FileText size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{type}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteNoteType(type)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm rounded-sm bg-white overflow-hidden">
            <CardHeader className="bg-gray-50/50 border-b border-gray-200 py-3 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-900">Services & Fees</CardTitle>
              <CardDescription className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">Configure available treatments and their standard costs</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-gray-50 p-4 rounded-sm border border-gray-100">
                <div className="space-y-1.5">
                  <Label htmlFor="serviceName" className="text-[10px] font-bold uppercase text-gray-500">Service Name</Label>
                  <Input
                    id="serviceName"
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    placeholder="e.g., Routine Cleaning"
                    className="h-9 text-sm rounded-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="serviceFee" className="text-[10px] font-bold uppercase text-gray-500">Standard Fee (KSH)</Label>
                  <Input
                    id="serviceFee"
                    type="number"
                    value={newServiceFee}
                    onChange={(e) => setNewServiceFee(e.target.value)}
                    placeholder="1000"
                    className="h-9 text-sm rounded-sm"
                  />
                </div>
                <Button onClick={handleAddService} className="h-9 bg-primary hover:bg-primary/90 text-white font-semibold rounded-sm">
                  <Plus className="h-4 w-4 mr-2" /> Add Service
                </Button>
              </div>

              <div className="space-y-2">
                {services.map((service) => (
                  <div key={service.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-sm hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-50 text-primary rounded-sm">
                        <Stethoscope size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{service.name}</p>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">KSH {service.standard_fee.toLocaleString()}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteService(service.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
                {services.length === 0 && (
                  <div className="text-center py-10 border border-dashed border-gray-200 rounded-sm">
                    <p className="text-sm text-gray-400 italic">No services configured yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card className="border border-gray-200 shadow-sm rounded-sm bg-white overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b border-gray-200 py-3 px-4">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-900">Application Updates</CardTitle>
          <CardDescription className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">Configure how the application handles new versions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="autoUpdate"
              checked={autoUpdate}
              onChange={(e) => setAutoUpdate(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
            />
            <Label htmlFor="autoUpdate">Automatically download and install updates</Label>
          </div>

          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => checkForUpdates(false)}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Check for updates now
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-gray-200 shadow-sm rounded-sm bg-white overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b border-gray-200 py-3 px-4">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-900">Network & Synchronization</CardTitle>
          <CardDescription className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">Manage device connectivity and sync mode</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {networkInfo && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${networkInfo.mode === 'hub' ? 'bg-blue-100 text-blue-600' : networkInfo.mode === 'spoke' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                    {networkInfo.mode === 'hub' ? <Server size={18} /> : networkInfo.mode === 'spoke' ? <Laptop size={18} /> : <RefreshCw size={18} />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {networkInfo.mode === 'hub' ? 'Hub Server' : networkInfo.mode === 'spoke' ? 'Spoke Client' : 'Standalone Mode'}
                    </p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Current Role</p>
                  </div>
                </div>
                {networkInfo.mode === 'none' && (
                  <Button onClick={handleStartHub} size="sm" className="bg-primary text-white text-[10px] h-8 px-4 font-bold uppercase tracking-wider rounded-sm">
                    Enable Hub Mode
                  </Button>
                )}
              </div>

              {networkInfo.mode === 'hub' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Pairing Code</Label>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-50 border border-gray-200 rounded-sm px-3 py-2 font-mono text-lg font-bold tracking-widest text-primary">
                        {networkInfo.pairing_code}
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 border-gray-200"
                        onClick={() => copyToClipboard(networkInfo.pairing_code || "")}
                      >
                        {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Local IP Addresses (Fallback)</Label>
                    <div className="bg-gray-50 border border-gray-200 rounded-sm p-2 space-y-1">
                      {networkInfo.local_ips.length > 0 ? (
                        networkInfo.local_ips.map(ip => (
                          <div key={ip} className="flex items-center justify-between text-xs font-mono text-gray-600">
                            <span>{ip}:8080</span>
                            <button onClick={() => copyToClipboard(`${ip}:8080`)} className="hover:text-primary">
                              <Copy size={12} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] text-gray-400 italic">No IP addresses found</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {networkInfo.mode === 'spoke' && (
                <div className="pt-4 border-t border-gray-100">
                   <p className="text-xs text-gray-600">
                     This device is connected to a Hub. Changes will be synchronized automatically.
                   </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} size="sm" className="bg-primary hover:bg-primary/90 text-white rounded-sm h-9 px-4 text-xs font-semibold">
          <Save className="mr-2 h-3.5 w-3.5" />
          Save Settings
        </Button>
      </div>
    </div>
  );
};

export default Settings;