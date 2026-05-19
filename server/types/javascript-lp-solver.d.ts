declare module "javascript-lp-solver" {
  // Minimal typed surface for the members we actually call. The package is
  // CJS and exposes many more entries (Model, Constraint, Variable, Numeral,
  // Term, Tableau, External, branchAndCut, lastSolvedModel, …) but pinning
  // the call surface here means future API regressions (e.g. the `Solve` →
  // `solve` casing mismatch that previously slipped through untyped) become
  // compile-time errors rather than runtime "not a function" throws.
  interface LpSolveResult {
    feasible: boolean;
    result: number;
    bounded: boolean;
    isIntegral?: boolean;
    [variableName: string]: unknown;
  }
  interface LpSolverApi {
    Solve(model: Record<string, unknown>, precision?: number, full?: boolean, validate?: boolean): LpSolveResult;
    Model?: unknown;
    Constraint?: unknown;
    Variable?: unknown;
  }
  const solver: LpSolverApi;
  export default solver;
}
