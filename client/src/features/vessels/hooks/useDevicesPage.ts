import { useState, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDevices } from "@/features/vessels";
import { useCreateMutation, useUpdateMutation, useDeleteMutation } from "@/hooks/useCrudMutations";
import type { Device, InsertDevice } from "@shared/schema";

const initialFormData: Partial<InsertDevice> = {
  id: "",
  vessel: "",
  buses: "",
  sensors: "",
  config: "",
  hmacKey: "",
};

export function useDevicesPage() {
  const { toast } = useToast();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [formData, setFormData] = useState<Partial<InsertDevice>>(initialFormData);

  const { data: devices, isLoading, error } = useDevices();

  const stats = useMemo(() => {
    const d = devices ?? [];
    return {
      total: d.length,
      online: d.filter((x: any) => x.status === "Online").length,
      warning: d.filter((x: any) => x.status === "Warning").length,
      critical: d.filter((x: any) => x.status === "Critical").length,
    };
  }, [devices]);

  const resetForm = useCallback(() => setFormData(initialFormData), []);

  const createDeviceMutation = useCreateMutation<InsertDevice>("/api/devices", {
    successMessage: "Device created successfully",
    onSuccess: () => {
      setAddModalOpen(false);
      resetForm();
    },
  });
  const updateDeviceMutation = useUpdateMutation<Partial<InsertDevice>>("/api/devices", {
    successMessage: "Device updated successfully",
    onSuccess: () => {
      setEditModalOpen(false);
      setSelectedDevice(null);
      resetForm();
    },
  });
  const deleteDeviceMutation = useDeleteMutation("/api/devices", {
    successMessage: "Device deleted successfully",
  });

  const handleAdd = useCallback(() => {
    resetForm();
    setAddModalOpen(true);
  }, [resetForm]);
  const handleEdit = useCallback((device: Device) => {
    setSelectedDevice(device);
    setFormData({
      id: device.id,
      vessel: device.vessel || "",
      buses: device.buses || "",
      sensors: device.sensors || "",
      config: device.config || "",
      hmacKey: device.hmacKey || "",
    });
    setEditModalOpen(true);
  }, []);
  const handleDelete = useCallback(
    (device: Device) => {
      if (
        confirm(
          `Are you sure you want to delete device "${device.id}"? This action cannot be undone.`
        )
      ) {
        deleteDeviceMutation.mutate(device.id);
      }
    },
    [deleteDeviceMutation]
  );
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.id?.trim()) {
        toast({
          title: "Validation Error",
          description: "Device ID is required",
          variant: "destructive",
        });
        return;
      }
      const deviceData: InsertDevice = {
        id: formData.id.trim(),
        orgId: (selectedDevice?.orgId as string) || "",
        vessel: (formData.vessel as any)?.toString().trim() || null,
        buses: (formData.buses as any)?.toString().trim() || null,
        sensors: (formData.sensors as any)?.toString().trim() || null,
        config: (formData.config as any)?.toString().trim() || null,
        hmacKey: (formData.hmacKey as any)?.toString().trim() || null,
      } as any;
      if (selectedDevice) {
        updateDeviceMutation.mutate({ id: selectedDevice.id, data: deviceData } as any);
      } else {
        createDeviceMutation.mutate(deviceData);
      }
    },
    [formData, selectedDevice, toast, createDeviceMutation, updateDeviceMutation]
  );

  return {
    devices,
    isLoading,
    error,
    stats,
    addModalOpen,
    setAddModalOpen,
    editModalOpen,
    setEditModalOpen,
    selectedDevice,
    formData,
    setFormData,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSubmit,
    createDeviceMutation,
    updateDeviceMutation,
  };
}
