/**
 * LP Optimizer - Linear Programming Formulation
 */

import type { MaintenanceJob, OptimizationConstraints, OptimizationResult } from "./types.js";
import { getPriorityCost } from "./estimation-helpers.js";
import { cryptoRandomId } from "@shared/crypto-random";

function initializeConstraintMap(
  jobs: MaintenanceJob[],
  constraints: OptimizationConstraints,
  partsStock: Map<string, number>
): Map<string, { min?: number; max?: number }> {
  const constraintMap = new Map<string, { min?: number; max?: number }>();

  for (let jobIdx = 0; jobIdx < jobs.length; jobIdx++) {
    constraintMap.set(`job_assignment_${jobIdx}`, { min: 1, max: 1 });
  }

  for (let crewIdx = 0; crewIdx < constraints.crewAvailability.length; crewIdx++) {
    const crew = constraints.crewAvailability[crewIdx];
    for (let day = 0; day < constraints.timeHorizonDays; day++) {
      constraintMap.set(`crew_capacity_c${crewIdx}_d${day}`, { max: crew.maxHoursPerDay });
    }
  }

  for (let day = 0; day < constraints.timeHorizonDays; day++) {
    for (let hour = 8; hour <= 16; hour++) {
      constraintMap.set(`concurrent_limit_d${day}_h${hour}`, {
        max: constraints.maxConcurrentJobs,
      });
    }
  }

  constraintMap.set("parts_budget", { max: constraints.partsBudget });

  for (let crewIdx = 0; crewIdx < constraints.crewAvailability.length; crewIdx++) {
    for (let day = 0; day < constraints.timeHorizonDays; day++) {
      for (let hour = 8; hour <= 16; hour++) {
        constraintMap.set(`crew_overlap_c${crewIdx}_d${day}_h${hour}`, { max: 1 });
      }
    }
  }

  const uniqueEquipment = new Set(jobs.map((j) => j.equipmentId));
  for (const eqId of uniqueEquipment) {
    for (let day = 0; day < constraints.timeHorizonDays; day++) {
      for (let hour = 8; hour <= 16; hour++) {
        constraintMap.set(`equipment_exclusive_eq${eqId}_d${day}_h${hour}`, { max: 1 });
      }
    }
  }

  for (const [partId, stock] of partsStock) {
    constraintMap.set(`parts_stock_${partId}`, { max: stock });
  }

  return constraintMap;
}

function buildPartsStock(jobs: MaintenanceJob[], partsData: any[]): Map<string, number> {
  const partsStock = new Map<string, number>();
  partsData.forEach((part) => {
    if (part.quantity) {
      partsStock.set(part.id, part.quantity);
    }
  });
  jobs.forEach((job) => {
    job.parts.forEach((part) => {
      if (!partsStock.has(part.partId)) {
        partsStock.set(part.partId, 999);
      }
    });
  });
  return partsStock;
}

function createJobVariable(
  job: MaintenanceJob,
  jobIdx: number,
  crewIdx: number,
  crew: OptimizationConstraints["crewAvailability"][0],
  day: number,
  hour: number,
  constraints: OptimizationConstraints
): { varName: string; coeffs: any } | null {
  const dayName = new Date(Date.now() + day * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
    weekday: "long",
  });
  if (!crew.availableDays.includes(dayName)) {
    return null;
  }

  const jobDurationHours = job.estimatedDurationHours / 60;
  if (hour + Math.ceil(jobDurationHours) > 17) {
    return null;
  }

  const varName = `j${jobIdx}_c${crewIdx}_d${day}_h${hour}`;

  const laborCost = (job.estimatedDurationHours / 60) * crew.hourlyRate;
  const partsCost = job.parts.reduce((sum, part) => sum + part.quantity * part.unitCost, 0);
  const priorityCost = getPriorityCost(job.priority, constraints.priorityWeights);

  const scheduledDate = new Date(Date.now() + day * 24 * 60 * 60 * 1000);
  let latenessPenalty = 0;
  if (job.deadline && scheduledDate > job.deadline) {
    const daysLate = Math.ceil(
      (scheduledDate.getTime() - job.deadline.getTime()) / (24 * 60 * 60 * 1000)
    );
    latenessPenalty = daysLate * 100;
  }

  const coeffs: any = { objective: laborCost + partsCost + priorityCost + latenessPenalty };
  coeffs[`job_assignment_${jobIdx}`] = 1;
  coeffs[`crew_capacity_c${crewIdx}_d${day}`] = jobDurationHours;

  const jobEndHour = hour + Math.ceil(jobDurationHours);
  for (let blockHour = hour; blockHour < jobEndHour; blockHour++) {
    coeffs[`concurrent_limit_d${day}_h${blockHour}`] = 1;
    coeffs[`crew_overlap_c${crewIdx}_d${day}_h${blockHour}`] = 1;
    coeffs[`equipment_exclusive_eq${job.equipmentId}_d${day}_h${blockHour}`] = 1;
  }

  coeffs["parts_budget"] = partsCost;
  job.parts.forEach((part) => {
    coeffs[`parts_stock_${part.partId}`] = part.quantity;
  });

  return { varName, coeffs };
}

