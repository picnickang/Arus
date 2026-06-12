import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Database, Radio, Trash2, TrendingUp } from "lucide-react";
import {
  DataExportSection,
  ResetTrainingDataSection,
  TrainedModelsSection,
} from "./TrainingTabManagementSections";
import {
  AcousticAnalysisSection,
  LstmTrainingSection,
  RandomForestTrainingSection,
} from "./TrainingTabTrainingSections";
import type { TrainingDataState } from "./TrainingTabTypes";

interface TrainingTabShellProps {
  training: TrainingDataState;
}

export function TrainingTabShell({ training }: TrainingTabShellProps) {
  return (
    <Tabs defaultValue="lstm" className="space-y-4">
      <div className="overflow-x-auto pb-2">
        <TabsList className="inline-flex w-full min-w-fit p-1 gap-1">
          <TabsTrigger
            value="lstm"
            className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px]"
            data-testid="tab-lstm"
          >
            <Brain className="h-4 w-4 mr-2" />
            <span>LSTM Training</span>
          </TabsTrigger>
          <TabsTrigger
            value="rf"
            className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px]"
            data-testid="tab-random-forest"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            <span>Random Forest</span>
          </TabsTrigger>
          <TabsTrigger
            value="acoustic"
            className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px]"
            data-testid="tab-acoustic"
          >
            <Radio className="h-4 w-4 mr-2" />
            <span>Acoustic Analysis</span>
          </TabsTrigger>
          <TabsTrigger
            value="models"
            className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px]"
            data-testid="tab-models"
          >
            <Database className="h-4 w-4 mr-2" />
            <span>Trained Models</span>
          </TabsTrigger>
          <TabsTrigger
            value="reset"
            className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] text-destructive"
            data-testid="tab-reset-data"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            <span>Reset Data</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="lstm" className="space-y-4">
        <LstmTrainingSection training={training} />
      </TabsContent>

      <TabsContent value="rf" className="space-y-4">
        <RandomForestTrainingSection training={training} />
      </TabsContent>

      <TabsContent value="acoustic" className="space-y-4">
        <AcousticAnalysisSection training={training} />
      </TabsContent>

      <TabsContent value="models" className="space-y-4">
        <TrainedModelsSection training={training} />
        <DataExportSection />
      </TabsContent>

      <TabsContent value="reset" className="space-y-4">
        <ResetTrainingDataSection training={training} />
      </TabsContent>
    </Tabs>
  );
}
