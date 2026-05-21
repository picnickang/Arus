import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertOrganizationSchema, insertUserSchema } from "@shared/schema";
import type { Organization, User, InsertOrganization, InsertUser } from "@shared/schema";
import { z } from "zod";

const setPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export function useOrganizationData() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [organizationDialogOpen, setOrganizationDialogOpen] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [editingOrganization, setEditingOrganization] = useState<Organization | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);

  const {
    data: organizations = [],
    isLoading: organizationsLoading,
    refetch: refetchOrganizations,
  } = useQuery<Organization[]>({ queryKey: ["/api/organizations"], refetchInterval: 60000 });
  const {
    data: users = [],
    isLoading: usersLoading,
    refetch: refetchUsers,
  } = useQuery<User[]>({
    queryKey: ["/api/users", selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) {
        return [];
      }
      const params = new URLSearchParams({ orgId: selectedOrgId });
      const response = await fetch(`/api/users?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      return response.json();
    },
    enabled: !!selectedOrgId,
    refetchInterval: 60000,
  });

  const organizationForm = useForm<InsertOrganization>({
    resolver: zodResolver(insertOrganizationSchema),
    defaultValues: {
      name: "",
      slug: "",
      subscriptionTier: "basic",
      isActive: true,
      maxUsers: 50,
      maxEquipment: 1000,
    },
  });
  const userForm = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: { name: "", email: "", role: "viewer", isActive: true, orgId: selectedOrgId },
  });
  const passwordForm = useForm<z.infer<typeof setPasswordSchema>>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const filteredOrganizations = organizations.filter(
    (org) =>
      org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateOrganization = async (data: InsertOrganization) => {
    try {
      await apiRequest("POST", "/api/organizations", data);
      toast({ title: "Success", description: "Organization created successfully" });
      setOrganizationDialogOpen(false);
      organizationForm.reset();
      refetchOrganizations();
    } catch {
      toast({
        title: "Error",
        description: "Failed to create organization",
        variant: "destructive",
      });
    }
  };
  const handleUpdateOrganization = async (data: InsertOrganization) => {
    if (!editingOrganization) {
      return;
    }
    try {
      await apiRequest("PUT", `/api/organizations/${editingOrganization.id}`, data);
      toast({ title: "Success", description: "Organization updated successfully" });
      setOrganizationDialogOpen(false);
      setEditingOrganization(null);
      organizationForm.reset();
      refetchOrganizations();
    } catch {
      toast({
        title: "Error",
        description: "Failed to update organization",
        variant: "destructive",
      });
    }
  };
  const handleDeleteOrganization = async (id: string) => {
    if (
      !confirm("Are you sure you want to delete this organization? This action cannot be undone.")
    ) {
      return;
    }
    try {
      await apiRequest("DELETE", `/api/organizations/${id}`);
      toast({ title: "Success", description: "Organization deleted successfully" });
      refetchOrganizations();
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete organization",
        variant: "destructive",
      });
    }
  };
  const handleCreateUser = async (data: InsertUser) => {
    try {
      await apiRequest("POST", "/api/users", { ...data, orgId: selectedOrgId });
      toast({ title: "Success", description: "User created successfully" });
      setUserDialogOpen(false);
      userForm.reset();
      refetchUsers();
    } catch {
      toast({ title: "Error", description: "Failed to create user", variant: "destructive" });
    }
  };
  const handleUpdateUser = async (data: InsertUser) => {
    if (!editingUser) {
      return;
    }
    try {
      await apiRequest("PUT", `/api/users/${editingUser.id}`, data);
      toast({ title: "Success", description: "User updated successfully" });
      setUserDialogOpen(false);
      setEditingUser(null);
      userForm.reset();
      refetchUsers();
    } catch {
      toast({ title: "Error", description: "Failed to update user", variant: "destructive" });
    }
  };
  const handleDeleteUser = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return;
    }
    try {
      await apiRequest("DELETE", `/api/users/${id}`);
      toast({ title: "Success", description: "User deleted successfully" });
      refetchUsers();
    } catch {
      toast({ title: "Error", description: "Failed to delete user", variant: "destructive" });
    }
  };

  const handleSetPassword = async (data: z.infer<typeof setPasswordSchema>) => {
    if (!passwordUserId) {
      return;
    }
    try {
      await apiRequest("POST", `/api/users/${passwordUserId}/set-password`, {
        password: data.password,
      });
      toast({ title: "Success", description: "Password set successfully" });
      setPasswordDialogOpen(false);
      setPasswordUserId(null);
      passwordForm.reset();
    } catch {
      toast({ title: "Error", description: "Failed to set password", variant: "destructive" });
    }
  };
  const handleResetPassword = async (userId: string) => {
    try {
      const result: any = await apiRequest("POST", `/api/users/${userId}/reset-password`);
      toast({
        title: "Password Reset Token Generated",
        description: `Token: ${result.token}\nExpires in: ${result.expiresIn}`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to generate reset token",
        variant: "destructive",
      });
    }
  };

  const openOrganizationDialog = (organization?: Organization) => {
    if (organization) {
      setEditingOrganization(organization);
      organizationForm.reset(organization as object as Parameters<typeof organizationForm.reset>[0]);
    } else {
      setEditingOrganization(null);
      organizationForm.reset({
        name: "",
        slug: "",
        subscriptionTier: "basic",
        isActive: true,
        maxUsers: 50,
        maxEquipment: 1000,
      });
    }
    setOrganizationDialogOpen(true);
  };
  const openUserDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      userForm.reset(user as object as Parameters<typeof userForm.reset>[0]);
    } else {
      setEditingUser(null);
      userForm.reset({ name: "", email: "", role: "viewer", isActive: true, orgId: selectedOrgId });
    }
    setUserDialogOpen(true);
  };
  const openPasswordDialog = (userId: string) => {
    setPasswordUserId(userId);
    passwordForm.reset();
    setPasswordDialogOpen(true);
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "enterprise":
        return "bg-purple-100 text-purple-800";
      case "pro":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return {
    searchTerm,
    setSearchTerm,
    selectedOrgId,
    setSelectedOrgId,
    organizationDialogOpen,
    setOrganizationDialogOpen,
    userDialogOpen,
    setUserDialogOpen,
    passwordDialogOpen,
    setPasswordDialogOpen,
    editingOrganization,
    editingUser,
    organizations,
    organizationsLoading,
    users,
    usersLoading,
    organizationForm,
    userForm,
    passwordForm,
    filteredOrganizations,
    filteredUsers,
    handleCreateOrganization,
    handleUpdateOrganization,
    handleDeleteOrganization,
    handleCreateUser,
    handleUpdateUser,
    handleDeleteUser,
    handleSetPassword,
    handleResetPassword,
    openOrganizationDialog,
    openUserDialog,
    openPasswordDialog,
    getTierColor,
  };
}