function buildVariables(jobs: MaintenanceJob[], constraints: OptimizationConstraints): any {
  const variables: any = {};

  for (let jobIdx = 0; jobIdx < jobs.length; jobIdx++) {
    const job = jobs[jobIdx];

    for (let crewIdx = 0; crewIdx < constraints.crewAvailability.length; crewIdx++) {
      const crew = constraints.crewAvailability[crewIdx];
      if (crew.skillLevel < job.requiredSkillLevel) {
        continue;
      }

      for (let day = 0; day < constraints.timeHorizonDays; day++) {
        for (let hour = 8; hour <= 16; hour++) {
          const result = createJobVariable(job, jobIdx, crewIdx, crew, day, hour, constraints);
          if (result) {
            variables[result.varName] = result.coeffs;
          }
        }
      }
    }

    variables[`slack_unassigned_j${jobIdx}`] = {
      objective: 10000,
      [`job_assignment_${jobIdx}`]: 1,
    };
  }

  return variables;
}

export function formulateLinearProgram(
  jobs: MaintenanceJob[],
  constraints: OptimizationConstraints,
  partsData: any[]
): any {
  const partsStock = buildPartsStock(jobs, partsData);
  const constraintMap = initializeConstraintMap(jobs, constraints, partsStock);
  const constraintDefs: any = {};
  for (const [name, bounds] of constraintMap) {
    constraintDefs[name] = bounds;
  }

  const variables = buildVariables(jobs, constraints);

  console.log(
    `[LP Optimizer] Formulated problem: ${Object.keys(variables).length} variables, ${Object.keys(constraintDefs).length} constraints`
  );

  return {
    optimize: "objective",
    opType: "min",
    constraints: constraintDefs,
    variables,
    binaries: Object.keys(variables).reduce((acc: any, key) => ({ ...acc, [key]: 1 }), {}),
  };
}

export function relaxConstraints(lpProblem: any): any {
  if (lpProblem.constraints.parts_budget) {
    lpProblem.constraints.parts_budget.max *= 1.2;
  }

  for (const constraintName in lpProblem.constraints) {
    if (constraintName.includes("crew_capacity_")) {
      lpProblem.constraints[constraintName].max *= 1.1;
    }
  }

  return lpProblem;
}

const META_KEYS = new Set(["feasible", "result", "bounded", "isIntegral"]);

