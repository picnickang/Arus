import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  priorityLabel,
  useCreateCrewTask,
  useUpdateCrewTask,
  type CrewTaskView,
  type UpdateCrewTaskInput,
} from "@/features/crew";
import { CREW_TASK_PRIORITIES, type CrewTaskPriority } from "@shared/schema";
import { Field, Overlay } from "./dialogChrome";
import {
  certificateLabel,
  documentLabel,
  inputClass,
  sourceKey,
} from "./taskPresentation";
import type { CertificateItem, CrewDocumentItem, CrewOption, VesselOption } from "./types";

/**
 * Create or edit a task. When `task` is provided the dialog prefills and
 * PATCHes; otherwise it POSTs a new task. Linked source is picked from the
 * assigned crew member's documents (the snapshot label is stored).
 */
export function TaskFormDialog({
  task,
  crew,
  vessels,
  onClose,
  onSaved,
}: {
  task?: CrewTaskView;
  crew: CrewOption[];
  vessels: VesselOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const createTask = useCreateCrewTask();
  const updateTask = useUpdateCrewTask();
  const isEdit = Boolean(task);

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<CrewTaskPriority>(task?.priority ?? "medium");
  const [assignedCrewId, setAssignedCrewId] = useState(task?.assignedCrewId ?? "");
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo ?? "");
  const [vesselId, setVesselId] = useState(task?.vesselId ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : "");
  // Composite key "type:id" so one picker can offer both crew documents and
  // vessel certificates. Empty string = no link.
  const initialSourceKey =
    task?.linkedSourceType && task?.linkedSourceId
      ? sourceKey(task.linkedSourceType, task.linkedSourceId)
      : "";
  const [linkedKey, setLinkedKey] = useState(initialSourceKey);

  // Load the chosen crew member's documents and the chosen vessel's
  // certificates so we can offer either as a linkable source (snapshotting
  // the label at save time).
  const { data: documents = [] } = useQuery<CrewDocumentItem[]>({
    queryKey: ["/api/crew", assignedCrewId, "documents"],
    queryFn: () => apiRequest<CrewDocumentItem[]>(`/api/crew/${assignedCrewId}/documents`),
    enabled: Boolean(assignedCrewId),
  });
  const { data: certificates = [] } = useQuery<CertificateItem[]>({
    queryKey: ["/api/certificates", { vesselId }],
    queryFn: () => apiRequest<CertificateItem[]>(`/api/certificates?vesselId=${vesselId}`),
    enabled: Boolean(vesselId),
  });

  const isPending = createTask.isPending || updateTask.isPending;

  /**
   * Resolve the picker's composite key into the three stored link fields.
   * Returns `null` when the key can't be resolved to a loaded item (e.g. it
   * points at an item not in the currently fetched lists) so callers can
   * choose to leave the existing link untouched rather than corrupt it.
   */
  const resolveLink = (
    key: string
  ): Pick<
    UpdateCrewTaskInput,
    "linkedSourceType" | "linkedSourceId" | "linkedSourceLabel"
  > | null => {
    if (!key) {
      return {
        linkedSourceType: null,
        linkedSourceId: null,
        linkedSourceLabel: null,
      };
    }
    const [type, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
    if (type === "crew_document") {
      const doc = documents.find((d) => d.id === id);
      return doc
        ? {
            linkedSourceType: "crew_document",
            linkedSourceId: doc.id,
            linkedSourceLabel: documentLabel(doc),
          }
        : null;
    }
    if (type === "certificate") {
      const cert = certificates.find((c) => c.id === id);
      return cert
        ? {
            linkedSourceType: "certificate",
            linkedSourceId: cert.id,
            linkedSourceLabel: certificateLabel(cert),
          }
        : null;
    }
    return null;
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      return;
    }

    const onError = () =>
      toast({
        title: isEdit ? "Could not update task" : "Could not create task",
        variant: "destructive",
      });

    if (isEdit && task) {
      // Only touch linked-source fields when the user actually changed the
      // picker — otherwise an unrelated edit (or a link this picker can't
      // represent right now, e.g. its vessel/crew isn't loaded) would be
      // silently cleared.
      const linkChanged = linkedKey !== initialSourceKey;
      const resolved = linkChanged ? resolveLink(linkedKey) : null;
      const linkPatch = resolved ?? {};
      updateTask.mutate(
        {
          id: task.id,
          patch: {
            title: title.trim(),
            description: description.trim() || null,
            priority,
            assignedCrewId: assignedCrewId || null,
            assignedTo: assignedTo.trim() || null,
            vesselId: vesselId || null,
            dueDate: dueDate ? new Date(dueDate).toISOString() : null,
            ...linkPatch,
          },
        },
        { onSuccess: onSaved, onError }
      );
      return;
    }

    const resolved = resolveLink(linkedKey);
    const linkFields = resolved?.linkedSourceId
      ? {
          linkedSourceType: resolved.linkedSourceType ?? undefined,
          linkedSourceId: resolved.linkedSourceId,
          linkedSourceLabel: resolved.linkedSourceLabel ?? undefined,
        }
      : {};
    createTask.mutate(
      {
        title: title.trim(),
        priority,
        ...(description.trim() && { description: description.trim() }),
        ...(assignedCrewId && { assignedCrewId }),
        ...(assignedTo.trim() && { assignedTo: assignedTo.trim() }),
        ...(vesselId && { vesselId }),
        ...(dueDate && { dueDate: new Date(dueDate).toISOString() }),
        ...linkFields,
      },
      { onSuccess: onSaved, onError }
    );
  };

  return (
    <Overlay
      onClose={onClose}
      title={isEdit ? "Edit task" : "Create task"}
      testId={isEdit ? "dialog-edit-task" : "dialog-create-task"}
    >
      <form onSubmit={submit} className="space-y-3">
        <Field label="Title">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="e.g. Renew passport before expiry"
            data-testid="input-task-title"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={inputClass}
            placeholder="Optional details"
            data-testid="input-task-description"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as CrewTaskPriority)}
              className={inputClass}
              data-testid="select-task-priority"
            >
              {CREW_TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {priorityLabel(p)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
              data-testid="input-task-due"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Crew member">
            <select
              value={assignedCrewId}
              onChange={(e) => {
                setAssignedCrewId(e.target.value);
                // A document link belongs to the previous crew member — drop it.
                if (linkedKey.startsWith("crew_document:")) {
                  setLinkedKey("");
                }
              }}
              className={inputClass}
              data-testid="select-task-assignee"
            >
              <option value="">Unassigned</option>
              {crew.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Assigned-to owner">
            <input
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className={inputClass}
              placeholder="e.g. Crewing Admin"
              data-testid="input-task-owner"
            />
          </Field>
        </div>
        <Field label="Vessel">
          <select
            value={vesselId}
            onChange={(e) => {
              setVesselId(e.target.value);
              // A certificate link belongs to the previous vessel — drop it.
              if (linkedKey.startsWith("certificate:")) {
                setLinkedKey("");
              }
            }}
            className={inputClass}
            data-testid="select-task-vessel"
          >
            <option value="">None</option>
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Linked source (crew document or vessel certificate)">
          <select
            value={linkedKey}
            onChange={(e) => setLinkedKey(e.target.value)}
            disabled={!assignedCrewId && !vesselId}
            className={inputClass}
            data-testid="select-task-linked-source"
          >
            <option value="">
              {assignedCrewId || vesselId ? "None" : "Pick a crew member or vessel first"}
            </option>
            {documents.length > 0 && (
              <optgroup label="Crew documents">
                {documents.map((d) => (
                  <option key={d.id} value={sourceKey("crew_document", d.id)}>
                    {documentLabel(d)}
                  </option>
                ))}
              </optgroup>
            )}
            {certificates.length > 0 && (
              <optgroup label="Vessel certificates">
                {certificates.map((c) => (
                  <option key={c.id} value={sourceKey("certificate", c.id)}>
                    {certificateLabel(c)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-300 hover:text-white"
            data-testid="button-cancel-create"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || isPending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500/90 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
            data-testid="button-submit-create"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create task"}
          </button>
        </div>
      </form>
    </Overlay>
  );
}
