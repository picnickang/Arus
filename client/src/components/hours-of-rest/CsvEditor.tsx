import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CsvEditorProps {
  csv: string;
  setCsv: React.Dispatch<React.SetStateAction<string>>;
  importCSV: () => void;
  setMode: React.Dispatch<React.SetStateAction<"GRID" | "CSV">>;
}

export function CsvEditor({ csv, setCsv, importCSV, setMode }: CsvEditorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>CSV Data</CardTitle>
        <CardDescription>Edit raw CSV data (date,h0..h23)</CardDescription>
      </CardHeader>
      <CardContent>
        <textarea className="w-full h-40 p-2 border rounded-md font-mono text-sm" value={csv} onChange={(e) => setCsv(e.target.value)} data-testid="textarea-csv" />
        <div className="flex gap-2 mt-2">
          <Button onClick={importCSV} size="sm" data-testid="button-import-csv-modal">Import & Apply</Button>
          <Button onClick={() => setMode("GRID")} variant="outline" size="sm" data-testid="button-back-to-grid">Back to Grid</Button>
        </div>
      </CardContent>
    </Card>
  );
}
