import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, Calendar, FileCheck, Clock, CheckCircle, AlertTriangle, X } from "lucide-react";
import { useHoursOfRestManagement } from "@/features/crew";

interface DayDetail {
  day: number;
  date: string;
  restHours: number;
  compliant: boolean;
}

export function HoursOfRest() {
  const {
    crew, crewLoading, restLoading, selectedCrew, setSelectedCrew, selectedYear, setSelectedYear,
    selectedMonth, setSelectedMonth, selectedMonthLabel, handleFileChange, handleImport, importMutation,
    handleCheckCompliance, complianceMutation, handleExportPDF, complianceResult, calendarGrid, months, years,
  } = useHoursOfRestManagement();

  const [selectedDay, setSelectedDay] = useState<DayDetail | null>(null);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Rest Data Management</CardTitle>
          <CardDescription>Import, view, and export STCW Hours of Rest data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="import-file">Import CSV File</Label>
              <Input id="import-file" type="file" accept=".csv" onChange={handleFileChange} data-testid="input-import-file" />
            </div>
            <div className="flex items-end">
              <Button onClick={handleImport} disabled={importMutation.isPending} data-testid="button-import">
                <Upload className="w-4 h-4 mr-2" />{importMutation.isPending ? "Importing..." : "Import"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="crew-select">Crew Member</Label>
              <Select value={selectedCrew} onValueChange={setSelectedCrew}>
                <SelectTrigger data-testid="select-crew"><SelectValue placeholder="Select crew member" /></SelectTrigger>
                <SelectContent>
                  {crew.map((member) => (
                    <SelectItem key={member.id} value={member.id}>{member.name} - {member.rank}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="year-select">Year</Label>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number.parseInt(v))}>
                <SelectTrigger data-testid="select-year"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((year) => (<SelectItem key={year} value={year.toString()}>{year}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="month-select">Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger data-testid="select-month"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map((month) => (<SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end space-x-2">
              <Button onClick={handleCheckCompliance} disabled={!selectedCrew || complianceMutation.isPending} variant="outline" data-testid="button-check-compliance">
                <FileCheck className="w-4 h-4 mr-2" />Check Compliance
              </Button>
              <Button onClick={handleExportPDF} disabled={!selectedCrew} variant="outline" data-testid="button-export-pdf">
                <Download className="w-4 h-4 mr-2" />Export PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {complianceResult && (
        <Card>
          <CardHeader>
            <CardTitle className={`flex items-center ${complianceResult.compliant ? "text-green-600" : "text-red-600"}`}>
              <FileCheck className="w-5 h-5 mr-2" />Compliance Check Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center" data-testid="text-total-days">
                <div className="text-2xl font-bold">{complianceResult.summary.totalDays}</div>
                <div className="text-sm text-muted-foreground">Total Days</div>
              </div>
              <div className="text-center" data-testid="text-violation-days">
                <div className="text-2xl font-bold text-red-600">{complianceResult.summary.violationDays}</div>
                <div className="text-sm text-muted-foreground">Violation Days</div>
              </div>
              <div className="text-center" data-testid="text-compliance-percentage">
                <div className="text-2xl font-bold text-green-600">{complianceResult.summary.compliancePercentage.toFixed(1)}%</div>
                <div className="text-sm text-muted-foreground">Compliance</div>
              </div>
            </div>
            {complianceResult.violations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold">Violations:</h4>
                <div className="space-y-1" data-testid="list-violations">
                  {complianceResult.violations.map((violation) => (
                    <div key={`${violation.date}-${violation.type}`} className="text-sm p-2 bg-red-50 border border-red-200 rounded">
                      <strong>{violation.date}</strong> - {violation.type}: {violation.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedCrew && calendarGrid && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="w-5 h-5 mr-2" />Rest Hours Calendar - {selectedMonthLabel} {selectedYear}
            </CardTitle>
            <CardDescription>Daily rest hours visualization (green = compliant ≥10h, red = violation &lt;10h). STCW requires minimum 77 hours rest in any 7-day period.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1" data-testid="calendar-rest-grid" role="grid" aria-label="Rest hours calendar grid">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="p-2 text-center font-semibold text-sm" role="columnheader">{day}</div>
              ))}
              {calendarGrid.map((dayData) => (
                <button key={dayData.day} className={`p-2 text-center text-xs border rounded cursor-pointer transition-colors hover:opacity-80 ${selectedDay?.day === dayData.day ? "ring-2 ring-primary ring-offset-1" : ""} ${dayData.compliant ? "bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300" : "bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300"}`} title={`${dayData.date}: ${dayData.restHours}h rest`} data-testid={`calendar-day-${dayData.day}`} aria-label={`${dayData.date}: ${dayData.restHours} hours rest, ${dayData.compliant ? "compliant" : "violation"}`} onClick={() => setSelectedDay(dayData)}>
                  <div className="font-semibold">{dayData.day}</div>
                  <div>{dayData.restHours}h</div>
                </button>
              ))}
            </div>

            {selectedDay && (
              <div className="mt-4 p-4 border rounded-lg bg-muted/30" data-testid="day-detail-panel">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Day Detail: {selectedDay.date}
                  </h4>
                  <button type="button" onClick={() => setSelectedDay(null)} className="text-muted-foreground hover:text-foreground" aria-label="Close day detail" data-testid="button-close-day-detail">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg border bg-background">
                    <div className="text-xs text-muted-foreground">Rest Hours</div>
                    <div className="text-xl font-bold">{selectedDay.restHours}h</div>
                  </div>
                  <div className="p-3 rounded-lg border bg-background">
                    <div className="text-xs text-muted-foreground">Work Hours</div>
                    <div className="text-xl font-bold">{(24 - selectedDay.restHours).toFixed(1)}h</div>
                  </div>
                  <div className="p-3 rounded-lg border bg-background">
                    <div className="text-xs text-muted-foreground">Status</div>
                    <div className="flex items-center gap-1 mt-1">
                      {selectedDay.compliant ? (
                        <Badge variant="outline" className="text-green-600 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />Compliant</Badge>
                      ) : (
                        <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Violation</Badge>
                      )}
                    </div>
                  </div>
                </div>
                {!selectedDay.compliant && (
                  <p className="text-xs text-destructive mt-2">Rest period is below the STCW minimum of 10 hours in any 24-hour period.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(crewLoading || restLoading) && (
        <Card>
          <CardContent className="flex items-center justify-center py-6">
            <div className="text-muted-foreground">Loading...</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
