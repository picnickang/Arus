/**
 * Training Tab
 *
 * ML model training interface with admin controls.
 * Includes LSTM, Random Forest, Acoustic analysis, and data management.
 */

import { useTrainingData } from "@/features/ml-ai";
import { TrainingTabShell } from "./TrainingTabShell";

export default function TrainingTab() {
  const training = useTrainingData();

  return (
    <div className="space-y-6">
      <TrainingTabShell training={training} />
    </div>
  );
}
