# ARUS Frontend — Part 4: Maintenance (Schedules, Work Orders, PdM)
Generated: 2026-03-26T02:38:14Z

### `client/src/pages/maintenance-schedules.tsx` (92 lines)

```tsx
import { useState } from "react";
import { Plus, Calendar, List, Eye, Edit, Trash2, Clock, Zap, Search, X, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ResponsiveTable } from "@/components/shared/ResponsiveTable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isPast } from "date-fns";
import { MaintenanceSchedule } from "@shared/schema";
import { getPriorityColor, useMaintenanceSchedulesData } from "@/features/maintenance";
import { PermissionGate } from "@/components/PermissionGate";
import { usePermissions } from "@/contexts/PermissionsContext";

interface CalendarViewProps { schedules: MaintenanceSchedule[]; onScheduleClick: (schedule: MaintenanceSchedule) => void; getEquipmentName: (id: string) => string; }

function CalendarView({ schedules, onScheduleClick, getEquipmentName }: CalendarViewProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const getSchedulesForDay = (day: Date) => schedules.filter((schedule) => isSameDay(new Date(schedule.scheduledDate), day));

  return (
    <Card><CardHeader><div className="flex items-center justify-between"><div><CardTitle className="text-xl">Weekly Schedule</CardTitle><CardDescription className="mt-1">{format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}</CardDescription></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setCurrentWeek(addDays(currentWeek, -7))} data-testid="button-prev-week">Previous</Button><Button variant="outline" size="sm" onClick={() => setCurrentWeek(new Date())} data-testid="button-current-week">Today</Button><Button variant="outline" size="sm" onClick={() => setCurrentWeek(addDays(currentWeek, 7))} data-testid="button-next-week">Next</Button></div></div></CardHeader><CardContent>
      <div className="grid grid-cols-7 gap-1">{weekDays.map((day) => { const isToday = isSameDay(day, new Date()); const daySchedules = getSchedulesForDay(day); return (
        <div key={format(day, "yyyy-MM-dd")} className={`rounded-lg border ${isToday ? "border-primary/50 bg-primary/5" : "border-border"} overflow-hidden`}><div className={`p-2 text-center border-b ${isToday ? "bg-primary/10 border-primary/30" : "bg-muted/30"}`}><div className="text-xs font-medium text-muted-foreground">{format(day, "EEE")}</div><div className={`text-lg font-bold ${isToday ? "text-primary" : ""}`}>{format(day, "d")}</div></div><div className="p-1 space-y-1 min-h-[120px]">{daySchedules.map((schedule) => <button key={schedule.id} onClick={() => onScheduleClick(schedule)} className={`w-full p-1.5 rounded border text-left text-xs hover:opacity-80 transition-opacity ${getPriorityColor(schedule.priority)}`} data-testid={`schedule-item-${schedule.id}`}><div className="font-medium truncate">{getEquipmentName(schedule.equipmentId)}</div><div className="text-xs opacity-75 mt-0.5">{format(new Date(schedule.scheduledDate), "h:mm a")}</div></button>)}</div></div>
      );})}</div>
    </CardContent></Card>
  );
}

export default function MaintenanceSchedules() {
  const m = useMaintenanceSchedulesData();

  if (m.isLoading) {return <div className="p-6 space-y-6"><div className="h-8 bg-muted animate-pulse rounded w-64"></div><div className="h-48 bg-muted animate-pulse rounded"></div><div className="h-96 bg-muted animate-pulse rounded"></div></div>;}

  if (m.error) {return <div className="p-6"><Card className="border-destructive/50"><CardContent className="pt-6"><div className="flex items-center gap-3 text-destructive mb-4"><AlertCircle className="h-5 w-5" /><div className="font-medium">Failed to load maintenance schedules</div></div><p className="text-sm text-muted-foreground mb-4">{(m.error instanceof Error ? m.error.message : "Unknown error")}</p><Button variant="outline" onClick={() => globalThis.location.reload()} data-testid="button-retry-maintenance">Try Again</Button></CardContent></Card></div>;}

  return (
    <div className="min-h-screen">
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">
          <PermissionGate resource="maintenance_schedules" action="create">
            <Button onClick={() => m.setCreateModalOpen(true)} size="lg" data-testid="button-create-schedule"><Plus className="w-4 h-4 mr-2" />Schedule Maintenance</Button>
          </PermissionGate>
        </div>
        <div className="flex flex-wrap items-center gap-4 md:gap-6 px-4 py-3 bg-muted/30 dark:bg-muted/20 rounded-lg border border-border/50">
          <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Total:</span><span className="text-sm font-bold" data-testid="stat-total">{m.schedules?.length || 0}</span></div>
          <div className="hidden md:block h-4 w-px bg-border" /><div className="flex items-center gap-2"><Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" /><span className="text-sm text-muted-foreground">Upcoming:</span><span className="text-sm font-bold text-blue-700 dark:text-blue-300" data-testid="stat-upcoming">{m.upcomingSchedules?.length || 0}</span></div>
          <div className="hidden md:block h-4 w-px bg-border" /><div className="flex items-center gap-2"><Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" /><span className="text-sm text-muted-foreground">In Progress:</span><span className="text-sm font-bold text-amber-700 dark:text-amber-300" data-testid="stat-in-progress">{m.schedules?.filter((s) => s.status === "in_progress").length || 0}</span></div>
          <div className="hidden md:block h-4 w-px bg-border" /><div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-600 dark:text-green-400" /><span className="text-sm text-muted-foreground">Completed:</span><span className="text-sm font-bold text-green-700 dark:text-green-300" data-testid="stat-completed">{m.schedules?.filter((s) => s.status === "completed").length || 0}</span></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search equipment or description..." value={m.searchText} onChange={(e) => m.setSearchText(e.target.value)} className="pl-10" data-testid="input-search-schedules" />{m.searchText && <Button variant="ghost" size="sm" onClick={() => m.setSearchText("")} className="absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2 p-0" aria-label="Clear search" data-testid="button-clear-search"><X className="h-4 w-4" /></Button>}</div></div>
          <div><Select value={m.statusFilter} onValueChange={m.setStatusFilter}><SelectTrigger data-testid="select-status-filter"><SelectValue placeholder="All Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="scheduled">Scheduled</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select></div>
          <div><Select value={m.priorityFilter} onValueChange={m.setPriorityFilter}><SelectTrigger data-testid="select-priority-filter"><SelectValue placeholder="All Priorities" /></SelectTrigger><SelectContent><SelectItem value="all">All Priorities</SelectItem><SelectItem value="1">High Priority</SelectItem><SelectItem value="2">Medium Priority</SelectItem><SelectItem value="3">Low Priority</SelectItem></SelectContent></Select></div>
        </div>
      </div>

      <Tabs value={m.viewType} onValueChange={(v) => m.setViewType(v as "calendar" | "list")}>
        <TabsList className="grid w-full max-w-md grid-cols-2"><TabsTrigger value="calendar" data-testid="tab-calendar"><Calendar className="w-4 h-4 mr-2" />Calendar View</TabsTrigger><TabsTrigger value="list" data-testid="tab-list"><List className="w-4 h-4 mr-2" />List View</TabsTrigger></TabsList>
        <TabsContent value="calendar" className="mt-6"><CalendarView schedules={m.filteredSchedules} onScheduleClick={m.handleViewSchedule} getEquipmentName={m.getEquipmentName} /></TabsContent>
        <TabsContent value="list" className="mt-6">
          <Card><CardHeader><CardTitle>Schedule List</CardTitle><CardDescription>{m.filteredSchedules.length} schedules found</CardDescription></CardHeader><CardContent className="p-0">
            <ResponsiveTable data={m.filteredSchedules} keyExtractor={(schedule) => schedule.id}
              columns={[
                { header: "Equipment", accessor: (schedule: MaintenanceSchedule) => <div className="flex items-center gap-2"><span className="font-medium">{m.getEquipmentName(schedule.equipmentId)}</span>{schedule.autoGenerated && <Badge variant="outline" className="text-xs"><Zap className="w-3 h-3 mr-1" />Auto</Badge>}</div> },
                { header: "Date & Time", accessor: (schedule: MaintenanceSchedule) => { const isOverdue = isPast(new Date(schedule.scheduledDate)) && schedule.status !== "completed"; return <div><div className="flex items-center gap-2"><div className="font-medium" data-testid={`text-scheduled-date-${schedule.id}`}>{format(new Date(schedule.scheduledDate), "MMM d, yyyy")}</div>{isOverdue && <Badge variant="destructive" className="text-xs" data-testid={`badge-overdue-${schedule.id}`}>OVERDUE</Badge>}</div><div className="text-sm text-muted-foreground">{format(new Date(schedule.scheduledDate), "h:mm a")}</div></div>; } },
                { header: "Type", accessor: (schedule: MaintenanceSchedule) => <Badge variant="outline" className="capitalize">{schedule.maintenanceType}</Badge> },
                { header: "Priority", accessor: (schedule: MaintenanceSchedule) => { const p = m.getPriorityBadge(schedule.priority); return <Badge className={p.className}>{p.label}</Badge>; } },
                { header: "Status", accessor: (schedule: MaintenanceSchedule) => { const s = m.getStatusBadge(schedule.status); return <Badge className={s.className}>{s.label}</Badge>; } },
              ]}
              actions={(schedule) => <div className="flex items-center gap-1"><Button variant="ghost" size="sm" onClick={() => m.handleViewSchedule(schedule)} data-testid={`button-view-schedule-${schedule.id}`}><Eye className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => m.handleEditSchedule(schedule)} data-testid={`button-edit-schedule-${schedule.id}`}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => m.handleDeleteSchedule(schedule)} className="text-destructive hover:text-destructive" data-testid={`button-delete-schedule-${schedule.id}`}><Trash2 className="h-4 w-4" /></Button></div>}
              emptyMessage="No maintenance schedules found. Create one to get started."
            />
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={m.viewModalOpen} onOpenChange={m.setViewModalOpen}><DialogContent className="max-w-2xl" data-testid="schedule-detail-modal"><DialogHeader><DialogTitle>Maintenance Schedule Details</DialogTitle><DialogDescription>{m.selectedSchedule && m.getEquipmentName(m.selectedSchedule.equipmentId)}</DialogDescription></DialogHeader>{m.selectedSchedule && <div className="space-y-6"><div className="grid grid-cols-2 gap-6"><div><Label className="text-sm font-medium text-muted-foreground">Equipment</Label><p className="text-base font-medium mt-1">{m.getEquipmentName(m.selectedSchedule.equipmentId)}</p></div><div><Label className="text-sm font-medium text-muted-foreground">Type</Label><p className="text-base capitalize mt-1">{m.selectedSchedule.maintenanceType}</p></div><div><Label className="text-sm font-medium text-muted-foreground">Scheduled Date</Label><p className="text-base font-medium mt-1">{format(new Date(m.selectedSchedule.scheduledDate), "MMM d, yyyy h:mm a")}</p></div><div><Label className="text-sm font-medium text-muted-foreground">Status</Label><div className="mt-1"><Badge className={m.getStatusBadge(m.selectedSchedule.status).className}>{m.getStatusBadge(m.selectedSchedule.status).label}</Badge></div></div><div><Label className="text-sm font-medium text-muted-foreground">Priority</Label><div className="mt-1"><Badge className={m.getPriorityBadge(m.selectedSchedule.priority).className}>{m.getPriorityBadge(m.selectedSchedule.priority).label}</Badge></div></div>{m.selectedSchedule.assignedTo && <div><Label className="text-sm font-medium text-muted-foreground">Assigned To</Label><p className="text-base mt-1">{m.selectedSchedule.assignedTo}</p></div>}</div>{m.selectedSchedule.description && <div><Label className="text-sm font-medium text-muted-foreground">Description</Label><p className="text-base mt-2 p-3 bg-muted/50 rounded-lg">{m.selectedSchedule.description}</p></div>}{m.selectedSchedule.autoGenerated && <div className="flex items-center gap-2 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30"><Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" /><span className="text-sm text-blue-700 dark:text-blue-300">Automatically scheduled based on predictive analytics</span></div>}</div>}<DialogFooter><Button variant="outline" onClick={() => m.setViewModalOpen(false)}>Close</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={m.createModalOpen} onOpenChange={m.setCreateModalOpen}><DialogContent className="max-w-2xl" data-testid="create-schedule-modal"><DialogHeader><DialogTitle>Schedule New Maintenance</DialogTitle><DialogDescription>Create a new maintenance schedule for equipment</DialogDescription></DialogHeader><div className="space-y-4"><div><Label htmlFor="create-equipment">Equipment *</Label><Select value={m.createForm.equipmentId || ""} onValueChange={(value) => m.setCreateForm((prev) => ({ ...prev, equipmentId: value }))}><SelectTrigger data-testid="select-create-equipment"><SelectValue placeholder="Select equipment" /></SelectTrigger><SelectContent>{m.equipment?.map((eq) => <SelectItem key={eq.id} value={eq.id}>{eq.name || eq.id}</SelectItem>)}</SelectContent></Select></div><div className="grid grid-cols-2 gap-4"><div><Label htmlFor="create-date">Scheduled Date & Time *</Label><Input id="create-date" type="datetime-local" value={m.createForm.scheduledDate ? (typeof m.createForm.scheduledDate === "string" ? m.createForm.scheduledDate : new Date(m.createForm.scheduledDate).toISOString().slice(0, 16)) : ""} onChange={(e) => m.setCreateForm((prev) => ({ ...prev, scheduledDate: e.target.value }))} data-testid="input-create-schedule-date" /></div><div><Label htmlFor="create-type">Maintenance Type *</Label><Select value={m.createForm.maintenanceType || "preventive"} onValueChange={(value) => m.setCreateForm((prev) => ({ ...prev, maintenanceType: value }))}><SelectTrigger data-testid="select-create-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="preventive">Preventive</SelectItem><SelectItem value="corrective">Corrective</SelectItem><SelectItem value="predictive">Predictive</SelectItem></SelectContent></Select></div></div><div className="grid grid-cols-2 gap-4"><div><Label htmlFor="create-priority">Priority *</Label><Select value={m.createForm.priority?.toString() || "2"} onValueChange={(value) => m.setCreateForm((prev) => ({ ...prev, priority: Number.parseInt(value) }))}><SelectTrigger data-testid="select-create-priority"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">High Priority</SelectItem><SelectItem value="2">Medium Priority</SelectItem><SelectItem value="3">Low Priority</SelectItem></SelectContent></Select></div><div><Label htmlFor="create-assigned">Assigned To</Label><Input id="create-assigned" placeholder="Technician name..." value={m.createForm.assignedTo || ""} onChange={(e) => m.setCreateForm((prev) => ({ ...prev, assignedTo: e.target.value }))} data-testid="input-create-assigned" /></div></div><div><Label htmlFor="create-description">Description</Label><Textarea id="create-description" placeholder="Details about this maintenance..." value={m.createForm.description || ""} onChange={(e) => m.setCreateForm((prev) => ({ ...prev, description: e.target.value }))} rows={3} data-testid="textarea-create-description" /></div></div><DialogFooter><Button variant="outline" onClick={() => m.setCreateModalOpen(false)}>Cancel</Button><Button onClick={m.handleCreateSubmit} disabled={m.createMutation.isPending} data-testid="button-submit-create-schedule">{m.createMutation.isPending ? "Creating..." : "Create Schedule"}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={m.editModalOpen} onOpenChange={m.setEditModalOpen}><DialogContent className="max-w-2xl" data-testid="edit-schedule-modal"><DialogHeader><DialogTitle>Edit Maintenance Schedule</DialogTitle><DialogDescription>Update schedule for {m.selectedSchedule && m.getEquipmentName(m.selectedSchedule.equipmentId)}</DialogDescription></DialogHeader><div className="space-y-4"><div><Label htmlFor="edit-equipment">Equipment *</Label><Select value={m.editForm.equipmentId || ""} onValueChange={(value) => m.setEditForm((prev) => ({ ...prev, equipmentId: value }))}><SelectTrigger data-testid="select-edit-equipment"><SelectValue placeholder="Select equipment" /></SelectTrigger><SelectContent>{m.equipment?.map((eq) => <SelectItem key={eq.id} value={eq.id}>{eq.name || eq.id}</SelectItem>)}</SelectContent></Select></div><div className="grid grid-cols-2 gap-4"><div><Label htmlFor="edit-date">Scheduled Date & Time *</Label><Input id="edit-date" type="datetime-local" value={m.editForm.scheduledDate ? (typeof m.editForm.scheduledDate === "string" ? m.editForm.scheduledDate : new Date(m.editForm.scheduledDate).toISOString().slice(0, 16)) : ""} onChange={(e) => m.setEditForm((prev) => ({ ...prev, scheduledDate: e.target.value }))} data-testid="input-edit-schedule-date" /></div><div><Label htmlFor="edit-type">Maintenance Type *</Label><Select value={m.editForm.maintenanceType || "preventive"} onValueChange={(value) => m.setEditForm((prev) => ({ ...prev, maintenanceType: value }))}><SelectTrigger data-testid="select-edit-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="preventive">Preventive</SelectItem><SelectItem value="corrective">Corrective</SelectItem><SelectItem value="predictive">Predictive</SelectItem></SelectContent></Select></div></div><div className="grid grid-cols-2 gap-4"><div><Label htmlFor="edit-priority">Priority *</Label><Select value={m.editForm.priority?.toString() || "2"} onValueChange={(value) => m.setEditForm((prev) => ({ ...prev, priority: Number.parseInt(value) }))}><SelectTrigger data-testid="select-edit-priority"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">High Priority</SelectItem><SelectItem value="2">Medium Priority</SelectItem><SelectItem value="3">Low Priority</SelectItem></SelectContent></Select></div><div><Label htmlFor="edit-status">Status *</Label><Select value={m.editForm.status || "scheduled"} onValueChange={(value) => m.setEditForm((prev) => ({ ...prev, status: value }))}><SelectTrigger data-testid="select-edit-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="scheduled">Scheduled</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select></div></div><div><Label htmlFor="edit-assigned">Assigned To</Label><Input id="edit-assigned" placeholder="Technician name..." value={m.editForm.assignedTo || ""} onChange={(e) => m.setEditForm((prev) => ({ ...prev, assignedTo: e.target.value }))} data-testid="input-edit-assigned" /></div><div><Label htmlFor="edit-description">Description</Label><Textarea id="edit-description" placeholder="Details about this maintenance..." value={m.editForm.description || ""} onChange={(e) => m.setEditForm((prev) => ({ ...prev, description: e.target.value }))} rows={3} data-testid="textarea-edit-description" /></div></div><DialogFooter><Button variant="outline" onClick={() => m.setEditModalOpen(false)}>Cancel</Button><Button onClick={m.handleEditSubmit} disabled={m.updateMutation.isPending} data-testid="button-submit-edit-schedule">{m.updateMutation.isPending ? "Updating..." : "Update Schedule"}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

```

### `client/src/pages/MaintenanceTemplatesPage.tsx` (188 lines)

```tsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Copy, FileText, CheckSquare, Clock } from "lucide-react";
import { useMaintenanceTemplatesData, getPriorityBadgeConfig, EQUIPMENT_TYPES, FREQUENCY_OPTIONS, PRIORITY_OPTIONS_TEMPLATE } from "@/features/maintenance";

export default function MaintenanceTemplatesPage() {
  const { selectedType, setSelectedType, selectedTemplate, isCreateDialogOpen, isEditDialogOpen, isViewDialogOpen, setIsViewDialogOpen, deleteTemplateId, setDeleteTemplateId, checklistItems, editingItemIndex, filteredTemplates, templateItems, isLoading, templateForm, itemForm, createTemplateMutation, updateTemplateMutation, deleteTemplateMutation, cloneTemplateMutation, onTemplateSubmit, handleEdit, handleView, handleDelete, handleClone, addChecklistItem, editChecklistItem, removeChecklistItem, openCreateDialog, openCreateForType, closeDialog, confirmDelete } = useMaintenanceTemplatesData();

  if (isLoading) {return <div className="container mx-auto py-6 space-y-6"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;}

  return (
    <div className="min-h-screen" data-testid="maintenance-templates-page">
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-end items-center">
          <Button onClick={openCreateDialog} data-testid="button-create-template"><Plus className="h-4 w-4 mr-2" />Create Template</Button>
        </div>

      <Tabs value={selectedType} onValueChange={setSelectedType} data-testid="equipment-type-tabs">
        <div className="overflow-x-auto pb-2">
          <TabsList className="inline-flex w-full min-w-fit p-1 gap-1">
            {EQUIPMENT_TYPES.map((type) => <TabsTrigger key={type.value} value={type.value} data-testid={`tab-${type.value}`} className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[80px] sm:min-w-[100px] transition-all"><span>{type.label}</span></TabsTrigger>)}
          </TabsList>
        </div>
        {EQUIPMENT_TYPES.map((type) => (
          <TabsContent key={type.value} value={type.value} className="space-y-4">
            {filteredTemplates.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTemplates.map((template) => <TemplateCard key={template.id} template={template} onView={handleView} onEdit={handleEdit} onClone={handleClone} onDelete={handleDelete} cloneIsPending={cloneTemplateMutation.isPending} />)}
              </div>
            ) : (
              <Card><CardContent className="flex flex-col items-center justify-center py-12"><FileText className="h-12 w-12 text-muted-foreground mb-4" /><h3 className="text-lg font-semibold mb-2" data-testid={`no-templates-${type.value}`}>No templates for {type.label}</h3><p className="text-muted-foreground text-sm mb-4">Create your first maintenance template for this equipment type</p><Button onClick={() => openCreateForType(type.value)} data-testid={`button-create-first-${type.value}`}><Plus className="h-4 w-4 mr-2" />Create Template</Button></CardContent></Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={isCreateDialogOpen || isEditDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle data-testid="dialog-title">{isEditDialogOpen ? "Edit Template" : "Create Template"}</DialogTitle><DialogDescription>{isEditDialogOpen ? "Update the template details below" : "Create a new maintenance template with checklist items"}</DialogDescription></DialogHeader>
          <Form {...templateForm}>
            <form onSubmit={templateForm.handleSubmit(onTemplateSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={templateForm.control} name="equipmentType" render={({ field }) => (<FormItem><FormLabel>Equipment Type *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger data-testid="select-equipment-type"><SelectValue /></SelectTrigger></FormControl><SelectContent>{EQUIPMENT_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={templateForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Template Name *</FormLabel><FormControl><Input placeholder="Annual engine inspection" {...field} data-testid="input-name" /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={templateForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Comprehensive inspection of main engine..." {...field} data-testid="textarea-description" /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-3 gap-4">
                <FormField control={templateForm.control} name="frequency" render={({ field }) => (<FormItem><FormLabel>Frequency *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger data-testid="select-frequency"><SelectValue /></SelectTrigger></FormControl><SelectContent>{FREQUENCY_OPTIONS.map((freq) => <SelectItem key={freq.value} value={freq.value}>{freq.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={templateForm.control} name="estimatedDuration" render={({ field }) => (<FormItem><FormLabel>Duration (minutes) *</FormLabel><FormControl><Input type="number" {...field} data-testid="input-duration" /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={templateForm.control} name="priority" render={({ field }) => (<FormItem><FormLabel>Priority *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger data-testid="select-priority"><SelectValue /></SelectTrigger></FormControl><SelectContent>{PRIORITY_OPTIONS_TEMPLATE.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              </div>
              {!isEditDialogOpen && <ChecklistSection checklistItems={checklistItems} editingItemIndex={editingItemIndex} itemForm={itemForm} onAdd={addChecklistItem} onEdit={editChecklistItem} onRemove={removeChecklistItem} />}
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={closeDialog} data-testid="button-cancel">Cancel</Button>
                <Button type="submit" disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending} data-testid="button-submit">{createTemplateMutation.isPending || updateTemplateMutation.isPending ? "Saving..." : isEditDialogOpen ? "Update Template" : "Create Template"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle data-testid="view-dialog-title">{selectedTemplate?.name}</DialogTitle><DialogDescription>{selectedTemplate?.description || "No description"}</DialogDescription></DialogHeader>
          {selectedTemplate && <ViewTemplateContent template={selectedTemplate} items={templateItems} onClose={() => setIsViewDialogOpen(false)} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTemplateId} onOpenChange={(open) => !open && setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle data-testid="delete-dialog-title">Delete Template</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this maintenance template? This will also delete all associated checklist items. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteTemplateMutation.isPending} data-testid="button-confirm-delete">{deleteTemplateMutation.isPending ? "Deleting..." : "Delete"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}

interface MaintenanceTemplate { id: string; name: string; description?: string | null; priority: string; frequency: string; estimatedDuration: number; equipmentType: string; }
interface ChecklistItemData { stepNumber: number; description: string; required?: boolean; estimatedMinutes?: number; }
function TemplateCard({ template, onView, onEdit, onClone, onDelete, cloneIsPending }: { template: MaintenanceTemplate; onView: (t: MaintenanceTemplate) => void; onEdit: (t: MaintenanceTemplate) => void; onClone: (id: string) => void; onDelete: (id: string) => void; cloneIsPending: boolean }) {
  const config = getPriorityBadgeConfig(template.priority);
  return (
    <Card data-testid={`template-card-${template.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1"><CardTitle className="text-lg" data-testid={`template-name-${template.id}`}>{template.name}</CardTitle><CardDescription className="mt-2" data-testid={`template-desc-${template.id}`}>{template.description || "No description"}</CardDescription></div>
          <Badge variant={config.variant} className={config.className}>{config.label}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Frequency:</span><span className="font-medium" data-testid={`template-freq-${template.id}`}>{template.frequency}</span></div>
          <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Duration:</span><span className="font-medium" data-testid={`template-duration-${template.id}`}>{template.estimatedDuration} min</span></div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <Button size="sm" variant="outline" onClick={() => onView(template)} data-testid={`button-view-${template.id}`}><FileText className="h-3 w-3 mr-1" />View</Button>
          <Button size="sm" variant="outline" onClick={() => onEdit(template)} data-testid={`button-edit-${template.id}`}><Pencil className="h-3 w-3 mr-1" />Edit</Button>
          <Button size="sm" variant="outline" onClick={() => onClone(template.id)} disabled={cloneIsPending} data-testid={`button-clone-${template.id}`}><Copy className="h-3 w-3 mr-1" />Clone</Button>
          <Button size="sm" variant="destructive" onClick={() => onDelete(template.id)} data-testid={`button-delete-${template.id}`}><Trash2 className="h-3 w-3" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ChecklistSection({ checklistItems, editingItemIndex, itemForm, onAdd, onEdit, onRemove }: { checklistItems: ChecklistItemData[]; editingItemIndex: number | null; itemForm: ReturnType<typeof import("react-hook-form").useForm>; onAdd: (data: ChecklistItemData) => void; onEdit: (index: number) => void; onRemove: (index: number) => void }) {
  return (
    <div className="border-t pt-4 space-y-4">
      <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Checklist Items</h3><Badge variant="secondary" data-testid="badge-item-count">{checklistItems.length} items</Badge></div>
      {checklistItems.length > 0 && (
        <div className="space-y-2">
          {checklistItems.map((item, index) => (
            <div key={`item-${item.stepNumber}-${item.description.slice(0, 20)}`} className="flex items-start justify-between p-3 border rounded" data-testid={`checklist-item-${index}`}>
              <div className="flex-1">
                <div className="flex items-center gap-2"><Badge variant="outline" data-testid={`item-step-${index}`}>Step {item.stepNumber}</Badge>{item.required && <Badge variant="destructive" data-testid={`item-required-${index}`}>Required</Badge>}</div>
                <p className="text-sm mt-2" data-testid={`item-description-${index}`}>{item.description}</p>
                {item.estimatedMinutes && <p className="text-xs text-muted-foreground mt-1" data-testid={`item-minutes-${index}`}>Est. {item.estimatedMinutes} minutes</p>}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(index)} data-testid={`button-edit-item-${index}`}><Pencil className="h-3 w-3" /></Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(index)} data-testid={`button-remove-item-${index}`}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="border rounded-lg p-4 space-y-4">
        <h4 className="font-medium">Add Checklist Item</h4>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={itemForm.control} name="stepNumber" render={({ field }) => (<FormItem><FormLabel>Step Number</FormLabel><FormControl><Input type="number" {...field} data-testid="input-step-number" /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={itemForm.control} name="estimatedMinutes" render={({ field }) => (<FormItem><FormLabel>Est. Minutes</FormLabel><FormControl><Input type="number" {...field} data-testid="input-item-minutes" /></FormControl><FormMessage /></FormItem>)} />
        </div>
        <FormField control={itemForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description *</FormLabel><FormControl><Textarea placeholder="Check oil level..." {...field} data-testid="textarea-item-description" /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={itemForm.control} name="required" render={({ field }) => (<FormItem className="flex items-center gap-2"><FormControl><input type="checkbox" checked={field.value} onChange={field.onChange} data-testid="checkbox-required" /></FormControl><FormLabel className="!mt-0">Required step</FormLabel><FormMessage /></FormItem>)} />
        <Button type="button" variant="secondary" onClick={itemForm.handleSubmit(onAdd)} data-testid="button-add-item"><Plus className="h-4 w-4 mr-2" />{editingItemIndex === null ? "Add Item" : "Update Item"}</Button>
      </div>
    </div>
  );
}

interface TemplateItem { id: string; stepNumber: number; description: string; required?: boolean; estimatedMinutes?: number; }
function ViewTemplateContent({ template, items, onClose }: { template: MaintenanceTemplate; items: TemplateItem[]; onClose: () => void }) {
  const config = getPriorityBadgeConfig(template.priority);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="text-sm font-medium text-muted-foreground">Equipment Type</label><p className="text-sm" data-testid="view-equipment-type">{EQUIPMENT_TYPES.find((t) => t.value === template.equipmentType)?.label}</p></div>
        <div><label className="text-sm font-medium text-muted-foreground">Frequency</label><p className="text-sm" data-testid="view-frequency">{template.frequency}</p></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="text-sm font-medium text-muted-foreground">Duration</label><p className="text-sm" data-testid="view-duration">{template.estimatedDuration} minutes</p></div>
        <div><label className="text-sm font-medium text-muted-foreground">Priority</label><div className="mt-1"><Badge variant={config.variant} className={config.className}>{config.label}</Badge></div></div>
      </div>
      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><CheckSquare className="h-5 w-5" />Checklist Items</h3>
        {items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={item.id} className="p-3 border rounded flex items-start gap-3" data-testid={`view-item-${index}`}>
                <Badge variant="outline" data-testid={`view-item-step-${index}`}>{item.stepNumber}</Badge>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">{item.required && <Badge variant="destructive" data-testid={`view-item-required-${index}`}>Required</Badge>}</div>
                  <p className="text-sm" data-testid={`view-item-desc-${index}`}>{item.description}</p>
                  {item.estimatedMinutes && <p className="text-xs text-muted-foreground mt-1" data-testid={`view-item-minutes-${index}`}>Est. {item.estimatedMinutes} minutes</p>}
                </div>
              </div>
            ))}
          </div>
        ) : <div className="text-center py-6 border rounded"><CheckSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground text-sm" data-testid="view-no-items">No checklist items defined</p></div>}
      </div>
      <div className="flex justify-end"><Button onClick={onClose} data-testid="button-close-view">Close</Button></div>
    </div>
  );
}

```

### `client/src/pages/work-orders.tsx` (125 lines)

```tsx
import { Plus, Trash2, Package, FileText, Wrench } from "lucide-react";
import { WorkOrderRequestsTab } from "@/components/work-orders/WorkOrderRequestsTab";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkOrderFilterPanel, VirtualizedWorkOrderTable, WorkOrderDetailDrawer, WorkOrderFormDialog, WorkOrderCloneDialog } from "@/components/work-orders";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { MultiPartSelector } from "@/components/MultiPartSelector";
import { useWorkOrdersPageData, getWorkOrderDuration, getPriorityColor, getPriorityLabel, getStatusColor } from "@/features/work-orders";
import { PermissionGate } from "@/components/PermissionGate";

export default function WorkOrders() {
  const {
    workOrders, vessels, equipment, allCrewMembers, isLoading, error,
    selectedOrder, viewModalOpen, setViewModalOpen, formDialogOpen, setFormDialogOpen, formDialogMode,
    defaultVesselId, defaultEquipmentId, sortColumn, sortDirection, filters, setFilters,
    drawerOpen, drawerOrder, cloneDialogOpen, cloneOrder,
    filteredAndSortedWorkOrders, openOrders, completedOrders, highPriorityOrders, hasActiveFilters,
    createMutation, updateMutation, clearAllMutation, completeWorkOrderMutation, queryClient,
    getEquipmentName, getVesselName,
    handleViewOrder, handleEditOrder, handleDeleteOrder, handleCreateOrder,
    handleClearAllOrders, handleFormSubmit, handleSort,
    closeDrawer, closeCloneDialog, onCloneSuccess,
  } = useWorkOrdersPageData();

  if (isLoading) {return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center"><div className="space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-96" /></div><Skeleton className="h-10 w-40" /></div>
      <Card><CardContent><TableSkeleton rows={10} columns={8} /></CardContent></Card>
    </div>
  );}

  if (error) { const message = (error)?.message ?? "Unknown error"; return <div className="flex items-center justify-center min-h-screen"><div className="text-destructive">Error loading work orders: {message}</div></div>; }

  return (
    <div className="min-h-screen">
      <div className="px-6 py-4 flex flex-wrap items-center justify-end gap-3">
        <PermissionGate resource="work_orders" action="delete">
          <Button variant="destructive" data-testid="button-clear-all-work-orders" onClick={handleClearAllOrders} disabled={clearAllMutation.isPending || !workOrders?.length}><Trash2 className="mr-2 h-4 w-4" />{clearAllMutation.isPending ? "Clearing..." : "Clear All"}</Button>
        </PermissionGate>
        <PermissionGate resource="work_orders" action="create">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-create-work-order" onClick={handleCreateOrder}><Plus className="mr-2 h-4 w-4" />Create Work Order</Button>
        </PermissionGate>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard label="Total Orders" value={workOrders?.length || 0} testId="stat-total-orders" />
          <StatCard label="Open" value={openOrders.length} testId="stat-open-orders" className="text-chart-2" />
          <StatCard label="High Priority" value={highPriorityOrders.length} testId="stat-high-priority-orders" className="text-destructive" />
          <StatCard label="Completed" value={completedOrders.length} testId="stat-completed-orders" className="text-chart-3" />
        </div>

        <div className="flex gap-6">
          <WorkOrderFilterPanel filters={filters} onFiltersChange={setFilters} />
          <div className="flex-1 min-w-0">
            <div className="mb-4 flex items-center justify-between">
              <div><h3 className="text-lg font-semibold">Work Order Management</h3><p className="text-sm text-muted-foreground">Track and manage maintenance work orders across your fleet{hasActiveFilters && ` (${filteredAndSortedWorkOrders.length} filtered results)`}</p></div>
            </div>
            <VirtualizedWorkOrderTable workOrders={filteredAndSortedWorkOrders} equipment={equipment} vessels={vessels} crew={allCrewMembers} isLoading={isLoading} onView={handleViewOrder} onEdit={handleEditOrder} onDelete={handleDeleteOrder} sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
          </div>
        </div>
      </div>

      <WorkOrderDetailDrawer workOrder={drawerOrder} open={drawerOpen} onClose={closeDrawer} equipment={equipment} vessels={vessels} crew={allCrewMembers} onComplete={(id) => { completeWorkOrderMutation.mutate(id); closeDrawer(); }} onEdit={(_order) => { closeDrawer(); handleEditOrder(_order); }} onClone={(_order) => { closeDrawer(); closeCloneDialog(true); }} isCompleting={completeWorkOrderMutation.isPending} />
      <WorkOrderCloneDialog workOrder={cloneOrder} open={cloneDialogOpen} onOpenChange={closeCloneDialog} onSuccess={onCloneSuccess} />

      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" data-testid="order-detail-panel">
          <DialogHeader><DialogTitle>Work Order {selectedOrder?.woNumber || selectedOrder?.id}</DialogTitle><DialogDescription>Manage work order and parts for {selectedOrder && getEquipmentName(selectedOrder.equipmentId)}</DialogDescription></DialogHeader>
          {selectedOrder && <ViewOrderTabs order={selectedOrder} getEquipmentName={getEquipmentName} getVesselName={getVesselName} onComplete={() => completeWorkOrderMutation.mutate(selectedOrder.id)} isCompleting={completeWorkOrderMutation.isPending} onClose={() => setViewModalOpen(false)} queryClient={queryClient} />}
        </DialogContent>
      </Dialog>

      <WorkOrderFormDialog open={formDialogOpen} onOpenChange={setFormDialogOpen} mode={formDialogMode} workOrder={selectedOrder} onSubmit={handleFormSubmit} isSubmitting={createMutation.isPending || updateMutation.isPending} defaultVesselId={defaultVesselId} defaultEquipmentId={defaultEquipmentId} />
    </div>
  );
}

function StatCard({ label, value, testId, className = "text-foreground" }: { label: string; value: number; testId: string; className?: string }) {
  return <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-muted-foreground text-sm">{label}</p><p className={`text-2xl font-bold mt-1 ${className}`} data-testid={testId}>{value}</p></div></div></CardContent></Card>;
}

function ViewOrderTabs({ order, getEquipmentName, getVesselName, onComplete, isCompleting, onClose, queryClient }: { order: WorkOrder; getEquipmentName: (id: string) => string; getVesselName: (id: string | null) => string; onComplete: () => void; isCompleting: boolean; onClose: () => void; queryClient: { invalidateQueries: (options: { queryKey: string[] }) => void } }) {
  return (
    <Tabs defaultValue="details" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="details" className="flex items-center gap-2"><FileText className="h-4 w-4" />Order Details</TabsTrigger>
        <TabsTrigger value="requests" className="flex items-center gap-2" data-testid="tab-requests"><Wrench className="h-4 w-4" />Service & Purchase Requests</TabsTrigger>
        <TabsTrigger value="parts" className="flex items-center gap-2"><Package className="h-4 w-4" />Parts Management</TabsTrigger>
      </TabsList>
      <TabsContent value="details" className="space-y-4 mt-6">
        <div className="grid grid-cols-2 gap-6">
          <div><Label className="text-sm font-medium">Order ID</Label><p className="text-sm text-muted-foreground font-mono">{order.woNumber || order.id}</p></div>
          <div><Label className="text-sm font-medium">Vessel</Label><p className="text-sm text-muted-foreground font-semibold">{getVesselName(order.vesselId)}</p></div>
          <div><Label className="text-sm font-medium">Equipment</Label><p className="text-sm text-muted-foreground">{getEquipmentName(order.equipmentId)}</p></div>
          <div><Label className="text-sm font-medium">Duration</Label><p className="text-sm text-muted-foreground font-semibold">{getWorkOrderDuration(order)}</p></div>
          <div><Label className="text-sm font-medium">Priority</Label><Badge className={getPriorityColor(order.priority)}>{getPriorityLabel(order.priority)}</Badge></div>
          <div><Label className="text-sm font-medium">Status</Label><Badge className={getStatusColor(order.status)}>{order.status.replace("_", " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}</Badge></div>
          <div className="col-span-2"><Label className="text-sm font-medium">Reason</Label><p className="text-sm text-muted-foreground">{order.reason || "No reason provided"}</p></div>
          <div className="col-span-2"><Label className="text-sm font-medium">Description</Label><p className="text-sm text-muted-foreground" data-testid="text-order-description">{order.description || "No description provided"}</p></div>
          <div><Label className="text-sm font-medium">Created</Label><p className="text-sm text-muted-foreground">{order.createdAt ? formatDistanceToNow(new Date(order.createdAt), { addSuffix: true }) : "Unknown"}</p></div>
          {order.actualDowntimeHours && <div><Label className="text-sm font-medium">Actual Downtime</Label><p className="text-sm text-muted-foreground">{order.actualDowntimeHours}h</p></div>}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          {order.status !== "completed" && <Button onClick={onComplete} disabled={isCompleting} variant="default" data-testid="button-complete-work-order">{isCompleting ? "Completing..." : "Complete Work Order"}</Button>}
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </TabsContent>
      <TabsContent value="requests" className="mt-6">
        <WorkOrderRequestsTab workOrderId={order.id} isReadOnly={order.status === "completed"} />
        <div className="flex justify-end pt-4"><Button variant="outline" onClick={onClose}>Close</Button></div>
      </TabsContent>
      <TabsContent value="parts" className="mt-6">
        <MultiPartSelector workOrderId={order.id} onPartsAdded={() => { queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] }); }} />
        <div className="flex justify-end pt-4"><Button variant="outline" onClick={onClose}>Close</Button></div>
      </TabsContent>
    </Tabs>
  );
}

