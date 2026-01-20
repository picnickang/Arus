import { FileText, Upload, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface EmptyStateProps {
  type: "no-documents" | "no-results" | "no-search";
  onUploadClick?: () => void;
}

export function EmptyState({ type, onUploadClick }: EmptyStateProps) {
  if (type === "no-documents") {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-2">No documents yet</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">
          Upload PDF, PNG, or JPG files to build your knowledge base for AI-powered search and analysis.
        </p>
        {onUploadClick && (
          <Button onClick={onUploadClick} data-testid="button-upload-first">
            <Upload className="h-4 w-4 mr-2" />
            Upload Your First Document
          </Button>
        )}
      </div>
    );
  }

  if (type === "no-results") {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-2">No matches found</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Try adjusting your search terms or filters to find what you're looking for.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium mb-2">Search your knowledge base</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Enter a query above to search across all your uploaded documents using semantic search.
      </p>
    </div>
  );
}
