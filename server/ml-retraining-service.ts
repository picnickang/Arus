export const getMlRetrainingService = () => ({
  scheduleRetraining: async () => {},
  getStatus: () => ({ isRunning: false, lastRun: null }),
});

export const evaluateRetrainingTriggers = async () => ({
  shouldRetrain: false,
  reason: "disabled",
});