```

### `client/src/pages/pdm-dashboard.tsx` (1607 lines)

```tsx
import { useState } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  Wrench, 
  Brain, 
  Wifi, 
  WifiOff,
  ChevronRight,
  ChevronDown,
  FileText,
  CheckCircle,
  Settings,
  Search,
  Download,
  Ship,
  Gauge,
  DollarSign,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  usePdmDashboard, 
  useAssetDetail, 
  useAcknowledgeRisk, 
  useCreateWorkOrderFromRisk,
  useCostSavingsSummary,
  useEquipmentFinancials,
  useTelemetryTrends,
  useEquipmentTelemetry,
  usePdmFilterOptions,
  ScheduleView
} from '@/features/pdm';
import type { RiskQueueItem, RiskLevel, TelemetryTrend, EvidenceChip, TelemetryReading } from '@/features/pdm';
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  ReferenceLine
} from 'recharts';

function FleetHealthGauge({ score, change, period }: { score: number; change: number; period: string }) {
  const rotation = (score / 100) * 180 - 90;
  const getColor = () => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <div className="relative w-24 h-14 overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-12 rounded-t-full border-8 border-muted" />
        <div 
          className={`absolute inset-x-0 bottom-0 h-12 rounded-t-full border-8 ${getColor().replace('text-', 'border-')}`}
          style={{ 
            clipPath: `polygon(0% 100%, 0% 0%, ${50 + score/2}% 0%, ${50 + score/2}% 100%)`
          }} 
        />
        <div 
          className="absolute bottom-0 left-1/2 w-1 h-10 bg-foreground origin-bottom rounded-full"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        />
      </div>
      <div className="text-center mt-1">
        <span className={`text-2xl font-bold ${getColor()}`} data-testid="kpi-health-score">{score}</span>
        <span className="text-sm text-muted-foreground">/100</span>
      </div>
      <div className="flex items-center gap-1 text-xs">
        <TrendingUp className={`h-3 w-3 ${change >= 0 ? 'text-green-500' : 'text-red-500 rotate-180'}`} />
        <span className={change >= 0 ? 'text-green-500' : 'text-red-500'}>
          {change > 0 ? '+' : ''}{change}
        </span>
        <span className="text-muted-foreground">{period}</span>
      </div>
    </div>
  );
}

