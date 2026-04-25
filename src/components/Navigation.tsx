import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Calendar,
  Users,
  Stethoscope,
  Home,
  Activity,
  LogOut,
  User,
  Bell,
  Menu,
  Database,
  CreditCard,
  BarChart3,
  Settings,
  Cloud,
  CloudOff,
  HelpCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { dataManager } from "@/lib/dataManager";
import { useAuth } from "@/contexts/AuthContext";

const Navigation = () => {
  const location = useLocation();
  const { user, logout, setUser } = useAuth();
  const [todayAppointments, setTodayAppointments] = useState(0);
  const [notifications] = useState(3); // Mock notifications
  const [connStatus, setConnStatus] = useState<string>("Checking...");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState(user?.full_name || "");

  useEffect(() => {
    let unlisten: () => void;

    const setupStatusListener = async () => {
      try {
        // Initial check
        const status = await invoke<string>("get_connection_status");
        setConnStatus(status);

        // Listen for real-time updates
        unlisten = await listen<string>("connection-status-changed", (event) => {
          setConnStatus(event.payload);
        });
      } catch (error) {
        console.error("Failed to setup connection status listener", error);
        setConnStatus("Offline");
      }
    };

    setupStatusListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    const updateAppointments = async () => {
      try {
        const appointments = await dataManager.getAppointments();
        const today = new Date().toISOString().split("T")[0];
        const todayCount = appointments.filter(
          (apt) => apt.date === today
        ).length;
        setTodayAppointments(todayCount);
      } catch (error) {
        console.error("Failed to update appointments count", error);
      }
    };

    updateAppointments();
  }, []);

  const allNavItems = [
    { path: "/", label: "Dashboard", icon: Home, roles: ["ADMIN", "RECEPTION", "DOCTOR"] },
    { path: "/patients", label: "Patients", icon: Users, roles: ["ADMIN", "RECEPTION", "DOCTOR"] },
    {
      path: "/appointments",
      label: "Appointments",
      icon: Calendar,
      badge: todayAppointments > 0 ? todayAppointments : null,
      roles: ["ADMIN", "RECEPTION", "DOCTOR"],
    },
    { path: "/treatments", label: "Treatments", icon: Stethoscope, roles: ["ADMIN", "DOCTOR"] },
    { path: "/payments", label: "Payments", icon: CreditCard, roles: ["ADMIN", "RECEPTION"] },
    { path: "/waiting-room", label: "Waiting Room", icon: Users, roles: ["ADMIN", "RECEPTION", "DOCTOR"] },
    { path: "/reports", label: "Reports", icon: BarChart3, roles: ["ADMIN", "RECEPTION"] },
    { path: "/users", label: "Users", icon: User, roles: ["ADMIN"] },
    { path: "/data-management", label: "Data", icon: Database, roles: ["ADMIN"] },
  ];

  const navItems = allNavItems.filter((item) => user && item.roles.includes(user.role));

  if (user?.role === "RECEPTION") return null;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (newPassword && newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      await invoke("update_user", {
        requesterId: user.id,
        userId: user.id,
        fullName: fullName,
        password: newPassword || undefined,
      });

      toast.success("Profile updated successfully");
      setIsProfileOpen(false);
      setNewPassword("");
      setConfirmPassword("");

      // Update local state
      const updatedUser = { ...user, full_name: fullName };
      setUser(updatedUser);
    } catch (error) {
      toast.error("Failed to update profile: " + error);
    }
  };

  return (
    <nav className="bg-[#0078d4] text-white shadow-sm border-b border-[#005a9e] sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-12">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-white/10 rounded-sm">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white tracking-tight">
                Skryme Dental
              </h1>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="hidden md:flex items-center space-x-1 h-full">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link key={item.path} to={item.path} className="h-full flex items-center">
                  <button
                    className={`flex items-center space-x-2 px-3 h-full text-xs font-medium transition-colors outline-hidden ${
                      isActive
                        ? "bg-[#005a9e] border-b-2 border-white"
                        : "hover:bg-white/10"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span
                        className="ml-1.5 bg-red-600 text-white text-[10px] px-1.5 rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold"
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                </Link>
              );
            })}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-2">
            {/* Connection Status */}
            <div className="hidden lg:flex items-center px-2 py-0.5 bg-white/10 rounded-sm">
              {connStatus === "Connected" || connStatus === "Server Online" ? (
                <Cloud className="h-3 w-3 text-green-300 mr-2" />
              ) : connStatus.includes("Syncing") ? (
                <Activity className="h-3 w-3 text-blue-300 mr-2 animate-pulse" />
              ) : (
                <CloudOff className="h-3 w-3 text-red-300 mr-2" />
              )}
              <span className="text-[10px] font-semibold uppercase tracking-wider">
                {connStatus}
              </span>
            </div>

            {/* Notifications */}
            <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0 text-white hover:bg-white/10 rounded-sm">
              <Bell className="h-4 w-4" />
              {notifications > 0 && (
                <span
                  className="absolute top-1 right-1 bg-red-600 text-white text-[9px] px-1 rounded-full min-w-[14px] h-[14px] flex items-center justify-center font-bold"
                >
                  {notifications}
                </span>
              )}
            </Button>

            {/* User Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 p-0 hover:bg-white/10 rounded-sm"
                >
                  <Avatar className="h-7 w-7 rounded-sm">
                    <AvatarFallback className="bg-white/20 text-white font-semibold text-xs rounded-sm">
                      {user ? getInitials(user.full_name) : "?"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user?.full_name}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      @{user?.username} ({user?.role})
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer" asChild>
                  <Link to="/guide">
                    <HelpCircle className="mr-2 h-4 w-4" />
                    <span>Usage Guide</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={() => {
                  setFullName(user?.full_name || "");
                  setIsProfileOpen(true);
                }}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" asChild>
                  <Link to="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer text-red-600" onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu */}
            <Button variant="ghost" size="sm" className="md:hidden">
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-4">
          <div className="flex flex-wrap gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className={`flex items-center space-x-2 ${
                      isActive
                        ? "bg-linear-to-r from-blue-600 to-indigo-600 text-white"
                        : "text-gray-600"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="text-xs">{item.label}</span>
                    {item.badge && (
                      <Badge
                        variant="destructive"
                        className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-xs"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Profile</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateProfile} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Full Name</Label>
              <Input
                id="profile-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-password">New Password (Leave blank to keep current)</Label>
              <Input
                id="profile-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New Password"
              />
            </div>
            {newPassword && (
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm New Password"
                  required
                />
              </div>
            )}
            <Button type="submit" className="w-full bg-[#0078d4] hover:bg-[#005a9e]">
              Save Changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </nav>
  );
};

export default Navigation;
