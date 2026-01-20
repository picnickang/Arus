import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Eye } from "lucide-react";

interface TemplatePreviewProps {
  subject: string;
  body: string;
}

export function TemplatePreview({ subject, body }: TemplatePreviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Email Preview
        </CardTitle>
        <CardDescription>
          Preview with sample data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground">Subject:</Label>
          <div className="p-3 bg-muted rounded-md font-medium" data-testid="preview-subject">
            {subject}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground">Body:</Label>
          <pre className="p-4 bg-muted rounded-md text-sm whitespace-pre-wrap font-mono overflow-auto max-h-96" data-testid="preview-body">
            {body}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
