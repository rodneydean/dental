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
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Initial System Setup</CardTitle>
          <CardDescription className="text-center">Choose how you want to configure this device</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={setupMode} onValueChange={(v) => setSetupMode(v as "hub" | "spoke")} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="hub">Setup as Hub</TabsTrigger>
              <TabsTrigger value="spoke">Setup as Spoke</TabsTrigger>
            </TabsList>

            <TabsContent value="hub">
              <form onSubmit={handleSetup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Dr. John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground mb-4">
                    Setting up as Hub will make this computer the central server for your network.
                  </p>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Setting up..." : "Initialize Hub & Create Admin"}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="spoke">
              <form onSubmit={handleSpokeConnect} className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pairingCode">Pairing Code</Label>
                    <Input
                      id="pairingCode"
                      type="text"
                      placeholder="ABCDEF"
                      className="text-center text-2xl tracking-widest"
                      maxLength={6}
                      value={pairingCode}
                      onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hubAddress">Hub IP Address (Optional)</Label>
                    <Input
                      id="hubAddress"
                      type="text"
                      placeholder="192.168.1.100:8080"
                      value={hubAddress}
                      onChange={(e) => setHubAddress(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Leave empty for automatic discovery
                    </p>
                  </div>
                </div>
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground mb-4">
                    Enter the code displayed on your Hub computer to connect.
                  </p>
                  <Button type="submit" className="w-full" disabled={isLoading}>
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
