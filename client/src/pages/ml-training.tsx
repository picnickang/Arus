import { useState } from "react";
import { useTrainingData } from "@/features/ml-ai";
import { MLTrainingExportCard } from "./ml-training-export-card";
import { MLTrainingTabs } from "./ml-training-tabs";

export default function MLTrainingPage() {
  const training = useTrainingData();
  const [ackResetKeepModels, setAckResetKeepModels] = useState(false);
  const [ackResetAll, setAckResetAll] = useState(false);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <MLTrainingTabs
        training={training}
        ackResetKeepModels={ackResetKeepModels}
        setAckResetKeepModels={setAckResetKeepModels}
        ackResetAll={ackResetAll}
        setAckResetAll={setAckResetAll}
      />
      <MLTrainingExportCard training={training} />
    </div>
  );
}
