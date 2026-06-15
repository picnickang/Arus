import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type Connection, type Edge, type EdgeChange, type NodeChange } from "reactflow";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Equipment, EquipmentDependency, Vessel } from "@shared/schema";
import {
  applyDependencyNodeChanges,
  buildDependencyEdges,
  buildDependencyNodes,
  buildOptimisticDependency,
  changesAffectLayout,
  formatEquipmentLabel,
  indexEquipmentById,
  isForbiddenVesselsError,
  mergeLayoutPositions,
  parseCsv,
  type CsvRow,
  type DependenciesResponse,
  type LayoutResponse,
  type NodePositions,
  type NotesDialogState,
} from "./equipment-dependencies-model";

export function useEquipmentDependenciesPageState() {
  const { toast } = useToast();
  const [selectedVesselId, setSelectedVesselId] = useState("");
  const [upstreamId, setUpstreamId] = useState("");
  const [downstreamId, setDownstreamId] = useState("");
  const [notes, setNotes] = useState("");
  const [csvText, setCsvText] = useState("");
  const [nodePositions, setNodePositions] = useState<NodePositions>({});
  const [notesDialog, setNotesDialog] = useState<NotesDialogState>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string | null>(null);

  const vesselsQuery = useQuery<Vessel[]>({ queryKey: ["/api/vessels"] });
  const vessels = vesselsQuery.data ?? [];
  const isForbidden = isForbiddenVesselsError(vesselsQuery.error);

  const equipmentQuery = useQuery<Equipment[]>({
    queryKey: ["/api/equipment", { vesselId: selectedVesselId }],
    queryFn: () =>
      apiRequest("GET", `/api/equipment?vesselId=${encodeURIComponent(selectedVesselId)}`),
    enabled: !!selectedVesselId,
  });
  const equipmentList: Equipment[] = Array.isArray(equipmentQuery.data) ? equipmentQuery.data : [];
  const equipmentById = useMemo(() => indexEquipmentById(equipmentList), [equipmentList]);

  const depsQueryKey = useMemo(
    () => ["/api/v1/vessels", selectedVesselId, "equipment-dependencies"] as const,
    [selectedVesselId]
  );
  const depsQuery = useQuery<DependenciesResponse>({
    queryKey: depsQueryKey,
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/v1/vessels/${encodeURIComponent(selectedVesselId)}/equipment-dependencies`
      ),
    enabled: !!selectedVesselId,
  });
  const dependencies = depsQuery.data?.dependencies ?? [];
  const invalidateDeps = () => queryClient.invalidateQueries({ queryKey: depsQueryKey });

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/v1/equipment-dependencies", {
        vesselId: selectedVesselId,
        upstreamEquipmentId: upstreamId,
        downstreamEquipmentId: downstreamId,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      toast({ title: "Dependency added" });
      setUpstreamId("");
      setDownstreamId("");
      setNotes("");
      invalidateDeps();
    },
    onError: (err: Error) =>
      toast({
        title: "Failed to add dependency",
        description: err.message,
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/v1/equipment-dependencies/${id}`),
    onSuccess: () => {
      toast({ title: "Dependency removed" });
      invalidateDeps();
    },
    onError: (err: Error) =>
      toast({
        title: "Failed to remove dependency",
        description: err.message,
        variant: "destructive",
      }),
  });

  const graphCreateMutation = useMutation({
    mutationFn: (input: { upstreamEquipmentId: string; downstreamEquipmentId: string }) =>
      apiRequest<{ dependency: EquipmentDependency }>("POST", "/api/v1/equipment-dependencies", {
        vesselId: selectedVesselId,
        upstreamEquipmentId: input.upstreamEquipmentId,
        downstreamEquipmentId: input.downstreamEquipmentId,
        notes: null,
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: depsQueryKey });
      const prev = queryClient.getQueryData<DependenciesResponse>(depsQueryKey);
      const optimistic = buildOptimisticDependency(selectedVesselId, input);
      queryClient.setQueryData<DependenciesResponse>(depsQueryKey, {
        dependencies: [...(prev?.dependencies ?? []), optimistic],
      });
      return { prev };
    },
    onError: (err: Error, _input, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(depsQueryKey, ctx.prev);
      }
      toast({ title: "Couldn't add edge", description: err.message, variant: "destructive" });
    },
    onSettled: () => invalidateDeps(),
  });

  const graphPatchMutation = useMutation({
    mutationFn: (input: { id: string; notes: string | null }) =>
      apiRequest<{ dependency: EquipmentDependency }>(
        "PATCH",
        `/api/v1/equipment-dependencies/${input.id}`,
        { notes: input.notes }
      ),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: depsQueryKey });
      const prev = queryClient.getQueryData<DependenciesResponse>(depsQueryKey);
      queryClient.setQueryData<DependenciesResponse>(depsQueryKey, {
        dependencies: (prev?.dependencies ?? []).map((d) =>
          d.id === input.id ? { ...d, notes: input.notes } : d
        ),
      });
      return { prev };
    },
    onError: (err: Error, _input, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(depsQueryKey, ctx.prev);
      }
      toast({ title: "Couldn't save notes", description: err.message, variant: "destructive" });
    },
    onSettled: () => invalidateDeps(),
  });

  const graphDeleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/v1/equipment-dependencies/${id}`),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: depsQueryKey });
      const prev = queryClient.getQueryData<DependenciesResponse>(depsQueryKey);
      queryClient.setQueryData<DependenciesResponse>(depsQueryKey, {
        dependencies: (prev?.dependencies ?? []).filter((d) => d.id !== id),
      });
      return { prev };
    },
    onError: (err: Error, _id, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(depsQueryKey, ctx.prev);
      }
      toast({ title: "Couldn't remove edge", description: err.message, variant: "destructive" });
    },
    onSettled: () => invalidateDeps(),
  });

  const importMutation = useMutation({
    mutationFn: (rows: CsvRow[]) =>
      apiRequest<{ ok: true; inserted: number; skipped: number }>(
        "POST",
        `/api/v1/vessels/${encodeURIComponent(selectedVesselId)}/equipment-dependencies/import-csv`,
        { rows }
      ),
    onSuccess: (result) => {
      toast({
        title: "Import complete",
        description: `Inserted ${result.inserted}, skipped ${result.skipped} (duplicates).`,
      });
      setCsvText("");
      invalidateDeps();
    },
    onError: (err: Error) =>
      toast({ title: "Import failed", description: err.message, variant: "destructive" }),
  });

  const layoutQueryKey = useMemo(
    () => ["/api/v1/vessels", selectedVesselId, "equipment-dependency-layout"] as const,
    [selectedVesselId]
  );
  const layoutQuery = useQuery<LayoutResponse>({
    queryKey: layoutQueryKey,
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/v1/vessels/${encodeURIComponent(selectedVesselId)}/equipment-dependency-layout`
      ),
    enabled: !!selectedVesselId,
  });

  useEffect(() => {
    if (!selectedVesselId || equipmentList.length === 0) {
      setNodePositions({});
      return;
    }
    if (layoutQuery.isLoading) {
      return;
    }
    const merged = mergeLayoutPositions(equipmentList, layoutQuery.data?.positions ?? {});
    setNodePositions(merged);
    lastSavedRef.current = JSON.stringify(merged);
  }, [selectedVesselId, equipmentList, layoutQuery.data, layoutQuery.isLoading]);

  const saveLayoutMutation = useMutation({
    mutationFn: (input: { vesselId: string; positions: NodePositions }) =>
      apiRequest<{ ok: true; positions: NodePositions }>(
        "PUT",
        `/api/v1/vessels/${encodeURIComponent(input.vesselId)}/equipment-dependency-layout`,
        { positions: input.positions }
      ),
    onError: (err: Error) => {
      const last = lastSavedRef.current;
      if (last) {
        try {
          setNodePositions(JSON.parse(last) as NodePositions);
        } catch {
          // Keep current state if a local rollback snapshot is corrupt.
        }
      }
      toast({ title: "Couldn't save layout", description: err.message, variant: "destructive" });
    },
    onSuccess: (_res, input) => {
      lastSavedRef.current = JSON.stringify(input.positions);
      queryClient.setQueryData<LayoutResponse>(layoutQueryKey, { positions: input.positions });
    },
  });

  const scheduleLayoutSave = useCallback(
    (positions: NodePositions) => {
      if (!selectedVesselId) {
        return;
      }
      const serialized = JSON.stringify(positions);
      if (serialized === lastSavedRef.current) {
        return;
      }
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        saveLayoutMutation.mutate({ vesselId: selectedVesselId, positions });
      }, 500);
    },
    [selectedVesselId, saveLayoutMutation]
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [selectedVesselId]);

  const nodes = useMemo(
    () => buildDependencyNodes(equipmentList, nodePositions),
    [equipmentList, nodePositions]
  );

  const edges = useMemo(() => buildDependencyEdges(dependencies), [dependencies]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const positional = changesAffectLayout(changes);
      setNodePositions((prev) => {
        const next = applyDependencyNodeChanges(prev, changes);
        if (positional) {
          scheduleLayoutSave(next);
        }
        return next;
      });
    },
    [scheduleLayoutSave]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const c of changes) {
        if (c.type === "remove" && !c.id.startsWith("optimistic-")) {
          graphDeleteMutation.mutate(c.id);
        }
      }
    },
    [graphDeleteMutation]
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) {
        return;
      }
      if (conn.source === conn.target) {
        toast({
          title: "Self-loop not allowed",
          description: "An equipment can't depend on itself.",
          variant: "destructive",
        });
        return;
      }
      const exists = dependencies.some(
        (d) => d.upstreamEquipmentId === conn.source && d.downstreamEquipmentId === conn.target
      );
      if (exists) {
        toast({ title: "That dependency already exists" });
        return;
      }
      setNotesDialog({
        mode: "create",
        upstreamId: conn.source,
        downstreamId: conn.target,
        notes: "",
      });
    },
    [dependencies, toast]
  );

  const onEdgeClick = useCallback(
    (_evt: MouseEvent, edge: Edge) => {
      if (edge.id.startsWith("optimistic-")) {
        return;
      }
      const dep = dependencies.find((d) => d.id === edge.id);
      if (!dep) {
        return;
      }
      setNotesDialog({
        mode: "edit",
        dependencyId: dep.id,
        upstreamId: dep.upstreamEquipmentId,
        downstreamId: dep.downstreamEquipmentId,
        notes: dep.notes ?? "",
      });
    },
    [dependencies]
  );

  const equipmentLabel = useCallback(
    (id: string) => {
      return formatEquipmentLabel(equipmentById, id);
    },
    [equipmentById]
  );

  const canSubmit =
    !!selectedVesselId &&
    !!upstreamId &&
    !!downstreamId &&
    upstreamId !== downstreamId &&
    !createMutation.isPending;

  const handleImportCsv = () => {
    const parsed = parseCsv(csvText);
    if (parsed.errors.length > 0) {
      toast({
        title: "CSV has errors",
        description: parsed.errors.slice(0, 5).join("; "),
        variant: "destructive",
      });
      return;
    }
    if (parsed.rows.length === 0) {
      toast({
        title: "Nothing to import",
        description: "Paste at least one row.",
        variant: "destructive",
      });
      return;
    }
    importMutation.mutate(parsed.rows);
  };

  const handleSkipCreate = (dialog: Exclude<NotesDialogState, null> & { mode: "create" }) => {
    graphCreateMutation.mutate({
      upstreamEquipmentId: dialog.upstreamId,
      downstreamEquipmentId: dialog.downstreamId,
    });
    setNotesDialog(null);
  };

  const handleSaveNotes = (dialog: Exclude<NotesDialogState, null>) => {
    const trimmed = dialog.notes.trim();
    const notesValue = trimmed.length === 0 ? null : trimmed;
    if (dialog.mode === "edit") {
      graphPatchMutation.mutate({ id: dialog.dependencyId, notes: notesValue });
      setNotesDialog(null);
      return;
    }
    graphCreateMutation.mutate(
      {
        upstreamEquipmentId: dialog.upstreamId,
        downstreamEquipmentId: dialog.downstreamId,
      },
      {
        onSuccess: (res) => {
          if (notesValue && res?.dependency?.id) {
            graphPatchMutation.mutate({ id: res.dependency.id, notes: notesValue });
          }
        },
      }
    );
    setNotesDialog(null);
  };

  return {
    selectedVesselId,
    setSelectedVesselId,
    vesselsQuery,
    vessels,
    isForbidden,
    equipmentList,
    equipmentStatus: {
      isLoading: equipmentQuery.isLoading,
      isError: equipmentQuery.isError,
      error: equipmentQuery.error,
    },
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onEdgeClick,
    layoutStatus: {
      isLoading: layoutQuery.isLoading,
      isSaving: saveLayoutMutation.isPending,
    },
    bulk: {
      upstreamId,
      downstreamId,
      notes,
      csvText,
      canSubmit,
      isCreating: createMutation.isPending,
      isImporting: importMutation.isPending,
      isDeleting: deleteMutation.isPending,
      dependencies,
      depsStatus: {
        isLoading: depsQuery.isLoading,
        isError: depsQuery.isError,
        error: depsQuery.error,
      },
      setUpstreamId,
      setDownstreamId,
      setNotes,
      setCsvText,
      equipmentLabel,
      onAddDependency: () => createMutation.mutate(),
      onImportCsv: handleImportCsv,
      onDeleteDependency: (id: string) => deleteMutation.mutate(id),
    },
    notes: {
      notesDialog,
      setNotesDialog,
      dependencies,
      equipmentLabel,
      isSaving: graphPatchMutation.isPending,
      isCreating: graphCreateMutation.isPending,
      onSkipCreate: handleSkipCreate,
      onSaveNotes: handleSaveNotes,
    },
  };
}
