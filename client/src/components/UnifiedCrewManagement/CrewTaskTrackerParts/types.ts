import type { CrewTaskFilter } from "@/features/crew";

export interface CrewOption {
  id: string;
  name: string;
  rank?: string;
}

export interface VesselOption {
  id: string;
  name: string;
}

export interface CrewDocumentItem {
  id: string;
  documentType: string;
  documentNumber: string | null;
}

export interface CertificateItem {
  id: string;
  certificateName: string;
  certificateNumber: string | null;
}

export type CrewTaskFilterOption = { key: CrewTaskFilter; label: string };
