import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { invoke } from "@tauri-apps/api/core";
import { useAuth, User } from "@/contexts/AuthContext";
import { toast } from "sonner";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { setUser } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const user = await invoke<User>("login", { username, password });
      setUser(user);
      toast.success(`Welcome back, ${user.full_name}`);
    } catch (error) {
      toast.error(error as string);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-sm border border-gray-200 shadow-sm rounded-sm bg-white overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b border-gray-200 py-6">
          <CardTitle className="text-xl font-semibold text-center text-gray-900 tracking-tight">Skryme Dental Login</CardTitle>
          <CardDescription className="text-center text-xs font-medium uppercase tracking-widest text-gray-500 mt-1">Management System</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter username"
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
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white rounded-sm h-10 font-semibold mt-2" disabled={isLoading}>
              {isLoading ? "Authenticating..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
