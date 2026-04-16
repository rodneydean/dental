import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navigation from "./components/Navigation";
import Index from "./pages/Index";
import Patients from "./pages/Patients";
import Appointments from "./pages/Appointments";
import Treatments from "./pages/Treatments";
import Payments from "./pages/Payments";
import WaitingRoom from "./pages/WaitingRoom";
import Reception from "./pages/Reception";
import Settings from "./pages/Settings";
import DataManagement from "./components/DataManagement";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import InitialSetup from "./pages/InitialSetup";
import Reports from "./pages/Reports";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { invoke } from "@tauri-apps/api/core";
import UserManagement from "./pages/UserManagement";
import UsageGuide from "./pages/UsageGuide";
import { checkForUpdates } from "./lib/updater";
import { useLocation, useNavigate } from "react-router-dom";

const queryClient = new QueryClient();

const AppContent = () => {
  const { user, isLoading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const hasAdmin = await invoke<boolean>("check_has_admin");
        setNeedsSetup(!hasAdmin);

        // Check for updates on start
        checkForUpdates(true);
      } catch (error) {
        console.error("Failed to check setup status", error);
      }
    };
    checkSetup();
  }, []);

  useEffect(() => {
    if (user?.role === 'RECEPTION' && location.pathname !== '/reception') {
      navigate('/reception');
    }
  }, [user, location.pathname, navigate]);

  if (authLoading || needsSetup === null) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (needsSetup && !user) {
    return <InitialSetup onComplete={() => setNeedsSetup(false)} />;
  }

  if (!user) {
    return <Login />;
  }

  if (user.role === 'RECEPTION') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/reception" element={<Reception />} />
          <Route path="*" element={<Reception />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/reception" element={<Reception />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/treatments" element={<Treatments />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/waiting-room" element={<WaitingRoom />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/guide" element={<UsageGuide />} />
          <Route path="/settings" element={<Settings />} />
          {user.role === 'ADMIN' && (
            <>
              <Route path="/data-management" element={<DataManagement />} />
              <Route path="/users" element={<UserManagement />} />
            </>
          )}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <AuthProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
