/**
 * Report Generation Job Processors
 */

interface ReportEquipment {
  id: string;
  vessel: string;
  healthIndex: number;
  status: string;
  predictedDueDays?: number;
}

interface ReportWorkOrder {
  id: string;
  title: string;
  equipmentId: string;
  priority: string;
  status: string;
  dueDate?: string | Date;
}

export interface ReportProcessorData {
  equipmentHealth?: ReportEquipment[];
  workOrders?: ReportWorkOrder[];
}

export interface ReportProcessorOptions {
  type?: string;
  title?: string;
}

export async function processPDFGeneration(data: {
  reportData: ReportProcessorData;
  options: ReportProcessorOptions;
}): Promise<{ buffer: Buffer; filename: string }> {
  const PDFDocument = await import("pdfkit");
  const { reportData, options } = data;

  const doc = new PDFDocument.default();
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  return new Promise((resolve, reject) => {
    doc.on("end", () => {
      const buffer = Buffer.concat(chunks);
      const filename = `report_${options.type || "general"}_${new Date().toISOString().split("T")[0]}.pdf`;
      resolve({ buffer, filename });
    });

    doc.on("error", reject);

    doc.fontSize(20).text(options.title || "ARUS Marine Report", 100, 100);
    doc.fontSize(12).text(`Generated: ${new Date().toISOString()}`, 100, 140);

    if (reportData.equipmentHealth) {
      doc.fontSize(16).text("Equipment Health Summary", 100, 180);
      let y = 210;
      reportData.equipmentHealth
        .slice(0, 10)
        .forEach((equipment: { id: string; healthIndex: number; status: string }) => {
          doc
            .fontSize(10)
            .text(`${equipment.id}: Health ${equipment.healthIndex}%`, 100, y)
            .text(`Status: ${equipment.status}`, 300, y);
          y += 20;
        });
    }

    if (reportData.workOrders) {
      let y = 350;
      doc.fontSize(16).text("Work Orders Summary", 100, y);
      y += 30;
      reportData.workOrders
        .slice(0, 5)
        .forEach((order: { title: string; priority: string; status: string }) => {
          doc
            .fontSize(10)
            .text(`${order.title}`, 100, y)
            .text(`Priority: ${order.priority}`, 300, y)
            .text(`Status: ${order.status}`, 400, y);
          y += 20;
        });
    }

    doc.end();
  });
}

export async function processCSVGeneration(data: {
  reportData: ReportProcessorData;
  options: ReportProcessorOptions;
}): Promise<{ csv: string; filename: string }> {
  const { reportData, options } = data;

  const csvRows: string[] = [];
  csvRows.push("Section,Type,ID,Value,Details,Timestamp");

  const sanitizeCSV = (value: unknown): string => {
    const str = String(value || "");
    if (str.match(/^[=+\-@]/)) {
      return `'${str}`;
    }
    return str.replaceAll('"', '""');
  };

  const timestamp = new Date().toISOString();

  if (reportData.equipmentHealth) {
    reportData.equipmentHealth.forEach(
      (equipment: { id: string; healthIndex: number; vessel: string; status: string }) => {
        csvRows.push(
          [
            "Equipment Health",
            "Health Index",
            sanitizeCSV(equipment.id),
            equipment.healthIndex,
            `Vessel: ${sanitizeCSV(equipment.vessel)}, Status: ${equipment.status}`,
            timestamp,
          ].join(",")
        );
      }
    );
  }

  if (reportData.workOrders) {
    reportData.workOrders.forEach(
      (order: { id: string; title: string; priority: string; status: string }) => {
        csvRows.push(
          [
            "Work Orders",
            "Maintenance Task",
            sanitizeCSV(order.id),
            sanitizeCSV(order.title),
            `Priority: ${order.priority}, Status: ${order.status}`,
            timestamp,
          ].join(",")
        );
      }
    );
  }

  const csv = csvRows.join("\n");
  const filename = `report_${options.type || "general"}_${new Date().toISOString().split("T")[0]}.csv`;

  return { csv, filename };
}

export async function processHTMLGeneration(data: {
  reportData: ReportProcessorData;
  options: ReportProcessorOptions;
}): Promise<{ html: string; filename: string }> {
  const { reportData, options } = data;

  const escapeHtml = (text: unknown) => {
    if (text === null || text === undefined) {
      return "";
    }
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  };

  const formattedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const equipmentSection = reportData.equipmentHealth
    ? `
    <div class="section"><h2>Equipment Health Summary</h2>
      <table><thead><tr><th>Equipment ID</th><th>Vessel</th><th>Health Index</th><th>Status</th><th>Due Days</th></tr></thead>
        <tbody>${reportData.equipmentHealth
          .slice(0, 20)
          .map(
            (e: {
              id: string;
              vessel: string;
              healthIndex: number;
              status: string;
              predictedDueDays?: number;
            }) => `
          <tr><td>${escapeHtml(e.id)}</td><td>${escapeHtml(e.vessel)}</td><td>${e.healthIndex}%</td>
          <td class="status-${e.status === "critical" ? "critical" : e.status === "warning" ? "warning" : "normal"}">${escapeHtml(e.status)}</td>
          <td>${e.predictedDueDays || "N/A"}</td></tr>`
          )
          .join("")}</tbody></table></div>`
    : "";

  const workOrdersSection = reportData.workOrders
    ? `
    <div class="section"><h2>Work Orders Summary</h2>
      <table><thead><tr><th>Title</th><th>Equipment</th><th>Priority</th><th>Status</th><th>Due Date</th></tr></thead>
        <tbody>${reportData.workOrders
          .slice(0, 15)
          .map(
            (o: {
              title: string;
              equipmentId: string;
              priority: string;
              status: string;
              dueDate?: string | Date;
            }) => `
          <tr><td>${escapeHtml(o.title)}</td><td>${escapeHtml(o.equipmentId)}</td>
          <td class="status-${o.priority === "critical" ? "critical" : o.priority === "high" ? "warning" : "normal"}">${escapeHtml(o.priority)}</td>
          <td>${escapeHtml(o.status)}</td><td>${o.dueDate ? new Date(o.dueDate).toLocaleDateString() : "N/A"}</td></tr>`
          )
          .join("")}</tbody></table></div>`
    : "";

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(options.title || "ARUS Marine Report")}</title>
    <style>body{font-family:system-ui,sans-serif;line-height:1.6;max-width:1200px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);color:white;padding:30px;border-radius:12px;margin-bottom:30px}.section{background:white;border-radius:8px;padding:20px;margin:20px 0;box-shadow:0 2px 4px rgba(0,0,0,0.1)}table{width:100%;border-collapse:collapse}th,td{padding:12px;text-align:left;border-bottom:1px solid #ddd}th{background-color:#f8f9fa;font-weight:600}.status-critical{color:#dc2626;font-weight:bold}.status-warning{color:#ea580c;font-weight:bold}.status-normal{color:#16a34a;font-weight:bold}</style></head>
    <body><div class="header"><h1>${escapeHtml(options.title || "ARUS Marine Predictive Maintenance Report")}</h1><p>Generated on ${formattedDate}</p></div>${equipmentSection}${workOrdersSection}</body></html>`;

  const filename = `report_${options.type || "general"}_${new Date().toISOString().split("T")[0]}.html`;

  return { html, filename };
}
