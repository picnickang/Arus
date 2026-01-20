import { Badge } from "@/components/ui/badge";
import { FileText, Image } from "lucide-react";

const SUPPORTED_FORMATS = [
  { ext: "PDF", icon: FileText, category: "document" },
  { ext: "DOCX", icon: FileText, category: "document" },
  { ext: "XLSX", icon: FileText, category: "document" },
  { ext: "TXT", icon: FileText, category: "document" },
  { ext: "MD", icon: FileText, category: "document" },
  { ext: "PNG", icon: Image, category: "image" },
  { ext: "JPG", icon: Image, category: "image" },
];

export function SupportedFormats() {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Supported:</span>
      {SUPPORTED_FORMATS.map((format) => (
        <Badge key={format.ext} variant="outline" className="text-xs py-0">
          {format.ext}
        </Badge>
      ))}
    </div>
  );
}
