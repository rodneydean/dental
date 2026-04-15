import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { dataManager } from "@/lib/dataManager";
import { Save, Settings as SettingsIcon, Server, Laptop, RefreshCw, Copy, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { checkForUpdates } from "@/lib/updater";
import { invoke } from "@tauri-apps/api/core";

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
  const [isLoading, setIsLoading] = useState(true);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    loadSettings();
    loadNetworkInfo();
  }, []);

  const loadSettings = async () => {
    try {
      const [fee, requirePay, autoUpd] = await Promise.all([
        dataManager.getSetting("reception_fee"),
        dataManager.getSetting("require_payment_before_admit"),
        dataManager.getSetting("auto_update")
      ]);
      setReceptionFee(fee || "0");
      setRequirePaymentBeforeAdmit(requirePay === "true");
      setAutoUpdate(autoUpd === "true");
    } catch {
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

  const handleSave = async () => {
    try {
      const promises = [
        dataManager.setSetting("auto_update", autoUpdate.toString())
      ];

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

      {user?.role === 'ADMIN' && (
        <Card className="border border-gray-200 shadow-sm rounded-sm bg-white overflow-hidden">
          <CardHeader className="bg-gray-50/50 border-b border-gray-200 py-3 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-900">Financial Settings</CardTitle>
            <CardDescription className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">Manage consultation fees and payment rules</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="receptionFee">Standard Reception Fee ($)</Label>
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