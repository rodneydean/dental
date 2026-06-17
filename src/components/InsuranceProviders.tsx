import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { dataManager, type InsuranceProvider } from "@/lib/dataManager";
import { Plus, Trash2, ShieldCheck, Edit, Info } from "lucide-react";

const InsuranceProviders = () => {
  const [insuranceProviders, setInsuranceProviders] = useState<InsuranceProvider[]>([]);
  const [newProviderName, setNewProviderName] = useState("");
  const [providerPaysReception, setProviderPaysReception] = useState(false);
  const [editingProvider, setEditingProvider] = useState<InsuranceProvider | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadInsuranceProviders = async () => {
    setIsLoading(true);
    try {
      const loadedProviders = await dataManager.getInsuranceProviders();
      setInsuranceProviders(loadedProviders);
    } catch {
      toast.error("Failed to load insurance providers");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInsuranceProviders();
  }, []);

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
    if (!confirm("Are you sure you want to delete this insurance provider?")) return;
    try {
      await dataManager.deleteInsuranceProvider(id);
      loadInsuranceProviders();
      toast.success("Insurance provider deleted");
    } catch {
      toast.error("Failed to delete insurance provider");
    }
  };

  const handleUpdateProvider = async () => {
    if (!editingProvider) return;
    try {
      await dataManager.updateInsuranceProvider(editingProvider.id, {
        name: editingProvider.name,
        pays_reception_fee: editingProvider.pays_reception_fee
      });
      setEditingProvider(null);
      loadInsuranceProviders();
      toast.success("Insurance provider updated");
    } catch {
      toast.error("Failed to update insurance provider");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200 shadow-sm rounded-sm bg-white overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b border-gray-200 py-3 px-4">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-900">Add New Provider</CardTitle>
          <CardDescription className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">Register a new insurance company</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-gray-50 p-4 rounded-sm border border-gray-100">
            <div className="space-y-1.5 md:col-span-1">
              <Label htmlFor="providerName" className="text-[10px] font-bold uppercase text-gray-500">Provider Name</Label>
              <Input
                id="providerName"
                value={newProviderName}
                onChange={(e) => setNewProviderName(e.target.value)}
                placeholder="e.g., Aetna"
                className="h-9 text-sm rounded-sm border-gray-200"
              />
            </div>
            <div className="flex items-center space-x-2 pb-2 md:pb-0 h-9">
              <input
                type="checkbox"
                id="paysReception"
                checked={providerPaysReception}
                onChange={(e) => setProviderPaysReception(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#0078d4] focus:ring-[#0078d4]"
              />
              <Label htmlFor="paysReception" className="text-[10px] font-bold uppercase text-gray-500">Covers Reception Fee</Label>
            </div>
            <Button onClick={handleAddProvider} className="h-9 bg-[#0078d4] hover:bg-[#005a9e] text-white font-semibold rounded-sm">
              <Plus className="h-4 w-4 mr-2" /> Add Provider
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="col-span-full py-10 text-center text-gray-500 font-medium uppercase text-xs tracking-widest">Loading Providers...</div>
        ) : insuranceProviders.length > 0 ? (
          insuranceProviders.map((provider) => (
            <Card key={provider.id} className="border border-gray-100 rounded-sm hover:shadow-md transition-all group bg-white overflow-hidden">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-purple-50 text-purple-600 rounded-sm">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{provider.name}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                      {provider.pays_reception_fee ? "Covers Reception Fee" : "Treatments Only"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[#0078d4] hover:bg-blue-50 rounded-sm"
                    onClick={() => setEditingProvider(provider)}
                  >
                    <Edit size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-sm"
                    onClick={() => handleDeleteProvider(provider.id)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-20 border border-dashed border-gray-200 rounded-sm bg-white">
            <Info className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium uppercase tracking-wider">No insurance providers configured</p>
          </div>
        )}
      </div>

      {/* Edit Provider Dialog */}
      {editingProvider && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <Card className="w-full max-w-md bg-white border-none shadow-2xl rounded-sm">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-[#0078d4]">Edit Insurance Provider</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-1.5">
                <Label htmlFor="editProviderName" className="text-[10px] font-bold uppercase text-gray-500">Provider Name</Label>
                <Input
                  id="editProviderName"
                  value={editingProvider.name}
                  onChange={(e) => setEditingProvider({ ...editingProvider, name: e.target.value })}
                  className="h-10 text-sm border-gray-200 rounded-sm"
                />
              </div>
              <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-sm">
                <input
                  type="checkbox"
                  id="editPaysReception"
                  checked={editingProvider.pays_reception_fee}
                  onChange={(e) => setEditingProvider({ ...editingProvider, pays_reception_fee: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-[#0078d4] focus:ring-[#0078d4]"
                />
                <Label htmlFor="editPaysReception" className="text-xs font-bold text-gray-700">Covers Reception Fee</Label>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" size="sm" className="h-9 rounded-sm border-gray-200" onClick={() => setEditingProvider(null)}>Cancel</Button>
                <Button size="sm" className="h-9 bg-[#0078d4] hover:bg-[#005a9e] rounded-sm text-white font-bold" onClick={handleUpdateProvider}>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default InsuranceProviders;
