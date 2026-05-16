import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExperienceSolutionMap } from "../types";

const STEPS: Array<{ key: keyof ExperienceSolutionMap; label: string }> = [
  { key: "detectRisk", label: "Detect risk" },
  { key: "explainRisk", label: "Explain risk" },
  { key: "assignAction", label: "Assign action" },
  { key: "completeWork", label: "Complete work" },
  { key: "captureProof", label: "Capture proof" },
  { key: "updateHandover", label: "Update handover" },
  { key: "learnFromOutcome", label: "Learn" },
  { key: "reportImpact", label: "Report impact" },
];

export function SolutionLoopCard({ solutionMap }: { solutionMap: ExperienceSolutionMap }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Operational UX loop</CardTitle>
        <CardDescription>Turns the UX plan into a measurable vessel workflow.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((step, index) => (
            <div key={step.key} className="rounded-lg border p-3 min-h-[120px]">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">{step.label}</div>
                {index < STEPS.length - 1 && <ArrowRight className="hidden h-4 w-4 text-muted-foreground xl:block" />}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{solutionMap[step.key]}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
