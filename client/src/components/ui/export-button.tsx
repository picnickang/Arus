import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, File, Table, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  exportToCSV,
  exportToJSON,
  exportToPDF,
  exportTableToPDF,
  type ExportOptions,
  type PDFExportOptions,
  type PDFSection,
  type PDFTableData,
} from "@/lib/exportUtils";

export type ExportFormat = "csv" | "json" | "pdf" | "pdf-table";

export interface ExportButtonProps {
  data: Record<string, unknown>[] | Record<string, unknown> | unknown[];
  filename: string;
  formats?: ExportFormat[];
  csvOptions?: Partial<ExportOptions>;
  pdfOptions?: Partial<PDFExportOptions>;
  pdfSections?: PDFSection[];
  pdfTableData?: PDFTableData;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  disabled?: boolean;
  "data-testid"?: string;
}

export function ExportButton({
  data,
  filename,
  formats = ["csv", "json"],
  csvOptions,
  pdfOptions,
  pdfSections,
  pdfTableData,
  variant = "outline",
  size = "default",
  className,
  disabled,
  "data-testid": testId = "button-export",
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async (format: ExportFormat) => {
    if (!data || isExporting) {
      return;
    }

    setIsExporting(true);

    try {
      let success = false;
      const timestamp = new Date().toISOString().split("T")[0];

      switch (format) {
        case "csv":
          success = exportToCSV((Array.isArray(data) ? data : [data]) as Record<string, unknown>[], {
            filename: `${filename}-${timestamp}.csv`,
            ...csvOptions,
          });
          break;

        case "json":
          success = exportToJSON(data, {
            filename: `${filename}-${timestamp}.json`,
          });
          break;

        case "pdf":
          if (pdfSections) {
            success = await exportToPDF(pdfSections, {
              filename: `${filename}-${timestamp}.pdf`,
              title: pdfOptions?.title || "Analytics Report",
              subtitle: pdfOptions?.subtitle || `Generated on ${timestamp}`,
              ...pdfOptions,
            });
          } else {
            toast({
              title: "Export Failed",
              description: "PDF sections are required for PDF export",
              variant: "destructive",
            });
            return;
          }
          break;

        case "pdf-table":
          if (pdfTableData) {
            success = await exportTableToPDF(pdfTableData, {
              filename: `${filename}-${timestamp}.pdf`,
              title: pdfOptions?.title || "Data Export",
              subtitle: pdfOptions?.subtitle || `Generated on ${timestamp}`,
              ...pdfOptions,
            });
          } else {
            toast({
              title: "Export Failed",
              description: "Table data is required for PDF table export",
              variant: "destructive",
            });
            return;
          }
          break;
      }

      if (success) {
        toast({
          title: "Export Successful",
          description: `Data exported as ${format.toUpperCase()}`,
        });
      } else {
        toast({
          title: "Export Failed",
          description: "No data available to export",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "An error occurred during export",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getFormatIcon = (format: ExportFormat) => {
    switch (format) {
      case "csv":
        return <Table className="h-4 w-4" />;
      case "json":
        return <File className="h-4 w-4" />;
      case "pdf":
      case "pdf-table":
        return <FileText className="h-4 w-4" />;
    }
  };

  const getFormatLabel = (format: ExportFormat) => {
    switch (format) {
      case "csv":
        return "Export as CSV";
      case "json":
        return "Export as JSON";
      case "pdf":
        return "Export as PDF";
      case "pdf-table":
        return "Export as PDF Table";
    }
  };

  if (formats.length === 1) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={() => handleExport(formats[0])}
        disabled={disabled || isExporting || !data}
        className={className}
        data-testid={testId}
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" data-testid="icon-export-loading" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        {isExporting ? "Exporting..." : "Export"}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={disabled || isExporting || !data}
          className={className}
          data-testid={testId}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" data-testid="icon-export-loading" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {isExporting ? "Exporting..." : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-testid="menu-export-formats">
        {formats.map((format) => (
          <DropdownMenuItem
            key={format}
            onClick={() => handleExport(format)}
            disabled={isExporting}
            data-testid={`menuitem-export-${format}`}
          >
            {getFormatIcon(format)}
            <span className="ml-2">{getFormatLabel(format)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