function KpiCardCompact({ 
  title, 
  value, 
  subtitle, 
  badge,
  variant = 'default',
  testId
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string; 
  badge?: { text: string; variant: 'destructive' | 'secondary' | 'outline' };
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  testId: string;
}) {
  const bgColor = {
    default: 'bg-primary',
    success: 'bg-green-600 dark:bg-green-700',
    warning: 'bg-yellow-500 dark:bg-yellow-600',
    danger: 'bg-red-600 dark:bg-red-700',
    info: 'bg-blue-600 dark:bg-blue-700',
  }[variant];

  return (
    <div className={`${bgColor} text-white rounded-lg p-3 min-w-[140px] flex-shrink-0`}>
      <p className="text-xs opacity-90 truncate">{title}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-2xl font-bold" data-testid={testId}>{value}</span>
        {badge && (
          <Badge variant={badge.variant} className="text-[10px] px-1.5 py-0">
            {badge.text}
          </Badge>
        )}
      </div>
      {subtitle && <p className="text-xs opacity-80 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: RiskLevel }) {
  const variants: Record<RiskLevel, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
    critical: { variant: 'destructive' },
    high: { variant: 'destructive', className: 'bg-orange-500 dark:bg-orange-600' },
    medium: { variant: 'secondary', className: 'bg-yellow-500 text-yellow-950 dark:bg-yellow-600' },
    low: { variant: 'outline', className: 'border-green-500 text-green-600 dark:text-green-400' },
  };
  
  return (
    <Badge {...variants[severity]} className={variants[severity].className}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </Badge>
  );
}

function StatusBadge({ status }: { status: 'new' | 'active' | 'acknowledged' | 'resolved' }) {
  const statusLabels: Record<string, string> = {
    new: 'Processing',
    active: 'Processing',
    acknowledged: 'Approved',
    resolved: 'Approved',
  };
  const variants: Record<string, { variant: 'default' | 'secondary' | 'outline'; className?: string; icon?: typeof CheckCircle }> = {
    new: { variant: 'secondary', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
    active: { variant: 'secondary', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
    acknowledged: { variant: 'secondary', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', icon: CheckCircle },
    resolved: { variant: 'secondary', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', icon: CheckCircle },
  };
  const config = variants[status] || variants.new;
  const Icon = config.icon;
  
  return (
    <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {statusLabels[status] || status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function MiniSparkline({ data, color = 'hsl(var(--primary))' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const height = 20;
  const width = 60;
  
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
}

function EvidenceChipBadge({ chip }: { chip: EvidenceChip }) {
  const typeStyles: Record<EvidenceChip['type'], string> = {
    trend: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    threshold: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    anomaly: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    pattern: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  };
  
  return (
    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0.5 ${typeStyles[chip.type]}`}>
      {chip.label}
    </Badge>
  );
}

function RiskQueueDesktopTable({ 
  items, 
  onSelectItem,
  isLoading 
}: { 
  items: RiskQueueItem[];
  onSelectItem: (item: RiskQueueItem) => void;
  isLoading: boolean;
}) {
  const acknowledgeMutation = useAcknowledgeRisk();
  const createWOMutation = useCreateWorkOrderFromRisk();

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <CheckCircle className="h-10 w-10 mb-3" />
        <p className="text-sm font-medium">No items in this queue</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Severity</TableHead>
            <TableHead>Vessel / Asset</TableHead>
            <TableHead>Failure Mode</TableHead>
            <TableHead className="w-[100px]">RUL Estimate</TableHead>
            <TableHead>Recommended Action</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow 
              key={item.id} 
              className="cursor-pointer hover-elevate"
              onClick={() => onSelectItem(item)}
              data-testid={`risk-item-${item.id}`}
            >
              <TableCell>
                <SeverityBadge severity={item.severity} />
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium text-sm">{item.vesselName}</p>
                  <p className="text-xs text-muted-foreground">{item.equipmentName}</p>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm">{item.failureMode}</span>
              </TableCell>
              <TableCell>
                {item.rulEstimateDays !== null ? (
                  <div className="flex flex-col">
                    <span className={`font-semibold text-sm ${item.rulEstimateDays < 7 ? 'text-red-500' : ''}`}>
                      {item.rulEstimateDays < 7 ? '< ' : ''}{item.rulEstimateDays} days
                    </span>
                    {item.rulConfidenceInterval && (
                      <span className="text-xs text-muted-foreground">
                        {item.rulConfidenceInterval.lowDays}-{item.rulConfidenceInterval.highDays}d range
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">N/A</span>
                )}
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground block">{item.recommendedAction}</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.evidenceChips && item.evidenceChips.length > 0 && (
                      item.evidenceChips.map((chip, idx) => (
                        <EvidenceChipBadge key={idx} chip={chip} />
                      ))
                    )}
                    {item.trendData && item.trendData.length >= 2 && (
                      <MiniSparkline 
                        data={item.trendData} 
                        color={item.severity === 'critical' ? '#ef4444' : item.severity === 'high' ? '#f97316' : '#3b82f6'}
                      />
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={item.status} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {item.status !== 'resolved' && (
                    <>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={(e) => { e.stopPropagation(); acknowledgeMutation.mutate(item.id); }}
                        disabled={acknowledgeMutation.isPending}
                        data-testid={`ack-${item.id}`}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); createWOMutation.mutate(item.id); }}
                        disabled={createWOMutation.isPending}
                        data-testid={`create-wo-${item.id}`}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RiskQueueMobileCards({ 
  items, 
  onSelectItem,
  isLoading 
}: { 
  items: RiskQueueItem[];
  onSelectItem: (item: RiskQueueItem) => void;
  isLoading: boolean;
}) {
  const acknowledgeMutation = useAcknowledgeRisk();
  const createWOMutation = useCreateWorkOrderFromRisk();

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <CheckCircle className="h-8 w-8 mb-2" />
        <p className="text-sm">No items in this queue</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {items.map((item) => (
        <div 
          key={item.id}
          className="p-3 border rounded-lg hover-elevate cursor-pointer"
          onClick={() => onSelectItem(item)}
          data-testid={`risk-item-${item.id}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <SeverityBadge severity={item.severity} />
                <span className="text-xs text-muted-foreground">{item.vesselName}</span>
              </div>
              <p className="font-medium text-sm truncate">{item.equipmentName}</p>
              <p className="text-xs text-muted-foreground truncate">{item.failureMode}</p>
              {item.evidenceChips && item.evidenceChips.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {item.evidenceChips.slice(0, 2).map((chip, idx) => (
                    <EvidenceChipBadge key={idx} chip={chip} />
                  ))}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              {item.rulEstimateDays !== null && (
                <div>
                  <p className={`text-sm font-semibold ${item.rulEstimateDays < 7 ? 'text-red-500' : ''}`}>
                    {item.rulEstimateDays < 7 ? '< ' : ''}{item.rulEstimateDays}d
                  </p>
                  {item.rulConfidenceInterval && (
                    <p className="text-xs text-muted-foreground">
                      {item.rulConfidenceInterval.lowDays}-{item.rulConfidenceInterval.highDays}d
                    </p>
                  )}
                </div>
              )}
              <StatusBadge status={item.status} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TelemetryCoverageCard({ 
  coverage, 
  isLoading 
}: { 
  coverage?: { onlineCount: number; totalCount: number; delayedCount: number; delayedEquipment: Array<{ equipmentId: string; equipmentName: string; vesselName: string; lastSeenAgo: string }> };
  isLoading: boolean;
}) {
  if (isLoading || !coverage) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              Telemetry Coverage
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            Telemetry Coverage
          </span>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-sm">Online:</span>
          <span className="font-bold" data-testid="telemetry-coverage">
            {coverage.onlineCount} / {coverage.totalCount}
          </span>
        </div>
        
        {coverage.delayedCount > 0 && (
          <>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm">Delayed:</span>
              <span className="font-bold text-yellow-600 dark:text-yellow-400">{coverage.delayedCount}</span>
            </div>
            <div className="space-y-1 pl-6">
              {coverage.delayedEquipment.slice(0, 3).map((eq) => (
                <div key={eq.equipmentId} className="text-xs flex items-center gap-2">
                  <span className="text-muted-foreground">-</span>
                  <span className="truncate flex-1">{eq.vesselName}</span>
                  <span className="text-muted-foreground shrink-0">Last seen: {eq.lastSeenAgo}</span>
                </div>
              ))}
            </div>
          </>
        )}
        
        <Button variant="outline" size="sm" className="w-full mt-2">
          Ingestion Health <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}

function ModelHealthCard({ 
  health, 
  isLoading 
}: { 
  health?: { activeModelsCount: number; driftAlertsCount: number; lastTrainingDate: string | Date | null };
  isLoading: boolean;
}) {
  if (isLoading || !health) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Model Health
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const lastTrained = health.lastTrainingDate 
    ? new Date(health.lastTrainingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Never';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Model Health
          </span>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-sm">Models Active:</span>
          <span className="font-bold" data-testid="active-models">{health.activeModelsCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className={`h-4 w-4 ${health.driftAlertsCount > 0 ? 'text-red-500' : 'text-green-500'}`} />
          <span className="text-sm">Drift Alerts:</span>
          <span className={`font-bold ${health.driftAlertsCount > 0 ? 'text-red-500' : ''}`}>{health.driftAlertsCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Last Training:</span>
          <span className="text-sm text-muted-foreground">{lastTrained}</span>
        </div>
        
        <Button variant="outline" size="sm" className="w-full mt-2">
          Model Dashboard <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}

function MaintenancePipelineCard({ 
  pipeline, 
  isLoading 
}: { 
  pipeline?: { openWorkOrdersCount: number; awaitingApprovalCount: number; inProgressCount: number };
  isLoading: boolean;
}) {
  if (isLoading || !pipeline) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Maintenance Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          Maintenance Pipeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm">Open Work Orders:</span>
          </div>
          <span className="font-bold" data-testid="open-wo">{pipeline.openWorkOrdersCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm">Awaiting Approval:</span>
          </div>
          <span className="font-bold">{pipeline.awaitingApprovalCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-red-500" />
            <span className="text-sm">In Progress:</span>
          </div>
          <span className="font-bold">{pipeline.inProgressCount}</span>
        </div>
        
        <Button variant="outline" size="sm" className="w-full mt-2">
          View WOs <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}

function RecommendedActionsChecklist({ actions }: { actions: string[] }) {
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  
  const toggleItem = (index: number) => {
    setCheckedItems(prev => ({ ...prev, [index]: !prev[index] }));
  };
  
  const completedCount = Object.values(checkedItems).filter(Boolean).length;
  
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium">Recommended Actions</p>
        <Badge variant="outline" className="text-xs">
          {completedCount}/{actions.length} completed
        </Badge>
      </div>
      <ul className="space-y-2">
        {actions.map((action, i) => (
          <li 
            key={i} 
            className={`flex items-start gap-2 text-sm p-2 rounded cursor-pointer hover-elevate ${
              checkedItems[i] ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted/30'
            }`}
            onClick={() => toggleItem(i)}
            data-testid={`action-item-${i}`}
          >
            <div className={`h-4 w-4 mt-0.5 shrink-0 rounded border flex items-center justify-center ${
              checkedItems[i] 
                ? 'bg-green-500 border-green-500 text-white' 
                : 'border-muted-foreground'
            }`}>
              {checkedItems[i] && <CheckCircle className="h-3 w-3" />}
            </div>
            <span className={checkedItems[i] ? 'line-through text-muted-foreground' : ''}>
              {action}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EvidenceTimeSeriesChart({ 
  readings, 
  isLoading, 
  failureMode 
}: { 
  readings?: TelemetryReading[]; 
  isLoading: boolean;
  failureMode: string;
}) {
  if (isLoading) {
    return <Skeleton className="h-[180px] w-full" />;
  }

  if (!readings || readings.length === 0) {
    return (
      <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm border rounded-lg bg-muted/30">
        No telemetry data available for this asset
      </div>
    );
  }

  const isVibration = failureMode.toLowerCase().includes('vibration') || failureMode.toLowerCase().includes('bearing');
  const isTemperature = failureMode.toLowerCase().includes('temperature') || failureMode.toLowerCase().includes('overheating');
  
  const threshold = isVibration ? 2.5 : isTemperature ? 85 : null;
  const warningThreshold = isVibration ? 2.0 : isTemperature ? 75 : null;

  const chartData = readings.slice(0, 50).map((r, idx) => ({
    time: new Date(r.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    value: Math.round(r.value * 100) / 100,
    sensor: r.sensorType,
  })).reverse();

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Sensor: {readings[0]?.sensorType || 'Unknown'} | Last {readings.length} readings
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 9 }} 
            className="text-muted-foreground"
            interval="preserveStartEnd"
          />
          <YAxis 
            tick={{ fontSize: 10 }} 
            className="text-muted-foreground"
            width={40}
          />
          <Tooltip 
            formatter={(value: number) => [value.toFixed(2), 'Value']}
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))', 
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              fontSize: '12px'
            }}
          />
          {threshold && (
            <ReferenceLine y={threshold} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Critical', position: 'right', fontSize: 10, fill: '#ef4444' }} />
          )}
          {warningThreshold && (
            <ReferenceLine y={warningThreshold} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Warning', position: 'right', fontSize: 10, fill: '#f59e0b' }} />
          )}
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="hsl(210, 70%, 50%)" 
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function AssetDetailPanel({ 
  item, 
  onClose 
}: { 
  item: RiskQueueItem | null; 
  onClose: () => void;
}) {
  const { data: assetDetail, isLoading } = useAssetDetail(item?.equipmentId || null);
  const { data: telemetryReadings, isLoading: telemetryLoading } = useEquipmentTelemetry(item?.equipmentId || null, { limit: 50, hours: 24 });
  const createWOMutation = useCreateWorkOrderFromRisk();

  if (!item) return null;

  return (
    <Sheet open={!!item} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {item.vesselName} | {item.equipmentName}
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={item.severity} />
            <Badge variant="outline">{item.equipmentType}</Badge>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2 text-center">RUL Estimate</p>
            <RulGauge 
              rulDays={item.rulEstimateDays} 
              confidence={item.confidence}
              confidenceInterval={item.rulConfidenceInterval}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 border rounded-lg">
              <p className="text-xs text-muted-foreground">Failure Mode</p>
              <p className="font-medium text-sm mt-1">{item.failureMode}</p>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <p className="text-xs text-muted-foreground">Confidence</p>
              <p className="font-bold text-lg">{item.confidence}%</p>
            </div>
          </div>

          {item.evidenceChips && item.evidenceChips.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Evidence</p>
              <div className="flex flex-wrap gap-2">
                {item.evidenceChips.map((chip, idx) => (
                  <EvidenceChipBadge key={idx} chip={chip} />
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium mb-2">Telemetry History</p>
            <EvidenceTimeSeriesChart 
              readings={telemetryReadings} 
              isLoading={telemetryLoading}
              failureMode={item.failureMode}
            />
          </div>

          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : assetDetail?.recommendedActions && (
            <RecommendedActionsChecklist actions={assetDetail.recommendedActions} />
          )}

          <div className="pt-4 border-t space-y-2">
            <Button 
              className="w-full" 
              onClick={() => createWOMutation.mutate(item.id)}
              disabled={createWOMutation.isPending || item.status === 'resolved'}
              data-testid="detail-create-wo"
            >
              <FileText className="h-4 w-4 mr-2" />
              Create Work Order
            </Button>
            <Button variant="outline" className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RulGauge({ rulDays, confidence, confidenceInterval }: { 
  rulDays: number | null; 
  confidence: number;
  confidenceInterval?: { lowDays: number; highDays: number } | null;
}) {
  if (rulDays === null) {
    return (
      <div className="text-center p-4 bg-muted/50 rounded-lg">
        <p className="text-muted-foreground">RUL data not available</p>
      </div>
    );
  }

  const maxDays = 60;
  const normalizedRul = Math.min(rulDays / maxDays, 1);
  const getColor = (days: number) => {
    if (days < 7) return '#ef4444';
    if (days < 14) return '#f97316';
    if (days < 30) return '#eab308';
    return '#22c55e';
  };

  const mainColor = getColor(rulDays);
  
  const p90Pct = confidenceInterval ? Math.min(confidenceInterval.highDays / maxDays, 1) * 100 : normalizedRul * 100;
  const p10Pct = confidenceInterval ? Math.min(confidenceInterval.lowDays / maxDays, 1) * 100 : normalizedRul * 100;
  const medianPct = normalizedRul * 100;

  const startAngleBase = 180;
  const endAngleBase = 0;
  const p10Angle = startAngleBase - (p10Pct / 100) * 180;
  const p90Angle = startAngleBase - (p90Pct / 100) * 180;
  const medianAngle = startAngleBase - (medianPct / 100) * 180;

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={160}>
        <RadialBarChart
          cx="50%"
          cy="100%"
          innerRadius="55%"
          outerRadius="100%"
          barSize={14}
          data={[{ name: 'Base', value: 100, fill: 'hsl(var(--muted))' }]}
          startAngle={180}
          endAngle={0}
        >
          <RadialBar dataKey="value" cornerRadius={6} />
        </RadialBarChart>
      </ResponsiveContainer>

      {confidenceInterval && (
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height={160}>
            <RadialBarChart
              cx="50%"
              cy="100%"
              innerRadius="55%"
              outerRadius="100%"
              barSize={14}
              data={[{ name: 'P90', value: p90Pct, fill: `${mainColor}25` }]}
              startAngle={180}
              endAngle={0}
            >
              <RadialBar dataKey="value" cornerRadius={6} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      )}

      {confidenceInterval && (
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height={160}>
            <RadialBarChart
              cx="50%"
              cy="100%"
              innerRadius="55%"
              outerRadius="100%"
              barSize={14}
              data={[{ name: 'P10', value: p10Pct, fill: 'hsl(var(--muted))' }]}
              startAngle={180}
              endAngle={0}
            >
              <RadialBar dataKey="value" cornerRadius={6} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="absolute inset-0">
        <ResponsiveContainer width="100%" height={160}>
          <RadialBarChart
            cx="50%"
            cy="100%"
            innerRadius="60%"
            outerRadius="95%"
            barSize={8}
            data={[{ name: 'Median', value: medianPct, fill: mainColor }]}
            startAngle={180}
            endAngle={0}
          >
            <RadialBar dataKey="value" cornerRadius={4} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="absolute inset-x-0 bottom-6 text-center">
        <p className="text-2xl font-bold" style={{ color: mainColor }} data-testid="rul-gauge-value">
          {confidenceInterval 
            ? `${confidenceInterval.lowDays}-${confidenceInterval.highDays}`
            : rulDays
          }
        </p>
        <p className="text-xs text-muted-foreground">Days (P10-P90)</p>
      </div>
      
      <div className="flex justify-center gap-4 mt-1">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Confidence</p>
          <p className="text-sm font-semibold">{confidence}%</p>
        </div>
        {confidenceInterval && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Median (P50)</p>
            <p className="text-sm font-semibold">{rulDays}d</p>
          </div>
        )}
      </div>
      
      {confidenceInterval && (
        <div className="flex justify-center gap-3 mt-2 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: `${mainColor}25` }}></span>
            P10-P90
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: mainColor }}></span>
            Median
          </span>
        </div>
      )}
    </div>
  );
}

function SensorTrendChart({ trends, isLoading, sensorFilter }: { 
  trends?: TelemetryTrend[]; 
  isLoading: boolean;
  sensorFilter?: string;
}) {
  if (isLoading) {
    return <Skeleton className="h-[200px] w-full" />;
  }

  if (!trends || trends.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
        No sensor data available
      </div>
    );
  }

  const filteredTrends = sensorFilter && trends
    ? trends.filter(t => t.sensorType.toLowerCase().includes(sensorFilter.toLowerCase()))
    : trends;

  const chartData = filteredTrends.slice(0, 10).map((t, i) => ({
    name: t.sensorType.length > 12 ? t.sensorType.slice(0, 12) + '...' : t.sensorType,
    fullName: t.sensorType,
    avg: Math.round(t.avgValue * 10) / 10,
    min: Math.round(t.minValue * 10) / 10,
    max: Math.round(t.maxValue * 10) / 10,
    points: t.dataPoints,
  }));

  if (chartData.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
        No matching sensor data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} className="text-muted-foreground" />
        <YAxis 
          type="category" 
          dataKey="name" 
          tick={{ fontSize: 10 }} 
          className="text-muted-foreground"
          width={70}
        />
        <Tooltip 
          formatter={(value: number, name: string) => [value.toFixed(1), name === 'avg' ? 'Average' : name === 'max' ? 'Maximum' : 'Minimum']}
          contentStyle={{ 
            backgroundColor: 'hsl(var(--card))', 
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px'
          }}
        />
        <Bar dataKey="min" fill="hsl(210, 70%, 60%)" name="Min" stackId="range" />
        <Bar dataKey="avg" fill="hsl(142, 70%, 45%)" name="Avg" />
        <Bar dataKey="max" fill="hsl(25, 95%, 53%)" name="Max" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function SensorTimeSeriesChart({ trends, isLoading }: { trends?: TelemetryTrend[]; isLoading: boolean }) {
  if (isLoading) {
    return <Skeleton className="h-[200px] w-full" />;
  }

  if (!trends || trends.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
        No sensor trend data available
      </div>
    );
  }

  const vibrationTrends = trends.filter(t => 
    t.sensorType.toLowerCase().includes('vibration') || 
    t.sensorType.toLowerCase().includes('rms') ||
    t.sensorType.toLowerCase().includes('temp')
  ).slice(0, 6);

  const chartData = vibrationTrends.map((t, i) => ({
    sensor: t.sensorType.length > 15 ? t.sensorType.slice(0, 15) + '...' : t.sensorType,
    value: Math.round(t.avgValue * 100) / 100,
    min: Math.round(t.minValue * 100) / 100,
    max: Math.round(t.maxValue * 100) / 100,
    dataPoints: t.dataPoints,
  }));

  if (chartData.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
        No vibration/temperature data
      </div>
    );
  }

  const hasVibration = trends.some(t => 
    t.sensorType.toLowerCase().includes('vibration') || t.sensorType.toLowerCase().includes('rms')
  );
  const hasTemp = trends.some(t => t.sensorType.toLowerCase().includes('temp'));
  
  const vibrationCritical = hasVibration ? 2.5 : null;
  const vibrationWarning = hasVibration ? 2.0 : null;
  const tempCritical = hasTemp ? 85 : null;
  const tempWarning = hasTemp ? 75 : null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="sensorGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(210, 70%, 50%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(210, 70%, 50%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="sensor" 
          tick={{ fontSize: 10 }} 
          className="text-muted-foreground"
          angle={-20}
          textAnchor="end"
          height={50}
        />
        <YAxis 
          tick={{ fontSize: 11 }}
          className="text-muted-foreground"
        />
        <Tooltip 
          formatter={(value: number, name: string) => [value.toFixed(2), name === 'value' ? 'Average' : name]}
          contentStyle={{ 
            backgroundColor: 'hsl(var(--card))', 
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px'
          }}
        />
        {vibrationCritical !== null && (
          <ReferenceLine y={vibrationCritical} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Vib Critical', position: 'right', fontSize: 9, fill: '#ef4444' }} />
        )}
        {vibrationWarning !== null && (
          <ReferenceLine y={vibrationWarning} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Vib Warning', position: 'right', fontSize: 9, fill: '#f59e0b' }} />
        )}
        {tempCritical !== null && (
          <ReferenceLine y={tempCritical} stroke="#dc2626" strokeDasharray="5 5" label={{ value: 'Temp Critical', position: 'right', fontSize: 9, fill: '#dc2626' }} />
        )}
        {tempWarning !== null && (
          <ReferenceLine y={tempWarning} stroke="#ea580c" strokeDasharray="3 3" label={{ value: 'Temp Warning', position: 'right', fontSize: 9, fill: '#ea580c' }} />
        )}
        <Area 
          type="monotone" 
          dataKey="value" 
          stroke="hsl(210, 70%, 50%)" 
          fill="url(#sensorGradient)" 
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

type MainView = 'risk-queue' | 'schedule';

export default function PdmDashboard() {
  const [mainView, setMainView] = useState<MainView>('risk-queue');
  const [activeTab, setActiveTab] = useState<'active' | 'new' | 'resolved'>('active');
  const [selectedItem, setSelectedItem] = useState<RiskQueueItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [fleetFilter, setFleetFilter] = useState('all');
  const [equipmentTypeFilter, setEquipmentTypeFilter] = useState('all');
  const [dateRange, setDateRange] = useState('30');
  
  const { data: filterOptions } = usePdmFilterOptions();

  const getDateRange = (days: string) => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - parseInt(days));
    return {
      dateFrom: from.toISOString().split('T')[0],
      dateTo: now.toISOString().split('T')[0],
    };
  };

  const dateFilters = getDateRange(dateRange);
  
  const filters = {
    vesselId: fleetFilter !== 'all' ? fleetFilter : undefined,
    equipmentType: equipmentTypeFilter !== 'all' ? equipmentTypeFilter : undefined,
    search: debouncedSearch || undefined,
    dateFrom: dateFilters.dateFrom,
    dateTo: dateFilters.dateTo,
  };

  const { data, isLoading, error } = usePdmDashboard(filters);
  const { data: costSummary, isLoading: costLoading } = useCostSavingsSummary(12);
  const { data: financials, isLoading: financialsLoading } = useEquipmentFinancials();
  const { data: telemetryTrends, isLoading: telemetryLoading } = useTelemetryTrends(undefined, 24);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const timeoutId = setTimeout(() => setDebouncedSearch(value), 300);
    return () => clearTimeout(timeoutId);
  };

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    params.set('format', 'csv');
    if (filters.vesselId) params.set('vesselId', filters.vesselId);
    if (filters.equipmentType) params.set('equipmentType', filters.equipmentType);
    if (filters.search) params.set('search', filters.search);
    window.open(`/api/pdm/export/risk-queue?${params.toString()}`, '_blank');
  };

  const handleExportJSON = () => {
    const params = new URLSearchParams();
    params.set('format', 'json');
    if (filters.vesselId) params.set('vesselId', filters.vesselId);
    if (filters.equipmentType) params.set('equipmentType', filters.equipmentType);
    if (filters.search) params.set('search', filters.search);
    window.open(`/api/pdm/export/risk-queue?${params.toString()}`, '_blank');
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-500">Failed to load PdM Dashboard</p>
          <p className="text-sm text-muted-foreground mt-1">Please check your connection and try again</p>
        </div>
      </div>
    );
  }

  const currentItems = data?.riskQueue[activeTab] || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-slate-800 dark:bg-slate-900 text-white">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold whitespace-nowrap">Predictive Maintenance</h1>
              
              <div className="hidden md:flex items-center gap-1 bg-slate-700/50 rounded-lg p-1">
                <Button
                  variant={mainView === 'risk-queue' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setMainView('risk-queue')}
                  className={mainView === 'risk-queue' ? 'bg-slate-600' : 'text-slate-300 hover:text-white'}
                  data-testid="nav-risk-queue"
                >
                  Risk Queue
                </Button>
                <Button
                  variant={mainView === 'schedule' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setMainView('schedule')}
                  className={mainView === 'schedule' ? 'bg-slate-600' : 'text-slate-300 hover:text-white'}
                  data-testid="nav-schedule"
                >
                  Schedule
                </Button>
              </div>
            </div>
            
            <div className="hidden lg:flex items-center gap-3 flex-1 justify-end">
              <Select value={fleetFilter} onValueChange={setFleetFilter}>
                <SelectTrigger className="w-[160px] bg-slate-700 border-slate-600 text-white" data-testid="filter-fleet">
                  <Ship className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Fleet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ships</SelectItem>
                  {filterOptions?.vessels.map((vessel) => (
                    <SelectItem key={vessel.id} value={vessel.id}>{vessel.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={equipmentTypeFilter} onValueChange={setEquipmentTypeFilter}>
                <SelectTrigger className="w-[160px] bg-slate-700 border-slate-600 text-white" data-testid="filter-equipment">
                  <Settings className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Equipment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Equipment</SelectItem>
                  {filterOptions?.equipmentTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[160px] bg-slate-700 border-slate-600 text-white" data-testid="filter-date">
                  <Clock className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 Days</SelectItem>
                  <SelectItem value="30">Last 30 Days</SelectItem>
                  <SelectItem value="90">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative hidden md:block">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  type="search"
                  placeholder="Search asset or tag..."
                  className="w-[200px] pl-8 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  data-testid="input-search"
                />
              </div>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="border-slate-600 text-slate-200"
                onClick={handleExportCSV}
                data-testid="button-export-csv"
              >
                <Download className="h-4 w-4 mr-1" />
                Export CSV
              </Button>
              <Button size="icon" variant="ghost" className="text-white hover:bg-slate-700" data-testid="button-search-mobile">
                <Search className="h-5 w-5 md:hidden" />
              </Button>
              <Button size="icon" variant="ghost" className="text-white hover:bg-slate-700" data-testid="button-export">
                <Download className="h-5 w-5" />
              </Button>
              <Button size="icon" variant="ghost" className="text-white hover:bg-slate-700" data-testid="button-settings">
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
          <div className="flex lg:hidden items-center gap-2 mt-3 overflow-x-auto pb-1">
            <div className="flex items-center gap-1 bg-slate-700/50 rounded-md p-0.5 md:hidden">
              <Button
                variant={mainView === 'risk-queue' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setMainView('risk-queue')}
                className={`text-xs h-7 ${mainView === 'risk-queue' ? 'bg-slate-600' : 'text-slate-300'}`}
                data-testid="nav-risk-queue-mobile"
              >
                Risk Queue
              </Button>
              <Button
                variant={mainView === 'schedule' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setMainView('schedule')}
                className={`text-xs h-7 ${mainView === 'schedule' ? 'bg-slate-600' : 'text-slate-300'}`}
                data-testid="nav-schedule-mobile"
              >
                Schedule
              </Button>
            </div>
            <Select value={fleetFilter} onValueChange={setFleetFilter}>
              <SelectTrigger className="w-[130px] bg-slate-700 border-slate-600 text-white text-xs" data-testid="filter-fleet-mobile">
                <Ship className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Fleet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ships</SelectItem>
                {filterOptions?.vessels.map((vessel) => (
                  <SelectItem key={vessel.id} value={vessel.id}>{vessel.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={equipmentTypeFilter} onValueChange={setEquipmentTypeFilter}>
              <SelectTrigger className="w-[130px] bg-slate-700 border-slate-600 text-white text-xs" data-testid="filter-equipment-mobile">
                <Settings className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Equipment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Equipment</SelectItem>
                {filterOptions?.equipmentTypes.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>
      
      {mainView === 'schedule' ? (
        <div className="p-4 lg:p-6">
          <ScheduleView />
        </div>
      ) : (
      <>
      <div className="p-4 lg:p-6 space-y-6">
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-2">
            <div className="bg-slate-700 dark:bg-slate-800 text-white rounded-lg p-3 min-w-[180px] flex-shrink-0">
              <p className="text-xs opacity-90">Fleet Health Score</p>
              {isLoading ? (
                <Skeleton className="h-16 w-full bg-slate-600" />
              ) : (
                <FleetHealthGauge 
                  score={data?.kpis.fleetHealthScore || 0} 
                  change={data?.kpis.fleetHealthChange || 0}
                  period={data?.kpis.fleetHealthPeriod || 'last week'}
                />
              )}
            </div>
            
            <KpiCardCompact
              title="Active Alerts"
              value={isLoading ? '-' : data?.kpis.activeAlertsTotal || 0}
              badge={data?.kpis.criticalAlertsCount ? { text: `${data.kpis.criticalAlertsCount} Critical`, variant: 'destructive' } : undefined}
              variant="danger"
              testId="kpi-active-alerts"
            />
            
            <KpiCardCompact
              title="Assets at Risk"
              value={isLoading ? '-' : data?.kpis.assetsAtRisk || 0}
              subtitle={`${data?.kpis.assetsRulUnder14Days || 0} RUL < 14 Days`}
              variant="warning"
              testId="kpi-assets-at-risk"
            />
            
            <KpiCardCompact
              title="Avoided Downtime"
              value={isLoading ? '-' : `${data?.kpis.avoidedDowntimeHours || 0} hrs`}
              subtitle={data?.kpis.avoidedDowntimePeriod}
              variant="success"
              testId="kpi-avoided-downtime"
            />
            
            <KpiCardCompact
              title="Maintenance Forecast"
              value={isLoading ? '-' : `$${((data?.kpis.maintenanceForecastCost || 0) / 1000).toFixed(0)}k`}
              subtitle={data?.kpis.maintenanceForecastPeriod}
              variant="info"
              testId="kpi-forecast-cost"
            />
            
            <KpiCardCompact
              title="Total Savings (12mo)"
              value={costLoading ? '-' : `$${((costSummary?.totalSavings || 0) / 1000).toFixed(0)}k`}
              subtitle={`${costSummary?.savingsCount || 0} preventive actions`}
              variant="success"
              testId="kpi-total-savings"
            />
            
            <KpiCardCompact
              title="Asset ROI"
              value={financialsLoading ? '-' : `${(financials?.assetROI || 0).toFixed(1)}%`}
              subtitle="Fleet-wide return"
              variant="default"
              testId="kpi-asset-roi"
            />
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-base flex items-center gap-2">
                    Risk Queue
                  </CardTitle>
                  <Button variant="outline" size="sm" className="hidden sm:flex">
                    <Wifi className="h-4 w-4 mr-1" />
                    Ingestion Health <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'new' | 'resolved')}>
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="active" data-testid="tab-active">
                      Risk Queue ({data?.riskQueue.active.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="new" data-testid="tab-new">
                      Active Alerts ({data?.riskQueue.new.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="resolved" data-testid="tab-resolved">
                      Resolved ({data?.riskQueue.resolved.length || 0})
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="active" className="mt-0">
                    <div className="hidden md:block">
                      <RiskQueueDesktopTable 
                        items={data?.riskQueue.active || []} 
                        onSelectItem={setSelectedItem}
                        isLoading={isLoading}
                      />
                    </div>
                    <div className="md:hidden">
                      <RiskQueueMobileCards 
                        items={data?.riskQueue.active || []} 
                        onSelectItem={setSelectedItem}
                        isLoading={isLoading}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="new" className="mt-0">
                    <div className="hidden md:block">
                      <RiskQueueDesktopTable 
                        items={data?.riskQueue.new || []} 
                        onSelectItem={setSelectedItem}
                        isLoading={isLoading}
                      />
                    </div>
                    <div className="md:hidden">
                      <RiskQueueMobileCards 
                        items={data?.riskQueue.new || []} 
                        onSelectItem={setSelectedItem}
                        isLoading={isLoading}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="resolved" className="mt-0">
                    <div className="hidden md:block">
                      <RiskQueueDesktopTable 
                        items={data?.riskQueue.resolved || []} 
                        onSelectItem={setSelectedItem}
                        isLoading={isLoading}
                      />
                    </div>
                    <div className="md:hidden">
                      <RiskQueueMobileCards 
                        items={data?.riskQueue.resolved || []} 
                        onSelectItem={setSelectedItem}
                        isLoading={isLoading}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <TelemetryCoverageCard 
              coverage={data?.telemetryCoverage} 
              isLoading={isLoading}
            />
            <ModelHealthCard 
              health={data?.modelHealth} 
              isLoading={isLoading}
            />
            <MaintenancePipelineCard 
              pipeline={data?.maintenancePipeline} 
              isLoading={isLoading}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wifi className="h-4 w-4" />
                Sensor Overview (Min/Avg/Max)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SensorTrendChart 
                trends={telemetryTrends} 
                isLoading={telemetryLoading} 
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Vibration & Temperature Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SensorTimeSeriesChart 
                trends={telemetryTrends} 
                isLoading={telemetryLoading} 
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <AssetDetailPanel 
        item={selectedItem} 
        onClose={() => setSelectedItem(null)} 
      />
      </>
      )}
    </div>
  );
}

```

### `client/src/pages/pdm-equipment-detail.tsx` (121 lines)

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MetricCard } from "@/components/shared/MetricCard";
import { SensorSetupWizard } from "@/components/sensors/SensorSetupWizard";
import { SensorHealthDashboard } from "@/components/sensors/SensorHealthDashboard";
import { MultiSensorChart } from "@/components/charts/MultiSensorChart";
import { LoadingState } from "@/components/patterns/LoadingState";
import { ErrorState } from "@/components/patterns/ErrorState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { BulkSelectionBar } from "@/components/ui/bulk-selection-bar";
import { ArrowLeft, Activity, Gauge, AlertTriangle, Wrench, FileText, Plus, Settings } from "lucide-react";
import { usePdmEquipmentDetailData, useOverviewTabData, useSensorsTabData, useAnomaliesTabData, useMaintenanceHistoryTabData, type EquipmentDetail, type PdmHealthData } from "@/features/analytics";
import { formatDate } from "@/lib/formatters";
import { PageHeader } from "@/components/navigation";

export default function PdmEquipmentDetail() {
  const { equipmentId, equipment, healthData, isLoadingEquipment, isLoadingHealth, equipmentError, healthError, handleBack, handleCreateWorkOrder, handleViewWorkOrders, retryEquipment, retryHealth, healthScore, healthStatus, rul, rulUncertainty, confidence } = usePdmEquipmentDetailData();

  if (isLoadingEquipment || isLoadingHealth) {return <div className="container mx-auto p-6"><LoadingState variant="card" /></div>;}
  if (equipmentError) {return <ErrorState error={equipmentError} title="Failed to load equipment details" variant="page" onRetry={retryEquipment} onBack={handleBack} />;}
  if (healthError) {return <ErrorState error={healthError} title="Failed to load equipment health data" variant="page" onRetry={retryHealth} onBack={handleBack} />;}
  if (!equipment) {return <ErrorState error={new Error("Equipment not found")} title="Equipment not found" variant="page" onBack={handleBack} />;}

  return (
    <div className="min-h-screen" data-testid="pdm-equipment-detail">
      <PageHeader title={equipment?.name || "Equipment Detail"} />
      <div className="container mx-auto p-6 space-y-6">
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-6 border">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3"><h1 className="text-3xl font-bold" data-testid="text-equipment-name">{equipment.name}</h1><Badge variant="outline" data-testid="badge-equipment-type">{equipment.type}</Badge></div>
            {equipment.vesselName && <p className="text-muted-foreground" data-testid="text-vessel-name">Vessel: {equipment.vesselName}</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            <Card className="min-w-[140px]"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Health Score</p><p className="text-2xl font-bold" data-testid="text-health-score">{healthScore}</p></div><StatusBadge status={healthStatus} /></div></CardContent></Card>
            <Card className="min-w-[140px]"><CardContent className="p-4"><div><p className="text-xs text-muted-foreground">Remaining Life</p>{rul !== null ? (<><p className="text-2xl font-bold" data-testid="text-rul">{rul < 72 ? `${rul}h` : `${Math.round(rul / 24)}d`}</p>{rulUncertainty && <p className="text-xs text-muted-foreground">±{rulUncertainty < 24 ? `${rulUncertainty}h` : `${Math.round(rulUncertainty / 24)}d`}</p>}</>) : <p className="text-2xl font-bold text-muted-foreground" data-testid="text-rul">N/A</p>}<p className="text-xs text-muted-foreground capitalize">{confidence} confidence</p></div></CardContent></Card>
            <div className="flex gap-2"><Button onClick={handleViewWorkOrders} variant="outline" data-testid="button-view-work-orders"><FileText className="h-4 w-4 mr-2" />Work Orders</Button><Button onClick={handleCreateWorkOrder} data-testid="button-create-work-order"><Plus className="h-4 w-4 mr-2" />Create Work Order</Button></div>
          </div>
        </div>
      </div>
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview"><Activity className="h-4 w-4 mr-2" />Overview</TabsTrigger>
          <TabsTrigger value="sensors" data-testid="tab-sensors"><Gauge className="h-4 w-4 mr-2" />Sensors</TabsTrigger>
          <TabsTrigger value="anomalies" data-testid="tab-anomalies"><AlertTriangle className="h-4 w-4 mr-2" />Anomalies & AI</TabsTrigger>
          <TabsTrigger value="maintenance" data-testid="tab-maintenance"><Wrench className="h-4 w-4 mr-2" />Maintenance History</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-6"><OverviewTab equipmentId={equipmentId} equipment={equipment} healthData={healthData} /></TabsContent>
        <TabsContent value="sensors" className="space-y-6"><SensorsTab equipmentId={equipmentId} /></TabsContent>
        <TabsContent value="anomalies" className="space-y-6"><AnomaliesTab equipmentId={equipmentId} /></TabsContent>
        <TabsContent value="maintenance" className="space-y-6"><MaintenanceHistoryTab equipmentId={equipmentId} /></TabsContent>
      </Tabs>
      </div>
    </div>
  );
}

function OverviewTab({ equipmentId, equipment, healthData }: { equipmentId: string; equipment: EquipmentDetail; healthData?: PdmHealthData }) {
  const { timeRange, setTimeRange, sensorData, isLoadingTelemetry, defaultSummary } = useOverviewTabData(equipmentId, healthData);
  return (
    <div className="space-y-6">
      <div><h2 className="text-lg font-semibold mb-4">Sensor Health Overview</h2><SensorHealthDashboard equipmentId={equipmentId} /></div>
      <MultiSensorChart title="Sensor Correlation Analysis" description="Compare multiple sensor readings to identify correlations and anomalies" sensors={sensorData} timeRange={timeRange} onTimeRangeChange={setTimeRange} isLoading={isLoadingTelemetry} data-testid="chart-sensor-correlation" />
      <Card><CardHeader><CardTitle>AI Summary</CardTitle></CardHeader><CardContent><p className="text-muted-foreground" data-testid="text-ai-summary">{defaultSummary}</p>{healthData?.lastUpdated && <p className="text-xs text-muted-foreground mt-2">Last updated: {formatDate(healthData.lastUpdated)}</p>}</CardContent></Card>
      <div><h3 className="text-lg font-semibold mb-4">Key Metrics</h3><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"><MetricCard label="Health Score" value={healthData?.healthScore ?? 0} unit="%" status={healthData?.status ?? "unknown"} normalizedValue={healthData?.healthScore ?? 0} /><MetricCard label="Failure Probability" value={healthData?.pFail30d ?? 0} unit="%" status={(healthData?.pFail30d ?? 0) > 70 ? "critical" : (healthData?.pFail30d ?? 0) > 40 ? "warning" : "normal"} /><MetricCard label="Equipment Type" value={equipment.type} status="normal" /><MetricCard label="Status" value={equipment.isActive ? "Active" : "Inactive"} status={equipment.isActive ? "normal" : "warning"} /></div></div>
      <Card><CardHeader><CardTitle>Risk Factors</CardTitle></CardHeader><CardContent>{healthData?.pFail30d > 40 ? (<div className="space-y-2"><p className="text-sm font-medium">Elevated failure probability detected ({healthData.pFail30d.toFixed(1)}%)</p><ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">{healthData.pFail30d > 70 && <li>Critical failure risk within 30 days</li>}{healthData.healthScore < 50 && <li>Low health score indicates degradation</li>}{healthData.status === "critical" && <li>Equipment requires immediate attention</li>}</ul></div>) : <p className="text-sm text-muted-foreground">No significant risk factors detected at this time.</p>}</CardContent></Card>
    </div>
  );
}

function SensorsTab({ equipmentId }: { equipmentId: string }) {
  const { isWizardOpen, setIsWizardOpen, selectedSensorIds, deleteDialogOpen, setDeleteDialogOpen, sensorConfigs, equipment, isLoading, deleteMutation: _deleteMutation, enableMutation, disableMutation, handleWizardSuccess, handleSelectAll, handleSelectSensor, handleBulkDelete, confirmDelete, selectedSensors, isBulkOperationDisabled } = useSensorsTabData(equipmentId);
  if (isLoading) {return <LoadingState variant="card" />;}
  return (
    <>
      <Card>
        <CardHeader><div className="flex items-center justify-between"><CardTitle>Active Sensors</CardTitle><Button onClick={() => setIsWizardOpen(true)} variant="default" size="sm" data-testid="button-configure-sensors"><Settings className="h-4 w-4 mr-2" />Configure Sensors</Button></div></CardHeader>
        <CardContent>
          {sensorConfigs?.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead className="w-12"><Checkbox checked={selectedSensorIds.length === sensorConfigs.length && sensorConfigs.length > 0} onCheckedChange={handleSelectAll} disabled={isBulkOperationDisabled} data-testid="checkbox-select-all" /></TableHead><TableHead>Sensor Type</TableHead><TableHead>Target Unit</TableHead><TableHead>Status</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                <TableBody>{sensorConfigs.map((sensor) => (<TableRow key={sensor.id} data-testid={`sensor-row-${sensor.sensorType}`}><TableCell><Checkbox checked={selectedSensorIds.includes(sensor.id)} onCheckedChange={(checked) => handleSelectSensor(sensor.id, checked as boolean)} disabled={isBulkOperationDisabled} data-testid={`checkbox-sensor-${sensor.sensorType}`} /></TableCell><TableCell className="font-medium">{sensor.sensorType}</TableCell><TableCell>{sensor.targetUnit || sensor.unit || "N/A"}</TableCell><TableCell><StatusBadge status={sensor.enabled === false ? "offline" : "online"} /></TableCell><TableCell className="text-sm text-muted-foreground">{sensor.notes || "-"}</TableCell></TableRow>))}</TableBody>
              </Table>
            </div>
          ) : <div className="text-center py-8"><Gauge className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" /><p className="text-muted-foreground">No sensors configured for this equipment.</p><p className="text-sm text-muted-foreground mt-2">Click "Configure Sensors" to set up sensor monitoring.</p></div>}
        </CardContent>
      </Card>
      {equipment && <SensorSetupWizard open={isWizardOpen} onClose={() => setIsWizardOpen(false)} equipment={{ id: equipment.id, name: equipment.name, type: equipment.type, status: equipment.status || (equipment.isActive ? "active" : "inactive"), location: equipment.location || "Unknown" }} onSuccess={handleWizardSuccess} />}
      <BulkSelectionBar selectedCount={selectedSensorIds.length} onDelete={isBulkOperationDisabled ? undefined : handleBulkDelete} onEnable={isBulkOperationDisabled ? undefined : () => enableMutation.mutate(selectedSensorIds)} onDisable={isBulkOperationDisabled ? undefined : () => disableMutation.mutate(selectedSensorIds)} onClear={() => {}} />
      <ConfirmDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={confirmDelete} title="Delete sensors" description={<div className="space-y-2"><p>Are you sure you want to delete {selectedSensors.length} {selectedSensors.length === 1 ? "sensor" : "sensors"}? This action cannot be undone.</p><div className="mt-3 p-3 bg-muted rounded-md"><p className="text-sm font-medium mb-2">Sensors to be deleted:</p><ul className="text-sm space-y-1">{selectedSensors.map((sensor) => (<li key={sensor.id} className="flex items-center gap-2"><span className="font-mono text-xs">{sensor.sensorType}</span><span className="text-muted-foreground">({sensor.targetUnit || sensor.unit})</span></li>))}</ul></div></div>} confirmText="Delete" cancelText="Cancel" />
    </>
  );
}

function AnomaliesTab({ equipmentId }: { equipmentId: string }) {
  const { anomalies, isLoading } = useAnomaliesTabData(equipmentId);
  if (isLoading) {return <LoadingState variant="card" />;}
  return (
    <Card>
      <CardHeader><CardTitle>Anomaly Detections</CardTitle></CardHeader>
      <CardContent>{anomalies?.length > 0 ? (<div className="space-y-3">{anomalies.map((anomaly) => (<div key={anomaly.id} className="p-4 border rounded-lg space-y-2"><div className="flex items-center justify-between"><p className="font-medium">{anomaly.sensorKind}</p><StatusBadge status={anomaly.severity || "info"} /></div><p className="text-sm text-muted-foreground">{anomaly.description || "Anomaly detected"}</p></div>))}</div>) : <p className="text-muted-foreground">No anomalies detected for this equipment.</p>}</CardContent>
    </Card>
  );
}

function MaintenanceHistoryTab({ equipmentId }: { equipmentId: string }) {
  const { workOrders, isLoading } = useMaintenanceHistoryTabData(equipmentId);
  if (isLoading) {return <LoadingState variant="card" />;}
  return (
    <Card>
      <CardHeader><CardTitle>Work Order History</CardTitle></CardHeader>
      <CardContent>{workOrders?.length > 0 ? (<div className="space-y-3">{workOrders.map((wo) => (<div key={wo.id} className="p-4 border rounded-lg space-y-2"><div className="flex items-center justify-between"><p className="font-medium">{wo.reason || wo.description}</p><StatusBadge status={wo.status || "pending"} /></div><p className="text-sm text-muted-foreground">Type: {wo.maintenanceType}</p></div>))}</div>) : <p className="text-muted-foreground">No maintenance history for this equipment.</p>}</CardContent>
    </Card>
  );
}

```

### `client/src/pages/pdm-platform.tsx` (1117 lines)

```tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Database, BarChart3, Box, Zap, AlertTriangle, TrendingUp, TrendingDown, Minus, RefreshCw, ArrowUp, ArrowDown, CheckCircle2, Play, Upload, FlaskConical, FileBox, Shield, Eye, CheckCheck, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLatestFeatures, useComputeFeatures } from "@/features/pdm/hooks/use-feature-store";
import { useFleetBaselines, useFleetComparison, useComputeBaselines } from "@/features/pdm/hooks/use-fleet-analytics";
import { useModels, useModelVersions, useActiveDeployment } from "@/features/pdm/hooks/use-model-registry";
import { useRunInference, usePredictionExplanations } from "@/features/pdm/hooks/use-inference";
import { useModelDrift, useComputeDrift } from "@/features/pdm/hooks/use-model-monitoring";
import { useTrainingDatasets, useTrainingRuns, useCreateDataset, useStartTrainingRun, usePromoteRun, useTrainingArtifacts } from "@/features/ml-ai/hooks/useTrainingPipeline";
import { usePredictionGovernance, useGovernanceDetail, useReviewPrediction, useApprovePrediction, useSuppressPrediction } from "@/features/pdm/hooks/usePredictionGovernance";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

function FeatureStoreTab() {
  const [equipmentId, setEquipmentId] = useState("");
  const { data: features, isLoading, refetch } = useLatestFeatures(equipmentId);
  const computeMutation = useComputeFeatures();
  const { toast } = useToast();

  const handleCompute = async () => {
    if (!equipmentId) return;
    try {
      await computeMutation.mutateAsync({ equipmentId });
      toast({ title: "Features computed successfully" });
      refetch();
    } catch {
      toast({ title: "Failed to compute features", variant: "destructive" });
    }
  };

  const hasFeatures = features && !features.message;
  const sampleCount = hasFeatures ? features.sampleCount : 0;
  const dataSource = sampleCount > 0 ? "telemetry" : "stub";

  const featureEntries = hasFeatures ? [
    { name: "Mean Temperature", value: features.meanTemp, unit: "°C" },
    { name: "Std Temperature", value: features.stdTemp, unit: "°C" },
    { name: "Mean Vibration", value: features.meanVibration, unit: "mm/s" },
    { name: "Std Vibration", value: features.stdVibration, unit: "mm/s" },
    { name: "Mean Pressure", value: features.meanPressure, unit: "bar" },
    { name: "Std Pressure", value: features.stdPressure, unit: "bar" },
    { name: "RMS Vibration", value: features.rmsVibration, unit: "mm/s" },
    { name: "Peak-to-Peak", value: features.peakToPeak, unit: "mm/s" },
    { name: "Kurtosis", value: features.kurtosis, unit: "" },
    { name: "Skewness", value: features.skewness, unit: "" },
  ] : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          data-testid="input-equipment-id-features"
          type="text"
          placeholder="Enter equipment ID"
          value={equipmentId}
          onChange={(e) => setEquipmentId(e.target.value)}
          className="flex h-10 w-72 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <Button data-testid="button-compute-features" onClick={handleCompute} disabled={!equipmentId || computeMutation.isPending}>
          {computeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Compute Features
        </Button>
      </div>

      {isLoading && <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading features...</div>}

      {featureEntries.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle data-testid="text-features-title" className="text-lg">Latest Equipment Features</CardTitle>
                <CardDescription>Window: {features.windowMinutes ?? 60} min | Samples: {sampleCount}</CardDescription>
              </div>
              <Badge
                data-testid="badge-data-source"
                variant={dataSource === "telemetry" ? "default" : "secondary"}
              >
                {dataSource === "telemetry" ? "Live Telemetry" : "Estimated"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {featureEntries.map((f) => (
                <div key={f.name} className="p-3 rounded-lg border bg-muted/50">
                  <div className="text-xs text-muted-foreground">{f.name}</div>
                  <div className="text-lg font-semibold" data-testid={`text-feature-${f.name.toLowerCase().replace(/\s/g, '-')}`}>
                    {f.value != null ? Number(f.value).toFixed(2) : "—"} <span className="text-xs text-muted-foreground">{f.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {equipmentId && !isLoading && featureEntries.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No features computed yet. Click "Compute Features" to start.</CardContent></Card>
      )}
    </div>
  );
}

function FleetAnalyticsTab() {
  const [equipmentType, setEquipmentType] = useState("engine");
  const [equipmentId, setEquipmentId] = useState("");
  const { data: baselines, isLoading: baselinesLoading } = useFleetBaselines(equipmentType);
  const { data: comparison, isLoading: comparisonLoading } = useFleetComparison(equipmentId, equipmentType);
  const computeMutation = useComputeBaselines();
  const { toast } = useToast();

  const statusColor = (status: string) => status === "critical" ? "destructive" : status === "warning" ? "secondary" : "default";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input data-testid="input-equipment-type" type="text" placeholder="Equipment type" value={equipmentType} onChange={(e) => setEquipmentType(e.target.value)} className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <Button data-testid="button-compute-baselines" onClick={() => computeMutation.mutateAsync(equipmentType).then(() => toast({ title: "Baselines computed from feature records" })).catch(() => toast({ title: "Failed to compute baselines", variant: "destructive" }))} disabled={!equipmentType || computeMutation.isPending}>
          {computeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Compute Baselines
        </Button>
        <input data-testid="input-equipment-id-compare" type="text" placeholder="Equipment ID for comparison" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} className="flex h-10 w-72 rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>

      {baselinesLoading && <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading baselines...</div>}

      {Array.isArray(baselines) && baselines.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Fleet Baselines: {equipmentType}</CardTitle><CardDescription>{baselines[0]?.sampleSize ?? 0} source records</CardDescription></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left p-2">Feature</th><th className="text-right p-2">Mean</th><th className="text-right p-2">Std Dev</th><th className="text-right p-2">P5</th><th className="text-right p-2">P95</th><th className="text-right p-2">Samples</th></tr></thead>
                <tbody>{baselines.map((b: any) => (
                  <tr key={b.id} className="border-b" data-testid={`row-baseline-${b.featureName}`}>
                    <td className="p-2 font-medium">{b.featureName}</td>
                    <td className="p-2 text-right">{b.mean?.toFixed(2)}</td>
                    <td className="p-2 text-right">{b.stddev?.toFixed(2)}</td>
                    <td className="p-2 text-right">{b.p5?.toFixed(2)}</td>
                    <td className="p-2 text-right">{b.p95?.toFixed(2)}</td>
                    <td className="p-2 text-right">{b.sampleSize}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {Array.isArray(comparison) && comparison.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Fleet Comparison</CardTitle><CardDescription>Equipment vs fleet average with z-scores and percentiles</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {comparison.map((c: any) => (
                <div key={c.featureName} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`row-comparison-${c.featureName}`}>
                  <div className="font-medium w-32">{c.featureName}</div>
                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    <span className="font-mono">{c.equipmentValue?.toFixed(2)}</span>
                    <span className="text-muted-foreground">Fleet: {c.fleetMean?.toFixed(2)} ± {c.fleetStddev?.toFixed(2)}</span>
                    <span className="font-mono">Z: {c.zScore?.toFixed(2)}</span>
                    <span className="text-muted-foreground">P{c.percentile?.toFixed(0)}</span>
                    <span className="flex items-center gap-1">
                      {c.aboveFleetAvg ? <ArrowUp className="w-3 h-3 text-orange-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />}
                      <span className="text-xs">{c.aboveFleetAvg ? "Above" : "Below"}</span>
                    </span>
                    <Badge variant={statusColor(c.status)}>{c.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ModelRegistryTab() {
  const { data: models, isLoading } = useModels();
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const { data: versions } = useModelVersions(selectedModelId ?? "");
  const { data: deployment } = useActiveDeployment(selectedModelId ?? "");

  return (
    <div className="space-y-4">
      {isLoading && <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading models...</div>}

      {Array.isArray(models) && models.length > 0 ? (
        <div className="grid gap-3">
          {models.map((m: any) => (
            <Card key={m.id} className={`cursor-pointer transition-colors ${selectedModelId === m.id ? 'ring-2 ring-primary' : ''}`} onClick={() => setSelectedModelId(m.id)} data-testid={`card-model-${m.id}`}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{m.name}</div>
                  <div className="text-sm text-muted-foreground">{m.type} • {m.equipmentType || "all"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={m.status === "deployed" ? "default" : "secondary"}>{m.status}</Badge>
                  {m.accuracy && <span className="text-sm">Acc: {parseFloat(m.accuracy).toFixed(1)}%</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No models registered yet.</CardContent></Card>
      ) : null}

      {selectedModelId && Array.isArray(versions) && versions.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Versions</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {versions.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`row-version-${v.id}`}>
                  <div>
                    <span className="font-medium">v{v.version}</span>
                    <span className="text-sm text-muted-foreground ml-2">{v.artifactPath || "no artifact"}</span>
                    {v.trainingDataPoints && <span className="text-xs text-muted-foreground ml-2">({v.trainingDataPoints} training pts)</span>}
                  </div>
                  <Badge variant={v.status === "production" ? "default" : "secondary"}>{v.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedModelId && deployment && !deployment.message && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Active Deployment</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-muted-foreground">Target:</span> {deployment.deploymentTarget}</div>
              <div><span className="text-muted-foreground">Status:</span> <Badge>{deployment.deploymentStatus}</Badge></div>
              <div><span className="text-muted-foreground">Traffic:</span> {deployment.trafficPercentage}%</div>
              <div><span className="text-muted-foreground">Deployed:</span> {new Date(deployment.deployedAt).toLocaleDateString()}</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InferenceTab() {
  const [equipmentId, setEquipmentId] = useState("");
  const [lastPredictionId, setLastPredictionId] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const inferenceMutation = useRunInference();
  const { data: explanations } = usePredictionExplanations(lastPredictionId);
  const { toast } = useToast();

  const handleInference = async () => {
    if (!equipmentId) return;
    try {
      const result = await inferenceMutation.mutateAsync({ equipmentId });
      setLastResult(result);
      if (result.inferenceRun?.predictionId) setLastPredictionId(result.inferenceRun.predictionId);
      toast({ title: "Inference completed" });
    } catch {
      toast({ title: "Inference failed", variant: "destructive" });
    }
  };

  const riskColor = (level: string) => level === "critical" ? "destructive" : level === "high" ? "secondary" : "default";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input data-testid="input-equipment-id-inference" type="text" placeholder="Equipment ID" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} className="flex h-10 w-72 rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <Button data-testid="button-run-inference" onClick={handleInference} disabled={!equipmentId || inferenceMutation.isPending}>
          {inferenceMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
          Run Inference
        </Button>
      </div>

      {lastResult?.prediction && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Prediction Result</CardTitle>
              <Badge variant="outline" className="text-xs">
                {lastResult.inferenceRun?.status === "completed" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : null}
                {lastResult.inferenceRun?.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg border bg-muted/50">
                <div className="text-xs text-muted-foreground">Failure Probability</div>
                <div className="text-2xl font-bold" data-testid="text-failure-probability">{(lastResult.prediction.failureProbability * 100).toFixed(1)}%</div>
              </div>
              <div className="p-3 rounded-lg border bg-muted/50">
                <div className="text-xs text-muted-foreground">Risk Level</div>
                <Badge variant={riskColor(lastResult.prediction.riskLevel)} data-testid="text-risk-level" className="mt-1">{lastResult.prediction.riskLevel}</Badge>
              </div>
              <div className="p-3 rounded-lg border bg-muted/50">
                <div className="text-xs text-muted-foreground">Remaining Useful Life</div>
                <div className="text-2xl font-bold" data-testid="text-rul">{lastResult.prediction.remainingUsefulLife}d</div>
              </div>
              <div className="p-3 rounded-lg border bg-muted/50">
                <div className="text-xs text-muted-foreground">Latency</div>
                <div className="text-2xl font-bold">{lastResult.inferenceRun?.latencyMs}ms</div>
              </div>
            </div>
            {lastResult.prediction.recommendations?.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-medium mb-2">Recommendations:</div>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  {lastResult.prediction.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {Array.isArray(explanations) && explanations.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Prediction Explanations</CardTitle><CardDescription>Feature contributions to prediction — normalized importance with deviation direction</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {explanations.map((e: any) => (
                <div key={e.id} className="flex items-center gap-3 p-2 rounded border" data-testid={`row-explanation-${e.featureName}`}>
                  <div className="w-32 font-medium text-sm">{e.featureName}</div>
                  <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                    <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${e.importance * 100}%` }} />
                  </div>
                  <div className="text-sm text-right w-16">{(e.importance * 100).toFixed(1)}%</div>
                  <div className="text-sm text-muted-foreground w-24 text-right">
                    {e.featureValue?.toFixed(2)} <span className="text-xs">/ {e.baselineValue?.toFixed(2)}</span>
                  </div>
                  {e.direction === "increasing" ? <TrendingUp className="w-4 h-4 text-red-500" /> : e.direction === "decreasing" ? <TrendingDown className="w-4 h-4 text-blue-500" /> : <Minus className="w-4 h-4 text-muted-foreground" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DriftMonitoringTab() {
  const [modelVersionId, setModelVersionId] = useState("");
  const { data: driftMetrics, isLoading } = useModelDrift(modelVersionId);
  const computeMutation = useComputeDrift();
  const { toast } = useToast();

  const driftedCount = Array.isArray(driftMetrics) ? driftMetrics.filter((d: any) => d.driftDetected).length : 0;
  const totalCount = Array.isArray(driftMetrics) ? driftMetrics.length : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input data-testid="input-model-version-id" type="text" placeholder="Model Version ID" value={modelVersionId} onChange={(e) => setModelVersionId(e.target.value)} className="flex h-10 w-72 rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <Button data-testid="button-compute-drift" onClick={() => computeMutation.mutateAsync({ modelVersionId }).then(() => toast({ title: "Drift computed (normalized mean shift)" })).catch(() => toast({ title: "Failed to compute drift", variant: "destructive" }))} disabled={!modelVersionId || computeMutation.isPending}>
          {computeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Compute Drift
        </Button>
      </div>

      {isLoading && <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading drift metrics...</div>}

      {totalCount > 0 && (
        <>
          <div className="flex items-center gap-3">
            <Badge variant={driftedCount > 0 ? "destructive" : "default"} data-testid="badge-drift-summary">
              {driftedCount}/{totalCount} features drifted
            </Badge>
            <span className="text-xs text-muted-foreground">Method: normalized mean shift (|μ_live - μ_train| / σ_train) &gt; 2.0</span>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-lg">Drift Metrics</CardTitle><CardDescription>Feature distribution shifts — training vs live</CardDescription></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left p-2">Feature</th><th className="text-right p-2">Training μ</th><th className="text-right p-2">Training σ</th><th className="text-right p-2">Live μ</th><th className="text-right p-2">Live σ</th><th className="text-right p-2">Drift Score</th><th className="text-center p-2">Status</th></tr></thead>
                  <tbody>{driftMetrics.map((d: any) => (
                    <tr key={d.id} className="border-b" data-testid={`row-drift-${d.featureName}`}>
                      <td className="p-2 font-medium">{d.featureName}</td>
                      <td className="p-2 text-right font-mono">{d.trainingMean?.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono text-muted-foreground">{d.trainingStd?.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">{d.liveMean?.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono text-muted-foreground">{d.liveStd?.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono font-semibold">{d.driftScore?.toFixed(2)}</td>
                      <td className="p-2 text-center">
                        <Badge variant={d.driftDetected ? "destructive" : "default"}>{d.driftDetected ? "DRIFT" : "OK"}</Badge>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ArtifactsViewer({ modelVersionId }: { modelVersionId: string }) {
  const { data: artifacts, isLoading } = useTrainingArtifacts(modelVersionId);

  if (isLoading) return <div className="flex items-center gap-2 py-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading artifacts...</div>;
  if (!Array.isArray(artifacts) || artifacts.length === 0) return <div className="text-sm text-muted-foreground py-2">No artifacts found.</div>;

  return (
    <div className="space-y-2">
      {artifacts.map((a: any) => (
        <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`row-artifact-${a.id}`}>
          <div className="flex items-center gap-2">
            <FileBox className="w-4 h-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">{a.artifactType}</div>
              <div className="text-xs text-muted-foreground">{a.framework} / {a.format}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {a.sizeBytes && <span>{(a.sizeBytes / 1024).toFixed(1)} KB</span>}
            {a.checksum && <span className="font-mono text-xs">{a.checksum.substring(0, 12)}...</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function TrainingPipelineTab() {
  const { data: datasets, isLoading: datasetsLoading, error: datasetsError } = useTrainingDatasets();
  const { data: runs, isLoading: runsLoading, error: runsError } = useTrainingRuns();
  const createDatasetMutation = useCreateDataset();
  const startRunMutation = useStartTrainingRun();
  const promoteMutation = usePromoteRun();
  const { toast } = useToast();

  const [showCreateDataset, setShowCreateDataset] = useState(false);
  const [showStartRun, setShowStartRun] = useState(false);
  const [showPromote, setShowPromote] = useState<string | null>(null);
  const [expandedRunArtifact, setExpandedRunArtifact] = useState<string | null>(null);

  const [datasetForm, setDatasetForm] = useState({ name: "", sourceType: "telemetry", description: "", labelColumn: "", targetType: "failure_prediction", rowCount: "" });
  const [runForm, setRunForm] = useState({ datasetId: "", learningRate: "0.001", epochs: "100", batchSize: "32" });
  const [promoteForm, setPromoteForm] = useState({ modelId: "", version: "", changelog: "" });

  const handleCreateDataset = async () => {
    if (!datasetForm.name || !datasetForm.sourceType) return;
    try {
      await createDatasetMutation.mutateAsync({
        name: datasetForm.name,
        sourceType: datasetForm.sourceType,
        description: datasetForm.description || undefined,
        labelColumn: datasetForm.labelColumn || undefined,
        targetType: datasetForm.targetType || undefined,
        rowCount: datasetForm.rowCount ? parseInt(datasetForm.rowCount) : undefined,
      });
      toast({ title: "Dataset created successfully" });
      setShowCreateDataset(false);
      setDatasetForm({ name: "", sourceType: "telemetry", description: "", labelColumn: "", targetType: "failure_prediction", rowCount: "" });
    } catch {
      toast({ title: "Failed to create dataset", variant: "destructive" });
    }
  };

  const handleStartRun = async () => {
    if (!runForm.datasetId) return;
    try {
      await startRunMutation.mutateAsync({
        datasetId: runForm.datasetId,
        hyperparameters: {
          learningRate: parseFloat(runForm.learningRate),
          epochs: parseInt(runForm.epochs),
          batchSize: parseInt(runForm.batchSize),
        },
      });
      toast({ title: "Training run started" });
      setShowStartRun(false);
      setRunForm({ datasetId: "", learningRate: "0.001", epochs: "100", batchSize: "32" });
    } catch {
      toast({ title: "Failed to start training run", variant: "destructive" });
    }
  };

  const handlePromote = async (runId: string) => {
    if (!promoteForm.modelId || !promoteForm.version) return;
    try {
      await promoteMutation.mutateAsync({
        runId,
        modelId: promoteForm.modelId,
        version: promoteForm.version,
        changelog: promoteForm.changelog || undefined,
      });
      toast({ title: "Model version promoted successfully" });
      setShowPromote(null);
      setPromoteForm({ modelId: "", version: "", changelog: "" });
    } catch {
      toast({ title: "Failed to promote model version", variant: "destructive" });
    }
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case "completed": return "default" as const;
      case "running": return "secondary" as const;
      case "failed": return "destructive" as const;
      default: return "outline" as const;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-lg" data-testid="text-datasets-title">Training Datasets</CardTitle>
              <CardDescription>Manage datasets for model training</CardDescription>
            </div>
            <Button data-testid="button-create-dataset" onClick={() => setShowCreateDataset(true)}>
              <Database className="w-4 h-4 mr-2" />
              New Dataset
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {datasetsLoading && <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading datasets...</div>}
          {datasetsError && <div className="text-destructive text-sm" data-testid="text-datasets-error">Failed to load datasets</div>}
          {!datasetsLoading && Array.isArray(datasets) && datasets.length === 0 && (
            <div className="py-8 text-center text-muted-foreground" data-testid="text-datasets-empty">No datasets created yet. Click "New Dataset" to get started.</div>
          )}
          {Array.isArray(datasets) && datasets.length > 0 && (
            <div className="space-y-2">
              {datasets.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`row-dataset-${d.id}`}>
                  <div>
                    <div className="font-medium" data-testid={`text-dataset-name-${d.id}`}>{d.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {d.sourceType} {d.rowCount ? `| ${d.rowCount.toLocaleString()} rows` : ""} | Created {new Date(d.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge variant={statusVariant(d.status)} data-testid={`badge-dataset-status-${d.id}`}>{d.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-lg" data-testid="text-runs-title">Training Runs</CardTitle>
              <CardDescription>Track model training runs, metrics, and promotions</CardDescription>
            </div>
            <Button data-testid="button-start-run" onClick={() => setShowStartRun(true)}>
              <Play className="w-4 h-4 mr-2" />
              Start New Run
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {runsLoading && <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading runs...</div>}
          {runsError && <div className="text-destructive text-sm" data-testid="text-runs-error">Failed to load training runs</div>}
          {!runsLoading && Array.isArray(runs) && runs.length === 0 && (
            <div className="py-8 text-center text-muted-foreground" data-testid="text-runs-empty">No training runs yet. Start a new run to begin training.</div>
          )}
          {Array.isArray(runs) && runs.length > 0 && (
            <div className="space-y-3">
              {runs.map((r: any) => {
                const metrics = r.metrics as Record<string, number> | null;
                const hyperparams = r.hyperparameters as Record<string, unknown> | null;
                return (
                  <Card key={r.id} data-testid={`card-run-${r.id}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <div className="font-medium text-sm">Run {r.id.substring(0, 8)}...</div>
                          <div className="text-xs text-muted-foreground">
                            Dataset: {r.datasetId?.substring(0, 8)}...
                            {r.startedAt && ` | Started: ${new Date(r.startedAt).toLocaleString()}`}
                            {r.finishedAt && ` | Finished: ${new Date(r.finishedAt).toLocaleString()}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={statusVariant(r.status)} data-testid={`badge-run-status-${r.id}`}>{r.status}</Badge>
                          {r.status === "completed" && (
                            <Button size="sm" variant="outline" data-testid={`button-promote-${r.id}`} onClick={() => setShowPromote(r.id)}>
                              <Upload className="w-3 h-3 mr-1" />
                              Promote
                            </Button>
                          )}
                          {r.modelVersionId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              data-testid={`button-artifacts-${r.id}`}
                              onClick={() => setExpandedRunArtifact(expandedRunArtifact === r.modelVersionId ? null : r.modelVersionId)}
                            >
                              <FileBox className="w-3 h-3 mr-1" />
                              Artifacts
                            </Button>
                          )}
                        </div>
                      </div>

                      {metrics && Object.keys(metrics).length > 0 && (
                        <div className="flex items-center gap-3 flex-wrap">
                          {Object.entries(metrics).map(([key, val]) => (
                            <div key={key} className="text-xs px-2 py-1 rounded-md bg-muted">
                              <span className="text-muted-foreground">{key}:</span>{" "}
                              <span className="font-mono font-medium" data-testid={`text-metric-${key}-${r.id}`}>
                                {typeof val === "number" ? val.toFixed(4) : String(val)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {hyperparams && Object.keys(hyperparams).length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                          {Object.entries(hyperparams).map(([key, val]) => (
                            <span key={key}>{key}: {String(val)}</span>
                          ))}
                        </div>
                      )}

                      {r.errorMessage && (
                        <div className="text-sm text-destructive" data-testid={`text-error-${r.id}`}>{r.errorMessage}</div>
                      )}

                      {expandedRunArtifact === r.modelVersionId && r.modelVersionId && (
                        <ArtifactsViewer modelVersionId={r.modelVersionId} />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDataset} onOpenChange={setShowCreateDataset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Training Dataset</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Name</label>
              <input
                data-testid="input-dataset-name"
                type="text"
                value={datasetForm.name}
                onChange={(e) => setDatasetForm({ ...datasetForm, name: e.target.value })}
                placeholder="e.g., Engine Telemetry Q4 2024"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Source Type</label>
              <input
                data-testid="input-dataset-source-type"
                type="text"
                value={datasetForm.sourceType}
                onChange={(e) => setDatasetForm({ ...datasetForm, sourceType: e.target.value })}
                placeholder="telemetry"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <input
                data-testid="input-dataset-description"
                type="text"
                value={datasetForm.description}
                onChange={(e) => setDatasetForm({ ...datasetForm, description: e.target.value })}
                placeholder="Optional description"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Label Column</label>
                <input
                  data-testid="input-dataset-label-column"
                  type="text"
                  value={datasetForm.labelColumn}
                  onChange={(e) => setDatasetForm({ ...datasetForm, labelColumn: e.target.value })}
                  placeholder="failure"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Row Count</label>
                <input
                  data-testid="input-dataset-row-count"
                  type="number"
                  value={datasetForm.rowCount}
                  onChange={(e) => setDatasetForm({ ...datasetForm, rowCount: e.target.value })}
                  placeholder="10000"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDataset(false)} data-testid="button-cancel-dataset">Cancel</Button>
            <Button onClick={handleCreateDataset} disabled={!datasetForm.name || !datasetForm.sourceType || createDatasetMutation.isPending} data-testid="button-submit-dataset">
              {createDatasetMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Create Dataset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showStartRun} onOpenChange={setShowStartRun}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Training Run</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Dataset ID</label>
              {Array.isArray(datasets) && datasets.length > 0 ? (
                <select
                  data-testid="select-run-dataset"
                  value={runForm.datasetId}
                  onChange={(e) => setRunForm({ ...runForm, datasetId: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                >
                  <option value="">Select a dataset</option>
                  {datasets.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.status})</option>
                  ))}
                </select>
              ) : (
                <input
                  data-testid="input-run-dataset-id"
                  type="text"
                  value={runForm.datasetId}
                  onChange={(e) => setRunForm({ ...runForm, datasetId: e.target.value })}
                  placeholder="Enter dataset ID"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                />
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Learning Rate</label>
                <input
                  data-testid="input-run-learning-rate"
                  type="text"
                  value={runForm.learningRate}
                  onChange={(e) => setRunForm({ ...runForm, learningRate: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Epochs</label>
                <input
                  data-testid="input-run-epochs"
                  type="text"
                  value={runForm.epochs}
                  onChange={(e) => setRunForm({ ...runForm, epochs: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Batch Size</label>
                <input
                  data-testid="input-run-batch-size"
                  type="text"
                  value={runForm.batchSize}
                  onChange={(e) => setRunForm({ ...runForm, batchSize: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartRun(false)} data-testid="button-cancel-run">Cancel</Button>
            <Button onClick={handleStartRun} disabled={!runForm.datasetId || startRunMutation.isPending} data-testid="button-submit-run">
              {startRunMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Start Training
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showPromote} onOpenChange={(open) => !open && setShowPromote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote to Model Version</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Model ID</label>
              <input
                data-testid="input-promote-model-id"
                type="text"
                value={promoteForm.modelId}
                onChange={(e) => setPromoteForm({ ...promoteForm, modelId: e.target.value })}
                placeholder="Target model ID"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Version</label>
              <input
                data-testid="input-promote-version"
                type="text"
                value={promoteForm.version}
                onChange={(e) => setPromoteForm({ ...promoteForm, version: e.target.value })}
                placeholder="e.g., 2.1.0"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Changelog</label>
              <input
                data-testid="input-promote-changelog"
                type="text"
                value={promoteForm.changelog}
                onChange={(e) => setPromoteForm({ ...promoteForm, changelog: e.target.value })}
                placeholder="Optional changelog notes"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPromote(null)} data-testid="button-cancel-promote">Cancel</Button>
            <Button onClick={() => showPromote && handlePromote(showPromote)} disabled={!promoteForm.modelId || !promoteForm.version || promoteMutation.isPending} data-testid="button-submit-promote">
              {promoteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Promote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GovernanceTab() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPredictionId, setSelectedPredictionId] = useState<number | null>(null);
  const [suppressDialogOpen, setSuppressDialogOpen] = useState(false);
  const [suppressTargetId, setSuppressTargetId] = useState<number | null>(null);
  const [suppressReason, setSuppressReason] = useState("");
  const { toast } = useToast();

  const queryStatus = statusFilter === "all" ? undefined : statusFilter;
  const { data: predictions, isLoading } = usePredictionGovernance(queryStatus);
  const { data: detail } = useGovernanceDetail(selectedPredictionId);
  const reviewMutation = useReviewPrediction();
  const approveMutation = useApprovePrediction();
  const suppressMutation = useSuppressPrediction();

  const statusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    if (status === "approved") return "default";
    if (status === "suppressed") return "destructive";
    if (status === "expired") return "outline";
    if (status === "reviewed") return "secondary";
    return "secondary";
  };

  const riskBadgeVariant = (level: string): "default" | "secondary" | "destructive" | "outline" => {
    if (level === "critical") return "destructive";
    if (level === "high") return "secondary";
    return "default";
  };

  const handleReview = async (id: number) => {
    try {
      await reviewMutation.mutateAsync({ id });
      toast({ title: "Prediction marked as reviewed" });
    } catch {
      toast({ title: "Failed to review prediction", variant: "destructive" });
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await approveMutation.mutateAsync({ id });
      toast({ title: "Prediction approved" });
    } catch {
      toast({ title: "Failed to approve prediction", variant: "destructive" });
    }
  };

  const handleSuppressOpen = (id: number) => {
    setSuppressTargetId(id);
    setSuppressReason("");
    setSuppressDialogOpen(true);
  };

  const handleSuppressConfirm = async () => {
    if (!suppressTargetId || !suppressReason.trim()) return;
    try {
      await suppressMutation.mutateAsync({ id: suppressTargetId, reason: suppressReason });
      toast({ title: "Prediction suppressed" });
      setSuppressDialogOpen(false);
      setSuppressTargetId(null);
      setSuppressReason("");
    } catch {
      toast({ title: "Failed to suppress prediction", variant: "destructive" });
    }
  };

  const predictionsList = Array.isArray(predictions) ? predictions : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter} data-testid="select-governance-status">
          <SelectTrigger className="w-48" data-testid="select-trigger-governance-status">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" data-testid="select-item-all">All Statuses</SelectItem>
            <SelectItem value="pending" data-testid="select-item-pending">Pending</SelectItem>
            <SelectItem value="reviewed" data-testid="select-item-reviewed">Reviewed</SelectItem>
            <SelectItem value="approved" data-testid="select-item-approved">Approved</SelectItem>
            <SelectItem value="suppressed" data-testid="select-item-suppressed">Suppressed</SelectItem>
            <SelectItem value="expired" data-testid="select-item-expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground" data-testid="text-governance-count">
          {predictionsList.length} prediction{predictionsList.length !== 1 ? "s" : ""}
        </span>
      </div>

      {isLoading && <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading governance predictions...</div>}

      {!isLoading && predictionsList.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No predictions found for the selected filter.</CardContent></Card>
      )}

      <div className="grid gap-3">
        {predictionsList.map((p: any) => (
          <Card key={p.id} className={`cursor-pointer transition-colors ${selectedPredictionId === p.id ? 'ring-2 ring-primary' : ''}`} onClick={() => setSelectedPredictionId(p.id)} data-testid={`card-governance-prediction-${p.id}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold" data-testid={`text-equipment-${p.id}`}>{p.equipmentId}</span>
                    <Badge variant={riskBadgeVariant(p.riskLevel)} data-testid={`badge-risk-${p.id}`}>{p.riskLevel}</Badge>
                    <Badge variant={statusBadgeVariant(p.reviewStatus || "pending")} data-testid={`badge-status-${p.id}`}>{p.reviewStatus || "pending"}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 flex items-center gap-4 flex-wrap">
                    <span>Probability: {((p.failureProbability ?? 0) * 100).toFixed(1)}%</span>
                    {p.remainingUsefulLife != null && <span>RUL: {p.remainingUsefulLife}d</span>}
                    {p.predictionValidUntil && <span>Valid until: {new Date(p.predictionValidUntil).toLocaleDateString()}</span>}
                    {p.modelVersionId && <span>Model: {p.modelVersionId.slice(0, 8)}</span>}
                    {p.featureSetVersion && <span>Features: {p.featureSetVersion}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(!p.reviewStatus || p.reviewStatus === "pending") && (
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleReview(p.id); }} disabled={reviewMutation.isPending} data-testid={`button-review-${p.id}`}>
                      <Eye className="w-4 h-4 mr-1" /> Review
                    </Button>
                  )}
                  {(p.reviewStatus === "pending" || p.reviewStatus === "reviewed") && (
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleApprove(p.id); }} disabled={approveMutation.isPending} data-testid={`button-approve-${p.id}`}>
                      <CheckCheck className="w-4 h-4 mr-1" /> Approve
                    </Button>
                  )}
                  {p.reviewStatus !== "suppressed" && (
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleSuppressOpen(p.id); }} data-testid={`button-suppress-${p.id}`}>
                      <XCircle className="w-4 h-4 mr-1" /> Suppress
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedPredictionId && detail && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg" data-testid="text-provenance-title">Provenance Details</CardTitle>
            <CardDescription>Full governance and provenance information for prediction #{selectedPredictionId}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Equipment</div>
                <div className="font-medium" data-testid="text-provenance-equipment">{detail.equipmentId}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Risk Level</div>
                <Badge variant={riskBadgeVariant(detail.riskLevel)} data-testid="text-provenance-risk">{detail.riskLevel}</Badge>
              </div>
              <div>
                <div className="text-muted-foreground">Review Status</div>
                <Badge variant={statusBadgeVariant(detail.reviewStatus || "pending")} data-testid="text-provenance-status">{detail.reviewStatus || "pending"}</Badge>
              </div>
              <div>
                <div className="text-muted-foreground">Failure Probability</div>
                <div className="font-medium">{((detail.failureProbability ?? 0) * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-muted-foreground">RUL</div>
                <div className="font-medium">{detail.remainingUsefulLife != null ? `${detail.remainingUsefulLife} days` : "N/A"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Prediction Date</div>
                <div className="font-medium">{detail.predictionTimestamp ? new Date(detail.predictionTimestamp).toLocaleString() : "N/A"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Valid Until</div>
                <div className="font-medium" data-testid="text-provenance-valid-until">{detail.predictionValidUntil ? new Date(detail.predictionValidUntil).toLocaleString() : "No expiry"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Model Version</div>
                <div className="font-medium" data-testid="text-provenance-model-version">{detail.modelVersionId || "N/A"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Feature Set Version</div>
                <div className="font-medium" data-testid="text-provenance-feature-set">{detail.featureSetVersion || "N/A"}</div>
              </div>
              {detail.reviewedBy && (
                <div>
                  <div className="text-muted-foreground">Reviewed By</div>
                  <div className="font-medium">{detail.reviewedBy}</div>
                </div>
              )}
              {detail.reviewedAt && (
                <div>
                  <div className="text-muted-foreground">Reviewed At</div>
                  <div className="font-medium">{new Date(detail.reviewedAt).toLocaleString()}</div>
                </div>
              )}
              {detail.suppressionReason && (
                <div className="col-span-2 md:col-span-3">
                  <div className="text-muted-foreground">Suppression Reason</div>
                  <div className="font-medium">{detail.suppressionReason}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={suppressDialogOpen} onOpenChange={setSuppressDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suppress Prediction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Provide a reason for suppressing prediction #{suppressTargetId}. This action will mark the prediction as suppressed and remove it from active monitoring.
            </div>
            <Textarea
              data-testid="input-suppress-reason"
              placeholder="Enter suppression reason..."
              value={suppressReason}
              onChange={(e) => setSuppressReason(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuppressDialogOpen(false)} data-testid="button-suppress-cancel">Cancel</Button>
            <Button onClick={handleSuppressConfirm} disabled={!suppressReason.trim() || suppressMutation.isPending} data-testid="button-suppress-confirm">
              {suppressMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Suppress
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PdmPlatformPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-pdm-platform-title">PdM Platform</h1>
        <p className="text-muted-foreground">Feature Store, Fleet Analytics, Model Registry, Training Pipeline, Inference, Monitoring, and Governance</p>
      </div>

      <Tabs defaultValue="features" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="features" data-testid="tab-features"><Database className="w-4 h-4 mr-1" /> Features</TabsTrigger>
          <TabsTrigger value="fleet" data-testid="tab-fleet"><BarChart3 className="w-4 h-4 mr-1" /> Fleet</TabsTrigger>
          <TabsTrigger value="models" data-testid="tab-models"><Box className="w-4 h-4 mr-1" /> Models</TabsTrigger>
          <TabsTrigger value="training" data-testid="tab-training"><FlaskConical className="w-4 h-4 mr-1" /> Training</TabsTrigger>
          <TabsTrigger value="inference" data-testid="tab-inference"><Zap className="w-4 h-4 mr-1" /> Inference</TabsTrigger>
          <TabsTrigger value="drift" data-testid="tab-drift"><AlertTriangle className="w-4 h-4 mr-1" /> Drift</TabsTrigger>
          <TabsTrigger value="governance" data-testid="tab-governance"><Shield className="w-4 h-4 mr-1" /> Governance</TabsTrigger>
        </TabsList>

        <TabsContent value="features" className="mt-4"><FeatureStoreTab /></TabsContent>
        <TabsContent value="fleet" className="mt-4"><FleetAnalyticsTab /></TabsContent>
        <TabsContent value="models" className="mt-4"><ModelRegistryTab /></TabsContent>
        <TabsContent value="training" className="mt-4"><TrainingPipelineTab /></TabsContent>
        <TabsContent value="inference" className="mt-4"><InferenceTab /></TabsContent>
        <TabsContent value="drift" className="mt-4"><DriftMonitoringTab /></TabsContent>
        <TabsContent value="governance" className="mt-4"><GovernanceTab /></TabsContent>
      </Tabs>
    </div>
  );
}

```

### `client/src/pages/pdm-schedule.tsx` (5 lines)

```tsx
import { ScheduleView } from "@/features/pdm/components/schedule-view";

export default function PdmSchedulePage() {
  return <ScheduleView />;
}

```

### `client/src/pages/pdm-pack.tsx` (111 lines)

```tsx
import { Activity, BarChart3, AlertCircle, Settings, PlayCircle, Database, TrendingUp, Waves } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { type AnalysisResult, usePdmPackData } from "@/features/maintenance";
import { formatDate } from "@/lib/formatters";
import { PageHeader } from "@/components/navigation";

const AnalysisResultsCard = ({ result, title, isLoading }: { result: AnalysisResult | null; title: string; isLoading: boolean }) => {
  if (isLoading) {return <Card><CardHeader><CardTitle>{title} Results</CardTitle></CardHeader><CardContent><div className="flex items-center justify-center py-8"><div className="text-muted-foreground">Analyzing...</div></div></CardContent></Card>;}
  if (!result) {return <Card><CardHeader><CardTitle>{title} Results</CardTitle></CardHeader><CardContent><div className="text-center py-8"><p className="text-muted-foreground">Run analysis to see results</p></div></CardContent></Card>;}
  return (
    <Card><CardHeader><CardTitle className="flex items-center gap-2">{title} Results<Badge variant={result.severity === "high" ? "destructive" : result.severity === "warn" ? "secondary" : "outline"} className={result.severity === "high" ? "" : result.severity === "warn" ? "" : "border-green-500 text-green-500"}>{result.severity.toUpperCase()}</Badge></CardTitle></CardHeader><CardContent><div className="space-y-4">
      <div><Label className="text-sm font-medium">Worst Z-Score</Label><p className="text-2xl font-bold mt-1" data-testid={`worst-z-${title.toLowerCase().replace(" ", "-")}`}>{Number.isFinite(result.worstZ) ? result.worstZ.toFixed(2) : "—"}</p></div>
      <div><Label className="text-sm font-medium">Feature Scores</Label><div className="space-y-2 mt-2">{Object.entries(result.scores).map(([feature, score]) => <div key={feature} className="flex justify-between items-center p-2 border rounded"><span className="text-sm font-mono">{feature}</span><div className="text-right"><div className="text-sm font-medium">Z: {Number.isFinite(score) ? score.toFixed(2) : "—"}</div><div className="text-xs text-muted-foreground">Value: {Number.isFinite(result.features[feature]) ? result.features[feature].toFixed(4) : "—"}</div></div></div>)}</div></div>
      {result.explanation && <div><Label className="text-sm font-medium">Analysis Details</Label><div className="mt-2 p-3 bg-muted rounded text-xs font-mono max-h-96 overflow-auto"><pre>{JSON.stringify(result.explanation, null, 2).slice(0, 4000)}</pre>{JSON.stringify(result.explanation).length > 4000 && <p className="text-yellow-500 mt-2">... (truncated, showing first 4000 chars)</p>}</div></div>}
    </div></CardContent></Card>
  );
};

export default function PdmPack() {
  const p = usePdmPackData();

  if (p.alertsLoading || p.healthLoading) {return <div className="flex items-center justify-center min-h-screen"><div className="text-muted-foreground">Loading PdM Pack...</div></div>;}
  if (p.alerts === undefined) {return <div className="flex items-center justify-center min-h-screen"><div className="text-red-500">Failed to load PdM alerts. Please check your connection.</div></div>;}

  return (
    <div className="min-h-screen">
      <PageHeader title="PdM Pack" />
      <div className="space-y-6">
        <div className="flex items-center justify-end px-6 py-2"><Badge variant={p.serviceStatus ? "outline" : "destructive"} className={p.serviceStatus ? "border-green-500 text-green-500" : ""} data-testid="service-status">{p.serviceStatus ? "Operational" : "Service Issue"}</Badge></div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-muted-foreground text-sm">Service Status</p><p className="text-2xl font-bold text-foreground mt-1" data-testid="metric-service-status">{p.serviceStatus ? "Online" : "Offline"}</p></div><div className={`${p.serviceStatus ? "bg-green-500/20" : "bg-red-500/20"} p-3 rounded-lg`}><Activity className={p.serviceStatus ? "text-green-500" : "text-red-500"} size={20} /></div></div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-muted-foreground text-sm">Critical Alerts (24h)</p><p className="text-2xl font-bold text-red-500 mt-1" data-testid="metric-critical-alerts">{p.criticalCount}</p></div><div className="bg-red-500/20 p-3 rounded-lg"><AlertCircle className="text-red-500" size={20} /></div></div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-muted-foreground text-sm">Warning Alerts (24h)</p><p className="text-2xl font-bold text-yellow-500 mt-1" data-testid="metric-warning-alerts">{p.warningCount}</p></div><div className="bg-yellow-500/20 p-3 rounded-lg"><TrendingUp className="text-yellow-500" size={20} /></div></div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-muted-foreground text-sm">Total Alerts (24h)</p><p className="text-2xl font-bold text-foreground mt-1" data-testid="metric-total-alerts">{p.recentAlerts.length}</p></div><div className="bg-blue-500/20 p-3 rounded-lg"><BarChart3 className="text-blue-500" size={20} /></div></div></CardContent></Card>
        </div>

        <Tabs value={p.activeTab} onValueChange={p.setActiveTab} className="space-y-6">
          <TabsList className="inline-flex w-full overflow-x-auto">
            <TabsTrigger value="overview" data-testid="tab-overview" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[60px] sm:min-w-[80px] transition-all"><Database className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Overview</span><span className="sm:hidden">Over</span></TabsTrigger>
            <TabsTrigger value="bearing-analysis" data-testid="tab-bearing-analysis" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[60px] sm:min-w-[80px] transition-all"><Waves className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Bearing Analysis</span><span className="sm:hidden">Bearing</span></TabsTrigger>
            <TabsTrigger value="pump-analysis" data-testid="tab-pump-analysis" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[60px] sm:min-w-[80px] transition-all"><Settings className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Pump Analysis</span><span className="sm:hidden">Pump</span></TabsTrigger>
            <TabsTrigger value="baselines" data-testid="tab-baselines" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[60px] sm:min-w-[80px] transition-all"><TrendingUp className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Baselines</span><span className="sm:hidden">Base</span></TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertCircle className="w-5 h-5" />Recent Alerts<InfoTooltip content="Z-score shows how unusual a reading is. Values above 2 indicate the measurement is significantly different from normal and may signal a problem." /></CardTitle></CardHeader><CardContent><div className="space-y-3 max-h-96 overflow-y-auto">{p.recentAlerts.length === 0 ? <p className="text-muted-foreground text-center py-4">No recent alerts</p> : p.recentAlerts.map((alert) => <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg"><div className="flex-1"><div className="flex items-center gap-2 mb-1"><Badge variant={p.getSeverityBadgeColor(alert.severity) as "default" | "secondary" | "destructive" | "outline"} className="text-xs">{alert.severity.toUpperCase()}</Badge><span className="font-medium text-sm">{alert.assetId}</span></div><p className="text-xs text-muted-foreground">{alert.feature}: {alert.value.toFixed(2)} (Z-score: {alert.scoreZ.toFixed(1)})</p><p className="text-xs text-muted-foreground">{formatDate(alert.at)}</p></div></div>)}</div></CardContent></Card>
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5" />Service Information</CardTitle></CardHeader><CardContent><div className="space-y-4"><div><Label className="text-sm font-medium">Service Version</Label><p className="text-sm text-muted-foreground mt-1">PdM Pack v1</p></div><div><Label className="text-sm font-medium">Features</Label><div className="flex flex-wrap gap-2 mt-2">{p.healthData?.features?.map((feature: string) => <Badge key={feature} variant="outline" className="text-xs">{feature.replaceAll('_', " ")}</Badge>)}</div></div><div><Label className="text-sm font-medium">Last Health Check</Label><p className="text-sm text-muted-foreground mt-1">{p.healthData?.timestamp ? formatDate(p.healthData.timestamp) : "Unknown"}</p></div></div></CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="bearing-analysis" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><Waves className="w-5 h-5" />Bearing Vibration Analysis<InfoTooltip content="Paste a series of vibration measurements (like numbers from a sensor). The system will check if the vibrations are normal or indicate potential bearing problems." /></CardTitle></CardHeader><CardContent>
                <Form {...p.bearingForm}><form onSubmit={p.bearingForm.handleSubmit((data) => p.bearingAnalysisMutation.mutate(data))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4"><FormField control={p.bearingForm.control} name="vesselName" render={({ field }) => <FormItem><FormLabel>Vessel Name</FormLabel><FormControl><Input {...field} placeholder="MV Green Belt" data-testid="input-vessel-name" /></FormControl><FormMessage /></FormItem>} /><FormField control={p.bearingForm.control} name="assetId" render={({ field }) => <FormItem><FormLabel>Asset ID</FormLabel><FormControl><Input {...field} placeholder="BEARING001" data-testid="input-asset-id" /></FormControl><FormMessage /></FormItem>} /></div>
                  <FormField control={p.bearingForm.control} name="series" render={({ field }) => <FormItem><FormLabel>Vibration Series (comma-separated)</FormLabel><FormControl><Textarea {...field} placeholder="0.1, 0.2, 0.15, 0.18, 0.22, 0.19, 0.21, 0.17, 0.16, 0.20" rows={4} data-testid="input-vibration-series" /></FormControl><FormMessage /></FormItem>} />
                  <div className="grid grid-cols-2 gap-4"><FormField control={p.bearingForm.control} name="sampleRateHz" render={({ field }) => <FormItem><FormLabel>Sample Rate (Hz)</FormLabel><FormControl><Input {...field} type="number" placeholder="1000" data-testid="input-sample-rate" /></FormControl><FormMessage /></FormItem>} /><FormField control={p.bearingForm.control} name="rpm" render={({ field }) => <FormItem><FormLabel>Shaft RPM (optional)</FormLabel><FormControl><Input {...field} type="number" placeholder="1800" data-testid="input-rpm" /></FormControl><FormMessage /></FormItem>} /></div>
                  <FormField control={p.bearingForm.control} name="autoBaseline" render={({ field }) => <FormItem className="flex items-center gap-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-auto-baseline" /></FormControl><FormLabel className="!mt-0">Auto-update baseline statistics</FormLabel></FormItem>} />
                  <Button type="submit" className="w-full" disabled={p.bearingAnalysisMutation.isPending} data-testid="button-analyze-bearing"><PlayCircle className="mr-2 h-4 w-4" />{p.bearingAnalysisMutation.isPending ? "Analyzing..." : "Run Bearing Analysis"}</Button>
                </form></Form>
              </CardContent></Card>
              <AnalysisResultsCard result={p.bearingAnalysisResult} title="Bearing" isLoading={p.bearingAnalysisMutation.isPending} />
            </div>
          </TabsContent>

          <TabsContent value="pump-analysis" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5" />Pump Process Analysis<InfoTooltip content="Enter flow, pressure, or electrical current readings from a pump. The system will detect if the pump is operating normally or showing signs of wear." /></CardTitle></CardHeader><CardContent>
                <Form {...p.pumpForm}><form onSubmit={p.pumpForm.handleSubmit((data) => p.pumpAnalysisMutation.mutate(data))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4"><FormField control={p.pumpForm.control} name="vesselName" render={({ field }) => <FormItem><FormLabel>Vessel Name</FormLabel><FormControl><Input {...field} placeholder="MV Green Belt" data-testid="input-pump-vessel" /></FormControl><FormMessage /></FormItem>} /><FormField control={p.pumpForm.control} name="assetId" render={({ field }) => <FormItem><FormLabel>Asset ID</FormLabel><FormControl><Input {...field} placeholder="PUMP001" data-testid="input-pump-asset" /></FormControl><FormMessage /></FormItem>} /></div>
                  <FormField control={p.pumpForm.control} name="flow" render={({ field }) => <FormItem><FormLabel>Flow Readings (comma-separated)</FormLabel><FormControl><Textarea {...field} placeholder="100, 102, 98, 101, 99, 100, 103, 97, 100, 101" rows={2} data-testid="input-flow" /></FormControl><FormMessage /></FormItem>} />
                  <FormField control={p.pumpForm.control} name="pressure" render={({ field }) => <FormItem><FormLabel>Pressure Readings (comma-separated)</FormLabel><FormControl><Textarea {...field} placeholder="50, 51, 49, 50, 52, 48, 50, 51, 49, 50" rows={2} data-testid="input-pressure" /></FormControl><FormMessage /></FormItem>} />
                  <FormField control={p.pumpForm.control} name="current" render={({ field }) => <FormItem><FormLabel>Current Readings (comma-separated)</FormLabel><FormControl><Textarea {...field} placeholder="10, 10.2, 9.8, 10.1, 10, 9.9, 10.3, 10, 9.7, 10.1" rows={2} data-testid="input-current" /></FormControl><FormMessage /></FormItem>} />
                  <FormField control={p.pumpForm.control} name="autoBaseline" render={({ field }) => <FormItem className="flex items-center gap-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-pump-baseline" /></FormControl><FormLabel className="!mt-0">Auto-update baseline statistics</FormLabel></FormItem>} />
                  <Button type="submit" className="w-full" disabled={p.pumpAnalysisMutation.isPending} data-testid="button-analyze-pump"><PlayCircle className="mr-2 h-4 w-4" />{p.pumpAnalysisMutation.isPending ? "Analyzing..." : "Run Pump Analysis"}</Button>
                </form></Form>
              </CardContent></Card>
              <AnalysisResultsCard result={p.pumpAnalysisResult} title="Pump" isLoading={p.pumpAnalysisMutation.isPending} />
            </div>
          </TabsContent>

          <TabsContent value="baselines" className="space-y-6">
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" />Baseline Statistics<InfoTooltip content="These are the 'normal' values learned from past measurements. The system compares new readings against these baselines to detect problems." /></CardTitle></CardHeader><CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label htmlFor="baseline-vessel">Vessel</Label><Select value={p.selectedVessel} onValueChange={p.setSelectedVessel}><SelectTrigger data-testid="select-baseline-vessel"><SelectValue placeholder="Select vessel" /></SelectTrigger><SelectContent><SelectItem value="MV Green Belt">MV Green Belt</SelectItem><SelectItem value="MV Pacific Star">MV Pacific Star</SelectItem><SelectItem value="MV Ocean Explorer">MV Ocean Explorer</SelectItem></SelectContent></Select></div>
                  <div><Label htmlFor="baseline-asset">Asset ID</Label><Select value={p.selectedAsset} onValueChange={p.setSelectedAsset}><SelectTrigger data-testid="select-baseline-asset"><SelectValue placeholder="Select asset" /></SelectTrigger><SelectContent><SelectItem value="BEARING001">BEARING001</SelectItem><SelectItem value="BEARING002">BEARING002</SelectItem><SelectItem value="PUMP001">PUMP001</SelectItem><SelectItem value="PUMP002">PUMP002</SelectItem></SelectContent></Select></div>
                </div>
                {p.baselinesLoading ? <div className="text-center py-4"><p className="text-muted-foreground">Loading baseline data...</p></div> : p.baselines && p.baselines.length > 0 ? <div className="space-y-3 max-h-96 overflow-y-auto">{p.baselines.map((baseline) => <div key={baseline.id} className="p-4 border rounded-lg"><div className="grid grid-cols-1 md:grid-cols-4 gap-4"><div><Label className="text-xs font-medium text-muted-foreground">Feature</Label><p className="text-sm font-mono">{baseline.feature}</p></div><div><Label className="text-xs font-medium text-muted-foreground">Mean (μ)</Label><p className="text-sm font-mono">{baseline.mu.toFixed(4)}</p></div><div><Label className="text-xs font-medium text-muted-foreground">Std Dev (σ)</Label><p className="text-sm font-mono">{baseline.sigma.toFixed(4)}</p></div><div><Label className="text-xs font-medium text-muted-foreground">Samples (n)</Label><p className="text-sm font-mono">{baseline.n}</p></div></div><div className="mt-2 pt-2 border-t"><Label className="text-xs font-medium text-muted-foreground">Last Updated</Label><p className="text-xs text-muted-foreground">{formatDate(baseline.updatedAt)}</p></div></div>)}</div> : <div className="text-center py-8"><p className="text-muted-foreground">No baseline data found for {p.selectedVessel} - {p.selectedAsset}</p><p className="text-xs text-muted-foreground mt-2">Run analysis with auto-baseline enabled to establish baselines</p></div>}
              </div>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
      </div>
    </div>
  );
}

```

### `client/src/pages/governance-dashboard.tsx` (182 lines)

```tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Brain, Loader2, AlertCircle, Activity, Shield, GitBranch, Clock, Database, RefreshCw, FileCheck, Filter, Eye, Link, Hash, Cpu, Calendar, User, Layers } from "lucide-react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { useGovernanceData, type LineageRecord, FAMILY_COLORS, STAGE_COLORS, EVENT_TYPE_CONFIG } from "@/features/settings";
import { formatNumber } from "@/lib/formatters";

export default function GovernanceDashboard() {
  const { activeTab, setActiveTab, selectedModel, detailDrawerOpen, setDetailDrawerOpen, comparisonModel, lineageFilters, provenanceFilters, updateLineageFilter, updateProvenanceFilter, lineageRecords, provenanceEvents, isLoadingLineage, isLoadingProvenance, stats, verifyChainMutation, handleViewModelDetails, handleRefresh, handleToggleComparison, handleClearComparison } = useGovernanceData();

  return (
    <div className="min-h-screen">
      <div className="container mx-auto py-6 px-4 space-y-6">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button variant="outline" onClick={handleRefresh} data-testid="button-refresh-governance"><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Models</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold" data-testid="text-total-models">{stats.totalModels}</div><p className="text-xs text-muted-foreground">{stats.productionModels} in production</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Predictions</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold" data-testid="text-total-predictions">{formatNumber(stats.totalPredictions)}</div><p className="text-xs text-muted-foreground">Across all models</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Model Families</CardTitle></CardHeader><CardContent><div className="flex gap-2"><Badge variant="outline" className="text-xs">LSTM: {stats.familyCounts.lstm}</Badge><Badge variant="outline" className="text-xs">XGB: {stats.familyCounts.xgboost}</Badge><Badge variant="outline" className="text-xs">RF: {stats.familyCounts.rf}</Badge></div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Chain Status</CardTitle></CardHeader><CardContent><Button variant="outline" size="sm" onClick={() => verifyChainMutation.mutate()} disabled={verifyChainMutation.isPending} data-testid="button-verify-chain">{verifyChainMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileCheck className="h-4 w-4 mr-2" />}Verify Integrity</Button></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="lineage" data-testid="tab-lineage"><GitBranch className="h-4 w-4 mr-2" />Model Lineage</TabsTrigger>
          <TabsTrigger value="provenance" data-testid="tab-provenance"><Clock className="h-4 w-4 mr-2" />Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="lineage" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div><CardTitle>Model Lineage Records</CardTitle><CardDescription>Track model versions, training provenance, and deployment stages</CardDescription></div>
                <div className="flex flex-wrap gap-2">
                  <Select value={lineageFilters.family} onValueChange={(v) => updateLineageFilter("family", v)}><SelectTrigger className="w-[130px]" data-testid="select-family-filter"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="Family" /></SelectTrigger><SelectContent><SelectItem value="all">All Families</SelectItem><SelectItem value="lstm">LSTM</SelectItem><SelectItem value="xgboost">XGBoost</SelectItem><SelectItem value="rf">Random Forest</SelectItem></SelectContent></Select>
                  <Select value={lineageFilters.stage} onValueChange={(v) => updateLineageFilter("stage", v)}><SelectTrigger className="w-[140px]" data-testid="select-stage-filter"><Layers className="h-4 w-4 mr-2" /><SelectValue placeholder="Stage" /></SelectTrigger><SelectContent><SelectItem value="all">All Stages</SelectItem><SelectItem value="dev">Development</SelectItem><SelectItem value="staging">Staging</SelectItem><SelectItem value="production">Production</SelectItem></SelectContent></Select>
                  <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><Input type="date" value={lineageFilters.fromDate} onChange={(e) => updateLineageFilter("fromDate", e.target.value)} className="w-[140px]" data-testid="input-lineage-from-date" placeholder="From" /><span className="text-muted-foreground">to</span><Input type="date" value={lineageFilters.toDate} onChange={(e) => updateLineageFilter("toDate", e.target.value)} className="w-[140px]" data-testid="input-lineage-to-date" placeholder="To" /></div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingLineage ? <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> : lineageRecords.length === 0 ? <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>No Models Found</AlertTitle><AlertDescription>No ML models have been trained yet. Train a model to see lineage records here.</AlertDescription></Alert> : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader><TableRow><TableHead>Model ID</TableHead><TableHead>Family</TableHead><TableHead>Profile</TableHead><TableHead>Version</TableHead><TableHead>Stage</TableHead><TableHead>Predictions</TableHead><TableHead>Created</TableHead><TableHead></TableHead></TableRow></TableHeader>
                    <TableBody>
                      {lineageRecords.map((record) => (
                        <TableRow key={record.modelId} data-testid={`row-model-${record.modelId}`}>
                          <TableCell className="font-mono text-xs">{record.modelId.substring(0, 12)}...</TableCell>
                          <TableCell><Badge className={FAMILY_COLORS[record.family]}>{record.family.toUpperCase()}</Badge></TableCell>
                          <TableCell>{record.profile}</TableCell>
                          <TableCell>v{record.version}</TableCell>
                          <TableCell><Badge className={STAGE_COLORS[record.promotion.stage]}>{record.promotion.stage}</Badge></TableCell>
                          <TableCell>{formatNumber(record.predictionCount)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{formatDistanceToNow(parseISO(record.createdAt), { addSuffix: true })}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleViewModelDetails(record)} data-testid={`button-view-model-${record.modelId}`} title="View Details"><Eye className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => handleToggleComparison(record)} className={comparisonModel?.modelId === record.modelId ? "bg-primary/10" : ""} data-testid={`button-compare-model-${record.modelId}`} title={comparisonModel?.modelId === record.modelId ? "Deselect" : "Compare"}><GitBranch className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="provenance" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div><CardTitle>Provenance Events</CardTitle><CardDescription>Cryptographically verified audit trail of all ML operations</CardDescription></div>
                <div className="flex flex-wrap gap-2">
                  <Select value={provenanceFilters.type} onValueChange={(v) => updateProvenanceFilter("type", v)}><SelectTrigger className="w-[140px]" data-testid="select-event-type-filter"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="Event Type" /></SelectTrigger><SelectContent><SelectItem value="all">All Events</SelectItem><SelectItem value="prediction">Predictions</SelectItem><SelectItem value="alert">Alerts</SelectItem><SelectItem value="anomaly">Anomalies</SelectItem><SelectItem value="work_order">Work Orders</SelectItem><SelectItem value="training">Training</SelectItem></SelectContent></Select>
                  <div className="flex items-center gap-2"><Label htmlFor="modelId" className="sr-only">Model ID</Label><Input id="modelId" placeholder="Filter by Model ID" value={provenanceFilters.modelId} onChange={(e) => updateProvenanceFilter("modelId", e.target.value)} className="w-[200px]" data-testid="input-model-filter" /></div>
                  <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><Input type="date" value={provenanceFilters.fromDate} onChange={(e) => updateProvenanceFilter("fromDate", e.target.value)} className="w-[140px]" data-testid="input-provenance-from-date" /><span className="text-muted-foreground">to</span><Input type="date" value={provenanceFilters.toDate} onChange={(e) => updateProvenanceFilter("toDate", e.target.value)} className="w-[140px]" data-testid="input-provenance-to-date" /></div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingProvenance ? <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> : provenanceEvents.length === 0 ? <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>No Events Found</AlertTitle><AlertDescription>No provenance events recorded yet. Events are created automatically when predictions, alerts, or training operations occur.</AlertDescription></Alert> : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {provenanceEvents.map((event, index) => {
                      const config = EVENT_TYPE_CONFIG[event.type] || EVENT_TYPE_CONFIG.prediction;
                      const Icon = config.icon;
                      return (
                        <div key={`${event.ts}-${index}`} className="flex gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors" data-testid={`row-event-${index}`}>
                          <div className={`mt-1 ${config.color}`}><Icon className="h-5 w-5" /></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1"><Badge variant="outline" className="text-xs">{config.label}</Badge><span className="text-xs text-muted-foreground">{format(parseISO(event.ts), "PPpp")}</span></div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                              {event.modelId && <div className="flex items-center gap-1 text-muted-foreground"><Brain className="h-3 w-3" /><span className="truncate font-mono text-xs">{event.modelId.substring(0, 12)}</span></div>}
                              {event.equipmentId && <div className="flex items-center gap-1 text-muted-foreground"><Database className="h-3 w-3" /><span className="truncate font-mono text-xs">{event.equipmentId.substring(0, 12)}</span></div>}
                              {event.anomalyScore !== undefined && <div className="flex items-center gap-1 text-muted-foreground"><Activity className="h-3 w-3" /><span>Score: {(event.anomalyScore * 100).toFixed(1)}%</span></div>}
                              {event.engine && <div className="flex items-center gap-1 text-muted-foreground"><Cpu className="h-3 w-3" /><span>{event.engine.toUpperCase()}</span></div>}
                            </div>
                            {event.hash && <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground font-mono"><Hash className="h-3 w-3" /><span className="truncate">{event.hash.substring(0, 16)}...</span>{event.prevHash && <><Link className="h-3 w-3 ml-2" /><span className="truncate">{event.prevHash.substring(0, 16)}...</span></>}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet open={detailDrawerOpen} onOpenChange={setDetailDrawerOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><Brain className="h-5 w-5" />{comparisonModel && selectedModel?.modelId !== comparisonModel.modelId ? "Model Comparison" : "Model Details"}</SheetTitle>
            <SheetDescription>{comparisonModel && selectedModel?.modelId !== comparisonModel.modelId ? "Side-by-side comparison of selected models" : "Full lineage and metadata for the selected model"}</SheetDescription>
          </SheetHeader>
          {selectedModel && comparisonModel && selectedModel.modelId !== comparisonModel.modelId ? <ModelComparisonView modelA={selectedModel} modelB={comparisonModel} onClear={handleClearComparison} /> : selectedModel && <ModelDetailsView model={selectedModel} />}
        </SheetContent>
      </Sheet>
      </div>
    </div>
  );
}

function ModelComparisonView({ modelA, modelB, onClear }: { modelA: LineageRecord; modelB: LineageRecord; onClear: () => void }) {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 bg-muted/50 rounded-lg"><div className="text-xs text-muted-foreground mb-1">Model A</div><div className="font-mono text-sm truncate">{modelA.modelId.substring(0, 16)}...</div><Badge className={`${FAMILY_COLORS[modelA.family]  } mt-2`}>{modelA.family.toUpperCase()}</Badge></div>
        <div className="p-3 bg-muted/50 rounded-lg"><div className="text-xs text-muted-foreground mb-1">Model B</div><div className="font-mono text-sm truncate">{modelB.modelId.substring(0, 16)}...</div><Badge className={`${FAMILY_COLORS[modelB.family]  } mt-2`}>{modelB.family.toUpperCase()}</Badge></div>
      </div>
      <Separator />
      <div><Label className="text-sm font-medium">Metrics Comparison</Label><div className="mt-2 space-y-2">{Object.keys({ ...modelA.metrics, ...modelB.metrics }).map((key) => { const valA = modelA.metrics[key] ?? 0; const valB = modelB.metrics[key] ?? 0; const diff = typeof valA === "number" && typeof valB === "number" ? valA - valB : 0; return (<div key={key} className="flex items-center justify-between p-2 bg-muted rounded"><span className="text-sm capitalize">{key.replaceAll('_', " ")}</span><div className="flex items-center gap-4 text-sm"><span className="font-mono">{typeof valA === "number" ? valA.toFixed(4) : valA}</span><span className="text-muted-foreground">vs</span><span className="font-mono">{typeof valB === "number" ? valB.toFixed(4) : valB}</span>{diff !== 0 && <Badge variant={diff > 0 ? "default" : "destructive"} className="ml-2">{diff > 0 ? "+" : ""}{diff.toFixed(4)}</Badge>}</div></div>); })}</div></div>
      <Separator />
      <div><Label className="text-sm font-medium">Stage Comparison</Label><div className="mt-2 grid grid-cols-2 gap-4"><div className="p-3 bg-muted rounded text-center"><Badge className={STAGE_COLORS[modelA.promotion.stage]}>{modelA.promotion.stage}</Badge><div className="text-xs text-muted-foreground mt-2">{formatNumber(modelA.predictionCount)} predictions</div></div><div className="p-3 bg-muted rounded text-center"><Badge className={STAGE_COLORS[modelB.promotion.stage]}>{modelB.promotion.stage}</Badge><div className="text-xs text-muted-foreground mt-2">{formatNumber(modelB.predictionCount)} predictions</div></div></div></div>
      <Separator />
      <div><Label className="text-sm font-medium">Training Date Comparison</Label><div className="mt-2 grid grid-cols-2 gap-4 text-sm"><div className="p-2 bg-muted rounded"><Calendar className="h-4 w-4 inline mr-2 text-muted-foreground" />{format(parseISO(modelA.createdAt), "PPP")}</div><div className="p-2 bg-muted rounded"><Calendar className="h-4 w-4 inline mr-2 text-muted-foreground" />{format(parseISO(modelB.createdAt), "PPP")}</div></div></div>
      <div className="mt-4"><Button variant="outline" size="sm" onClick={onClear} data-testid="button-clear-comparison">Clear Comparison</Button></div>
    </div>
  );
}

function ModelDetailsView({ model }: { model: LineageRecord }) {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div><Label className="text-xs text-muted-foreground">Model ID</Label><p className="font-mono text-sm">{model.modelId}</p></div>
        <div><Label className="text-xs text-muted-foreground">Version</Label><p className="font-semibold">v{model.version}</p></div>
        <div><Label className="text-xs text-muted-foreground">Family</Label><Badge className={FAMILY_COLORS[model.family]}>{model.family.toUpperCase()}</Badge></div>
        <div><Label className="text-xs text-muted-foreground">Stage</Label><Badge className={STAGE_COLORS[model.promotion.stage]}>{model.promotion.stage}</Badge></div>
      </div>
      <Separator />
      <div><Label className="text-sm font-medium">Training Info</Label><div className="mt-2 grid grid-cols-2 gap-4 text-sm"><div className="flex items-center gap-2 text-muted-foreground"><User className="h-4 w-4" /><span>{model.trainedBy}</span></div><div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4" /><span>{format(parseISO(model.createdAt), "PPP")}</span></div></div></div>
      <Separator />
      <div><Label className="text-sm font-medium">Performance Metrics</Label><div className="mt-2 grid grid-cols-2 gap-2">{Object.entries(model.metrics).map(([key, value]) => (<div key={key} className="flex justify-between p-2 bg-muted rounded"><span className="text-sm capitalize">{key.replaceAll('_', " ")}</span><span className="font-mono text-sm">{typeof value === "number" ? value.toFixed(4) : value}</span></div>))}</div></div>
      <Separator />
      <div><Label className="text-sm font-medium">Hyperparameters</Label><div className="mt-2 grid grid-cols-2 gap-2">{Object.entries(model.hyperparams).map(([key, value]) => (<div key={key} className="flex justify-between p-2 bg-muted rounded text-sm"><span className="capitalize">{key.replaceAll('_', " ")}</span><span className="font-mono">{String(value)}</span></div>))}</div></div>
      <Separator />
      <div><Label className="text-sm font-medium">Dataset Mix</Label><div className="mt-2 space-y-2">{model.datasetMix.map((ds, i) => (<div key={i} className="flex items-center justify-between p-2 bg-muted rounded text-sm"><div className="flex items-center gap-2"><Database className="h-4 w-4 text-muted-foreground" /><span>{ds.name}</span></div><div className="flex items-center gap-2"><span className="text-muted-foreground">{(ds.weight * 100).toFixed(0)}%</span>{ds.rowCount && <span className="text-xs text-muted-foreground">({formatNumber(ds.rowCount)} rows)</span>}</div></div>))}</div></div>
      <Separator />
      <div><Label className="text-sm font-medium">Artifacts</Label><div className="mt-2 space-y-2 text-sm"><div className="p-2 bg-muted rounded"><div className="text-muted-foreground text-xs">Checkpoint</div><div className="font-mono truncate">{model.artifacts.checkpointPath}</div><div className="font-mono text-xs text-muted-foreground mt-1 truncate">SHA-256: {model.artifacts.checkpointHash}</div></div>{model.artifacts.thresholdsPath && <div className="p-2 bg-muted rounded"><div className="text-muted-foreground text-xs">Thresholds</div><div className="font-mono truncate">{model.artifacts.thresholdsPath}</div>{model.artifacts.thresholdsHash && <div className="font-mono text-xs text-muted-foreground mt-1 truncate">SHA-256: {model.artifacts.thresholdsHash}</div>}</div>}</div></div>
      <Separator />
      <div><Label className="text-sm font-medium">Statistics</Label><div className="mt-2 grid grid-cols-2 gap-4"><div className="p-3 bg-muted rounded text-center"><div className="text-2xl font-bold">{formatNumber(model.predictionCount)}</div><div className="text-xs text-muted-foreground">Total Predictions</div></div>{model.promotion.promotedAt && <div className="p-3 bg-muted rounded text-center"><div className="text-sm font-medium">{formatDistanceToNow(parseISO(model.promotion.promotedAt), { addSuffix: true })}</div><div className="text-xs text-muted-foreground">Last Promoted</div></div>}</div></div>
    </div>
  );
}

```

### `client/src/pages/ml-training.tsx` (96 lines)

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Brain, Loader2, CheckCircle2, AlertCircle, TrendingUp, Activity, Radio, Play, Database, Info, FileJson, Download, FileSpreadsheet, Trash2, AlertTriangle } from "lucide-react";
import { useTrainingData } from "@/features/ml-ai";

export default function MLTrainingPage() {
  const t = useTrainingData();

  return (
    <div className="container mx-auto p-6 space-y-6">

      <Tabs defaultValue="lstm" className="space-y-6">
        <div className="overflow-x-auto pb-2"><TabsList className="inline-flex w-full min-w-fit p-1 gap-1"><TabsTrigger value="lstm" data-testid="tab-lstm" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[90px] sm:min-w-[110px] transition-all"><Brain className="h-4 w-4 mr-2" /><span>LSTM Training</span></TabsTrigger><TabsTrigger value="rf" data-testid="tab-random-forest" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[90px] sm:min-w-[110px] transition-all"><TrendingUp className="h-4 w-4 mr-2" /><span>Random Forest</span></TabsTrigger><TabsTrigger value="acoustic" data-testid="tab-acoustic" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[90px] sm:min-w-[110px] transition-all"><Radio className="h-4 w-4 mr-2" /><span>Acoustic Analysis</span></TabsTrigger><TabsTrigger value="models" data-testid="tab-models" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[90px] sm:min-w-[110px] transition-all"><Database className="h-4 w-4 mr-2" /><span>Trained Models</span></TabsTrigger><TabsTrigger value="reset" data-testid="tab-reset-data" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[90px] sm:min-w-[110px] transition-all text-destructive"><Trash2 className="h-4 w-4 mr-2" /><span>Reset Data</span></TabsTrigger></TabsList></div>

        <TabsContent value="lstm" className="space-y-4">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" />LSTM Training<InfoTooltip content="LSTM (Long Short-Term Memory) - An AI that learns patterns in equipment data over time to predict when failures might happen. Best for detecting trends and patterns that develop gradually." /></CardTitle><CardDescription>Teach the AI to recognize patterns in equipment data over time to predict failures before they happen</CardDescription></CardHeader><CardContent className="space-y-4">
            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800" data-testid="alert-adaptive-window"><Info className="h-4 w-4 text-blue-600 dark:text-blue-400" /><AlertDescription className="text-blue-900 dark:text-blue-100"><strong>Smart Adaptive Training:</strong> The system automatically uses optimal training data range based on available history.<div className="mt-2 text-sm space-y-1"><div>🥉 <strong>Bronze (90-180 days):</strong> Basic predictions</div><div>🥈 <strong>Silver (180-365 days):</strong> Good confidence</div><div>🥇 <strong>Gold (365-730 days):</strong> High confidence</div><div>💎 <strong>Platinum (730+ days):</strong> Exceptional confidence</div></div></AlertDescription></Alert>
            <Alert data-testid="alert-lstm-info"><Info className="h-4 w-4" /><AlertDescription>LSTM models learn patterns from historical telemetry data to predict equipment failures. Requires at least 10 time-series samples with sequential sensor readings.</AlertDescription></Alert>
            <div className="grid gap-4 md:grid-cols-3"><div className="space-y-2"><Label htmlFor="lstm-equipment-type">Equipment Type (Optional)</Label><Select value={t.selectedEquipmentType} onValueChange={t.setSelectedEquipmentType}><SelectTrigger id="lstm-equipment-type" data-testid="select-lstm-equipment"><SelectValue placeholder="All Equipment" /></SelectTrigger><SelectContent><SelectItem value="all" data-testid="option-all-equipment">All Equipment</SelectItem>{t.uniqueEquipmentTypes.map((type) => <SelectItem key={type} value={type} data-testid={`option-${type}`}>{type}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="lstm-epochs">Training Epochs</Label><Input id="lstm-epochs" type="number" defaultValue="50" min="10" max="200" data-testid="input-lstm-epochs" /></div><div className="space-y-2"><Label htmlFor="lstm-sequence">Sequence Length</Label><Input id="lstm-sequence" type="number" defaultValue="10" min="5" max="50" data-testid="input-lstm-sequence" /></div></div>
            <Button onClick={t.handleTrainLSTM} disabled={t.trainLSTM.isPending} className="w-full" data-testid="button-train-lstm">{t.trainLSTM.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Training LSTM Model...</> : <><Play className="h-4 w-4 mr-2" />Train LSTM Model</>}</Button>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="rf" className="space-y-4">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />Random Forest Training<InfoTooltip content="Random Forest - An AI that looks at current equipment conditions to classify health status (Healthy, At Risk, Critical). Best for quick health assessments based on current sensor readings." /></CardTitle><CardDescription>Teach the AI to assess equipment health by analyzing current sensor data and conditions</CardDescription></CardHeader><CardContent className="space-y-4">
            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800" data-testid="alert-adaptive-window-rf"><Info className="h-4 w-4 text-blue-600 dark:text-blue-400" /><AlertDescription className="text-blue-900 dark:text-blue-100"><strong>Smart Adaptive Training:</strong> Uses optimal data range automatically (90-730 days based on availability). Data quality tier affects prediction confidence.</AlertDescription></Alert>
            <Alert data-testid="alert-rf-info"><Info className="h-4 w-4" /><AlertDescription>Random Forest models classify equipment health status based on aggregated sensor statistics. Requires equipment with historical sensor data and maintenance records.</AlertDescription></Alert>
            <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="rf-equipment-type">Equipment Type (Optional)</Label><Select value={t.selectedEquipmentType} onValueChange={t.setSelectedEquipmentType}><SelectTrigger id="rf-equipment-type" data-testid="select-rf-equipment"><SelectValue placeholder="All Equipment" /></SelectTrigger><SelectContent><SelectItem value="all" data-testid="option-rf-all">All Equipment</SelectItem>{t.uniqueEquipmentTypes.map((type) => <SelectItem key={type} value={type} data-testid={`option-rf-${type}`}>{type}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="rf-trees">Number of Trees</Label><Input id="rf-trees" type="number" defaultValue="50" min="10" max="200" data-testid="input-rf-trees" /></div></div>
            <Button onClick={t.handleTrainRandomForest} disabled={t.trainRandomForest.isPending} className="w-full" data-testid="button-train-rf">{t.trainRandomForest.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Training Random Forest...</> : <><Play className="h-4 w-4 mr-2" />Train Random Forest Model</>}</Button>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="acoustic" className="space-y-4">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Radio className="h-5 w-5" />Acoustic Monitoring Analysis</CardTitle><CardDescription>Analyze acoustic waveforms for frequency signatures and anomaly detection</CardDescription></CardHeader><CardContent className="space-y-4">
            <Alert data-testid="alert-acoustic-info"><Info className="h-4 w-4" /><AlertDescription>Acoustic analysis uses FFT to extract frequency signatures and detect abnormal sound patterns that may indicate bearing wear, cavitation, or mechanical issues.</AlertDescription></Alert>
            <div className="space-y-2"><Label htmlFor="acoustic-data">Acoustic Waveform Data (comma-separated values)</Label><Textarea id="acoustic-data" placeholder="0.1, 0.2, -0.1, 0.3, -0.2, 0.15, -0.05, 0.25..." value={t.acousticData} onChange={(e) => t.setAcousticData(e.target.value)} rows={4} data-testid="input-acoustic-data" /></div>
            <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="sample-rate">Sample Rate (Hz)</Label><Input id="sample-rate" type="number" value={t.sampleRate} onChange={(e) => t.setSampleRate(e.target.value)} data-testid="input-sample-rate" /></div><div className="space-y-2"><Label htmlFor="rpm">RPM (Optional)</Label><Input id="rpm" type="number" value={t.rpm} onChange={(e) => t.setRpm(e.target.value)} placeholder="e.g., 1800" data-testid="input-rpm" /></div></div>
            <Button onClick={() => t.analyzeAcoustic.mutate()} disabled={t.analyzeAcoustic.isPending || !t.acousticData} className="w-full" data-testid="button-analyze-acoustic">{t.analyzeAcoustic.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing...</> : <><Activity className="h-4 w-4 mr-2" />Analyze Acoustic Data</>}</Button>
            {t.acousticResults && <Card className="mt-4 bg-muted/50" data-testid="card-acoustic-results"><CardHeader><CardTitle className="text-sm flex items-center gap-2">Analysis Results<Badge variant={t.acousticResults.severity === "critical" ? "destructive" : t.acousticResults.severity === "warning" ? "default" : "outline"} data-testid="badge-severity">{t.acousticResults.severity}</Badge></CardTitle></CardHeader><CardContent className="space-y-4">
              <div><div className="text-sm font-medium mb-2">Health Score</div><div className="flex items-center gap-2"><div className="flex-1 bg-muted rounded-full h-2"><div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${t.acousticResults.healthScore}%` }} data-testid="progress-health-score" /></div><span className="text-sm font-medium" data-testid="text-health-score">{t.acousticResults.healthScore.toFixed(0)}%</span></div></div>
              {t.acousticResults.features && <div className="grid grid-cols-2 gap-2 text-sm"><div><span className="text-muted-foreground">RMS Level:</span><span className="ml-2 font-medium" data-testid="text-rms">{t.acousticResults.features.rms?.toFixed(3)}</span></div><div><span className="text-muted-foreground">Peak Amplitude:</span><span className="ml-2 font-medium" data-testid="text-peak">{t.acousticResults.features.peakAmplitude?.toFixed(3)}</span></div><div><span className="text-muted-foreground">Dominant Frequency:</span><span className="ml-2 font-medium" data-testid="text-dominant-freq">{t.acousticResults.features.dominantFrequency?.toFixed(1)} Hz</span></div><div><span className="text-muted-foreground">SNR:</span><span className="ml-2 font-medium" data-testid="text-snr">{t.acousticResults.features.snr?.toFixed(1)} dB</span></div></div>}
              {t.acousticResults.primaryIssues?.length > 0 && <div><div className="text-sm font-medium mb-2">Primary Issues</div><ul className="space-y-1">{t.acousticResults.primaryIssues.map((issue: string, i: number) => <li key={i} className="text-sm text-muted-foreground flex items-start gap-2" data-testid={`text-issue-${i}`}><AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />{issue}</li>)}</ul></div>}
              {t.acousticResults.recommendations?.length > 0 && <div><div className="text-sm font-medium mb-2">Recommendations</div><ul className="space-y-1">{t.acousticResults.recommendations.map((rec: string, i: number) => <li key={i} className="text-sm text-muted-foreground flex items-start gap-2" data-testid={`text-rec-${i}`}><CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600" />{rec}</li>)}</ul></div>}
            </CardContent></Card>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />Trained ML Models</CardTitle><CardDescription>View and manage your trained machine learning models</CardDescription></CardHeader><CardContent>
            {t.isLoadingModels ? <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> : t.mlModels.length === 0 ? <div className="text-center py-8 text-muted-foreground" data-testid="text-no-models"><Database className="h-12 w-12 mx-auto mb-3 opacity-20" /><p>No trained models yet</p><p className="text-sm mt-1">Train an LSTM or Random Forest model to get started</p></div> :
            <Table><TableHeader><TableRow><TableHead>Model Name</TableHead><TableHead>Type</TableHead><TableHead>Equipment</TableHead><TableHead>Performance</TableHead><TableHead>Data Quality</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead></TableRow></TableHeader><TableBody>
              {t.mlModels.map((model) => { const tier = model.hyperparameters?.dataQualityTier; return (
                <TableRow key={model.id} data-testid={`row-model-${model.id}`}><TableCell className="font-medium">{model.name}</TableCell><TableCell><Badge variant="outline" data-testid={`badge-type-${model.id}`}>{model.modelType === "failure_prediction" ? "LSTM" : model.modelType === "health_classification" ? "Random Forest" : model.modelType}</Badge></TableCell><TableCell>{model.targetEquipmentType || "All"}</TableCell><TableCell>{model.performance?.accuracy ? <span className="text-sm" data-testid={`text-accuracy-${model.id}`}>{(model.performance.accuracy * 100).toFixed(1)}% accuracy</span> : <span className="text-muted-foreground text-sm">N/A</span>}</TableCell><TableCell>{tier ? <div className="space-y-1"><Badge className={t.getTierBadge(tier).className} data-testid={`badge-tier-${model.id}`}>{t.getTierBadge(tier).label}</Badge>{model.hyperparameters?.lookbackDays && <div className="text-xs text-muted-foreground">{model.hyperparameters.lookbackDays} days</div>}</div> : <span className="text-muted-foreground text-sm">Legacy</span>}</TableCell><TableCell>{model.status === "active" ? <Badge variant="default" className="bg-green-600" data-testid={`badge-status-${model.id}`}><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge> : <Badge variant="secondary" data-testid={`badge-status-${model.id}`}>{model.status}</Badge>}</TableCell><TableCell className="text-sm text-muted-foreground">{new Date(model.createdAt).toLocaleDateString()}</TableCell></TableRow>
              );})}
            </TableBody></Table>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="reset" className="space-y-4">
          <Alert variant="destructive" className="border-2"><AlertTriangle className="h-5 w-5" /><AlertDescription className="text-lg font-semibold">⚠️ DESTRUCTIVE OPERATION - ADMIN ONLY</AlertDescription></Alert>
          <Card className="border-destructive border-2"><CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-5 w-5" />Reset ML Training Data</CardTitle><CardDescription>Permanently delete synthetic telemetry data and optionally trained models to start fresh with real equipment data</CardDescription></CardHeader><CardContent className="space-y-6">
            <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-700"><Info className="h-4 w-4 text-amber-600 dark:text-amber-400" /><AlertDescription className="text-amber-900 dark:text-amber-100"><strong>When to use this:</strong> This reset function is designed for development and testing. Use it to clear synthetic/test data before deploying to production with real equipment telemetry.</AlertDescription></Alert>
            <div className="space-y-4 p-4 bg-muted rounded-lg"><h3 className="font-semibold text-destructive">What will be deleted:</h3><ul className="space-y-2 text-sm"><li className="flex items-start gap-2"><span className="text-destructive">•</span><span><strong>All telemetry records</strong> for your organization ({t.mlModels.length > 0 ? "7,369 synthetic records" : "all current data"})</span></li><li className="flex items-start gap-2"><span className="text-destructive">•</span><span><strong>All failure predictions</strong> generated by ML models</span></li><li className="flex items-start gap-2"><span className="text-destructive">•</span><span><strong>All anomaly detections</strong> from monitoring systems</span></li><li className="flex items-start gap-2"><span className="text-destructive">•</span><span><strong>Optionally:</strong> All trained ML models (LSTM, Random Forest, XGBoost)</span></li></ul></div>
            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"><Info className="h-4 w-4 text-blue-600 dark:text-blue-400" /><AlertDescription className="text-blue-900 dark:text-blue-100"><strong>What is preserved:</strong> Equipment records, sensor configurations, alert settings, and maintenance schedules remain intact.</AlertDescription></Alert>
            <div className="pt-4 space-y-3">
              <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="lg" className="w-full" disabled={t.resetMLData.isPending} data-testid="button-reset-ml-data-keep-models">{t.resetMLData.isPending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Deleting...</> : <><Trash2 className="mr-2 h-5 w-5" />Reset Training Data (Keep Models)</>}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Confirm ML Data Reset</AlertDialogTitle><AlertDialogDescription className="space-y-3 pt-2"><p className="font-semibold">This will permanently delete all telemetry, predictions, and anomaly data.</p><p>Trained ML models will be preserved.</p><p className="text-destructive font-semibold">This action cannot be undone.</p></AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel data-testid="button-cancel-reset">Cancel</AlertDialogCancel><AlertDialogAction onClick={() => t.resetMLData.mutate({ deleteModels: false })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-reset-keep-models">Yes, Delete Training Data</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
              <AlertDialog><AlertDialogTrigger asChild><Button variant="outline" size="lg" className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" disabled={t.resetMLData.isPending} data-testid="button-reset-ml-data-delete-models">{t.resetMLData.isPending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Deleting...</> : <><Trash2 className="mr-2 h-5 w-5" />Reset Everything (Including Models)</>}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Confirm Complete Reset</AlertDialogTitle><AlertDialogDescription className="space-y-3 pt-2"><p className="font-semibold text-destructive">This will permanently delete ALL ML data including trained models.</p><p>You will need to retrain all models from scratch. This includes:</p><ul className="list-disc list-inside space-y-1 text-sm"><li>LSTM neural network model</li><li>Random Forest classifier</li><li>XGBoost model</li><li>All telemetry and prediction data</li></ul><p className="text-destructive font-bold">This action cannot be undone. Are you absolutely sure?</p></AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel data-testid="button-cancel-reset-all">Cancel</AlertDialogCancel><AlertDialogAction onClick={() => t.resetMLData.mutate({ deleteModels: true })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-reset-all">Yes, Delete Everything</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
            </div>
            <Alert><Info className="h-4 w-4" /><AlertDescription className="text-xs"><strong>Admin Authentication Required:</strong> This operation requires admin privileges and is logged for audit purposes.</AlertDescription></Alert>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" />Export ML/PDM Data</CardTitle><CardDescription>Export machine learning models, predictions, and telemetry data in industry-standard formats for use in competing applications</CardDescription></CardHeader><CardContent className="space-y-4">
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"><Info className="h-4 w-4 text-blue-600 dark:text-blue-400" /><AlertDescription className="text-blue-900 dark:text-blue-100"><strong>Data Portability:</strong> Export your ML/PDM data to migrate to IBM Maximo, Azure IoT, SAP PM, or any competing predictive maintenance platform. All exports include tier metadata and are compatible with industry-standard tools.</AlertDescription></Alert>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-2"><CardHeader><CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4" />Complete ML/PDM Package</CardTitle><CardDescription className="text-xs">JSON: All datasets. CSV: ML models only</CardDescription></CardHeader><CardContent className="space-y-2"><div className="flex gap-2"><Button variant="default" className="flex-1" onClick={() => t.exportData("complete-json")} data-testid="button-export-complete-json"><FileJson className="h-4 w-4 mr-2" />JSON (All)</Button><Button variant="outline" className="flex-1" onClick={() => t.exportData("complete-csv")} data-testid="button-export-complete-csv"><FileSpreadsheet className="h-4 w-4 mr-2" />CSV (Models)</Button></div></CardContent></Card>
          <Card className="border-2"><CardHeader><CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4" />ML Models Only</CardTitle><CardDescription className="text-xs">Trained models with tier metadata and performance metrics</CardDescription></CardHeader><CardContent className="space-y-2"><div className="flex gap-2"><Button variant="default" className="flex-1" onClick={() => t.exportData("models-json")} data-testid="button-export-models-json"><FileJson className="h-4 w-4 mr-2" />JSON</Button><Button variant="outline" className="flex-1" onClick={() => t.exportData("models-csv")} data-testid="button-export-models-csv"><FileSpreadsheet className="h-4 w-4 mr-2" />CSV</Button></div></CardContent></Card>
          <Card className="border-2"><CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />Predictions & History</CardTitle><CardDescription className="text-xs">Failure predictions, RUL estimates, and historical failures</CardDescription></CardHeader><CardContent className="space-y-2"><div className="flex gap-2"><Button variant="default" className="flex-1" onClick={() => t.exportData("predictions-json")} data-testid="button-export-predictions-json"><FileJson className="h-4 w-4 mr-2" />JSON</Button><Button variant="outline" className="flex-1" onClick={() => t.exportData("predictions-csv")} data-testid="button-export-predictions-csv"><FileSpreadsheet className="h-4 w-4 mr-2" />CSV</Button></div></CardContent></Card>
          <Card className="border-2"><CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" />Telemetry Data</CardTitle><CardDescription className="text-xs">Historical sensor data for ML training (up to 50k records)</CardDescription></CardHeader><CardContent className="space-y-2"><div className="flex gap-2"><Button variant="default" className="flex-1" onClick={() => t.exportData("telemetry-json")} data-testid="button-export-telemetry-json"><FileJson className="h-4 w-4 mr-2" />JSON</Button><Button variant="outline" className="flex-1" onClick={() => t.exportData("telemetry-csv")} data-testid="button-export-telemetry-csv"><FileSpreadsheet className="h-4 w-4 mr-2" />CSV</Button></div></CardContent></Card>
        </div>
        <Alert><Info className="h-4 w-4" /><AlertDescription><strong>Export Formats:</strong> JSON format includes all datasets (raw telemetry, models, predictions, anomalies, thresholds, PDM scores) - use for complete platform migration or training models in external systems. CSV format contains ML models only with full tier metadata - use for spreadsheet analysis in Excel, Pandas, or BI tools. Raw telemetry data enables competing platforms to train their own predictive models.</AlertDescription></Alert>
      </CardContent></Card>
    </div>
  );
}

```

### `client/src/pages/optimization-tools.tsx` (120 lines)

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Settings, Play, RotateCcw, TrendingUp, BarChart3, Zap, Target, Clock, AlertTriangle, CheckCircle, XCircle, Loader2, Download, Trash2, Plus, Search, RefreshCw, Ship, Users, Wrench } from "lucide-react";
import { formatDecimal, formatPercent } from "@/lib/formatters";
import { useOptimizationData, formatDurationMs } from "@/features/maintenance";
import { useQuery } from "@tanstack/react-query";

// Fleet stats are computed locally to avoid hook caching issues - v2
export default function OptimizationTools() {
  const o = useOptimizationData();
  
  const { data: vessels } = useQuery<Array<{ id: string; name: string; active: boolean }>>({
    queryKey: ["/api/vessels"],
    queryFn: async () => { const r = await fetch("/api/vessels", { headers: { "x-org-id": "default-org-id" } }); if (!r.ok) {throw new Error("Failed to fetch vessels");} return r.json(); },
  });
  const { data: crew } = useQuery<Array<{ id: string; name: string; active: boolean }>>({
    queryKey: ["/api/crew"],
    queryFn: async () => { const r = await fetch("/api/crew", { headers: { "x-org-id": "default-org-id" } }); if (!r.ok) {throw new Error("Failed to fetch crew");} return r.json(); },
  });
  const fleetStats = {
    activeVessels: vessels?.filter((v) => v.active).length ?? 0,
    totalVessels: vessels?.length ?? 0,
    activeCrew: crew?.filter((c) => c.active).length ?? 0,
    totalCrew: crew?.length ?? 0,
  };
  
  const StatusBadge = ({ status }: { status: string }) => { const v = o.getStatusBadge(status); const icons = { loader: <Loader2 className="h-3 w-3 animate-spin" />, check: <CheckCircle className="h-3 w-3" />, x: <XCircle className="h-3 w-3" /> }; return <Badge className={`${v.color} text-white`}>{icons[v.iconName]}<span className="ml-1 capitalize">{status}</span></Badge>; };

  return (
    <div className="min-h-screen">
      <div className="flex-1 space-y-6 p-6">
        <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={o.handleRefresh} data-testid="button-refresh"><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
          <Dialog open={o.configDialogOpen} onOpenChange={o.setConfigDialogOpen}>
            <DialogTrigger asChild><Button size="sm" data-testid="button-create-config"><Plus className="h-4 w-4 mr-2" />New Configuration</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Create Optimizer Configuration</DialogTitle><DialogDescription>Configure a new optimization scenario with algorithm parameters and constraints</DialogDescription></DialogHeader>
              <Form {...o.configForm}>
                <form onSubmit={o.configForm.handleSubmit(o.onSubmitConfig)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={o.configForm.control} name="name" render={({ field }) => (<FormItem className="col-span-2"><FormLabel>Configuration Name</FormLabel><FormControl><Input placeholder="Fleet Maintenance Optimization" {...field} data-testid="input-config-name" /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={o.configForm.control} name="algorithmType" render={({ field }) => (<FormItem><FormLabel>Algorithm Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger data-testid="select-algorithm-type"><SelectValue placeholder="Select algorithm" /></SelectTrigger></FormControl><SelectContent><SelectItem value="greedy">Greedy (Fast)</SelectItem><SelectItem value="genetic">Genetic Algorithm</SelectItem><SelectItem value="simulated_annealing">Simulated Annealing</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={o.configForm.control} name="maxSchedulingHorizon" render={({ field }) => (<FormItem><FormLabel>Time Horizon (Days)</FormLabel><FormControl><Input type="number" {...field} onChange={(e) => field.onChange(Number.parseInt(e.target.value))} data-testid="input-time-horizon" /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={o.configForm.control} name="costWeightFactor" render={({ field }) => (<FormItem><FormLabel>Cost Weight Factor</FormLabel><FormControl><Input type="number" step="0.1" min="0" max="1" {...field} onChange={(e) => field.onChange(Number.parseFloat(e.target.value))} data-testid="input-cost-weight" /></FormControl><FormDescription>Weight for cost optimization (0 - 1)</FormDescription><FormMessage /></FormItem>)} />
                    <FormField control={o.configForm.control} name="urgencyWeightFactor" render={({ field }) => (<FormItem><FormLabel>Urgency Weight Factor</FormLabel><FormControl><Input type="number" step="0.1" min="0" max="1" {...field} onChange={(e) => field.onChange(Number.parseFloat(e.target.value))} data-testid="input-urgency-weight" /></FormControl><FormDescription>Weight for urgency optimization (0 - 1)</FormDescription><FormMessage /></FormItem>)} />
                    <FormField control={o.configForm.control} name="conflictResolutionStrategy" render={({ field }) => (<FormItem className="col-span-2"><FormLabel>Conflict Resolution Strategy</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger data-testid="select-conflict-strategy"><SelectValue placeholder="Select strategy" /></SelectTrigger></FormControl><SelectContent><SelectItem value="priority_based">Priority Based</SelectItem><SelectItem value="cost_based">Cost Based</SelectItem><SelectItem value="earliest_first">Earliest First</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={o.configForm.control} name="enabled" render={({ field }) => (<FormItem className="flex items-center justify-between"><FormLabel>Enabled</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-enabled" /></FormControl></FormItem>)} />
                    <FormField control={o.configForm.control} name="resourceConstraintStrict" render={({ field }) => (<FormItem className="flex items-center justify-between"><FormLabel>Strict Resource Constraints</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-strict-constraints" /></FormControl></FormItem>)} />
                  </div>
                  <DialogFooter><Button type="button" variant="outline" onClick={() => o.setConfigDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={o.createConfigMutation.isPending} data-testid="button-save-config">{o.createConfigMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Configuration</Button></DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card><CardContent className="p-4"><div className="flex items-center gap-4"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search configurations and results..." value={o.searchQuery} onChange={(e) => o.setSearchQuery(e.target.value)} className="pl-9" data-testid="input-search" /></div><Select value={o.statusFilter} onValueChange={o.setStatusFilter}><SelectTrigger className="w-40" data-testid="select-status-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="running">Running</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="failed">Failed</SelectItem></SelectContent></Select></div></CardContent></Card>

      <Tabs value={o.activeTab} onValueChange={o.setActiveTab} className="space-y-6">
        <div className="overflow-x-auto"><TabsList className="inline-flex w-full min-w-fit p-1 gap-1"><TabsTrigger value="scenarios" data-testid="tab-scenarios" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[80px] sm:min-w-[140px]"><Settings className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /><span className="hidden sm:inline">Scenario Builder</span><span className="sm:hidden">Scenario</span></TabsTrigger><TabsTrigger value="runs" data-testid="tab-runs" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[80px] sm:min-w-[140px]"><Play className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /><span className="hidden sm:inline">Solver Runs</span><span className="sm:hidden">Runs</span></TabsTrigger><TabsTrigger value="rul" data-testid="tab-rul" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[80px] sm:min-w-[140px]"><Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /><span className="hidden sm:inline">RUL Analysis</span><span className="sm:hidden">RUL</span></TabsTrigger><TabsTrigger value="trends" data-testid="tab-trends" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[80px] sm:min-w-[140px]"><TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /><span className="hidden sm:inline">Trend Insights</span><span className="sm:hidden">Trends</span></TabsTrigger><TabsTrigger value="fleet" data-testid="tab-fleet" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[80px] sm:min-w-[140px]"><Ship className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /><span className="hidden sm:inline">Fleet Controls</span><span className="sm:hidden">Fleet</span></TabsTrigger></TabsList></div>

        <TabsContent value="scenarios" className="space-y-6">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Optimizer Configurations</CardTitle><CardDescription>Manage optimization scenarios and algorithm parameters</CardDescription></CardHeader><CardContent>
            {o.configurationsLoading ? <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div> : o.filteredConfigurations.length === 0 ? <div className="text-center py-12 text-muted-foreground" data-testid="text-no-configurations">No optimizer configurations found</div> : (
              <div className="space-y-4">{o.filteredConfigurations.map((config) => (
                <Card key={config.id} className="border-l-4 border-l-blue-500"><CardContent className="p-4"><div className="flex items-start justify-between"><div className="space-y-2"><div className="flex items-center gap-2"><h3 className="font-semibold" data-testid={`text-config-name-${config.id}`}>{config.name}</h3>{config.enabled ? <Badge className="bg-green-500 text-white">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</div><div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm"><div><span className="text-muted-foreground">Algorithm:</span><p className="font-medium capitalize" data-testid={`text-algorithm-${config.id}`}>{config.algorithmType}</p></div><div><span className="text-muted-foreground">Time Horizon:</span><p className="font-medium">{config.maxSchedulingHorizon} days</p></div><div><span className="text-muted-foreground">Cost Weight:</span><p className="font-medium">{formatPercent(config.costWeightFactor * 100, 0)}</p></div><div><span className="text-muted-foreground">Strategy:</span><p className="font-medium">{config.conflictResolutionStrategy.replace("_", " ")}</p></div></div></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => { o.setSelectedConfiguration(config.id); o.setRunDialogOpen(true); }} disabled={!config.enabled} data-testid={`button-run-${config.id}`}><Play className="h-4 w-4 mr-2" />Run</Button><Button variant="outline" size="sm" onClick={() => o.deleteConfigMutation.mutate(config.id)} data-testid={`button-delete-${config.id}`}><Trash2 className="h-4 w-4" /></Button></div></div></CardContent></Card>
              ))}</div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="runs" className="space-y-6">
          <Card><CardHeader><div className="flex items-center justify-between"><div><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Optimization Results</CardTitle><CardDescription>Monitor optimization runs and review results</CardDescription></div>{o.filteredResults.length > 0 && <Button variant="destructive" size="sm" onClick={() => { if (confirm(`Delete all ${o.filteredResults.length} optimization result(s)? This cannot be undone.`)) {o.clearAllOptimizationsMutation.mutate();} }} disabled={o.clearAllOptimizationsMutation.isPending} data-testid="button-clear-all-results">{o.clearAllOptimizationsMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}Clear All</Button>}</div></CardHeader><CardContent>
            {o.resultsLoading ? <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div> : o.filteredResults.length === 0 ? <div className="text-center py-12 text-muted-foreground" data-testid="text-no-results">No optimization results found</div> : (
              <div className="space-y-4">{o.filteredResults.map((result) => { const config = o.configurations?.find((c) => c.id === result.configurationId);
                return (<Card key={result.id} className="border-l-4 border-l-green-500"><CardContent className="p-4"><div className="flex items-start justify-between"><div className="space-y-3"><div className="flex items-center gap-2"><h3 className="font-semibold" data-testid={`text-result-config-${result.id}`}>{config?.name || "Unknown Configuration"}</h3><StatusBadge status={result.runStatus} /></div><div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm"><div><span className="text-muted-foreground">Started:</span><p className="font-medium">{new Date(result.startTime).toLocaleDateString()}</p></div><div><span className="text-muted-foreground">Duration:</span><p className="font-medium" data-testid={`text-duration-${result.id}`}>{formatDurationMs(result.executionTimeMs)}</p></div><div><span className="text-muted-foreground">Schedules:</span><p className="font-medium">{result.totalSchedules}</p></div><div><span className="text-muted-foreground">Cost Savings:</span><p className="font-medium text-green-600" data-testid={`text-savings-${result.id}`}>{o.formatCurrency(result.costSavings)}</p></div></div>{result.runStatus === "completed" && result.optimizationScore && <div className="flex items-center gap-4"><div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">Optimization Score:</span><Badge variant="outline" className="font-mono">{formatDecimal(result.optimizationScore, 2)}</Badge></div><div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">Conflicts Resolved:</span><Badge variant="outline">{result.conflictsResolved}</Badge></div></div>}{result.runStatus === "running" && <div className="space-y-2"><div className="flex items-center justify-between text-sm"><span>Optimization in progress...</span><span>{formatDurationMs(Date.now() - new Date(result.startTime).getTime())}</span></div><Progress value={65} className="w-full" /></div>}</div><div className="flex items-center gap-2">{result.runStatus === "completed" && <><Button variant="outline" size="sm" onClick={() => o.downloadOptimizationMutation.mutate(result.id)} disabled={o.downloadOptimizationMutation.isPending} data-testid={`button-download-${result.id}`}>{o.downloadOptimizationMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}Download</Button><Button variant="outline" size="sm" onClick={() => o.applyToProductionMutation.mutate(result.id)} disabled={result.appliedToProduction || o.applyToProductionMutation.isPending} data-testid={`button-apply-${result.id}`}>{o.applyToProductionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{result.appliedToProduction ? "Applied" : "Apply to Production"}</Button><Button variant="outline" size="sm" onClick={() => { if (confirm("Delete this optimization result? This cannot be undone.")) {o.deleteOptimizationMutation.mutate(result.id);} }} disabled={o.deleteOptimizationMutation.isPending} data-testid={`button-delete-result-${result.id}`}>{o.deleteOptimizationMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button></>}{result.runStatus === "failed" && <><Button variant="default" size="sm" onClick={() => o.runOptimizationMutation.mutate({ configId: result.configurationId })} disabled={o.runOptimizationMutation.isPending} data-testid={`button-restart-${result.id}`}>{o.runOptimizationMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}Retry</Button><Button variant="outline" size="sm" onClick={() => { if (confirm("Delete this failed optimization result? This cannot be undone.")) {o.deleteOptimizationMutation.mutate(result.id);} }} disabled={o.deleteOptimizationMutation.isPending} data-testid={`button-delete-result-${result.id}`}>{o.deleteOptimizationMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button></>}{result.runStatus === "running" && <Button variant="destructive" size="sm" onClick={() => o.cancelOptimizationMutation.mutate(result.id)} disabled={o.cancelOptimizationMutation.isPending} data-testid={`button-cancel-${result.id}`}>{o.cancelOptimizationMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}Cancel</Button>}</div></div></CardContent></Card>);
              })}</div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="rul" className="space-y-6" data-testid="content-rul">
          {o.equipmentLoading ? <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div> : (
            <div className="grid grid-cols-1 gap-6">{o.rulQueries.map((query, index) => { const eq = o.equipment?.[index]; const rulData = query.data; if (!eq || !rulData) {return null;} const riskColor = rulData.riskLevel === "high" ? "bg-red-500" : rulData.riskLevel === "medium" ? "bg-yellow-500" : "bg-green-500";
              return (<Card key={eq.id} data-testid={`card-rul-${eq.id}`}><CardHeader><div className="flex items-start justify-between"><div><CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" />{eq.name}</CardTitle><CardDescription>{eq.type} - {eq.location}</CardDescription></div><Badge className={`${riskColor} text-white`} data-testid={`badge-risk-${eq.id}`}>{rulData.riskLevel.toUpperCase()} RISK</Badge></div></CardHeader><CardContent><div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"><Card className="p-4 bg-muted/50"><div className="flex items-center gap-2 mb-2"><Clock className="h-4 w-4 text-muted-foreground" /><p className="text-sm font-medium">Remaining Days</p></div><p className="text-2xl font-bold" data-testid={`text-remaining-days-${eq.id}`}>{rulData.remainingDays}</p></Card><Card className="p-4 bg-muted/50"><div className="flex items-center gap-2 mb-2"><Target className="h-4 w-4 text-muted-foreground" /><p className="text-sm font-medium">Health Index</p></div><p className="text-2xl font-bold" data-testid={`text-health-index-${eq.id}`}>{rulData.healthIndex}%</p></Card><Card className="p-4 bg-muted/50"><div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-muted-foreground" /><p className="text-sm font-medium">Failure Probability</p></div><p className="text-2xl font-bold" data-testid={`text-failure-prob-${eq.id}`}>{formatPercent(rulData.failureProbability * 100)}</p></Card></div>{rulData.componentStatus && rulData.componentStatus.length > 0 && <div className="space-y-3 mb-6"><h4 className="text-sm font-semibold">Component Analysis</h4>{rulData.componentStatus.map((comp: {componentType: string; healthScore?: number; degradationMetric?: number; predictedFailureDays: number}) => (<div key={comp.componentType} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`component-${comp.componentType}-${eq.id}`}><div className="flex-1"><p className="font-medium capitalize">{comp.componentType.replace("_", " ")}</p><div className="flex gap-4 mt-1"><p className="text-sm text-muted-foreground">Health: {comp.healthScore ? formatPercent(comp.healthScore) : "N/A"}</p><p className="text-sm text-muted-foreground">Degradation: {comp.degradationMetric ? formatDecimal(comp.degradationMetric) : "N/A"}</p></div></div><div className="text-right"><p className="text-sm font-medium">{comp.predictedFailureDays} days</p></div></div>))}</div>}{rulData.recommendations && rulData.recommendations.length > 0 && <div className="space-y-2"><h4 className="text-sm font-semibold flex items-center gap-2"><CheckCircle className="h-4 w-4" />Recommendations</h4><ul className="space-y-1" data-testid={`recommendations-${eq.id}`}>{rulData.recommendations.map((rec: string, idx: number) => (<li key={`rec-${rec.slice(0, 30)}-${idx}`} className="text-sm text-muted-foreground flex items-start gap-2"><span className="text-primary mt-0.5">•</span><span>{rec}</span></li>))}</ul></div>}</CardContent></Card>);
            })}{(!o.equipment || o.equipment.length === 0) && <Card><CardContent className="py-12"><div className="text-center text-muted-foreground"><Clock className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No equipment available for RUL analysis</p></div></CardContent></Card>}</div>
          )}
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />Enhanced Trend Analytics</CardTitle><CardDescription>Advanced statistical analysis and forecasting insights</CardDescription></CardHeader><CardContent>{o.trendsLoading ? <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div> : <div className="text-center py-12 text-muted-foreground"><TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" /><p data-testid="text-trends-coming-soon">Enhanced trend insights integration coming soon</p><p className="text-sm mt-2">Connect with existing enhanced-trends service</p></div>}</CardContent></Card>
        </TabsContent>

        <TabsContent value="fleet" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Ship className="h-5 w-5" />Fleet Optimization</CardTitle><CardDescription>Fleet-wide resource allocation and scheduling coordination</CardDescription></CardHeader><CardContent><div className="space-y-4"><div className="grid grid-cols-2 gap-4"><Card className="p-4"><div className="flex items-center gap-2 mb-2"><Ship className="h-4 w-4" /><span className="text-sm font-medium">Active Vessels</span></div><p className="text-2xl font-bold" data-testid="text-active-vessels">{fleetStats.activeVessels}</p><p className="text-xs text-muted-foreground">of {fleetStats.totalVessels} total</p></Card><Card className="p-4"><div className="flex items-center gap-2 mb-2"><Users className="h-4 w-4" /><span className="text-sm font-medium">Active Crew</span></div><p className="text-2xl font-bold" data-testid="text-active-crew">{fleetStats.activeCrew}</p><p className="text-xs text-muted-foreground">of {fleetStats.totalCrew} total</p></Card></div><Separator /><div className="space-y-3"><Button className="w-full" onClick={() => o.fleetOptimizationMutation.mutate()} disabled={o.fleetOptimizationMutation.isPending || !o.configurations?.length} data-testid="button-fleet-optimization">{o.fleetOptimizationMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}Run Fleet Optimization</Button><Button variant="outline" className="w-full" onClick={() => o.crewSchedulingMutation.mutate()} disabled={o.crewSchedulingMutation.isPending} data-testid="button-crew-scheduling">{o.crewSchedulingMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}Optimize Crew Scheduling</Button><Button variant="outline" className="w-full" onClick={() => o.maintenanceSchedulingMutation.mutate()} disabled={o.maintenanceSchedulingMutation.isPending} data-testid="button-maintenance-scheduling">{o.maintenanceSchedulingMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wrench className="h-4 w-4 mr-2" />}Schedule Maintenance</Button></div></div></CardContent></Card>
            <Card><CardHeader><CardTitle>Fleet Performance Metrics</CardTitle></CardHeader><CardContent><div className="space-y-4"><div className="space-y-2"><div className="flex justify-between text-sm"><span>Vessel Utilization</span><span>{fleetStats.totalVessels > 0 ? Math.round((fleetStats.activeVessels / fleetStats.totalVessels) * 100) : 0}%</span></div><Progress value={fleetStats.totalVessels > 0 ? (fleetStats.activeVessels / fleetStats.totalVessels) * 100 : 0} /></div><div className="space-y-2"><div className="flex justify-between text-sm"><span>Crew Availability</span><span>{fleetStats.totalCrew > 0 ? Math.round((fleetStats.activeCrew / fleetStats.totalCrew) * 100) : 0}%</span></div><Progress value={fleetStats.totalCrew > 0 ? (fleetStats.activeCrew / fleetStats.totalCrew) * 100 : 0} /></div><div className="space-y-2"><div className="flex justify-between text-sm"><span>Equipment Tracked</span><span>{(o.equipment as Array<{id: string}> | undefined)?.length ?? 0} items</span></div><Progress value={100} /></div><Separator /><div className="grid grid-cols-2 gap-4 pt-2"><div className="text-center"><p className="text-2xl font-bold text-green-600" data-testid="text-total-savings">{o.formatCurrency(o.optimizationResults?.reduce((sum, r) => sum + (r.costSavings || 0), 0) ?? 0)}</p><p className="text-sm text-muted-foreground">Total Savings</p></div><div className="text-center"><p className="text-2xl font-bold text-blue-600" data-testid="text-completed-runs">{o.optimizationResults?.filter((r) => r.runStatus === "completed").length ?? 0}</p><p className="text-sm text-muted-foreground">Completed Runs</p></div></div></div></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={o.runDialogOpen} onOpenChange={o.setRunDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Run Optimization</DialogTitle><DialogDescription>Execute optimization with selected configuration</DialogDescription></DialogHeader><div className="space-y-4"><div><Label>Configuration</Label><p className="text-sm text-muted-foreground">{o.configurations?.find((c) => c.id === o.selectedConfiguration)?.name}</p></div><div><Label htmlFor="time-horizon">Time Horizon (Days)</Label><Input id="time-horizon" type="number" defaultValue={90} min={1} max={365} data-testid="input-run-time-horizon" /></div></div><DialogFooter><Button variant="outline" onClick={() => o.setRunDialogOpen(false)}>Cancel</Button><Button onClick={() => o.selectedConfiguration && o.runOptimizationMutation.mutate({ configId: o.selectedConfiguration })} disabled={o.runOptimizationMutation.isPending} data-testid="button-start-optimization">{o.runOptimizationMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Start Optimization</Button></DialogFooter></DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

```

### `client/src/components/work-orders/EnhancedServiceRequestDialog.tsx` (255 lines)

```tsx
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Loader2, Wrench, Plus, Trash2, AlertTriangle, CalendarIcon } from "lucide-react";
import { useServiceProviders } from "@/features/suppliers/hooks/useSuppliers";
import { useEquipmentList } from "@/features/vessels/hooks/useVessels";
import { cn } from "@/lib/utils";
import { EquipmentMultiSelect, DatePickerField } from "./RequestDialogHelpers";

const SEVERITY_OPTIONS = [
  { value: "general", label: "General", color: "bg-blue-100 text-blue-800" },
  { value: "safety", label: "Safety", color: "bg-amber-100 text-amber-800" },
  { value: "critical", label: "Critical", color: "bg-red-100 text-red-800" },
];

const ASSISTANCE_TAGS = [
  { value: "servicing", label: "Servicing" },
  { value: "calibration", label: "Calibration" },
  { value: "pressure_test", label: "Pressure Test" },
  { value: "replacement", label: "Replacement" },
  { value: "certificate_renewal", label: "Certificate Renewal" },
  { value: "repair", label: "Repair" },
];

interface CertificateItem { id: string; name: string; expiryDate?: Date; remarks: string; }

interface EnhancedServiceRequestData {
  serviceProviderId: string;
  equipmentIds: string[];
  severity: string;
  assistanceTags: string[];
  symptomDescription: string;
  probableCause?: string;
  actionTakenSoFar?: string;
  isRecurringDefect: boolean;
  requestedStartDate?: Date;
  requestedEndDate?: Date;
  estimatedDurationHours?: number;
  quotedAmount?: number;
  notes?: string;
  mocRequired: boolean;
  mocNumber?: string;
  certificateItems?: Array<{ name: string; expiryDate?: string; remarks?: string }>;
  scope?: string;
}

interface InitialServiceOrderData {
  serviceProviderId?: string;
  scope?: string;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  estimatedDurationHours?: number;
}

interface EnhancedServiceRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: EnhancedServiceRequestData) => void;
  isPending: boolean;
  initialData?: InitialServiceOrderData;
  isEditing?: boolean;
}

export function EnhancedServiceRequestDialog({ open, onOpenChange, onSubmit, isPending, initialData, isEditing = false }: EnhancedServiceRequestDialogProps) {
  const { data: providers = [] } = useServiceProviders();
  const { data: equipment = [] } = useEquipmentList();

  const [providerId, setProviderId] = useState("");
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [severity, setSeverity] = useState("general");
  const [assistanceTags, setAssistanceTags] = useState<string[]>([]);
  const [symptomDescription, setSymptomDescription] = useState("");
  const [probableCause, setProbableCause] = useState("");
  const [actionTakenSoFar, setActionTakenSoFar] = useState("");
  const [isRecurringDefect, setIsRecurringDefect] = useState(false);
  const [requestedStartDate, setRequestedStartDate] = useState<Date | undefined>();
  const [requestedEndDate, setRequestedEndDate] = useState<Date | undefined>();
  const [estimatedHours, setEstimatedHours] = useState("");
  const [quotedAmount, setQuotedAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [mocRequired, setMocRequired] = useState(false);
  const [mocNumber, setMocNumber] = useState("");
  const [certificateItems, setCertificateItems] = useState<CertificateItem[]>([]);
  const [initialized, setInitialized] = useState(false);

  if (open && isEditing && initialData && !initialized) {
    if (initialData.serviceProviderId) setProviderId(initialData.serviceProviderId);
    if (initialData.scope) setSymptomDescription(initialData.scope);
    if (initialData.scheduledStartDate) setRequestedStartDate(new Date(initialData.scheduledStartDate));
    if (initialData.scheduledEndDate) setRequestedEndDate(new Date(initialData.scheduledEndDate));
    if (initialData.estimatedDurationHours) setEstimatedHours(String(initialData.estimatedDurationHours));
    setInitialized(true);
  }
  
  if (!open && initialized) {
    setInitialized(false);
  }

  const showCertificates = assistanceTags.includes("certificate_renewal");

  const toggleTag = useCallback((tag: string) => {
    setAssistanceTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }, []);

  const addCertificate = useCallback(() => {
    setCertificateItems(prev => [...prev, { id: `cert-${Date.now()}`, name: "", remarks: "" }]);
  }, []);

  const updateCertificate = useCallback((id: string, field: keyof CertificateItem, value: string | Date | undefined) => {
    setCertificateItems(prev => prev.map(cert => cert.id === id ? { ...cert, [field]: value } : cert));
  }, []);

  const removeCertificate = useCallback((id: string) => {
    setCertificateItems(prev => prev.filter(cert => cert.id !== id));
  }, []);

  const resetForm = useCallback(() => {
    setProviderId(""); setSelectedEquipmentIds([]); setSeverity("general"); setAssistanceTags([]);
    setSymptomDescription(""); setProbableCause(""); setActionTakenSoFar(""); setIsRecurringDefect(false);
    setRequestedStartDate(undefined); setRequestedEndDate(undefined); setEstimatedHours(""); setQuotedAmount("");
    setNotes(""); setMocRequired(false); setMocNumber(""); setCertificateItems([]);
  }, []);

  const handleSubmit = () => {
    onSubmit({
      serviceProviderId: providerId, equipmentIds: selectedEquipmentIds, severity, assistanceTags, symptomDescription,
      probableCause: probableCause || undefined, actionTakenSoFar: actionTakenSoFar || undefined, isRecurringDefect,
      requestedStartDate, requestedEndDate,
      estimatedDurationHours: estimatedHours ? Number.parseFloat(estimatedHours) : undefined,
      quotedAmount: quotedAmount ? Number.parseFloat(quotedAmount) : undefined,
      notes: notes || undefined, mocRequired, mocNumber: mocRequired ? mocNumber || undefined : undefined,
      certificateItems: showCertificates && certificateItems.length > 0
        ? certificateItems.filter(c => c.name.trim()).map(c => ({ name: c.name, expiryDate: c.expiryDate?.toISOString(), remarks: c.remarks || undefined }))
        : undefined,
      scope: symptomDescription,
    });
  };

  const handleOpenChange = (isOpen: boolean) => { if (!isOpen) {resetForm(); setInitialized(false);} onOpenChange(isOpen); };
  const canSubmit = isEditing 
    ? symptomDescription.trim() && !isPending
    : providerId && selectedEquipmentIds.length > 0 && symptomDescription.trim() && !isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" />{isEditing ? "Edit Service Order" : "Request External Service"}</DialogTitle>
          <DialogDescription>{isEditing ? "Update the service order details." : "Create a service request with detailed diagnostics and scheduling information."}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Service Provider *</Label>
              <Select value={providerId} onValueChange={setProviderId}>
                <SelectTrigger data-testid="select-service-provider"><SelectValue placeholder="Select provider..." /></SelectTrigger>
                <SelectContent>{providers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Severity *</Label>
              <div className="flex gap-2 mt-2">
                {SEVERITY_OPTIONS.map(opt => (
                  <Badge key={opt.value} className={cn("cursor-pointer px-3 py-1", severity === opt.value ? opt.color : "bg-muted text-muted-foreground hover:bg-muted/80")} onClick={() => setSeverity(opt.value)} data-testid={`badge-severity-${opt.value}`}>
                    {opt.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <EquipmentMultiSelect equipment={equipment} selectedIds={selectedEquipmentIds} onChange={setSelectedEquipmentIds} />

          <div>
            <Label className="mb-2 block">Assistance Required</Label>
            <div className="flex flex-wrap gap-2">
              {ASSISTANCE_TAGS.map(tag => (
                <Badge key={tag.value} variant={assistanceTags.includes(tag.value) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleTag(tag.value)} data-testid={`tag-${tag.value}`}>
                  {tag.label}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Diagnostics</h4>
            <div><Label>Symptom / Issue Description *</Label><Textarea value={symptomDescription} onChange={(e) => setSymptomDescription(e.target.value)} placeholder="Describe the issue in detail..." rows={3} data-testid="input-symptom" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Probable Cause</Label><Textarea value={probableCause} onChange={(e) => setProbableCause(e.target.value)} placeholder="What might be causing this..." rows={2} data-testid="input-probable-cause" /></div>
              <div><Label>Action Taken So Far</Label><Textarea value={actionTakenSoFar} onChange={(e) => setActionTakenSoFar(e.target.value)} placeholder="Any troubleshooting done..." rows={2} data-testid="input-action-taken" /></div>
            </div>
            <div className="flex items-center space-x-2"><Switch id="recurring" checked={isRecurringDefect} onCheckedChange={setIsRecurringDefect} data-testid="switch-recurring" /><Label htmlFor="recurring">Recurring Defect</Label></div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2"><CalendarIcon className="h-4 w-4" />Scheduling</h4>
            <div className="grid grid-cols-2 gap-4">
              <DatePickerField label="Requested Start Date" value={requestedStartDate} onChange={setRequestedStartDate} testId="date-start" />
              <DatePickerField label="Requested End Date" value={requestedEndDate} onChange={setRequestedEndDate} testId="date-end" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Estimated Hours</Label><Input type="number" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} placeholder="0" data-testid="input-hours" /></div>
              <div><Label>Quoted Amount ($)</Label><Input type="number" value={quotedAmount} onChange={(e) => setQuotedAmount(e.target.value)} placeholder="0.00" data-testid="input-quote" /></div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center space-x-2"><Switch id="moc" checked={mocRequired} onCheckedChange={setMocRequired} data-testid="switch-moc" /><Label htmlFor="moc">MOC (Management of Change) Required</Label></div>
            {mocRequired && <div><Label>MOC Number</Label><Input value={mocNumber} onChange={(e) => setMocNumber(e.target.value)} placeholder="MOC-2024-001" data-testid="input-moc-number" /></div>}
          </div>

          {showCertificates && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between"><h4 className="font-medium">Certificate Renewals</h4><Button variant="outline" size="sm" onClick={addCertificate} data-testid="btn-add-certificate"><Plus className="h-4 w-4 mr-1" />Add Certificate</Button></div>
                {certificateItems.map(cert => (
                  <div key={cert.id} className="grid grid-cols-4 gap-2 items-end">
                    <div><Label className="text-xs">Certificate Name</Label><Input value={cert.name} onChange={(e) => updateCertificate(cert.id, "name", e.target.value)} placeholder="Certificate name" data-testid={`input-cert-name-${cert.id}`} /></div>
                    <DatePickerField label="Expiry Date" value={cert.expiryDate} onChange={(d) => updateCertificate(cert.id, "expiryDate", d)} testId={`cert-expiry-${cert.id}`} compact />
                    <div><Label className="text-xs">Remarks</Label><Input value={cert.remarks} onChange={(e) => updateCertificate(cert.id, "remarks", e.target.value)} placeholder="Remarks" data-testid={`input-cert-remarks-${cert.id}`} /></div>
                    <Button variant="ghost" size="sm" onClick={() => removeCertificate(cert.id)} data-testid={`btn-remove-cert-${cert.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            </>
          )}

          <div><Label>Additional Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes..." rows={2} data-testid="input-notes" /></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} data-testid="btn-submit-sr">{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{isEditing ? "Update Service Order" : "Create Service Order"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EnhancedServiceRequestDialog;

```

### `client/src/components/work-orders/LinkTemplateDialog.tsx` (216 lines)

```tsx
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Clock, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MaintenanceTemplate } from "@shared/schema";

interface LinkTemplateDialogProps {
  workOrderId: string;
  equipmentType?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

async function fetchTemplates() {
  return apiRequest<MaintenanceTemplate[]>("GET", "/api/maintenance-templates");
}

export function LinkTemplateDialog({
  workOrderId,
  equipmentType,
  open,
  onOpenChange,
  onSuccess,
}: LinkTemplateDialogProps) {
  const { toast } = useToast();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["/api/maintenance-templates"],
    queryFn: fetchTemplates,
    enabled: open,
  });

  const filteredTemplates = equipmentType
    ? templates.filter((t) => 
        t.isActive && 
        t.equipmentType?.toLowerCase() === equipmentType.toLowerCase()
      )
    : templates.filter((t) => t.isActive);

  const linkTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return apiRequest("POST", `/api/work-orders/${workOrderId}/initialize-checklist`, {
        templateId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/maintenance-checklist/${workOrderId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      toast({
        title: "Template Linked",
        description: "Checklist items from the template have been added to this work order",
      });
      onOpenChange(false);
      setSelectedTemplateId("");
      onSuccess?.();
    },
    onError: (_error) => {
      toast({
        title: "Error",
        description: "Failed to link template to work order",
        variant: "destructive",
      });
    },
  });

  const handleLinkTemplate = () => {
    if (selectedTemplateId) {
      linkTemplateMutation.mutate(selectedTemplateId);
    }
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="link-template-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Link Maintenance Template
          </DialogTitle>
          <DialogDescription>
            Select a maintenance template to add its checklist items to this work order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoadingTemplates ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {equipmentType 
                  ? `No active templates found for ${equipmentType} equipment.`
                  : "No active templates available."}
              </p>
              <p className="text-xs mt-1">
                Create templates in the Maintenance Templates page.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Template</label>
                <Select
                  value={selectedTemplateId}
                  onValueChange={setSelectedTemplateId}
                >
                  <SelectTrigger data-testid="select-link-template">
                    <SelectValue placeholder="Choose a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTemplates.map((template) => (
                      <SelectItem 
                        key={template.id} 
                        value={template.id}
                        data-testid={`template-option-${template.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{template.name}</span>
                          {template.priority && template.priority <= 2 && (
                            <Badge variant="outline" className="text-xs">
                              P{template.priority}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplate && (
                <div className="rounded-lg border p-3 bg-muted/30 space-y-2" data-testid="template-preview">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{selectedTemplate.name}</span>
                    {selectedTemplate.estimatedDurationHours && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {selectedTemplate.estimatedDurationHours}h
                      </div>
                    )}
                  </div>
                  {selectedTemplate.description && (
                    <p className="text-xs text-muted-foreground">
                      {selectedTemplate.description}
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {selectedTemplate.maintenanceType && (
                      <Badge variant="secondary" className="text-xs">
                        {selectedTemplate.maintenanceType}
                      </Badge>
                    )}
                    {selectedTemplate.equipmentType && (
                      <Badge variant="outline" className="text-xs">
                        {selectedTemplate.equipmentType}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-link-template"
          >
            Cancel
          </Button>
          <Button
            onClick={handleLinkTemplate}
            disabled={!selectedTemplateId || linkTemplateMutation.isPending}
            data-testid="button-confirm-link-template"
          >
            {linkTemplateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Linking...
              </>
            ) : (
              "Link Template"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

```

### `client/src/components/work-orders/MultiLinePartsRequestDialog.tsx` (392 lines)

```tsx
import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2, Package, Search, ChevronDown, AlertTriangle, Truck } from "lucide-react";
import { useParts } from "@/features/inventory/hooks/useInventory";
import { useInventoryPartSuppliers, type SupplierLink } from "@/features/inventory/hooks/useInventoryPartSuppliers";
import { cn } from "@/lib/utils";

interface InventoryPartFromAPI {
  id: string;
  partNo: string;
  name: string;
  standardCost?: number;
  quantityOnHand?: number;
}

function mapPartFields(part: InventoryPartFromAPI) {
  return {
    id: part.id,
    partNumber: part.partNo,
    partName: part.name,
    unitCost: part.standardCost,
    quantityOnHand: part.quantityOnHand,
  };
}

interface PartItem {
  id: string;
  inventoryItemId?: string;
  partNumber?: string;
  partName?: string;
  description: string;
  quantity: number;
  notes: string;
  unitCost?: number;
  quantityOnHand?: number;
  isCustom: boolean;
  selectedSupplierId?: string;
  availableSuppliers?: SupplierLink[];
}

export interface SuggestedPart {
  partId: string;
  partNo: string;
  partName: string;
  quantityNeeded: number;
  quantityOnHand: number;
  shortfall: number;
  suggestedOrderQuantity: number;
}

interface MultiLinePartsRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { notes?: string; items: Array<{ partId?: string; description: string; quantity: number; notes?: string; supplierId?: string }> }) => void;
  isPending: boolean;
  suggestions?: SuggestedPart[];
}

export function MultiLinePartsRequestDialog({ open, onOpenChange, onSubmit, isPending, suggestions = [] }: MultiLinePartsRequestDialogProps) {
  const [items, setItems] = useState<PartItem[]>([]);
  const [globalNotes, setGlobalNotes] = useState("");
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
  const { data: rawParts = [], isLoading: partsLoading } = useParts();
  const inventoryParts = (rawParts as unknown as InventoryPartFromAPI[]).map(mapPartFields);

  const generateId = () => `item-${Date.now()}-${crypto.randomUUID().slice(0, 7)}`;

  const loadSuggestions = useCallback(() => {
    if (suggestions.length > 0 && !suggestionsLoaded) {
      const suggestedItems: PartItem[] = suggestions.map((s) => ({
        id: generateId(),
        inventoryItemId: s.partId,
        partNumber: s.partNo,
        partName: s.partName,
        description: `${s.partNo} - ${s.partName}`,
        quantity: s.suggestedOrderQuantity,
        notes: "",
        quantityOnHand: s.quantityOnHand,
        isCustom: false,
      }));
      setItems(suggestedItems);
      setSuggestionsLoaded(true);
    }
  }, [suggestions, suggestionsLoaded]);

  const addInventoryItem = useCallback((part: { id: string; partNumber: string; partName: string; unitCost?: number; quantityOnHand?: number }) => {
    setItems(prev => [...prev, {
      id: generateId(),
      inventoryItemId: part.id,
      partNumber: part.partNumber,
      partName: part.partName,
      description: `${part.partNumber} - ${part.partName}`,
      quantity: 1,
      notes: "",
      unitCost: part.unitCost,
      quantityOnHand: part.quantityOnHand,
      isCustom: false,
    }]);
  }, []);

  const addCustomItem = useCallback(() => {
    setItems(prev => [...prev, {
      id: generateId(),
      description: "",
      quantity: 1,
      notes: "",
      isCustom: true,
    }]);
  }, []);

  const updateItem = useCallback((id: string, field: keyof PartItem, value: string | number) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const resetForm = useCallback(() => {
    setItems([]);
    setGlobalNotes("");
    setSuggestionsLoaded(false);
  }, []);

  if (open && !suggestionsLoaded && suggestions.length > 0) {
    loadSuggestions();
  }

  const handleSubmit = () => {
    const validItems = items.filter(item => item.description.trim() && item.quantity > 0);
    if (validItems.length === 0) {return;}
    onSubmit({
      notes: globalNotes || undefined,
      items: validItems.map(item => ({
        partId: item.inventoryItemId,
        description: item.description,
        quantity: item.quantity,
        notes: item.notes || undefined,
        supplierId: item.selectedSupplierId || undefined,
      })),
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {resetForm();}
    onOpenChange(isOpen);
  };

  const validItemCount = items.filter(item => item.description.trim() && item.quantity > 0).length;
  const canSubmit = validItemCount > 0 && !isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Create Purchase Request</DialogTitle>
          <DialogDescription>Add parts from inventory or enter custom items. You can add multiple items in a single request.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {suggestionsLoaded && suggestions.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-800 dark:text-amber-200">
                {suggestions.length} out-of-stock part{suggestions.length > 1 ? "s" : ""} pre-filled from work order
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <PartSearchCombobox parts={inventoryParts} isLoading={partsLoading} onSelect={addInventoryItem} />
            <Button variant="outline" onClick={addCustomItem} data-testid="btn-add-custom-item">
              <Plus className="h-4 w-4 mr-1" />Custom Item
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="border rounded-lg p-8 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No items added yet. Search inventory or add a custom item.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">Item</TableHead>
                    <TableHead className="w-[10%]">Qty</TableHead>
                    <TableHead className="w-[10%]">Stock</TableHead>
                    <TableHead className="w-[25%]">Supplier</TableHead>
                    <TableHead className="w-[20%]">Notes</TableHead>
                    <TableHead className="w-[5%]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.isCustom ? (
                          <Input value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)} placeholder="Enter part description..." data-testid={`input-item-desc-${item.id}`} />
                        ) : (
                          <div>
                            <div className="font-medium text-sm">{item.partNumber}</div>
                            <div className="text-xs text-muted-foreground">{item.partName}</div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", Number.parseInt(e.target.value) || 1)} className="w-20" data-testid={`input-item-qty-${item.id}`} />
                      </TableCell>
                      <TableCell>
                        {item.isCustom ? (
                          <Badge variant="outline">Custom</Badge>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Badge className={item.quantityOnHand && item.quantityOnHand > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                              {item.quantityOnHand ?? 0}
                            </Badge>
                            {item.quantityOnHand !== undefined && item.quantity > item.quantityOnHand && (
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <SupplierSelectCell
                          item={item}
                          onSupplierSelect={(supplierId) => updateItem(item.id, "selectedSupplierId", supplierId)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input value={item.notes} onChange={(e) => updateItem(item.id, "notes", e.target.value)} placeholder="Notes..." className="text-sm" data-testid={`input-item-notes-${item.id}`} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)} data-testid={`btn-remove-item-${item.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div>
            <Label>General Notes (Optional)</Label>
            <Textarea value={globalNotes} onChange={(e) => setGlobalNotes(e.target.value)} placeholder="Additional notes for this purchase request..." rows={2} data-testid="input-pr-global-notes" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <div className="flex-1 text-sm text-muted-foreground">{validItemCount} item{validItemCount !== 1 ? "s" : ""} ready</div>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} data-testid="btn-submit-pr">
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Purchase Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PartSearchComboboxProps {
  parts: Array<{ id: string; partNumber: string; partName: string; unitCost?: number; quantityOnHand?: number }>;
  isLoading: boolean;
  onSelect: (part: { id: string; partNumber: string; partName: string; unitCost?: number; quantityOnHand?: number }) => void;
}

function PartSearchCombobox({ parts, isLoading, onSelect }: PartSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const searchLower = search.toLowerCase();
  const filteredParts = parts.filter(p =>
    (p.partNumber?.toLowerCase() || "").includes(searchLower) ||
    (p.partName?.toLowerCase() || "").includes(searchLower)
  ).slice(0, 20);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="flex-1 justify-between" data-testid="btn-search-inventory">
          <span className="flex items-center gap-2"><Search className="h-4 w-4" />Search Inventory...</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by part number or name..." value={search} onValueChange={setSearch} data-testid="input-search-inventory" />
          <CommandList>
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
            ) : (
              <>
                <CommandEmpty>No parts found.</CommandEmpty>
                <CommandGroup heading="Inventory Parts">
                  {filteredParts.map((part) => (
                    <CommandItem key={part.id} value={`${part.partNumber} ${part.partName}`} onSelect={() => { onSelect(part); setOpen(false); setSearch(""); }} className="cursor-pointer" data-testid={`option-part-${part.id}`}>
                      <div className="flex-1">
                        <div className="font-medium">{part.partNumber}</div>
                        <div className="text-xs text-muted-foreground">{part.partName}</div>
                      </div>
                      <Badge variant="outline" className={cn("ml-2", part.quantityOnHand && part.quantityOnHand > 0 ? "bg-green-50" : "bg-red-50")}>
                        Stock: {part.quantityOnHand ?? 0}
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface SupplierSelectCellProps {
  item: PartItem;
  onSupplierSelect: (supplierId: string) => void;
}

function SupplierSelectCell({ item, onSupplierSelect }: SupplierSelectCellProps) {
  const { data: suppliers = [], isLoading } = useInventoryPartSuppliers(
    item.inventoryItemId || "",
    { enabled: !!item.inventoryItemId && !item.isCustom }
  );

  useEffect(() => {
    if (!item.isCustom && suppliers.length > 0 && !item.selectedSupplierId) {
      const preferredSupplier = suppliers.find(s => s.isPreferred);
      const defaultSupplierId = preferredSupplier?.supplierId || suppliers[0].supplierId;
      if (defaultSupplierId) {
        onSupplierSelect(defaultSupplierId);
      }
    }
  }, [suppliers, item.isCustom, item.selectedSupplierId, onSupplierSelect]);

  if (item.isCustom) {
    return <Badge variant="outline" className="text-xs">Manual</Badge>;
  }

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  if (suppliers.length === 0) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Truck className="h-3 w-3" />
        <span>No suppliers</span>
      </div>
    );
  }

  return (
    <Select value={item.selectedSupplierId || ""} onValueChange={onSupplierSelect}>
      <SelectTrigger className="h-8 text-xs" data-testid={`select-supplier-${item.id}`}>
        <SelectValue placeholder="Select supplier" />
      </SelectTrigger>
      <SelectContent>
        {suppliers.map((supplier) => (
          <SelectItem
            key={supplier.supplierId}
            value={supplier.supplierId}
            data-testid={`option-supplier-${supplier.supplierId}`}
          >
            <div className="flex items-center gap-2">
              <span>{supplier.supplierName}</span>
              {supplier.isPreferred && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">Preferred</Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default MultiLinePartsRequestDialog;

```

### `client/src/components/work-orders/RequestDialogHelpers.tsx` (93 lines)

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ChevronDown, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EquipmentMultiSelectProps {
  equipment: Array<{ id: string; name: string; type?: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function EquipmentMultiSelect({ equipment, selectedIds, onChange }: EquipmentMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = equipment.filter(e => e.name.toLowerCase().includes(search.toLowerCase())).slice(0, 20);
  const toggle = (id: string) => onChange(selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id]);

  return (
    <div>
      <Label>Equipment *</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between" data-testid="btn-select-equipment">
            {selectedIds.length > 0 ? `${selectedIds.length} equipment selected` : "Select equipment..."}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search equipment..." value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>No equipment found.</CommandEmpty>
              <CommandGroup>
                {filtered.map(eq => (
                  <CommandItem key={eq.id} value={eq.name} onSelect={() => toggle(eq.id)} className="cursor-pointer" data-testid={`option-equipment-${eq.id}`}>
                    <Checkbox checked={selectedIds.includes(eq.id)} className="mr-2" />
                    <div className="flex-1">
                      <div className="font-medium">{eq.name}</div>
                      {eq.type && <div className="text-xs text-muted-foreground">{eq.type}</div>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedIds.map(id => {
            const eq = equipment.find(e => e.id === id);
            return eq && <Badge key={id} variant="secondary" className="text-xs">{eq.name}<button className="ml-1" onClick={() => toggle(id)}>&times;</button></Badge>;
          })}
        </div>
      )}
    </div>
  );
}

interface DatePickerFieldProps {
  label: string;
  value?: Date;
  onChange: (date?: Date) => void;
  testId: string;
  compact?: boolean;
}

export function DatePickerField({ label, value, onChange, testId, compact }: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      {!compact && <Label className="text-xs">{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")} data-testid={testId}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "PPP") : compact ? label : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={(d) => { onChange(d); setOpen(false); }} initialFocus />
        </PopoverContent>
      </Popover>
    </div>
  );
}

```

### `client/src/components/work-orders/VirtualizedWorkOrderTable.tsx` (234 lines)

```tsx
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Eye, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import type { WorkOrder } from "@shared/schema";
import { COLUMNS, STATUS_CONFIG, PRIORITY_CONFIG, ROW_HEIGHT, getTotalWidth } from "./work-order-table-config";
import { TruncatedCell, SortableHeader, WorkOrderTableSkeleton, WorkOrderTableEmpty } from "./WorkOrderTableHelpers";

interface VirtualizedWorkOrderTableProps {
  workOrders: WorkOrder[];
  equipment: Array<{ id: string; name?: string }>;
  vessels: Array<{ id: string; name?: string }>;
  crew: Array<{ id: string; name?: string }>;
  isLoading: boolean;
  onView: (order: WorkOrder) => void;
  onEdit: (order: WorkOrder) => void;
  onDelete: (order: WorkOrder) => void;
  sortColumn: string;
  sortDirection: "asc" | "desc";
  onSort: (column: string) => void;
}

export function VirtualizedWorkOrderTable({
  workOrders,
  equipment,
  vessels,
  crew,
  isLoading,
  onView,
  onEdit,
  onDelete,
  sortColumn,
  sortDirection,
  onSort,
}: VirtualizedWorkOrderTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const getEquipmentName = (equipmentId: string) => {
    if (!equipmentId) {return "—";}
    const eq = equipment.find((e) => e.id === equipmentId);
    return eq?.name || equipmentId.slice(0, 8).toUpperCase();
  };

  const getVesselName = (vesselId: string | null) => {
    if (!vesselId) {return "—";}
    const vessel = vessels.find((v) => v.id === vesselId);
    return vessel?.name || vesselId.slice(0, 8).toUpperCase();
  };

  const getCrewName = (crewId: string | null) => {
    if (!crewId) {return "Unassigned";}
    const member = crew.find((c) => c.id === crewId);
    return member?.name || crewId.slice(0, 8).toUpperCase();
  };

  const rowVirtualizer = useVirtualizer({
    count: workOrders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const totalWidth = getTotalWidth();

  if (isLoading) {return <WorkOrderTableSkeleton />;}
  if (workOrders.length === 0) {return <WorkOrderTableEmpty />;}

  return (
    <TooltipProvider delayDuration={300}>
      <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${totalWidth}px` }}>
            <TableHeader sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
            <div ref={parentRef} className="h-[600px] overflow-auto" style={{ contain: "strict" }}>
              <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const order = workOrders[virtualRow.index];
                  return (
                    <WorkOrderRow
                      key={order.id}
                      order={order}
                      virtualRow={virtualRow}
                      getEquipmentName={getEquipmentName}
                      getVesselName={getVesselName}
                      getCrewName={getCrewName}
                      onView={onView}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <TableFooter count={workOrders.length} />
      </div>
    </TooltipProvider>
  );
}

function TableHeader({ sortColumn, sortDirection, onSort }: { sortColumn: string; sortDirection: "asc" | "desc"; onSort: (col: string) => void }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 px-4 py-3.5 flex items-center">
      {COLUMNS.map((col, idx) => (
        <div key={col.key} style={{ width: col.width, minWidth: col.width }} className={cn("pr-3", col.flex && "flex-1", idx === COLUMNS.length - 1 && "text-right")}>
          {["woNumber", "vessel", "equipment", "priority", "status", "dueDate", "createdAt"].includes(col.key) ? (
            <SortableHeader columnKey={col.key} sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort}>
              {col.label}
            </SortableHeader>
          ) : (
            <span className="font-semibold text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">{col.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}

interface WorkOrderRowProps {
  order: WorkOrder;
  virtualRow: { index: number; size: number; start: number };
  getEquipmentName: (id: string) => string;
  getVesselName: (id: string | null) => string;
  getCrewName: (id: string | null) => string;
  onView: (order: WorkOrder) => void;
  onEdit: (order: WorkOrder) => void;
  onDelete: (order: WorkOrder) => void;
}

function WorkOrderRow({ order, virtualRow, getEquipmentName, getVesselName, getCrewName, onView, onEdit, onDelete }: WorkOrderRowProps) {
  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.open;
  const priorityConfig = PRIORITY_CONFIG[order.priority] || PRIORITY_CONFIG[3];
  const StatusIcon = statusConfig.icon;

  return (
    <div
      data-testid={`row-wo-${order.id}`}
      role="button"
      tabIndex={0}
      className={cn(
        "absolute left-0 w-full flex items-center px-4 border-b border-slate-100 dark:border-slate-800",
        "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer",
        virtualRow.index % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/20"
      )}
      style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
      onClick={() => onView(order)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView(order); } }}
    >
      <Cell width={COLUMNS[0].width}>
        <span className="font-mono text-sm font-medium text-slate-900 dark:text-white">
          {order.woNumber || `WO-${order.id.slice(0, 6).toUpperCase()}`}
        </span>
      </Cell>
      <Cell width={COLUMNS[1].width}>
        <TruncatedCell text={getVesselName(order.vesselId)} className="text-sm text-slate-700 dark:text-slate-300" maxWidth={COLUMNS[1].width - 12} />
      </Cell>
      <Cell width={COLUMNS[2].width}>
        <TruncatedCell text={getEquipmentName(order.equipmentId)} className="text-sm font-medium text-slate-900 dark:text-white" maxWidth={COLUMNS[2].width - 12} />
      </Cell>
      <Cell width={COLUMNS[3].width} flex>
        <TruncatedCell text={order.reason || ""} className="text-sm text-slate-600 dark:text-slate-400" maxWidth={COLUMNS[3].width - 12} />
      </Cell>
      <Cell width={COLUMNS[4].width}>
        <Badge variant="outline" className={cn("text-xs font-medium px-2.5 py-0.5", priorityConfig.className)}>{priorityConfig.label}</Badge>
      </Cell>
      <Cell width={COLUMNS[5].width}>
        <Badge variant="outline" className={cn("text-xs font-medium px-2.5 py-0.5 inline-flex items-center gap-1.5", statusConfig.className)}>
          <StatusIcon className="h-3.5 w-3.5" />
          <span>{statusConfig.label}</span>
        </Badge>
      </Cell>
      <Cell width={COLUMNS[6].width}>
        <TruncatedCell text={getCrewName(order.assignedCrewId)} className={cn("text-sm", order.assignedCrewId ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500 italic")} maxWidth={COLUMNS[6].width - 12} />
      </Cell>
      <Cell width={COLUMNS[7].width}>
        {order.plannedEndDate ? (
          <span className="text-sm text-slate-700 dark:text-slate-300">{format(new Date(order.plannedEndDate), "MMM d, yyyy")}</span>
        ) : (
          <span className="text-sm text-slate-400 dark:text-slate-500">—</span>
        )}
      </Cell>
      <Cell width={COLUMNS[8].width}>
        {order.createdAt ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm text-slate-500 dark:text-slate-400 cursor-default">{formatDistanceToNow(new Date(order.createdAt), { addSuffix: false })}</span>
            </TooltipTrigger>
            <TooltipContent side="top"><p className="text-sm">{format(new Date(order.createdAt), "PPpp")}</p></TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-sm text-slate-400 dark:text-slate-500">—</span>
        )}
      </Cell>
      <div style={{ width: COLUMNS[9].width, minWidth: COLUMNS[9].width }} className="flex items-center justify-end gap-0.5" onMouseDown={(e) => e.stopPropagation()} role="presentation">
        <ActionButton icon={Eye} tooltip="View Details" onClick={() => onView(order)} testId={`button-view-wo-${order.id}`} />
        <ActionButton icon={Edit} tooltip="Edit" onClick={() => onEdit(order)} testId={`button-edit-wo-${order.id}`} />
        <ActionButton icon={Trash2} tooltip="Delete" onClick={() => onDelete(order)} testId={`button-delete-wo-${order.id}`} variant="danger" />
      </div>
    </div>
  );
}

function Cell({ width, flex, children }: { width: number; flex?: boolean; children: React.ReactNode }) {
  return <div style={{ width, minWidth: width }} className={cn("pr-3", flex && "flex-1")}>{children}</div>;
}

function ActionButton({ icon: Icon, tooltip, onClick, testId, variant }: { icon: typeof Eye; tooltip: string; onClick: () => void; testId: string; variant?: "danger" }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("h-8 w-8", variant === "danger" ? "text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white")} onClick={onClick} data-testid={testId}>
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function TableFooter({ count }: { count: number }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{count} work order{count !== 1 ? "s" : ""}</span>
      <span className="text-xs text-slate-400 dark:text-slate-500">Click any row to view details</span>
    </div>
  );
}

export default VirtualizedWorkOrderTable;

```

### `client/src/components/work-orders/WorkOrderCloneDialog.tsx` (278 lines)

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Calendar, CheckSquare, Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WorkOrder } from "@shared/schema";

const cloneFormSchema = z.object({
  plannedStartDate: z.string().optional(),
  plannedEndDate: z.string().optional(),
  includeTasks: z.boolean().default(true),
  includeParts: z.boolean().default(true),
}).refine(
  (data) => {
    if (data.plannedStartDate && data.plannedEndDate) {
      return new Date(data.plannedEndDate) >= new Date(data.plannedStartDate);
    }
    return true;
  },
  {
    message: "End date must be after start date",
    path: ["plannedEndDate"],
  }
);

type CloneFormValues = z.infer<typeof cloneFormSchema>;

interface WorkOrderCloneDialogProps {
  workOrder: WorkOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (clonedWorkOrder: WorkOrder) => void;
}

export function WorkOrderCloneDialog({
  workOrder,
  open,
  onOpenChange,
  onSuccess,
}: WorkOrderCloneDialogProps) {
  const { toast } = useToast();
  const _queryClient = useQueryClient();

  const form = useForm<CloneFormValues>({
    resolver: zodResolver(cloneFormSchema),
    defaultValues: {
      plannedStartDate: "",
      plannedEndDate: "",
      includeTasks: true,
      includeParts: true,
    },
  });

  const cloneMutation = useMutation({
    mutationFn: async (values: CloneFormValues) => {
      if (!workOrder) {throw new Error("No work order to clone");}

      const payload: Record<string, unknown> = {
        includeTasks: values.includeTasks,
        includeParts: values.includeParts,
      };

      if (values.plannedStartDate) {
        payload.plannedStartDate = new Date(values.plannedStartDate).toISOString();
      }

      if (values.plannedEndDate) {
        payload.plannedEndDate = new Date(values.plannedEndDate).toISOString();
      }

      return apiRequest<WorkOrder>("POST", `/api/work-orders/${workOrder.id}/clone`, payload);
    },
    onSuccess: (clonedWorkOrder) => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      toast({
        title: "Work Order Cloned",
        description: `Created new work order ${clonedWorkOrder.woNumber}`,
      });
      onOpenChange(false);
      form.reset();
      onSuccess?.(clonedWorkOrder);
    },
    onError: (error) => {
      toast({
        title: "Clone Failed",
        description: error instanceof Error ? error.message : "Failed to clone work order",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: CloneFormValues) => {
    cloneMutation.mutate(values);
  };

  if (!workOrder) {return null;}

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="work-order-clone-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Clone Work Order
          </DialogTitle>
          <DialogDescription>
            Create a copy of work order <span className="font-medium">{workOrder.woNumber || workOrder.id.slice(0, 8)}</span>.
            The new work order will have status "Open" with a new WO number.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="rounded-lg border p-4 bg-muted/30">
              <h4 className="text-sm font-medium mb-2">Original Work Order</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <div><span className="font-medium">Reason:</span> {workOrder.reason || "N/A"}</div>
                <div><span className="font-medium">Type:</span> {workOrder.maintenanceType || "N/A"}</div>
                <div><span className="font-medium">Priority:</span> {workOrder.priority}</div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Schedule (Optional)
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="plannedStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Planned Start</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          data-testid="input-clone-start-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="plannedEndDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Planned End</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          data-testid="input-clone-end-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Leave blank to create work order without scheduled dates.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Include in Clone</h4>
              
              <FormField
                control={form.control}
                name="includeTasks"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-include-tasks"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="flex items-center gap-2">
                        <CheckSquare className="h-4 w-4" />
                        Tasks/Checklist
                      </FormLabel>
                      <FormDescription>
                        Copy all tasks from the original work order (uncompleted)
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="includeParts"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-include-parts"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Parts List
                      </FormLabel>
                      <FormDescription>
                        Copy parts list as planned quantities (no inventory reserved)
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-clone-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={cloneMutation.isPending}
                data-testid="button-clone-submit"
              >
                {cloneMutation.isPending ? (
                  <>
                    <Copy className="mr-2 h-4 w-4 animate-spin" />
                    Cloning...
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Clone Work Order
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

```

### `client/src/components/work-orders/WorkOrderDetailDrawer.tsx` (189 lines)

```tsx
import { Clock, User, Ship, Wrench, Calendar, DollarSign, FileText, Package, ClipboardList, History, Copy, Link2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDistanceToNow, format } from "date-fns";
import { MultiPartSelector } from "@/components/MultiPartSelector";
import { WorkOrderTasksTab } from "./WorkOrderTasksTab";
import { WorkOrderHistoryTab } from "./WorkOrderHistoryTab";
import { WorkOrderRequestsTab } from "./WorkOrderRequestsTab";
import { LinkTemplateDialog } from "./LinkTemplateDialog";
import { cn } from "@/lib/utils";
import { useWorkOrderDetailData } from "@/features/work-orders";
import type { WorkOrder } from "@shared/schema";

interface EquipmentItem { id: string; name: string; type?: string; }
interface VesselItem { id: string; name: string; }
interface CrewItem { id: string; name: string; hourlyRate?: number; rank?: string; }
interface WorkOrderDetailDrawerProps {
  workOrder: WorkOrder | null;
  open: boolean;
  onClose: () => void;
  equipment: EquipmentItem[];
  vessels: VesselItem[];
  crew: CrewItem[];
  onComplete: (workOrderId: string) => void;
  onEdit: (workOrder: WorkOrder) => void;
  onClone?: (workOrder: WorkOrder) => void;
  isCompleting?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-blue-500/20 text-blue-700 dark:text-blue-300" },
  in_progress: { label: "In Progress", className: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300" },
  completed: { label: "Completed", className: "bg-green-500/20 text-green-700 dark:text-green-300" },
  cancelled: { label: "Cancelled", className: "bg-gray-500/20 text-gray-700 dark:text-gray-300" },
  deferred: { label: "Deferred", className: "bg-orange-500/20 text-orange-700 dark:text-orange-300" },
};

const PRIORITY_CONFIG: Record<number, { label: string; className: string }> = {
  1: { label: "High Priority", className: "bg-red-500/20 text-red-700 dark:text-red-300" },
  2: { label: "Medium Priority", className: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300" },
  3: { label: "Low Priority", className: "bg-green-500/20 text-green-700 dark:text-green-300" },
};

function InfoCard({ icon: Icon, label, value, subValue }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; subValue?: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
      <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
      <div>
        <span className="text-xs text-muted-foreground block">{label}</span>
        <span className="text-sm font-medium">{value}</span>
        {subValue && <span className="text-xs text-muted-foreground block">{subValue}</span>}
      </div>
    </div>
  );
}

export function WorkOrderDetailDrawer({ workOrder, open, onClose, equipment, vessels, crew, onComplete, onEdit, onClone, isCompleting = false }: WorkOrderDetailDrawerProps) {
  const {
    activeTab, setActiveTab, linkTemplateDialogOpen, setLinkTemplateDialogOpen,
    workOrderParts, totalPartsCost, totalOtherCosts, grandTotal, invalidateParts, invalidateChecklist,
  } = useWorkOrderDetailData({ workOrder });

  if (!workOrder) {return null;}

  const getEquipmentName = (equipmentId: string) => equipment.find((e) => e.id === equipmentId)?.name || equipmentId?.slice(0, 8) || "Unknown";
  const getEquipmentType = (equipmentId: string) => equipment.find((e) => e.id === equipmentId)?.type || "Equipment";
  const getVesselName = (vesselId: string | null) => !vesselId ? "Not assigned" : vessels.find((v) => v.id === vesselId)?.name || vesselId.slice(0, 8);
  const getCrewName = (crewId: string | null) => !crewId ? "Unassigned" : crew.find((c) => c.id === crewId)?.name || crewId.slice(0, 8);
  const getCrewHourlyRate = (crewId: string | null) => !crewId ? null : crew.find((c) => c.id === crewId)?.hourlyRate || null;
  const assignedCrewRate = getCrewHourlyRate(workOrder.assignedCrewId);
  const calculatedLaborCost = assignedCrewRate && workOrder.laborHours ? assignedCrewRate * workOrder.laborHours : null;

  const statusConfig = STATUS_CONFIG[workOrder.status] || STATUS_CONFIG.open;
  const priorityConfig = PRIORITY_CONFIG[workOrder.priority] || PRIORITY_CONFIG[3];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:w-[540px] lg:w-[640px] p-0 flex flex-col h-dvh max-h-dvh overflow-hidden">
        <SheetHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg sm:text-xl font-semibold flex items-center gap-2 truncate">
                <Wrench className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <span className="truncate">{workOrder.woNumber || workOrder.id.slice(0, 8)}</span>
              </SheetTitle>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">{getEquipmentName(workOrder.equipmentId)}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge className={cn("text-xs", priorityConfig.className)}>{priorityConfig.label}</Badge>
              <Badge className={cn("text-xs", statusConfig.className)}>{statusConfig.label}</Badge>
            </div>
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="w-full justify-start rounded-none border-b px-2 sm:px-6 h-auto py-0 flex-shrink-0 overflow-x-auto">
            <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-2.5 sm:py-3 text-xs sm:text-sm px-2 sm:px-4" data-testid="tab-wo-details"><FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />Details</TabsTrigger>
            <TabsTrigger value="parts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-2.5 sm:py-3 text-xs sm:text-sm px-2 sm:px-4" data-testid="tab-wo-parts"><Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />Parts ({workOrderParts.length})</TabsTrigger>
            <TabsTrigger value="requests" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-2.5 sm:py-3 text-xs sm:text-sm px-2 sm:px-4" data-testid="tab-wo-requests"><Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />Requests</TabsTrigger>
            <TabsTrigger value="tasks" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-2.5 sm:py-3 text-xs sm:text-sm px-2 sm:px-4" data-testid="tab-wo-tasks"><ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />Tasks</TabsTrigger>
            <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-2.5 sm:py-3 text-xs sm:text-sm px-2 sm:px-4" data-testid="tab-wo-history"><History className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />History</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto min-h-0">
            <TabsContent value="details" className="mt-0 p-4 sm:p-6 space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <InfoCard icon={Ship} label="Vessel" value={getVesselName(workOrder.vesselId)} />
                <InfoCard icon={Wrench} label="Equipment" value={getEquipmentName(workOrder.equipmentId)} subValue={getEquipmentType(workOrder.equipmentId)} />
                <InfoCard icon={User} label="Assigned To" value={getCrewName(workOrder.assignedCrewId)} subValue={assignedCrewRate ? `$${assignedCrewRate.toFixed(2)}/hr` : undefined} />
                <InfoCard icon={Calendar} label="Due Date" value={workOrder.plannedEndDate ? format(new Date(workOrder.plannedEndDate), "MMM d, yyyy") : "Not set"} />
              </div>
              <Separator />
              <div><h4 className="font-medium mb-2">Reason</h4><p className="text-sm text-muted-foreground">{workOrder.reason || "No reason provided"}</p></div>
              {workOrder.description && <div><h4 className="font-medium mb-2">Description</h4><p className="text-sm text-muted-foreground whitespace-pre-wrap">{workOrder.description}</p></div>}
              <Separator />
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2"><DollarSign className="h-4 w-4" />Cost Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Parts Cost</span><span>${totalPartsCost.toFixed(2)}</span></div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Labor Cost</span>
                    <div className="text-right">
                      <span>${(workOrder.laborCost || 0).toFixed(2)}</span>
                      {calculatedLaborCost !== null && calculatedLaborCost !== workOrder.laborCost && (
                        <span className="text-xs text-muted-foreground block">Est: ${calculatedLaborCost.toFixed(2)} ({workOrder.laborHours}h x ${assignedCrewRate?.toFixed(2)}/hr)</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Other Costs</span><span>${totalOtherCosts.toFixed(2)}</span></div>
                  <Separator />
                  <div className="flex justify-between font-medium"><span>Total Cost</span><span>${grandTotal.toFixed(2)}</span></div>
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2"><Clock className="h-4 w-4" />Time Tracking</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground block">Estimated Hours</span><span>{workOrder.estimatedDowntimeHours || "—"}h</span></div>
                  <div><span className="text-muted-foreground block">Actual Hours</span><span>{workOrder.actualDowntimeHours || "—"}h</span></div>
                  <div><span className="text-muted-foreground block">Created</span><span>{workOrder.createdAt ? formatDistanceToNow(new Date(workOrder.createdAt), { addSuffix: true }) : "Unknown"}</span></div>
                  <div><span className="text-muted-foreground block">Last Updated</span><span>{workOrder.updatedAt ? formatDistanceToNow(new Date(workOrder.updatedAt), { addSuffix: true }) : "Unknown"}</span></div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="parts" className="mt-0 p-4 sm:p-6">
              <MultiPartSelector workOrderId={workOrder.id} onPartsAdded={invalidateParts} />
            </TabsContent>

            <TabsContent value="requests" className="mt-0 p-4 sm:p-6">
              <WorkOrderRequestsTab workOrderId={workOrder.id} isReadOnly={workOrder.status === "completed" || workOrder.status === "cancelled"} />
            </TabsContent>

            <TabsContent value="tasks" className="mt-0 p-4 sm:p-6">
              <WorkOrderTasksTab workOrderId={workOrder.id} isReadOnly={workOrder.status === "completed" || workOrder.status === "cancelled"} />
            </TabsContent>

            <TabsContent value="history" className="mt-0 p-4 sm:p-6">
              <WorkOrderHistoryTab workOrderId={workOrder.id} />
            </TabsContent>
          </div>
        </Tabs>

        <div className="border-t px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-background flex-shrink-0">
          <Button variant="outline" onClick={onClose} data-testid="button-close-wo-drawer" className="order-last sm:order-first">Close</Button>
          <div className="flex flex-wrap gap-2 justify-end">
            {workOrder.status !== "completed" && workOrder.status !== "cancelled" && (
              <Button variant="outline" size="sm" onClick={() => setLinkTemplateDialogOpen(true)} data-testid="button-link-template-drawer" className="text-xs sm:text-sm">
                <Link2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" /><span className="hidden xs:inline">Link </span>Template
              </Button>
            )}
            {onClone && <Button variant="outline" size="sm" onClick={() => onClone(workOrder)} data-testid="button-clone-wo-drawer" className="text-xs sm:text-sm"><Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />Clone</Button>}
            <Button variant="outline" size="sm" onClick={() => onEdit(workOrder)} data-testid="button-edit-wo-drawer" className="text-xs sm:text-sm">Edit</Button>
            {workOrder.status !== "completed" && workOrder.status !== "cancelled" && (
              <Button size="sm" onClick={() => onComplete(workOrder.id)} disabled={isCompleting} data-testid="button-complete-wo-drawer" className="text-xs sm:text-sm">{isCompleting ? "Completing..." : "Complete"}</Button>
            )}
          </div>
        </div>

        <LinkTemplateDialog workOrderId={workOrder.id} equipmentType={getEquipmentType(workOrder.equipmentId)} open={linkTemplateDialogOpen} onOpenChange={setLinkTemplateDialogOpen} onSuccess={invalidateChecklist} />
      </SheetContent>
    </Sheet>
  );
}

export default WorkOrderDetailDrawer;

```

### `client/src/components/work-orders/WorkOrderFilterPanel.tsx` (130 lines)

```tsx
import { Filter, X, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  useWorkOrderFilterData,
  WorkOrderFilters,
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  EQUIPMENT_CATEGORIES,
} from "@/features/work-orders/hooks/useWorkOrderFilterData";

interface WorkOrderFilterPanelProps {
  filters: WorkOrderFilters;
  onFiltersChange: (filters: WorkOrderFilters) => void;
  className?: string;
}

export function WorkOrderFilterPanel({ filters, onFiltersChange, className }: WorkOrderFilterPanelProps) {
  const {
    localFilters, vessels, engineers, activeFilterCount, isOpen, setIsOpen,
    mobileOpen, setMobileOpen, updateFilter, clearAllFilters, removeFilter,
    getStatusLabel, getPriorityLabel, getVesselName, getEngineerName,
  } = useWorkOrderFilterData(filters, onFiltersChange);

  const filterContent = (
    <div className="space-y-4">
      <div>
        <Label htmlFor="search" className="text-sm font-medium">Search</Label>
        <Input id="search" placeholder="WO number, equipment, description..." value={localFilters.search} onChange={(e) => updateFilter("search", e.target.value)} className="mt-1.5" data-testid="input-wo-search" />
      </div>
      <Separator />
      <div>
        <Label className="text-sm font-medium">Status</Label>
        <Select value={localFilters.status} onValueChange={(value) => updateFilter("status", value)}>
          <SelectTrigger className="mt-1.5" data-testid="select-wo-status"><SelectValue placeholder="Select status" /></SelectTrigger>
          <SelectContent>{STATUS_OPTIONS.map((option) => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}</SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-sm font-medium">Priority</Label>
        <Select value={localFilters.priority} onValueChange={(value) => updateFilter("priority", value)}>
          <SelectTrigger className="mt-1.5" data-testid="select-wo-priority"><SelectValue placeholder="Select priority" /></SelectTrigger>
          <SelectContent>{PRIORITY_OPTIONS.map((option) => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}</SelectContent>
        </Select>
      </div>
      <Separator />
      <div>
        <Label className="text-sm font-medium">Vessel</Label>
        <Select value={localFilters.vesselId} onValueChange={(value) => updateFilter("vesselId", value)}>
          <SelectTrigger className="mt-1.5" data-testid="select-wo-vessel"><SelectValue placeholder="Select vessel" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Vessels</SelectItem>{vessels.filter((v) => v.id).map((vessel) => (<SelectItem key={vessel.id} value={vessel.id}>{vessel.name}</SelectItem>))}</SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-sm font-medium">Assigned Engineer</Label>
        <Select value={localFilters.engineerId} onValueChange={(value) => updateFilter("engineerId", value)}>
          <SelectTrigger className="mt-1.5" data-testid="select-wo-engineer"><SelectValue placeholder="Select engineer" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Engineers</SelectItem>{engineers.map((engineer) => (<SelectItem key={engineer.id} value={engineer.id}>{engineer.name}</SelectItem>))}</SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-sm font-medium">Equipment Category</Label>
        <Select value={localFilters.equipmentCategory} onValueChange={(value) => updateFilter("equipmentCategory", value)}>
          <SelectTrigger className="mt-1.5" data-testid="select-wo-equipment-category"><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>{EQUIPMENT_CATEGORIES.map((category) => (<SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>))}</SelectContent>
        </Select>
      </div>
      <Separator />
      <div>
        <Label className="text-sm font-medium flex items-center gap-1.5"><Calendar className="h-4 w-4" />Due Date Range</Label>
        <div className="grid grid-cols-2 gap-2 mt-1.5">
          <div><Label className="text-xs text-muted-foreground">From</Label><Input type="date" value={localFilters.dueDateFrom} onChange={(e) => updateFilter("dueDateFrom", e.target.value)} className="mt-1" data-testid="input-wo-due-from" /></div>
          <div><Label className="text-xs text-muted-foreground">To</Label><Input type="date" value={localFilters.dueDateTo} onChange={(e) => updateFilter("dueDateTo", e.target.value)} className="mt-1" data-testid="input-wo-due-to" /></div>
        </div>
      </div>
      {activeFilterCount > 0 && (<><Separator /><Button variant="outline" onClick={clearAllFilters} className="w-full" data-testid="button-clear-wo-filters"><X className="h-4 w-4 mr-2" />Clear All Filters ({activeFilterCount})</Button></>)}
    </div>
  );

  const activeFilterBadges = (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {localFilters.search && (<Badge variant="secondary" className="text-xs">Search: "{localFilters.search}"<button onClick={() => removeFilter("search")} className="ml-1"><X className="h-3 w-3" /></button></Badge>)}
      {localFilters.status !== "all" && (<Badge variant="secondary" className="text-xs">Status: {getStatusLabel(localFilters.status)}<button onClick={() => removeFilter("status")} className="ml-1"><X className="h-3 w-3" /></button></Badge>)}
      {localFilters.priority !== "all" && (<Badge variant="secondary" className="text-xs">Priority: {getPriorityLabel(localFilters.priority)}<button onClick={() => removeFilter("priority")} className="ml-1"><X className="h-3 w-3" /></button></Badge>)}
      {localFilters.vesselId !== "all" && (<Badge variant="secondary" className="text-xs">Vessel: {getVesselName(localFilters.vesselId) || "Selected"}<button onClick={() => removeFilter("vesselId")} className="ml-1"><X className="h-3 w-3" /></button></Badge>)}
      {localFilters.engineerId !== "all" && (<Badge variant="secondary" className="text-xs">Engineer: {getEngineerName(localFilters.engineerId) || "Selected"}<button onClick={() => removeFilter("engineerId")} className="ml-1"><X className="h-3 w-3" /></button></Badge>)}
      {localFilters.equipmentCategory !== "all" && (<Badge variant="secondary" className="text-xs">Category: {localFilters.equipmentCategory}<button onClick={() => removeFilter("equipmentCategory")} className="ml-1"><X className="h-3 w-3" /></button></Badge>)}
      {(localFilters.dueDateFrom || localFilters.dueDateTo) && (<Badge variant="secondary" className="text-xs">Due: {localFilters.dueDateFrom || "∞"} - {localFilters.dueDateTo || "∞"}<button onClick={() => { removeFilter("dueDateFrom"); removeFilter("dueDateTo"); }} className="ml-1"><X className="h-3 w-3" /></button></Badge>)}
    </div>
  );

  return (
    <>
      <div className={cn("hidden lg:block w-72 shrink-0", className)}>
        <div className="bg-card rounded-lg border p-4 sticky top-4">
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto font-semibold">
                <span className="flex items-center gap-2"><Filter className="h-4 w-4" />Filters{activeFilterCount > 0 && (<Badge variant="secondary" className="ml-1">{activeFilterCount}</Badge>)}</span>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">{filterContent}</CollapsibleContent>
          </Collapsible>
        </div>
      </div>
      <div className="lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild><Button variant="outline" className="gap-2" data-testid="button-wo-mobile-filters"><Filter className="h-4 w-4" />Filters{activeFilterCount > 0 && (<Badge variant="secondary">{activeFilterCount}</Badge>)}</Button></SheetTrigger>
          <SheetContent side="left" className="w-80 overflow-y-auto">
            <SheetHeader><SheetTitle>Filter Work Orders</SheetTitle></SheetHeader>
            <div className="py-4">{filterContent}</div>
            <SheetFooter><Button onClick={() => setMobileOpen(false)} className="w-full">Apply Filters</Button></SheetFooter>
          </SheetContent>
        </Sheet>
        {activeFilterCount > 0 && activeFilterBadges}
      </div>
    </>
  );
}

export default WorkOrderFilterPanel;
export type { WorkOrderFilters };

```

### `client/src/components/work-orders/WorkOrderFormDialog.tsx` (66 lines)

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Wrench, FileText, Clock } from "lucide-react";
import type { WorkOrder } from "@shared/schema";
import { useWorkOrderFormDialogData, MAINTENANCE_TYPES, PRIORITY_OPTIONS, STATUS_OPTIONS, type WorkOrderFormData } from "@/features/work-orders";

interface WorkOrderFormDialogProps { open: boolean; onOpenChange: (open: boolean) => void; mode: "create" | "edit"; workOrder?: WorkOrder | null; onSubmit: (data: WorkOrderFormData & { templateId?: string }) => void; isSubmitting?: boolean; defaultVesselId?: string; defaultEquipmentId?: string; }

export function WorkOrderFormDialog({ open, onOpenChange, mode, workOrder, onSubmit, isSubmitting = false, defaultVesselId, defaultEquipmentId }: WorkOrderFormDialogProps) {
  const { form, isEditMode, selectedVesselId, selectedEquipmentId, selectedTemplateId, vessels, filteredEquipment, crewMembers, filteredTemplates, applyTemplate, clearTemplate } = useWorkOrderFormDialogData({ open, mode, workOrder, defaultVesselId, defaultEquipmentId });

  const handleSubmit = (data: WorkOrderFormData) => onSubmit({ ...data, templateId: selectedTemplateId || undefined });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="work-order-form-dialog">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" />{isEditMode ? "Edit Work Order" : "Create Work Order"}</DialogTitle><DialogDescription>{isEditMode ? `Update work order ${workOrder?.woNumber || workOrder?.id || ""}` : "Create a new maintenance work order for equipment"}</DialogDescription></DialogHeader>
        <Form {...form}><form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="vesselId" render={({ field }) => (<FormItem><FormLabel>Vessel *</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isEditMode}><FormControl><SelectTrigger data-testid="select-vessel"><SelectValue placeholder="Select vessel" /></SelectTrigger></FormControl><SelectContent>{vessels.filter((v) => v.id && v.name).map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="equipmentId" render={({ field }) => (<FormItem><FormLabel>Equipment *</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isEditMode || !selectedVesselId}><FormControl><SelectTrigger data-testid="select-equipment"><SelectValue placeholder={isEditMode ? "Loading..." : (selectedVesselId ? "Select equipment" : "Select vessel first")} /></SelectTrigger></FormControl><SelectContent>{filteredEquipment.filter((eq) => eq.id && eq.id.trim() !== "").map((eq) => <SelectItem key={eq.id} value={eq.id}>{eq.name || eq.id} {eq.type ? `(${eq.type})` : ""}</SelectItem>)}</SelectContent></Select>{!isEditMode && selectedVesselId && filteredEquipment.length === 0 && <FormDescription className="text-muted-foreground">No equipment found for this vessel</FormDescription>}<FormMessage /></FormItem>)} />
          </div>

          {!isEditMode && selectedEquipmentId && filteredTemplates.length > 0 && (<div className="space-y-2" data-testid="template-selector-section"><Separator className="my-2" /><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /><FormLabel className="text-sm font-medium">Apply Maintenance Template</FormLabel></div><div className="flex items-center gap-2"><Select value={selectedTemplateId} onValueChange={(value) => value === "none" ? clearTemplate() : applyTemplate(value)}><SelectTrigger data-testid="select-template" className="flex-1"><SelectValue placeholder="Select a template to pre-fill form (optional)" /></SelectTrigger><SelectContent><SelectItem value="none" data-testid="template-option-none"><span className="text-muted-foreground">No template</span></SelectItem>{filteredTemplates.map((template) => <SelectItem key={template.id} value={template.id} data-testid={`template-option-${template.id}`}><div className="flex items-center gap-2"><span data-testid={`template-name-${template.id}`}>{template.name}</span>{template.priority && template.priority <= 2 && <Badge variant="outline" className="text-xs" data-testid={`template-priority-${template.id}`}>P{template.priority}</Badge>}{template.estimatedDurationHours && <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`template-duration-${template.id}`}><Clock className="h-3 w-3" />{template.estimatedDurationHours}h</span>}</div></SelectItem>)}</SelectContent></Select>{selectedTemplateId && <Button type="button" variant="ghost" size="sm" onClick={clearTemplate} data-testid="button-clear-template">Clear</Button>}</div>{selectedTemplateId && <FormDescription className="text-xs text-green-600" data-testid="template-applied-status">Template applied - form fields have been pre-filled</FormDescription>}<Separator className="my-2" /></div>)}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="maintenanceType" render={({ field }) => (<FormItem><FormLabel>Maintenance Type</FormLabel><Select onValueChange={field.onChange} value={field.value || ""}><FormControl><SelectTrigger data-testid="select-maintenance-type"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{MAINTENANCE_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="priority" render={({ field }) => (<FormItem><FormLabel>Priority</FormLabel><Select onValueChange={(value) => field.onChange(Number.parseInt(value))} value={field.value?.toString() || "3"}><FormControl><SelectTrigger data-testid="select-priority"><SelectValue placeholder="Select priority" /></SelectTrigger></FormControl><SelectContent>{PRIORITY_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value.toString()}><span className={option.color}>{option.label}</span></SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
          </div>

          {isEditMode && <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger data-testid="select-status"><SelectValue placeholder="Select status" /></SelectTrigger></FormControl><SelectContent>{STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />}

          <FormField control={form.control} name="assignedCrewId" render={({ field }) => (<FormItem><FormLabel>Assign to Crew Member</FormLabel><Select onValueChange={field.onChange} value={field.value || ""} disabled={!selectedVesselId}><FormControl><SelectTrigger data-testid="select-crew"><SelectValue placeholder={selectedVesselId ? "Select crew member (optional)" : "Select vessel first"} /></SelectTrigger></FormControl><SelectContent>{crewMembers.filter((c) => c.id && c.name).map((c) => <SelectItem key={c.id} value={c.id}>{c.name} - {c.rank || "Crew"}</SelectItem>)}</SelectContent></Select>{selectedVesselId && crewMembers.length === 0 && <FormDescription className="text-muted-foreground">No crew members found for this vessel</FormDescription>}<FormMessage /></FormItem>)} />

          <FormField control={form.control} name="reason" render={({ field }) => (<FormItem><FormLabel>Reason *</FormLabel><FormControl><Textarea {...field} placeholder="Describe the maintenance issue..." data-testid="input-reason" /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} placeholder="Additional details (optional)" data-testid="input-description" /></FormControl><FormMessage /></FormItem>)} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="plannedStartDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Planned Start Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")} data-testid="input-planned-start-date">{field.value ? format(field.value, "PPP") : "Pick a date"}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="plannedEndDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Planned End Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")} data-testid="input-planned-end-date">{field.value ? format(field.value, "PPP") : "Pick a date"}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} disabled={(date) => { const startDate = form.getValues("plannedStartDate"); return startDate ? date < startDate : false; }} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="estimatedHours" render={({ field }) => (<FormItem><FormLabel>Estimated Hours</FormLabel><FormControl><Input type="number" step="0.5" min="0" placeholder="0.0" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value)} onBlur={field.onBlur} name={field.name} ref={field.ref} data-testid="input-estimated-hours" /></FormControl><FormDescription>Estimated labor hours for this work order</FormDescription><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="estimatedDowntimeHours" render={({ field }) => (<FormItem><FormLabel>Estimated Downtime (hours)</FormLabel><FormControl><Input type="number" step="0.5" min="0" placeholder="0.0" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value)} onBlur={field.onBlur} name={field.name} ref={field.ref} data-testid="input-estimated-downtime" /></FormControl><FormMessage /></FormItem>)} />
          </div>

          <FormField control={form.control} name="affectsVesselDowntime" render={({ field }) => (<FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-affects-downtime" /></FormControl><div className="space-y-1 leading-none"><FormLabel>Affects Vessel Downtime</FormLabel><FormDescription>Track this work order as impacting vessel operational availability</FormDescription></div></FormItem>)} />

          <div className="flex justify-end gap-3 pt-4"><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting} data-testid="button-cancel">Cancel</Button><Button type="submit" disabled={isSubmitting} data-testid="button-submit">{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isEditMode ? "Update Work Order" : "Create Work Order"}</Button></div>
        </form></Form>
      </DialogContent>
    </Dialog>
  );
}

```

### `client/src/components/work-orders/WorkOrderHistoryTab.tsx` (266 lines)

```tsx
import { useQuery } from "@tanstack/react-query";
import {
  History,
  AlertCircle,
  CheckCircle2,
  Package,
  ClipboardCheck,
  Edit3,
  UserPlus,
  Flag,
  ArrowRight,
  Clock,
  Loader2,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import type { WorkOrderHistory, InventoryMovement } from "@shared/schema";

interface WorkOrderHistoryTabProps {
  workOrderId: string;
}

interface WorkOrderHistoryResponse {
  history: WorkOrderHistory[];
  inventoryMovements: InventoryMovement[];
}

type LucideIcon = React.ComponentType<{ className?: string }>;
const EVENT_TYPE_CONFIG: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  created: { icon: Clock, color: "text-blue-500", label: "Created" },
  status_changed: { icon: ArrowRight, color: "text-purple-500", label: "Status Changed" },
  priority_changed: { icon: Flag, color: "text-orange-500", label: "Priority Changed" },
  assigned: { icon: UserPlus, color: "text-teal-500", label: "Assigned" },
  part_added: { icon: Package, color: "text-green-500", label: "Part Added" },
  part_removed: { icon: Package, color: "text-red-500", label: "Part Removed" },
  task_added: { icon: ClipboardCheck, color: "text-blue-500", label: "Task Added" },
  task_completed: { icon: CheckCircle2, color: "text-green-500", label: "Task Completed" },
  task_deleted: { icon: ClipboardCheck, color: "text-red-500", label: "Task Deleted" },
  edited: { icon: Edit3, color: "text-yellow-500", label: "Edited" },
  completed: { icon: CheckCircle2, color: "text-green-600", label: "Completed" },
};

const MOVEMENT_TYPE_CONFIG: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  reserve: { icon: ArrowDown, color: "text-yellow-500", label: "Reserved" },
  release: { icon: ArrowUp, color: "text-blue-500", label: "Released" },
  consume: { icon: Package, color: "text-red-500", label: "Consumed" },
  restock: { icon: ArrowUp, color: "text-green-500", label: "Restocked" },
  adjustment: { icon: Edit3, color: "text-purple-500", label: "Adjusted" },
};

export function WorkOrderHistoryTab({ workOrderId }: WorkOrderHistoryTabProps) {
  const { data, isLoading, error } = useQuery<WorkOrderHistoryResponse>({
    queryKey: ["/api/work-orders", workOrderId, "history"],
    queryFn: () => apiRequest<WorkOrderHistoryResponse>("GET", `/api/work-orders/${workOrderId}/history`),
    enabled: !!workOrderId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium">Failed to Load History</h3>
        <p className="text-muted-foreground mt-1">
          Unable to retrieve audit trail. Please try again.
        </p>
      </div>
    );
  }

  const historyEntries: WorkOrderHistory[] = data?.history ?? [];
  const inventoryMovements: InventoryMovement[] = data?.inventoryMovements ?? [];

  const combinedTimeline = [
    ...historyEntries.map((entry) => ({
      type: "history" as const,
      date: entry.createdAt ? new Date(entry.createdAt) : null,
      data: entry,
    })),
    ...inventoryMovements.map((movement) => ({
      type: "inventory" as const,
      date: movement.createdAt ? new Date(movement.createdAt) : null,
      data: movement,
    })),
  ].sort((a, b) => {
    const aTime = a.date?.getTime() ?? 0;
    const bTime = b.date?.getTime() ?? 0;
    return bTime - aTime;
  });

  if (combinedTimeline.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <History className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No History Yet</h3>
        <p className="text-muted-foreground mt-1 max-w-sm">
          Changes to this work order will appear here as an audit trail.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <History className="h-5 w-5" />
          Audit Trail
        </h3>
        <Badge variant="secondary" data-testid="badge-history-count">
          {combinedTimeline.length} {combinedTimeline.length === 1 ? "event" : "events"}
        </Badge>
      </div>

      <Separator />

      <div className="relative">
        <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />
        
        <div className="space-y-6">
          {combinedTimeline.map((item, index) => (
            <TimelineItem
              key={item.type === "history" ? `h-${item.data.id}` : `i-${item.data.id}`}
              item={item}
              isFirst={index === 0}
              isLast={index === combinedTimeline.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TimelineItem({
  item,
  isFirst,
  isLast: _isLast,
}: {
  item: { type: "history" | "inventory"; date: Date | null; data: WorkOrderHistory | InventoryMovement };
  isFirst: boolean;
  isLast: boolean;
}) {
  if (item.type === "history") {
    return <HistoryTimelineItem entry={item.data as WorkOrderHistory} isFirst={isFirst} />;
  }
  return <InventoryTimelineItem movement={item.data as InventoryMovement} isFirst={isFirst} />;
}

function HistoryTimelineItem({
  entry,
  isFirst,
}: {
  entry: WorkOrderHistory;
  isFirst: boolean;
}) {
  const config = EVENT_TYPE_CONFIG[entry.eventType] || {
    icon: Edit3,
    color: "text-gray-500",
    label: entry.eventType,
  };
  const Icon = config.icon;

  return (
    <div className="relative flex gap-4 pl-1" data-testid={`timeline-history-${entry.id}`}>
      <div
        className={cn(
          "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background",
          isFirst ? "border-primary" : "border-border"
        )}
      >
        <Icon className={cn("h-4 w-4", config.color)} />
      </div>
      
      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{config.label}</span>
          {entry.previousValue && entry.newValue && (
            <span className="text-xs text-muted-foreground">
              {entry.previousValue} <ArrowRight className="h-3 w-3 inline" /> {entry.newValue}
            </span>
          )}
        </div>
        
        <p className="text-sm text-muted-foreground mt-0.5">
          {entry.description}
        </p>
        
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <span>{entry.performedByName || entry.performedBy}</span>
          <span>•</span>
          <span title={entry.createdAt ? format(new Date(entry.createdAt), "PPpp") : "Unknown"}>
            {entry.createdAt ? formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true }) : "Unknown"}
          </span>
        </div>
      </div>
    </div>
  );
}

function InventoryTimelineItem({
  movement,
  isFirst,
}: {
  movement: InventoryMovement;
  isFirst: boolean;
}) {
  const config = MOVEMENT_TYPE_CONFIG[movement.movementType] || {
    icon: Package,
    color: "text-gray-500",
    label: movement.movementType,
  };
  const Icon = config.icon;

  const quantityChange = movement.quantity;
  const isPositive = quantityChange > 0;

  return (
    <div className="relative flex gap-4 pl-1" data-testid={`timeline-inventory-${movement.id}`}>
      <div
        className={cn(
          "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background",
          isFirst ? "border-primary" : "border-border"
        )}
      >
        <Icon className={cn("h-4 w-4", config.color)} />
      </div>
      
      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">Inventory {config.label}</span>
          <Badge variant={isPositive ? "default" : "secondary"} className="text-xs">
            {isPositive ? "+" : ""}{quantityChange}
          </Badge>
        </div>
        
        <p className="text-sm text-muted-foreground mt-0.5">
          Stock: {movement.quantityBefore} → {movement.quantityAfter}
          {movement.notes && ` — ${movement.notes}`}
        </p>
        
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <span>{movement.performedBy}</span>
          <span>•</span>
          <span title={movement.createdAt ? format(new Date(movement.createdAt), "PPpp") : "Unknown"}>
            {movement.createdAt ? formatDistanceToNow(new Date(movement.createdAt), { addSuffix: true }) : "Unknown"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default WorkOrderHistoryTab;

```

### `client/src/components/work-orders/WorkOrderRequestsTab.tsx` (265 lines)

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, Package, Plus, Loader2, Trash2 } from "lucide-react";
import { MultiLinePartsRequestDialog } from "./MultiLinePartsRequestDialog";
import { EnhancedServiceRequestDialog } from "./EnhancedServiceRequestDialog";
import {
  useWorkOrderRequests,
  useOutOfStockSuggestions,
  ServiceOrderCard,
  PartsRequestCard,
} from "@/features/work-orders";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ServiceOrderCardData } from "@/features/work-orders/components/ServiceOrderCard";
import type { PartsRequestCardData } from "@/features/work-orders/components/PartsRequestCard";

interface WorkOrderRequestsTabProps {
  workOrderId: string;
  isReadOnly?: boolean;
}

export function WorkOrderRequestsTab({ workOrderId, isReadOnly = false }: WorkOrderRequestsTabProps) {
  const [soDialogOpen, setSoDialogOpen] = useState(false);
  const [prDialogOpen, setPrDialogOpen] = useState(false);
  const [editingSO, setEditingSO] = useState<ServiceOrderCardData | null>(null);
  const [editingPR, setEditingPR] = useState<PartsRequestCardData | null>(null);

  const { canApprove, canEdit } = useUserPermissions();
  const canApprovePR = canApprove("purchase_requests");
  const canApproveSO = canApprove("service_orders");
  const canEditPR = canEdit("purchase_requests");
  const canEditSO = canEdit("service_orders");

  const {
    serviceOrders,
    isLoadingServiceOrders,
    purchaseRequests,
    isLoadingPurchaseRequests,
    createServiceOrder,
    isCreatingServiceOrder,
    createPurchaseRequest,
    isCreatingPurchaseRequest,
    deleteServiceOrder,
    isDeletingServiceOrder,
    deletingServiceOrderId,
    deletePurchaseRequest,
    isDeletingPurchaseRequest,
    deletingPurchaseRequestId,
    fulfillItem,
    isFulfillingItem,
    updatePRStatus,
    isUpdatingPRStatus,
    updateServiceOrder,
    isUpdatingServiceOrder,
    updatePurchaseRequest,
    isUpdatingPurchaseRequest,
    bulkDeleteServiceOrders,
    isBulkDeletingServiceOrders,
    bulkDeletePurchaseRequests,
    isBulkDeletingPurchaseRequests,
  } = useWorkOrderRequests(workOrderId);

  const { data: outOfStockSuggestions = [] } = useOutOfStockSuggestions(workOrderId);

  const handleCreateServiceOrder = (data: Record<string, unknown>) => {
    if (editingSO) {
      updateServiceOrder({ soId: editingSO.id, data }, {
        onSuccess: () => {
          setSoDialogOpen(false);
          setEditingSO(null);
        },
      });
    } else {
      createServiceOrder(data, {
        onSuccess: () => setSoDialogOpen(false),
      });
    }
  };

  const handleCreatePurchaseRequest = (data: { notes?: string; items: Array<{ partId?: string; description: string; quantity: number; notes?: string }> }) => {
    createPurchaseRequest(data, {
      onSuccess: () => setPrDialogOpen(false),
    });
  };

  const handleEditServiceOrder = (so: ServiceOrderCardData) => {
    setEditingSO(so);
    setSoDialogOpen(true);
  };

  const handleSoDialogClose = (open: boolean) => {
    setSoDialogOpen(open);
    if (!open) {
      setEditingSO(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4" /> Service Orders
            </CardTitle>
            <div className="flex items-center gap-2">
              {!isReadOnly && serviceOrders.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="text-destructive" disabled={isBulkDeletingServiceOrders} data-testid="btn-clear-all-so">
                      {isBulkDeletingServiceOrders ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                      Clear All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear All Service Orders?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete all draft and cancelled service orders for this work order. Orders that have been sent or are in progress cannot be deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => bulkDeleteServiceOrders()} className="bg-destructive text-destructive-foreground">
                        Clear All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {!isReadOnly && (
                <Button size="sm" variant="outline" onClick={() => setSoDialogOpen(true)} data-testid="btn-request-service">
                  <Plus className="h-4 w-4 mr-1" /> Request Service
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingServiceOrders ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : serviceOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No external services requested</p>
          ) : (
            <div className="space-y-3">
              {serviceOrders.map((so) => (
                <ServiceOrderCard
                  key={so.id}
                  serviceOrder={so}
                  onDelete={deleteServiceOrder}
                  onEdit={handleEditServiceOrder}
                  isDeleting={isDeletingServiceOrder && deletingServiceOrderId === so.id}
                  isReadOnly={isReadOnly}
                  canApprove={canApproveSO}
                  canEditPermission={canEditSO}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" /> Purchase Requests
            </CardTitle>
            <div className="flex items-center gap-2">
              {!isReadOnly && purchaseRequests.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="text-destructive" disabled={isBulkDeletingPurchaseRequests} data-testid="btn-clear-all-pr">
                      {isBulkDeletingPurchaseRequests ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                      Clear All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear All Purchase Requests?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete all draft and cancelled purchase requests for this work order. Submitted or approved requests cannot be deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => bulkDeletePurchaseRequests()} className="bg-destructive text-destructive-foreground">
                        Clear All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {!isReadOnly && (
                <Button size="sm" variant="outline" onClick={() => setPrDialogOpen(true)} data-testid="btn-request-parts">
                  <Plus className="h-4 w-4 mr-1" /> New Purchase Request
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingPurchaseRequests ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : purchaseRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No purchase requests</p>
          ) : (
            <div className="space-y-3">
              {purchaseRequests.map((pr) => (
                <PartsRequestCard
                  key={pr.id}
                  purchaseRequest={pr}
                  onDelete={deletePurchaseRequest}
                  onFulfillItem={(prId, itemId, qty) => fulfillItem({ prId, itemId, quantity: qty })}
                  onUpdateStatus={(prId, status) => updatePRStatus({ prId, status })}
                  isDeleting={isDeletingPurchaseRequest && deletingPurchaseRequestId === pr.id}
                  isFulfilling={isFulfillingItem}
                  isUpdatingStatus={isUpdatingPRStatus}
                  isReadOnly={isReadOnly}
                  canApprove={canApprovePR}
                  canEditPermission={canEditPR}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <EnhancedServiceRequestDialog
        open={soDialogOpen}
        onOpenChange={handleSoDialogClose}
        onSubmit={handleCreateServiceOrder}
        isPending={isCreatingServiceOrder || isUpdatingServiceOrder}
        initialData={editingSO ? {
          serviceProviderId: (editingSO as any).serviceProviderId,
          scope: editingSO.scope,
          scheduledStartDate: editingSO.scheduledStartDate,
          scheduledEndDate: editingSO.scheduledEndDate,
          estimatedDurationHours: editingSO.estimatedDurationHours,
        } : undefined}
        isEditing={!!editingSO}
      />
      <MultiLinePartsRequestDialog
        open={prDialogOpen}
        onOpenChange={setPrDialogOpen}
        onSubmit={handleCreatePurchaseRequest}
        isPending={isCreatingPurchaseRequest}
        suggestions={outOfStockSuggestions}
      />
    </div>
  );
}

export default WorkOrderRequestsTab;

```

### `client/src/components/work-orders/WorkOrderTableHelpers.tsx` (115 lines)

```tsx
import { ChevronUp, ChevronDown, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { COLUMNS } from "./work-order-table-config";

interface TruncatedCellProps {
  text: string;
  className?: string;
  maxWidth?: number;
}

export function TruncatedCell({ text, className, maxWidth }: TruncatedCellProps) {
  const displayText = text || "—";
  const shouldTruncate = displayText.length > 20;

  if (!shouldTruncate) {
    return <span className={className}>{displayText}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn("block truncate cursor-default", className)}
          style={{ maxWidth: maxWidth ? `${maxWidth}px` : undefined }}
        >
          {displayText}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[300px]">
        <p className="text-sm">{displayText}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface SortableHeaderProps {
  columnKey: string;
  children: React.ReactNode;
  sortColumn: string;
  sortDirection: "asc" | "desc";
  onSort: (column: string) => void;
  className?: string;
}

export function SortableHeader({
  columnKey,
  children,
  sortColumn,
  sortDirection,
  onSort,
  className,
}: SortableHeaderProps) {
  const isSorted = sortColumn === columnKey;
  return (
    <button
      className={cn(
        "flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wide",
        "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors",
        className
      )}
      onClick={() => onSort(columnKey)}
      data-testid={`sort-${columnKey}`}
    >
      {children}
      {isSorted &&
        (sortDirection === "asc" ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        ))}
    </button>
  );
}

export function WorkOrderTableSkeleton() {
  return (
    <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
      <div className="bg-slate-50 dark:bg-slate-800/50 border-b px-4 py-3">
        <div className="flex gap-4">
          {COLUMNS.slice(0, 6).map((col, i) => (
            <Skeleton key={i} className="h-4" style={{ width: col.width - 20 }} />
          ))}
        </div>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorkOrderTableEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-slate-900 border rounded-lg">
      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <AlertTriangle className="h-8 w-8 text-slate-400 dark:text-slate-500" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No Work Orders Found</h3>
      <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
        Try adjusting your filters or create a new work order to get started.
      </p>
    </div>
  );
}

```

### `client/src/components/work-orders/WorkOrderTasksTab.tsx` (97 lines)

```tsx
import { useState } from "react";
import { Plus, Check, Circle, Trash2, Loader2, X, CheckCircle2, XCircle, RotateCcw, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useWorkOrderTasksTabData } from "@/features/work-orders";

interface WorkOrderTasksTabProps { workOrderId: string; isReadOnly?: boolean; }

export function WorkOrderTasksTab({ workOrderId, isReadOnly = false }: WorkOrderTasksTabProps) {
  const { newTaskText, setNewTaskText, isAddingTask, setIsAddingTask, isLoading, progress, templateCompletions, workOrderTasks, totalTasks, completedTasksCount, overallProgress, hasNoTasks, updateChecklistItemMutation, resetChecklistItemMutation, addTaskMutation, deleteTaskMutation, toggleTaskCompletion, handleAddTask, cancelAddTask } = useWorkOrderTasksTabData(workOrderId);

  if (isLoading) { return (<div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>); }

  return (
    <div className="space-y-6" data-testid="work-order-tasks-tab">
      {!hasNoTasks && (<div className="space-y-2" data-testid="tasks-progress-section"><div className="flex items-center justify-between"><span className="text-sm font-medium">Overall Progress</span><span className="text-sm text-muted-foreground" data-testid="tasks-progress-text">{completedTasksCount} of {totalTasks} completed</span></div><Progress value={overallProgress} className="h-2" data-testid="tasks-progress-bar" /><div className="flex gap-2 mt-2">{progress?.pendingItems > 0 && (<Badge variant="secondary" className="text-xs" data-testid="badge-pending-items">{progress.pendingItems} pending</Badge>)}{progress?.failedItems > 0 && (<Badge variant="destructive" className="text-xs" data-testid="badge-failed-items">{progress.failedItems} failed</Badge>)}{progress?.completedItems > 0 && (<Badge variant="default" className="text-xs bg-green-600" data-testid="badge-passed-items">{progress.completedItems} passed</Badge>)}</div></div>)}

      {!isReadOnly && (<div className="space-y-3">{isAddingTask ? (<div className="flex gap-2"><Input placeholder="Enter task description..." value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { handleAddTask(); } else if (e.key === "Escape") { cancelAddTask(); } }} autoFocus data-testid="input-new-task" /><Button size="sm" onClick={handleAddTask} disabled={!newTaskText.trim() || addTaskMutation.isPending} data-testid="button-save-task">{addTaskMutation.isPending ? (<Loader2 className="h-4 w-4 animate-spin" />) : "Add"}</Button><Button size="sm" variant="outline" onClick={cancelAddTask} data-testid="button-cancel-task">Cancel</Button></div>) : (<Button variant="outline" size="sm" onClick={() => setIsAddingTask(true)} className="w-full" data-testid="button-add-task"><Plus className="h-4 w-4 mr-2" />Add Task</Button>)}</div>)}

      <Separator />

      <ScrollArea className="max-h-[400px]">
        <div className="space-y-2">
          {templateCompletions.length > 0 && (<div className="space-y-2" data-testid="template-checklist-section"><h4 className="text-sm font-medium text-muted-foreground">Template Checklist</h4>{templateCompletions.map((item) => (<TemplateChecklistItem key={item.id} id={item.id} itemId={item.itemId} description={item.description || `Checklist Item`} passed={item.passed} notes={item.notes} completedByName={item.completedByName} completedAt={item.completedAt} isReadOnly={isReadOnly} isPending={updateChecklistItemMutation.isPending || resetChecklistItemMutation.isPending} onPass={(notes) => updateChecklistItemMutation.mutate({ itemId: item.itemId, passed: true, notes })} onFail={(notes) => updateChecklistItemMutation.mutate({ itemId: item.itemId, passed: false, notes })} onReset={() => resetChecklistItemMutation.mutate(item.itemId)} />))}</div>)}

          {workOrderTasks.length > 0 && (<div className="space-y-2" data-testid="additional-tasks-section">{templateCompletions.length > 0 && (<h4 className="text-sm font-medium text-muted-foreground mt-4">Additional Tasks</h4>)}{workOrderTasks.map((task) => (<TaskItem key={task.id} id={task.id} description={task.description} isCompleted={task.isCompleted} completedByName={task.completedByName} completedAt={task.completedAt} isReadOnly={isReadOnly} isPending={toggleTaskCompletion.isPending || deleteTaskMutation.isPending} onToggle={(completed) => toggleTaskCompletion.mutate({ taskId: task.id, completed })} onDelete={() => deleteTaskMutation.mutate(task.id)} />))}</div>)}

          {hasNoTasks && (<div className="flex flex-col items-center justify-center py-8 text-center" data-testid="no-tasks-message"><Circle className="h-12 w-12 text-muted-foreground/50 mb-4" /><h3 className="text-lg font-medium">No Tasks Yet</h3><p className="text-muted-foreground mt-1 max-w-sm">{isReadOnly ? "No tasks have been added to this work order." : "Add tasks to track the work that needs to be done."}</p></div>)}
        </div>
      </ScrollArea>
    </div>
  );
}

interface TemplateChecklistItemProps { id: string; itemId: string; description: string; passed: boolean | null; notes?: string; completedByName?: string; completedAt?: string; isReadOnly?: boolean; isPending?: boolean; onPass: (notes?: string) => void; onFail: (notes?: string) => void; onReset: () => void; }

function TemplateChecklistItem({ id, itemId: _itemId, description, passed, notes, completedByName, completedAt, isReadOnly, isPending, onPass, onFail, onReset }: TemplateChecklistItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localNotes, setLocalNotes] = useState(notes || "");
  const isCompleted = passed !== null;
  const getStatusColor = () => { if (passed === true) {return "border-green-500 bg-green-50 dark:bg-green-950/20";} if (passed === false) {return "border-red-500 bg-red-50 dark:bg-red-950/20";} return "border-border bg-background hover:border-primary/50"; };
  const getStatusIcon = () => { if (passed === true) {return <CheckCircle2 className="h-5 w-5 text-green-600" />;} if (passed === false) {return <XCircle className="h-5 w-5 text-red-600" />;} return <Circle className="h-5 w-5 text-muted-foreground" />; };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className={cn("rounded-lg border transition-colors", getStatusColor())} data-testid={`checklist-item-${id}`}>
        <div className="flex items-start gap-3 p-3">
          <div className="mt-0.5" data-testid={`status-icon-${id}`}>{getStatusIcon()}</div>
          <div className="flex-1 min-w-0">
            <p className={cn("text-sm", isCompleted && "text-muted-foreground")}>{description}</p>
            {isCompleted && completedByName && (<p className="text-xs text-muted-foreground mt-1" data-testid={`completion-info-${id}`}>{passed ? "Passed" : "Failed"} by {completedByName}{completedAt && ` on ${new Date(completedAt).toLocaleDateString()}`}</p>)}
            {notes && (<p className="text-xs text-muted-foreground mt-1 italic" data-testid={`notes-display-${id}`}>Note: {notes}</p>)}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!isReadOnly && !isCompleted && (<><Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100" onClick={() => onPass(localNotes || undefined)} disabled={isPending} title="Mark as Passed" data-testid={`button-pass-${id}`}><Check className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100" onClick={() => onFail(localNotes || undefined)} disabled={isPending} title="Mark as Failed" data-testid={`button-fail-${id}`}><X className="h-4 w-4" /></Button></>)}
            {!isReadOnly && isCompleted && (<Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onReset} disabled={isPending} title="Reset to Pending" data-testid={`button-reset-${id}`}><RotateCcw className="h-4 w-4" /></Button>)}
            <CollapsibleTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Add Notes" data-testid={`button-notes-${id}`}><MessageSquare className="h-4 w-4" /></Button></CollapsibleTrigger>
            <Badge variant="outline" className="text-xs shrink-0 ml-1">Template</Badge>
          </div>
        </div>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0">
            <Separator className="mb-3" />
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Notes / Comments</label>
              <Textarea placeholder="Add notes about this checklist item..." value={localNotes} onChange={(e) => setLocalNotes(e.target.value)} className="min-h-[60px] text-sm" disabled={isReadOnly} data-testid={`textarea-notes-${id}`} />
              {!isReadOnly && !isCompleted && (<div className="flex gap-2 pt-1"><Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => onPass(localNotes || undefined)} disabled={isPending} data-testid={`button-pass-with-notes-${id}`}><Check className="h-3 w-3 mr-1" />Pass</Button><Button size="sm" variant="destructive" onClick={() => onFail(localNotes || undefined)} disabled={isPending} data-testid={`button-fail-with-notes-${id}`}><X className="h-3 w-3 mr-1" />Fail</Button></div>)}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface TaskItemProps { id: string; description: string; isCompleted: boolean; completedByName?: string; completedAt?: string; isReadOnly?: boolean; isPending?: boolean; onToggle: (completed: boolean) => void; onDelete: () => void; }

function TaskItem({ id, description, isCompleted, completedByName, completedAt, isReadOnly, isPending, onToggle, onDelete }: TaskItemProps) {
  return (
    <div className={cn("flex items-start gap-3 p-3 rounded-lg border transition-colors", isCompleted ? "bg-muted/30 border-muted" : "bg-background border-border hover:border-primary/50")} data-testid={`task-item-${id}`}>
      <Checkbox id={`task-${id}`} checked={isCompleted} onCheckedChange={(checked) => !isReadOnly && onToggle(checked as boolean)} disabled={isReadOnly || isPending} className="mt-0.5" data-testid={`checkbox-task-${id}`} />
      <div className="flex-1 min-w-0">
        <label htmlFor={`task-${id}`} className={cn("text-sm cursor-pointer", isCompleted && "line-through text-muted-foreground")}>{description}</label>
        {isCompleted && completedByName && (<p className="text-xs text-muted-foreground mt-1">Completed by {completedByName}{completedAt && ` on ${new Date(completedAt).toLocaleDateString()}`}</p>)}
      </div>
      {!isReadOnly && (<Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onDelete} disabled={isPending} data-testid={`button-delete-task-${id}`}><Trash2 className="h-4 w-4" /></Button>)}
    </div>
  );
}

```

### `client/src/components/work-orders/index.ts` (7 lines)

```ts
export { WorkOrderFilterPanel, type WorkOrderFilters } from "./WorkOrderFilterPanel";
export { VirtualizedWorkOrderTable } from "./VirtualizedWorkOrderTable";
export { WorkOrderDetailDrawer } from "./WorkOrderDetailDrawer";
export { WorkOrderFormDialog } from "./WorkOrderFormDialog";
export { WorkOrderCloneDialog } from "./WorkOrderCloneDialog";
export { LinkTemplateDialog } from "./LinkTemplateDialog";
export { WorkOrderRequestsTab } from "./WorkOrderRequestsTab";

```

### `client/src/components/work-orders/work-order-table-config.ts` (56 lines)

```ts
import { Clock, CheckCircle2, XCircle, Pause, Wrench } from "lucide-react";

export const COLUMNS = [
  { key: "woNumber", label: "WO #", width: 120 },
  { key: "vessel", label: "Vessel", width: 140 },
  { key: "equipment", label: "Equipment", width: 180 },
  { key: "reason", label: "Reason", width: 220, flex: true },
  { key: "priority", label: "Priority", width: 100 },
  { key: "status", label: "Status", width: 130 },
  { key: "assignedTo", label: "Assigned To", width: 140 },
  { key: "dueDate", label: "Due Date", width: 110 },
  { key: "createdAt", label: "Created", width: 100 },
  { key: "actions", label: "Actions", width: 110 },
] as const;

export type ColumnConfig = typeof COLUMNS[number];

export const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  open: {
    label: "Open",
    icon: Clock,
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border-blue-200 dark:border-blue-800",
  },
  in_progress: {
    label: "In Progress",
    icon: Wrench,
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border-amber-200 dark:border-amber-800",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 border-green-200 dark:border-green-800",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-200 border-gray-200 dark:border-gray-700",
  },
  deferred: {
    label: "Deferred",
    icon: Pause,
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200 border-orange-200 dark:border-orange-800",
  },
};

export const PRIORITY_CONFIG: Record<number, { label: string; className: string }> = {
  1: { label: "High", className: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 border-red-200 dark:border-red-800" },
  2: { label: "Medium", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800" },
  3: { label: "Low", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800" },
};

export const ROW_HEIGHT = 60;

export function getTotalWidth(): number {
  return COLUMNS.reduce((sum, col) => sum + col.width, 0);
}

```

### `client/src/components/maintenance/PartsRequestsPanel.tsx` (78 lines)

```tsx
import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ExternalLink, Loader2, Package } from "lucide-react";
import { usePurchaseRequests } from "@/features/purchaseRequests/hooks/usePurchaseRequests";
import { PRStatusBadge } from "@/features/purchaseRequests";

export function PartsRequestsPanel() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const { data: requests = [], isLoading } = usePurchaseRequests({ status: "sent" });

  const filteredRequests = requests.filter((pr) => {
    if (!search) {return true;}
    const searchLower = search.toLowerCase();
    return pr.prNumber?.toLowerCase().includes(searchLower) || 
      pr.requestedBy?.toLowerCase().includes(searchLower);
  });

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" /> Purchase Orders
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Confirmed purchase requests ready for procurement
            </CardDescription>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." className="pl-8 h-8" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-pr" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No confirmed purchase orders</p>
            <p className="text-xs mt-2">Purchase orders appear here once confirmed from Work Orders</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>PR #</TableHead><TableHead>Requested By</TableHead><TableHead>Status</TableHead><TableHead className="w-12"></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((pr) => (
                <TableRow key={pr.id} data-testid={`row-pr-${pr.id}`}>
                  <TableCell className="font-medium">{pr.prNumber}</TableCell>
                  <TableCell className="truncate max-w-[120px]">{pr.requestedBy}</TableCell>
                  <TableCell><PRStatusBadge status={pr.status} /></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setLocation(`/purchase-requests/${pr.id}`)} data-testid={`btn-view-pr-${pr.id}`}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default PartsRequestsPanel;

```

### `client/src/components/maintenance/ServiceRequestsPanel.tsx` (89 lines)

```tsx
import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, ExternalLink, Wrench } from "lucide-react";
import { SO_STATUS_COLORS } from "@/features/serviceOrders/types";

export function ServiceRequestsPanel() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const { data: serviceOrders = [], isLoading } = useQuery<{ id: string; soNumber?: string; serviceProviderName?: string; scope?: string; status?: string }[]>({
    queryKey: ["/api/service-orders", { status: "confirmed" }],
  });

  const filteredOrders = serviceOrders.filter((so) => {
    if (!search) {return true;}
    const searchLower = search.toLowerCase();
    return so.soNumber?.toLowerCase().includes(searchLower) ||
      so.serviceProviderName?.toLowerCase().includes(searchLower) ||
      so.scope?.toLowerCase().includes(searchLower);
  });

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wrench className="h-5 w-5" /> Service Orders
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Confirmed service orders ready for execution
            </CardDescription>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." className="pl-8 h-8" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-so" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No confirmed service orders</p>
            <p className="text-xs mt-2">Service orders appear here once confirmed from Work Orders</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SO #</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((so) => (
                <TableRow key={so.id} data-testid={`row-so-${so.id}`}>
                  <TableCell className="font-medium">{so.soNumber}</TableCell>
                  <TableCell className="truncate max-w-[120px]">{so.serviceProviderName || "—"}</TableCell>
                  <TableCell>
                    <Badge className={SO_STATUS_COLORS[so.status] || "bg-gray-100"}>{so.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setLocation(`/service-orders/${so.id}`)} data-testid={`btn-view-so-${so.id}`}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default ServiceRequestsPanel;

```

### `client/src/components/maintenance/index.ts` (2 lines)

```ts
export { ServiceRequestsPanel } from "./ServiceRequestsPanel";
export { PartsRequestsPanel } from "./PartsRequestsPanel";

```

