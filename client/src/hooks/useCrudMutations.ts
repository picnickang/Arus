import { useMutation, UseMutationResult } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CrudMutationOptions<TData = unknown> {
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
  invalidateKeys?: string[]; // Additional query keys to invalidate
}

/**
 * Reusable hook for CREATE operations
 * Automatically handles: API request, query invalidation, toast notifications
 *
 * @example
 * const createMutation = useCreateMutation<SensorConfigFormData>('/api/sensor-configs', {
 *   successMessage: "Sensor configuration created successfully",
 *   onSuccess: () => setDialogOpen(false)
 * });
 */
export function useCreateMutation<TInput, TOutput = unknown>(
  endpoint: string,
  options?: CrudMutationOptions<TOutput>
): UseMutationResult<TOutput, Error, TInput> {
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: TInput) => apiRequest("POST", endpoint, data),
    onSuccess: (data) => {
      // Invalidate the main endpoint query (prefix match)
      queryClient.invalidateQueries({ queryKey: [endpoint], exact: false });

      // Invalidate any additional queries specified (prefix match)
      options?.invalidateKeys?.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey: [queryKey], exact: false });
      });

      toast({
        title: "Created",
        description: options?.successMessage || "Successfully created",
      });

      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      toast({
        title: "Creation Failed",
        description: options?.errorMessage || error.message,
        variant: "destructive",
      });

      options?.onError?.(error);
    },
  });
}

/**
 * Reusable hook for UPDATE operations
 * Automatically handles: API request, query invalidation, toast notifications
 *
 * @example
 * const updateMutation = useUpdateMutation<SensorConfigFormData>('/api/sensor-configs', {
 *   successMessage: "Sensor configuration updated successfully",
 *   onSuccess: () => setDialogOpen(false)
 * });
 * // Usage: updateMutation.mutate({ id: '123', data: { ... } })
 */
export function useUpdateMutation<TInput, TOutput = unknown>(
  endpoint: string,
  options?: CrudMutationOptions<TOutput>
): UseMutationResult<TOutput, Error, { id: string; data: Partial<TInput> }> {
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TInput> }) =>
      apiRequest("PUT", `${endpoint}/${id}`, data),
    onSuccess: (data) => {
      // Invalidate the main endpoint query (prefix match)
      queryClient.invalidateQueries({ queryKey: [endpoint], exact: false });

      // Invalidate any additional queries specified (prefix match)
      options?.invalidateKeys?.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey: [queryKey], exact: false });
      });

      toast({
        title: "Updated",
        description: options?.successMessage || "Successfully updated",
      });

      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: options?.errorMessage || error.message,
        variant: "destructive",
      });

      options?.onError?.(error);
    },
  });
}

/**
 * Reusable hook for DELETE operations
 * Automatically handles: API request, query invalidation, toast notifications
 *
 * @example
 * const deleteMutation = useDeleteMutation('/api/sensor-configs', {
 *   successMessage: "Sensor configuration deleted successfully"
 * });
 * // Usage: deleteMutation.mutate('config-id-123')
 */
export function useDeleteMutation<TOutput = unknown>(
  endpoint: string,
  options?: CrudMutationOptions<TOutput>
): UseMutationResult<TOutput, Error, string> {
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `${endpoint}/${id}`),
    onSuccess: (data) => {
      // Invalidate the main endpoint query (prefix match)
      queryClient.invalidateQueries({ queryKey: [endpoint], exact: false });

      // Invalidate any additional queries specified (prefix match)
      options?.invalidateKeys?.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey: [queryKey], exact: false });
      });

      toast({
        title: "Deleted",
        description: options?.successMessage || "Successfully deleted",
      });

      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion Failed",
        description: options?.errorMessage || error.message,
        variant: "destructive",
      });

      options?.onError?.(error);
    },
  });
}

/**
 * Reusable hook for BATCH DELETE operations
 * Automatically handles: API request, query invalidation, toast notifications
 *
 * @example
 * const batchDeleteMutation = useBatchDeleteMutation('/api/sensor-configs', {
 *   successMessage: "Sensor configurations deleted successfully"
 * });
 * // Usage: batchDeleteMutation.mutate(['id1', 'id2', 'id3'])
 */
export function useBatchDeleteMutation<TOutput = unknown>(
  endpoint: string,
  options?: CrudMutationOptions<TOutput>
): UseMutationResult<TOutput, Error, string[]> {
  const { toast } = useToast();

  return useMutation({
    mutationFn: (ids: string[]) => apiRequest("POST", `${endpoint}/batch-delete`, { ids }),
    onSuccess: (data) => {
      // Invalidate the main endpoint query (prefix match)
      queryClient.invalidateQueries({ queryKey: [endpoint], exact: false });

      // Invalidate any additional queries specified (prefix match)
      options?.invalidateKeys?.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey: [queryKey], exact: false });
      });

      toast({
        title: "Deleted",
        description: options?.successMessage || "Successfully deleted items",
      });

      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion Failed",
        description: options?.errorMessage || error.message,
        variant: "destructive",
      });

      options?.onError?.(error);
    },
  });
}

interface CustomMutationOptions<TInput, TOutput> {
  mutationFn: (data: TInput) => Promise<TOutput>;
  invalidateKeys?: string[];
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (data: TOutput) => void;
  onError?: (error: Error) => void;
}

/**
 * Reusable hook for CUSTOM mutations with standard error/success handling
 * Use this for operations that don't fit standard CRUD patterns
 *
 * @example
 * const approveSignalMutation = useCustomMutation({
 *   mutationFn: (data) => apiRequest('POST', '/api/sensors/approve', data),
 *   invalidateKeys: ['/api/sensors/unknown'],
 *   successMessage: "Signal approved and mapped successfully",
 *   onSuccess: () => setDialogOpen(false)
 * });
 */
export function useCustomMutation<TInput, TOutput = unknown>(
  options: CustomMutationOptions<TInput, TOutput>
): UseMutationResult<TOutput, Error, TInput> {
  const { toast } = useToast();

  return useMutation({
    mutationFn: options.mutationFn,
    onSuccess: (data) => {
      // Invalidate specified query keys (prefix match)
      options.invalidateKeys?.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key], exact: false });
      });

      if (options.successMessage) {
        toast({
          title: "Success",
          description: options.successMessage,
        });
      }

      options.onSuccess?.(data);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: options.errorMessage || error.message,
        variant: "destructive",
      });

      options.onError?.(error);
    },
  });
}
