/**
 * XGBoost Model - Gradient Calculations
 * Multi-class gradient and hessian computation
 */

export function calculateGradients(
  predictions: number[][],
  labels: number[],
  numClasses: number
): { gradients: number[][]; hessians: number[][] } {
  const numSamples = predictions.length;
  const gradients: number[][] = Array(numSamples)
    .fill(0)
    .map(() => Array(numClasses).fill(0));
  const hessians: number[][] = Array(numSamples)
    .fill(0)
    .map(() => Array(numClasses).fill(0));

  for (let i = 0; i < numSamples; i++) {
    const logits = predictions[i];
    if (!logits) continue;
    const maxLogit = Math.max(...logits);
    const expLogits = logits.map((l) => Math.exp(l - maxLogit));
    const sumExp = expLogits.reduce((a, b) => a + b, 0);
    const probs = expLogits.map((e) => e / sumExp);

    const gradRow = gradients[i];
    const hessRow = hessians[i];
    if (!gradRow || !hessRow) continue;
    for (let k = 0; k < numClasses; k++) {
      const yTrue = labels[i] === k ? 1 : 0;
      const yPred = probs[k] ?? 0;
      gradRow[k] = yPred - yTrue;
      hessRow[k] = yPred * (1 - yPred);
    }
  }

  return { gradients, hessians };
}