function extractScheduleFromSolution(
  solution: any,
  jobs: MaintenanceJob[],
  constraints: OptimizationConstraints
): {
  schedule: OptimizationResult["schedule"];
  crewUtilization: { [key: string]: number };
  dailyWorkload: { [key: string]: { hours: number; jobs: number } };
  totalCost: number;
  partsUsedBudget: number;
} {
  const schedule: OptimizationResult["schedule"] = [];
  const crewUtilization: { [key: string]: number } = {};
  const dailyWorkload: { [key: string]: { hours: number; jobs: number } } = {};
  let totalCost = 0;
  let partsUsedBudget = 0;

  constraints.crewAvailability.forEach((crew) => {
    crewUtilization[crew.crewMember] = 0;
  });

  if (!solution.feasible || !solution.result) {
    return { schedule, crewUtilization, dailyWorkload, totalCost, partsUsedBudget };
  }

  for (const [varName, value] of Object.entries(solution.result)) {
    if (META_KEYS.has(varName) || value !== 1) {
      continue;
    }

    const match = varName.match(/j(\d+)_c(\d+)_d(\d+)_h(\d+)/);
    if (!match) {
      continue;
    }

    const [, jobIdxStr, crewIdxStr, dayStr, hourStr] = match;
    const jobIdx = Number(jobIdxStr);
    const crewIdx = Number(crewIdxStr);
    const day = Number(dayStr);
    const hour = Number(hourStr);

    const job = jobs[jobIdx];
    const crew = constraints.crewAvailability[crewIdx];
    if (!job || !crew) {
      continue;
    }

    const scheduledDate = new Date(Date.now() + day * 24 * 60 * 60 * 1000);
    const laborCost = (job.estimatedDurationHours / 60) * crew.hourlyRate;
    const partsCost = job.parts.reduce((sum, part) => sum + part.quantity * part.unitCost, 0);

    schedule.push({
      jobId: job.id,
      equipmentId: job.equipmentId,
      assignedCrew: crew.crewMember,
      scheduledDate,
      startTime: `${hour.toString().padStart(2, "0")}:00`,
      duration: job.estimatedDurationHours,
      estimatedCost: laborCost + partsCost,
      priority: job.priority,
    });

    crewUtilization[crew.crewMember] += job.estimatedDurationHours / 60;
    totalCost += laborCost + partsCost;
    partsUsedBudget += partsCost;

    const dayKey = scheduledDate.toISOString().split("T")[0];
    if (!dailyWorkload[dayKey]) {
      dailyWorkload[dayKey] = { hours: 0, jobs: 0 };
    }
    dailyWorkload[dayKey].hours += job.estimatedDurationHours / 60;
    dailyWorkload[dayKey].jobs += 1;
  }

  return { schedule, crewUtilization, dailyWorkload, totalCost, partsUsedBudget };
}

export function processSolution(
  solution: any,
  jobs: MaintenanceJob[],
  constraints: OptimizationConstraints,
  optimizationTime: number,
  wasRelaxed: boolean
): OptimizationResult {
  const { schedule, crewUtilization, dailyWorkload, totalCost, partsUsedBudget } =
    extractScheduleFromSolution(solution, jobs, constraints);

  const resourceUtilization = {
    crewUtilization: constraints.crewAvailability.map((crew) => ({
      crewMember: crew.crewMember,
      totalHours: crewUtilization[crew.crewMember] ?? 0,
      utilizationRate:
        ((crewUtilization[crew.crewMember] ?? 0) /
          (crew.maxHoursPerDay * constraints.timeHorizonDays)) *
        100,
    })),
    dailyWorkload: Object.entries(dailyWorkload).map(([date, workload]) => ({
      date,
      totalHours: workload.hours,
      jobCount: workload.jobs,
    })),
    totalCost,
    partsUsedBudget,
  };

  const violations: string[] = [];
  if (wasRelaxed) {
    violations.push("Some constraints were relaxed to find a feasible solution");
  }
  if (partsUsedBudget > constraints.partsBudget) {
    violations.push(
      `Parts budget exceeded by $${(partsUsedBudget - constraints.partsBudget).toFixed(2)}`
    );
  }

  console.log(
    `[LP Optimizer] Optimization completed: ${schedule.length} jobs scheduled, total cost: $${totalCost.toFixed(2)}`
  );

  return {
    success: solution.feasible ?? false,
    objectiveValue: solution.objective ?? 0,
    schedule,
    resourceUtilization,
    constraints: {
      feasible: solution.feasible && !wasRelaxed,
      violations,
    },
    optimizationTime,
    optimizationId: `opt-${Date.now()}-${cryptoRandomId(9)}`,
  };
}
