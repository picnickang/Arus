import { Calendar, Check, Clock, Edit, Eye, List, Plus, Search, Trash2, X, Zap } from "lucide-react";
import { format, isPast } from "date-fns";
import type { MaintenanceSchedule } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveTable } from "@/components/shared/ResponsiveTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PermissionGate } from "@/components/PermissionGate";
import { CalendarView } from "./maintenance-schedules-calendar";
import type { MaintenanceSchedulesPageModel } from "./maintenance-schedules-types";

interface MaintenanceScheduleSectionsProps {
  m: MaintenanceSchedulesPageModel;
}

export function MaintenanceScheduleSections({ m }: MaintenanceScheduleSectionsProps) {
  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">
          <PermissionGate resource="maintenance_schedules" action="create">
            <Button
              onClick={() => m.setCreateModalOpen(true)}
              size="lg"
              data-testid="button-create-schedule"
            >
              <Plus className="w-4 h-4 mr-2" />
              Schedule Maintenance
            </Button>
          </PermissionGate>
        </div>
        <div className="flex flex-wrap items-center gap-4 md:gap-6 px-4 py-3 bg-muted/30 dark:bg-muted/20 rounded-lg border border-border/50">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Total:</span>
            <span className="text-sm font-bold" data-testid="stat-total">
              {m.schedules?.length || 0}
            </span>
          </div>
          <div className="hidden md:block h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-muted-foreground">Upcoming:</span>
            <span
              className="text-sm font-bold text-blue-700 dark:text-blue-300"
              data-testid="stat-upcoming"
            >
              {m.upcomingSchedules?.length || 0}
            </span>
          </div>
          <div className="hidden md:block h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm text-muted-foreground">In Progress:</span>
            <span
              className="text-sm font-bold text-amber-700 dark:text-amber-300"
              data-testid="stat-in-progress"
            >
              {m.schedules?.filter((s) => (s as { status?: string }).status === "in_progress")
                .length || 0}
            </span>
          </div>
          <div className="hidden md:block h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm text-muted-foreground">Completed:</span>
            <span
              className="text-sm font-bold text-green-700 dark:text-green-300"
              data-testid="stat-completed"
            >
              {m.schedules?.filter((s) => (s as { status?: string }).status === "completed")
                .length || 0}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search equipment or description..."
                value={m.searchText}
                onChange={(e) => m.setSearchText(e.target.value)}
                className="pl-10"
                data-testid="input-search-schedules"
              />
              {m.searchText && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => m.setSearchText("")}
                  className="absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
                  aria-label="Clear search"
                  data-testid="button-clear-search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div>
            <Select value={m.statusFilter} onValueChange={m.setStatusFilter}>
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={m.priorityFilter} onValueChange={m.setPriorityFilter}>
              <SelectTrigger data-testid="select-priority-filter">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="1">High Priority</SelectItem>
                <SelectItem value="2">Medium Priority</SelectItem>
                <SelectItem value="3">Low Priority</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Tabs value={m.viewType} onValueChange={(v) => m.setViewType(v as "calendar" | "list")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="calendar" data-testid="tab-calendar">
            <Calendar className="w-4 h-4 mr-2" />
            Calendar View
          </TabsTrigger>
          <TabsTrigger value="list" data-testid="tab-list">
            <List className="w-4 h-4 mr-2" />
            List View
          </TabsTrigger>
        </TabsList>
        <TabsContent value="calendar" className="mt-6">
          <CalendarView
            schedules={m.filteredSchedules}
            onScheduleClick={m.handleViewSchedule}
            getEquipmentName={m.getEquipmentName}
          />
        </TabsContent>
        <TabsContent value="list" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Schedule List</CardTitle>
              <CardDescription>{m.filteredSchedules.length} schedules found</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ResponsiveTable
                data={m.filteredSchedules}
                keyExtractor={(schedule) => schedule.id}
                columns={[
                  {
                    header: "Equipment",
                    accessor: (schedule: MaintenanceSchedule) => (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {m.getEquipmentName(schedule.equipmentId)}
                        </span>
                        {schedule.autoGenerated && (
                          <Badge variant="outline" className="text-xs">
                            <Zap className="w-3 h-3 mr-1" />
                            Auto
                          </Badge>
                        )}
                      </div>
                    ),
                  },
                  {
                    header: "Date & Time",
                    accessor: (schedule: MaintenanceSchedule) => {
                      const isOverdue =
                        isPast(new Date(schedule.scheduledDate)) && schedule.status !== "completed";
                      return (
                        <div>
                          <div className="flex items-center gap-2">
                            <div
                              className="font-medium"
                              data-testid={`text-scheduled-date-${schedule.id}`}
                            >
                              {format(new Date(schedule.scheduledDate), "MMM d, yyyy")}
                            </div>
                            {isOverdue && (
                              <Badge
                                variant="destructive"
                                className="text-xs"
                                data-testid={`badge-overdue-${schedule.id}`}
                              >
                                OVERDUE
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(schedule.scheduledDate), "h:mm a")}
                          </div>
                        </div>
                      );
                    },
                  },
                  {
                    header: "Type",
                    accessor: (schedule: MaintenanceSchedule) => (
                      <Badge variant="outline" className="capitalize">
                        {schedule.maintenanceType}
                      </Badge>
                    ),
                  },
                  {
                    header: "Priority",
                    accessor: (schedule: MaintenanceSchedule) => {
                      const p = m.getPriorityBadge(schedule.priority);
                      return <Badge className={p.className}>{p.label}</Badge>;
                    },
                  },
                  {
                    header: "Status",
                    accessor: (schedule: MaintenanceSchedule) => {
                      const s = m.getStatusBadge(schedule.status);
                      return <Badge className={s.className}>{s.label}</Badge>;
                    },
                  },
                ]}
                actions={(schedule) => (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => m.handleViewSchedule(schedule)}
                      data-testid={`button-view-schedule-${schedule.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => m.handleEditSchedule(schedule)}
                      data-testid={`button-edit-schedule-${schedule.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => m.handleDeleteSchedule(schedule)}
                      className="text-destructive hover:text-destructive"
                      data-testid={`button-delete-schedule-${schedule.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                emptyMessage="No maintenance schedules found. Create one to get started."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
