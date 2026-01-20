import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { fetchEquipmentHealth, fetchWorkOrders, fetchPdmScores } from "@/lib/api";
import { formatDateSgt } from "@/lib/time-utils";
import { exportToCSV, exportToJSON } from "@/lib/exportUtils";

export function useReportsData() {
  const { toast } = useToast();
  const [selectedEquipment, setSelectedEquipment] = useState<string>("all");
  const [selectedStandard, setSelectedStandard] = useState<string>("ISM");
  const [reportType, setReportType] = useState<string>("fleet");

  const { data: equipmentHealth, isLoading: healthLoading } = useQuery({ queryKey: ["/api/equipment/health"], queryFn: fetchEquipmentHealth });
  const { data: workOrders, isLoading: ordersLoading } = useQuery({ queryKey: ["/api/work-orders"], queryFn: () => fetchWorkOrders() });
  const { data: _pdmScores, isLoading: scoresLoading } = useQuery({ queryKey: ["/api/pdm/scores"], queryFn: () => fetchPdmScores() });

  const isLoading = healthLoading || ordersLoading || scoresLoading;
  const equipmentOptions = equipmentHealth?.map((eq) => ({ id: eq.id, vessel: eq.vessel })) ?? [];

  interface ReportSection { totalEquipment: number; avgHealthIndex: number; openWorkOrders: number; criticalEquipment: number; }
  interface EquipmentHealthItem { id: string; vessel: string; healthIndex: number; predictedDueDays: number; }
  interface ReportData { metadata: { title: string; generatedAt: string; reportType: string }; sections: { summary: ReportSection; equipmentHealth?: EquipmentHealthItem[] } }
  interface ComplianceReportData { standard: string; type: string; period: { startDate: string; endDate: string }; summary: Record<string, number | string>; maintenanceRecords?: Array<{ equipmentId: string; maintenanceType: string; completionStatus: string }>; alerts?: Array<{ equipmentId: string; alertType: string; acknowledged: boolean }> }
  const generatePDF = async (reportData: ReportData) => {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    pdf.setFontSize(20); pdf.text(reportData.metadata.title, 20, 20);
    pdf.setFontSize(12); pdf.text(`Generated: ${formatDateSgt(new Date(reportData.metadata.generatedAt))}`, 20, 35); pdf.text(`Report Type: ${reportData.metadata.reportType}`, 20, 45);
    let yPosition = 60;
    pdf.setFontSize(16); pdf.text("Fleet Summary", 20, yPosition); yPosition += 15;
    pdf.setFontSize(12); const summary = reportData.sections.summary; pdf.text(`Total Equipment: ${summary.totalEquipment}`, 20, yPosition); yPosition += 10; pdf.text(`Average Health Index: ${summary.avgHealthIndex}%`, 20, yPosition); yPosition += 10; pdf.text(`Open Work Orders: ${summary.openWorkOrders}`, 20, yPosition); yPosition += 10; pdf.text(`Critical Equipment: ${summary.criticalEquipment}`, 20, yPosition); yPosition += 20;
    if (reportData.sections.equipmentHealth?.length > 0) { pdf.setFontSize(16); pdf.text("Equipment Health Status", 20, yPosition); yPosition += 15; pdf.setFontSize(10); reportData.sections.equipmentHealth.slice(0, 15).forEach((eq) => { if (yPosition > 270) { pdf.addPage(); yPosition = 20; } pdf.text(`${eq.id} (${eq.vessel}): ${eq.healthIndex}% - Due in ${eq.predictedDueDays} days`, 20, yPosition); yPosition += 8; }); }
    pdf.save(`marine_report_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const generateCompliancePDF = async (reportData: ComplianceReportData) => {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    pdf.setFontSize(20); pdf.text(`Marine Compliance Report - ${reportData.standard}`, 20, 20);
    pdf.setFontSize(12); pdf.text(`Generated: ${formatDateSgt(new Date())}`, 20, 35); pdf.text(`Report Type: ${reportData.type}`, 20, 45); pdf.text(`Period: ${formatDateSgt(new Date(reportData.period.startDate))} - ${formatDateSgt(new Date(reportData.period.endDate))}`, 20, 55);
    let yPosition = 70;
    pdf.setFontSize(16); pdf.text("Compliance Summary", 20, yPosition); yPosition += 15;
    pdf.setFontSize(12); const summary = reportData.summary;
    if (reportData.type === "maintenance-compliance") { pdf.text(`Total Maintenance Records: ${summary.totalMaintenanceRecords}`, 20, yPosition); yPosition += 10; pdf.text(`Completed On Time: ${summary.completedOnTime}`, 20, yPosition); yPosition += 10; pdf.text(`Overdue: ${summary.overdue}`, 20, yPosition); yPosition += 10; pdf.text(`Compliance Rate: ${summary.complianceRate}%`, 20, yPosition); yPosition += 20; if (reportData.maintenanceRecords?.length > 0) { pdf.setFontSize(16); pdf.text("Recent Maintenance Records", 20, yPosition); yPosition += 15; pdf.setFontSize(10); reportData.maintenanceRecords.slice(0, 10).forEach((record) => { if (yPosition > 270) { pdf.addPage(); yPosition = 20; } pdf.text(`${record.equipmentId}: ${record.maintenanceType} - ${record.completionStatus}`, 20, yPosition); yPosition += 8; }); } }
    else if (reportData.type === "alert-response") { pdf.text(`Total Alerts: ${summary.totalAlerts}`, 20, yPosition); yPosition += 10; pdf.text(`Acknowledged: ${summary.acknowledgedAlerts}`, 20, yPosition); yPosition += 10; pdf.text(`Critical Alerts: ${summary.criticalAlerts}`, 20, yPosition); yPosition += 10; pdf.text(`Response Rate: ${summary.responseRate}%`, 20, yPosition); yPosition += 20; if (reportData.alerts?.length > 0) { pdf.setFontSize(16); pdf.text("Recent Alerts", 20, yPosition); yPosition += 15; pdf.setFontSize(10); reportData.alerts.slice(0, 10).forEach((alert) => { if (yPosition > 270) { pdf.addPage(); yPosition = 20; } pdf.text(`${alert.equipmentId}: ${alert.alertType} - ${alert.acknowledged ? "ACK" : "PENDING"}`, 20, yPosition); yPosition += 8; }); } }
    pdf.save(`marine_compliance_${reportData.type}_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const generateReport = async () => {
    try {
      const response = await fetch("/api/reports/generate/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: reportType, equipmentId: selectedEquipment === "all" ? undefined : selectedEquipment, title: `Marine ${reportType === "compliance" ? "Compliance" : "Fleet"} Report - ${formatDateSgt(new Date())}` }) });
      if (!response.ok) {throw new Error("Failed to generate report");}
      const reportData = await response.json(); generatePDF(reportData);
    } catch (error) { console.error("Report generation failed:", error); }
  };

  const generateComplianceReport = async (complianceType: string) => {
    try {
      const endDate = new Date(); const startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
      const params = new URLSearchParams({ standard: selectedStandard, startDate: startDate.toISOString(), endDate: endDate.toISOString(), ...(selectedEquipment !== "all" && { equipmentId: selectedEquipment }) });
      const response = await fetch(`/api/reports/compliance/${complianceType}?${params}`);
      if (!response.ok) {throw new Error("Failed to generate compliance report");}
      const reportData = await response.json(); generateCompliancePDF(reportData);
    } catch (error) { console.error("Compliance report generation failed:", error); }
  };

  const exportEquipmentHealthCSV = () => {
    try {
      if (!equipmentHealth || equipmentHealth.length === 0) { toast({ title: "No Data", description: "No equipment health data to export", variant: "destructive" }); return; }
      const filteredData = selectedEquipment === "all" ? equipmentHealth : equipmentHealth.filter((eq) => eq.id === selectedEquipment);
      const success = exportToCSV(filteredData, { filename: `equipment-health-${new Date().toISOString().split("T")[0]}.csv`, columns: ["id", "vessel", "healthIndex", "status", "predictedDueDays", "manufacturer", "model"], headers: { id: "Equipment ID", vessel: "Vessel", healthIndex: "Health Index (%)", status: "Status", predictedDueDays: "Predicted Due (Days)", manufacturer: "Manufacturer", model: "Model" } });
      if (!success) { toast({ title: "Export Failed", description: "No data available for export", variant: "destructive" }); }
    } catch (error) { console.error("Equipment health CSV export failed:", error); toast({ title: "Export Failed", description: "Failed to export equipment health data", variant: "destructive" }); }
  };

  const exportEquipmentHealthJSON = () => {
    try {
      if (!equipmentHealth || equipmentHealth.length === 0) { toast({ title: "No Data", description: "No equipment health data to export", variant: "destructive" }); return; }
      const filteredData = selectedEquipment === "all" ? equipmentHealth : equipmentHealth.filter((eq) => eq.id === selectedEquipment);
      const exportData = { metadata: { exportedAt: new Date().toISOString(), exportType: "equipment-health", equipmentFilter: selectedEquipment, totalRecords: filteredData.length }, data: filteredData };
      const success = exportToJSON(exportData, { filename: `equipment-health-${new Date().toISOString().split("T")[0]}.json` });
      if (!success) { toast({ title: "Export Failed", description: "No data available for export", variant: "destructive" }); }
    } catch (error) { console.error("Equipment health JSON export failed:", error); toast({ title: "Export Failed", description: "Failed to export equipment health data", variant: "destructive" }); }
  };

  return {
    selectedEquipment, setSelectedEquipment, selectedStandard, setSelectedStandard, reportType, setReportType,
    equipmentHealth, workOrders, isLoading, equipmentOptions,
    generateReport, generateComplianceReport, exportEquipmentHealthCSV, exportEquipmentHealthJSON,
  };
}
