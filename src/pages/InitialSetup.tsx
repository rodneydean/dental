import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { invoke } from "@tauri-apps/api/core";
import { useAuth, User } from "@/contexts/AuthContext";
import { toast } from "sonner";

const InitialSetup = ({ onComplete }: { onComplete: () => void }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [hubAddress, setHubAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [setupMode, setSetupMode] = useState<"hub" | "spoke">("hub");
  const { setUser } = useAuth();

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const user = await invoke<User>("initial_setup", {
        username,
        password,
        fullName
      });
      setUser(user);

      // Also start as hub by default if choosing Hub tab
      await invoke("start_as_hub");

      toast.success("Initial Admin account created successfully!");
      onComplete();
    } catch (error) {
      toast.error(error as string);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpokeConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await invoke("start_as_spoke", {
        code: pairingCode,
        manualAddr: hubAddress || null
      });
      toast.success("Connecting to Hub...");
      onComplete();
    } catch (error) {
      toast.error(error as string);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-sm border border-gray-200 shadow-sm rounded-sm bg-white overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b border-gray-200 py-6">
          <CardTitle className="text-xl font-semibold text-center text-gray-900 tracking-tight">System Configuration</CardTitle>
          <CardDescription className="text-center text-xs font-medium uppercase tracking-widest text-gray-500 mt-1">Skryme Dental Initial Setup</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <Tabs value={setupMode} onValueChange={(v) => setSetupMode(v as "hub" | "spoke")} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-9 p-1 bg-gray-100 border border-gray-200 rounded-sm mb-6">
              <TabsTrigger value="hub" className="text-[10px] font-bold uppercase tracking-wider rounded-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">HUB</TabsTrigger>
              <TabsTrigger value="spoke" className="text-[10px] font-bold uppercase tracking-wider rounded-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">SPOKE</TabsTrigger>
            </TabsList>

            <TabsContent value="hub" className="mt-0">
              <form onSubmit={handleSetup} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Administrator Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="e.g. Dr. John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-10 text-sm rounded-sm border-gray-200"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="username" className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-10 text-sm rounded-sm border-gray-200"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" title="password" className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 text-sm rounded-sm border-gray-200"
                    required
                  />
                </div>
                <div className="pt-2">
                  <p className="text-[10px] font-medium text-gray-400 mb-4 bg-gray-50 p-2 rounded-sm border border-gray-100 italic">
                    Configuring as HUB makes this the central server for your network.
                  </p>
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white rounded-sm h-10 font-semibold" disabled={isLoading}>
                    {isLoading ? "Configuring..." : "Initialize Hub"}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="spoke" className="mt-0">
              <form onSubmit={handleSpokeConnect} className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="pairingCode" className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Pairing Code</Label>
                    <Input
                      id="pairingCode"
                      type="text"
                      placeholder="ABCDEF"
                      className="text-center text-2xl tracking-[0.5em] font-bold h-12 rounded-sm border-gray-200"
                      maxLength={6}
                      value={pairingCode}
                      onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hubAddress" className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Hub Address (Optional)</Label>
                    <Input
                      id="hubAddress"
                      type="text"
                      placeholder="192.168.1.100:8080"
                      value={hubAddress}
                      onChange={(e) => setHubAddress(e.target.value)}
                      className="h-10 text-sm rounded-sm border-gray-200"
                    />
                    <p className="text-[10px] text-gray-400 font-medium italic">
                      Leave empty for automatic discovery
                    </p>
                  </div>
                </div>
                <div className="pt-2">
                  <p className="text-[10px] font-medium text-gray-400 mb-4 bg-gray-50 p-2 rounded-sm border border-gray-100 italic">
                    Enter the code displayed on your HUB instance.
                  </p>
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white rounded-sm h-10 font-semibold" disabled={isLoading}>
                    {isLoading ? "Connecting..." : "Connect to Hub"}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default InitialSetup;
