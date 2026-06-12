import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Database, Radio, Trash2, TrendingUp } from "lucide-react";
import { TrainedModelsTab } from "./ml-training-models-tab";
import { ResetDataTab } from "./ml-training-reset-tab";
import {
  AcousticAnalysisTab,
  LstmTrainingTab,
  RandomForestTrainingTab,
} from "./ml-training-training-tabs";
import type { MLTrainingData } from "./ml-training-types";

interface MLTrainingTabsProps {
  training: MLTrainingData;
  ackResetKeepModels: boolean;
  setAckResetKeepModels: (value: boolean) => void;
  ackResetAll: boolean;
  setAckResetAll: (value: boolean) => void;
}

export function MLTrainingTabs({
  training,
  ackResetKeepModels,
  setAckResetKeepModels,
  ackResetAll,
  setAckResetAll,
}: MLTrainingTabsProps) {
  return (
    <Tabs defaultValue="lstm" className="space-y-6">
      <div className="overflow-x-auto pb-2">
        <TabsList className="inline-flex w-full min-w-fit p-1 gap-1">
          <TabsTrigger
            value="lstm"
            data-testid="tab-lstm"
            className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[90px] sm:min-w-[110px] transition-all"
          >
            <Brain className="h-4 w-4 mr-2" />
            <span>LSTM Training</span>
          </TabsTrigger>
          <TabsTrigger
            value="rf"
            data-testid="tab-random-forest"
            className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[90px] sm:min-w-[110px] transition-all"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            <span>Random Forest</span>
          </TabsTrigger>
          <TabsTrigger
            value="acoustic"
            data-testid="tab-acoustic"
            className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[90px] sm:min-w-[110px] transition-all"
          >
            <Radio className="h-4 w-4 mr-2" />
            <span>Acoustic Analysis</span>
          </TabsTrigger>
          <TabsTrigger
            value="models"
            data-testid="tab-models"
            className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[90px] sm:min-w-[110px] transition-all"
          >
            <Database className="h-4 w-4 mr-2" />
            <span>Trained Models</span>
          </TabsTrigger>
          <TabsTrigger
            value="reset"
            data-testid="tab-reset-data"
            className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[90px] sm:min-w-[110px] transition-all text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            <span>Reset Data</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="lstm" className="space-y-4">
        <LstmTrainingTab training={training} />
      </TabsContent>

      <TabsContent value="rf" className="space-y-4">
        <RandomForestTrainingTab training={training} />
      </TabsContent>

      <TabsContent value="acoustic" className="space-y-4">
        <AcousticAnalysisTab training={training} />
      </TabsContent>

      <TabsContent value="models" className="space-y-4">
        <TrainedModelsTab training={training} />
      </TabsContent>

      <TabsContent value="reset" className="space-y-4">
        <ResetDataTab
          training={training}
          ackResetKeepModels={ackResetKeepModels}
          setAckResetKeepModels={setAckResetKeepModels}
          ackResetAll={ackResetAll}
          setAckResetAll={setAckResetAll}
        />
      </TabsContent>
    </Tabs>
  );
}
