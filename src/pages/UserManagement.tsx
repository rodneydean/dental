import { useState, useEffect, useCallback } from "react";
import { useAuth, User } from "@/contexts/AuthContext";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, Trash2, Users } from "lucide-react";

interface UserWithMetadata extends User {
    created_at: string;
}

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserWithMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // New user form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<string>("RECEPTION");

  const fetchUsers = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const result = await invoke<UserWithMetadata[]>("list_users", { adminId: currentUser.id });
      setUsers(result);
    } catch (error) {
      toast.error("Failed to fetch users: " + error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      await invoke("create_user", {
        adminId: currentUser.id,
        username,
        password,
        role,
        fullName,
      });
      toast.success("User created successfully");
      setIsDialogOpen(false);
      // Reset form
      setUsername("");
      setPassword("");
      setFullName("");
      setRole("RECEPTION");
      fetchUsers();
    } catch (error) {
      toast.error("Failed to create user: " + error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!currentUser) return;
    if (userId === currentUser.id) {
      toast.error("You cannot delete yourself");
      return;
    }

    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      await invoke("delete_user", { adminId: currentUser.id, userId });
      toast.success("User deleted successfully");
      fetchUsers();
    } catch (error) {
      toast.error("Failed to delete user: " + error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">User Management</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage staff accounts and permissions</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-white rounded-sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Add New Staff
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Staff Account</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="new-fullname">Full Name</Label>
                <Input
                  id="new-fullname"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Jane Smith"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-username">Username</Label>
                <Input
                  id="new-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="janesmith"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="DOCTOR">Doctor</SelectItem>
                    <SelectItem value="RECEPTION">Receptionist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                Create Account
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border border-gray-200 shadow-sm rounded-sm overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b border-gray-200 py-3 px-4">
          <CardTitle className="flex items-center text-xs font-semibold uppercase tracking-wider text-gray-900">
            <Users className="h-4 w-4 mr-2 text-primary" />
            Active Staff Accounts
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow className="border-b border-gray-200 hover:bg-transparent">
                <TableHead className="h-9 text-[10px] font-bold uppercase tracking-widest text-gray-500 px-4">Full Name</TableHead>
                <TableHead className="h-9 text-[10px] font-bold uppercase tracking-widest text-gray-500 px-4">Username</TableHead>
                <TableHead className="h-9 text-[10px] font-bold uppercase tracking-widest text-gray-500 px-4">Role</TableHead>
                <TableHead className="h-9 text-[10px] font-bold uppercase tracking-widest text-gray-500 px-4">Created At</TableHead>
                <TableHead className="h-9 text-[10px] font-bold uppercase tracking-widest text-gray-500 px-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-xs text-gray-500">Loading users...</TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-xs text-gray-400">No users found</TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                    <TableCell className="px-4 py-3 text-sm font-medium text-gray-900">{u.full_name}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-600">{u.username}</TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge variant="outline" className={`text-[10px] font-bold px-2 py-0 h-5 rounded-sm uppercase tracking-tight ${
                        u.role === 'ADMIN' ? 'border-purple-200 bg-purple-50 text-purple-700' :
                        u.role === 'DOCTOR' ? 'border-blue-200 bg-blue-50 text-primary' :
                        'border-green-200 bg-green-50 text-green-700'
                      }`}>
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs text-gray-500">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteUser(u.id)}
                        disabled={u.id === currentUser?.id}
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-sm"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;
