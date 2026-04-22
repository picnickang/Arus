import client from "prom-client";

// ===== JOB QUEUE METRICS =====
export const jobQueueJobsEnqueuedTotal = new client.Counter({
  name: "arus_job_queue_jobs_enqueued_total",
  help: "Total jobs enqueued to the job queue",
  labelNames: ["queue_name", "priority"],
});

export const jobQueueJobsCompletedTotal = new client.Counter({
  name: "arus_job_queue_jobs_completed_total",
  help: "Total jobs completed successfully",
  labelNames: ["queue_name"],
});

export const jobQueueJobsFailedTotal = new client.Counter({
  name: "arus_job_queue_jobs_failed_total",
  help: "Total jobs that failed",
  labelNames: ["queue_name", "error_type"],
});

export const jobQueueJobDuration = new client.Histogram({
  name: "arus_job_queue_job_duration_seconds",
  help: "Job processing duration in seconds",
  labelNames: ["queue_name"],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120, 300],
});

export const jobQueueDepth = new client.Gauge({
  name: "arus_job_queue_depth",
  help: "Current number of jobs in the queue",
  labelNames: ["queue_name", "state"],
});

export const jobQueueWorkerUtilization = new client.Gauge({
  name: "arus_job_queue_worker_utilization",
  help: "Worker utilization percentage (0-100)",
  labelNames: ["worker_id"],
});

// Helper functions
export function recordJobEnqueued(queueName: string, priority: string) {
  jobQueueJobsEnqueuedTotal.inc({ queue_name: queueName, priority });
}

export function recordJobCompleted(queueName: string) {
  jobQueueJobsCompletedTotal.inc({ queue_name: queueName });
}

export function recordJobFailed(queueName: string, errorType: string) {
  jobQueueJobsFailedTotal.inc({ queue_name: queueName, error_type: errorType });
}

export function recordJobDuration(queueName: string, durationSec: number) {
  jobQueueJobDuration.observe({ queue_name: queueName }, durationSec);
}

export function setJobQueueDepth(
  queueName: string,
  state: "pending" | "active" | "completed" | "failed",
  count: number
) {
  jobQueueDepth.set({ queue_name: queueName, state }, count);
}

export function setWorkerUtilization(workerId: string, utilization: number) {
  jobQueueWorkerUtilization.set({ worker_id: workerId }, utilization);
}

// Backward-compatible aliases
export const incrementJobEnqueued = recordJobEnqueued;
export const incrementJobCompleted = recordJobCompleted;
export function incrementJobFailed(queueName: string, errorType: string = "unknown") {
  jobQueueJobsFailedTotal.inc({ queue_name: queueName, error_type: errorType });
}
export function setJobQueueSize(queueName: string, count: number) {
  jobQueueDepth.set({ queue_name: queueName, state: "pending" }, count);
}
