export interface TechnicianInsight {
  id: string;
  equipmentId: string;
  equipmentName: string;
  category: string;
  title: string;
  description: string;
  statusLevel: "critical" | "action_required" | "monitor" | "normal";
  confidence: number;
  recommendation?: string;
  createdAt?: string;
}
