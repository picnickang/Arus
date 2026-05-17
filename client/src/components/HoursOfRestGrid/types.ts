export interface ComplianceRow {
  dayOK: boolean;
  restTotal: number;
  minRest24: number;
  splitOK: boolean;
}

export type DayRow = { date: string } & Record<`h${number}`, number>;
