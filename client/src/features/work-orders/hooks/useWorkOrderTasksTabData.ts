import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ChecklistItem {
  id: string;
  itemId?: string;
  workOrderId: string;
  description: string;
  isCompleted: boolean;
  completedBy?: string;
  completedByName?: string;
  completedAt?: string;
  passed?: boolean | null;
  notes?: string;
  isTemplate?: boolean;
  category?: string;
  sortOrder?: number;
}
interface ChecklistProgress {
  totalItems: number;
  completedItems: number;
  pendingItems: number;
  skippedItems: number;
  failedItems: number;
  percentComplete: number;
}
interface ChecklistCompletion {
  id: string;
  itemId: string;
  description?: string;
  passed: boolean | null;
  notes?: string;
  completedByName?: string;
  completedAt?: string;
}
interface ChecklistResponse {
  completions: ChecklistCompletion[];
  progress: ChecklistProgress;
}

export function useWorkOrderTasksTabData(workOrderId: string) {
  const { toast } = useToast();
  const [newTaskText, setNewTaskText] = useState("");
  const [isAddingTask, setIsAddingTask] = useState(false);

  const { data: checklistData, isLoading: isLoadingChecklist } = useQuery<ChecklistResponse>({
    queryKey: [`/api/maintenance-checklist/${workOrderId}`],
    queryFn: () => apiRequest("GET", `/api/maintenance-checklist/${workOrderId}`),
    staleTime: 30000,
  });
  const { data: workOrderTasks = [], isLoading: isLoadingTasks } = useQuery<ChecklistItem[]>({
    queryKey: [`/api/work-orders/${workOrderId}/tasks`],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", `/api/work-orders/${workOrderId}/tasks`);
        return response ?? [];
      } catch {
        return [];
      }
    },
    staleTime: 30000,
  });

  const getUserIdentity = useCallback(() => {
    try {
      const storedUser = localStorage.getItem("currentUser");
      if (storedUser) {
        const user = JSON.parse(storedUser);
        return { id: user.id || "session-user", name: user.name || user.email || "Session User" };
      }
    } catch {
      /* ignore parse errors */
    }
    return { id: "session-user", name: "Session User" };
  }, []);

  const updateChecklistItemMutation = useMutation({
    mutationFn: async ({
      itemId,
      passed,
      notes,
    }: {
      itemId: string;
      passed: boolean | null;
      notes?: string;
    }) => {
      const user = getUserIdentity();
      return apiRequest("POST", `/api/maintenance-checklist/${workOrderId}/complete`, {
        itemId,
        completedBy: user.id,
        completedByName: user.name,
        passed,
        notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/maintenance-checklist/${workOrderId}`] });
      toast({ title: "Checklist Updated", description: "Checklist item status has been updated" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update checklist item",
        variant: "destructive",
      });
    },
  });

  const resetChecklistItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return apiRequest("POST", `/api/maintenance-checklist/${workOrderId}/complete`, {
        itemId,
        completedBy: null,
        completedByName: null,
        passed: null,
        notes: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/maintenance-checklist/${workOrderId}`] });
      toast({ title: "Checklist Reset", description: "Checklist item has been reset to pending" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reset checklist item",
        variant: "destructive",
      });
    },
  });

  const addTaskMutation = useMutation({
    mutationFn: async (description: string) => {
      return apiRequest("POST", `/api/work-orders/${workOrderId}/tasks`, {
        description,
        isCompleted: false,
      });
    },
    onSuccess: () => {
      setNewTaskText("");
      setIsAddingTask(false);
      queryClient.invalidateQueries({ queryKey: [`/api/work-orders/${workOrderId}/tasks`] });
      toast({ title: "Task Added", description: "New task has been added to this work order" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add task", variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return apiRequest("DELETE", `/api/work-orders/${workOrderId}/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/work-orders/${workOrderId}/tasks`] });
      toast({ title: "Task Deleted", description: "Task has been removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
    },
  });

  const toggleTaskCompletion = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      return apiRequest("PATCH", `/api/work-orders/${workOrderId}/tasks/${taskId}`, {
        isCompleted: completed,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/work-orders/${workOrderId}/tasks`] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
    },
  });

  const handleAddTask = useCallback(() => {
    if (newTaskText.trim()) {
      addTaskMutation.mutate(newTaskText.trim());
    }
  }, [newTaskText, addTaskMutation]);
  const cancelAddTask = useCallback(() => {
    setIsAddingTask(false);
    setNewTaskText("");
  }, []);

  const isLoading = isLoadingChecklist || isLoadingTasks;
  const progress = checklistData?.progress;
  const templateCompletions = useMemo(() => checklistData?.completions ?? [], [checklistData]);
  const totalTasks = useMemo(
    () => (progress?.totalItems || 0) + workOrderTasks.length,
    [progress, workOrderTasks]
  );
  const completedTasksCount = useMemo(
    () => (progress?.completedItems || 0) + workOrderTasks.filter((t) => t.isCompleted).length,
    [progress, workOrderTasks]
  );
  const overallProgress = useMemo(
    () => (totalTasks > 0 ? Math.round((completedTasksCount / totalTasks) * 100) : 0),
    [totalTasks, completedTasksCount]
  );
  const hasNoTasks = totalTasks === 0;

  return {
    newTaskText,
    setNewTaskText,
    isAddingTask,
    setIsAddingTask,
    isLoading,
    progress,
    templateCompletions,
    workOrderTasks,
    totalTasks,
    completedTasksCount,
    overallProgress,
    hasNoTasks,
    updateChecklistItemMutation,
    resetChecklistItemMutation,
    addTaskMutation,
    deleteTaskMutation,
    toggleTaskCompletion,
    handleAddTask,
    cancelAddTask,
  };
}
