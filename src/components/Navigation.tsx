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
  Settings,
  Cloud,
  CloudOff,
  HelpCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { dataManager } from "@/lib/dataManager";
import { useAuth } from "@/contexts/AuthContext";

const Navigation = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [todayAppointments, setTodayAppointments] = useState(0);
  const [notifications] = useState(3); // Mock notifications
  const [connStatus, setConnStatus] = useState<string>("Checking...");

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await invoke<string>("get_connection_status");
        setConnStatus(status);
      } catch {
        setConnStatus("Offline");
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
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
    { path: "/users", label: "Users", icon: User, roles: ["ADMIN"] },
    { path: "/data-management", label: "Data", icon: Database, roles: ["ADMIN"] },
  ];

  const navItems = allNavItems.filter((item) => user && item.roles.includes(user.role));

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <nav className="bg-white shadow-lg border-b border-gray-100 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-linear-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-linear-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
                DentalCare
              </h1>
              <p className="text-xs text-gray-500 -mt-1">{user?.role} Workspace</p>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className={`flex items-center space-x-2 relative ${
                      isActive
                        ? "bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
                        : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{item.label}</span>
                    {item.badge && (
                      <Badge
                        variant="destructive"
                        className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </Button>
                </Link>
              );
            })}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-3">
            {/* Connection Status */}
            <div className="hidden lg:flex items-center px-3 py-1 bg-gray-50 rounded-full border border-gray-100">
              {connStatus === "Connected" ? (
                <Cloud className="h-3 w-3 text-green-500 mr-2" />
              ) : (
                <CloudOff className="h-3 w-3 text-red-500 mr-2" />
              )}
              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                {connStatus}
              </span>
            </div>

            {/* Notifications */}
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-4 w-4" />
              {notifications > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {notifications}
                </Badge>
              )}
            </Button>

            {/* User Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 rounded-full"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-linear-to-br from-blue-500 to-indigo-600 text-white font-semibold">
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
                <DropdownMenuItem className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                {user?.role === 'ADMIN' && (
                  <DropdownMenuItem className="cursor-pointer" asChild>
                    <Link to="/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                )}
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
    </nav>
  );
};

export default Navigation;
