export interface CertFormData {
  vesselId: string;
  certificateType: string;
  certificateName: string;
  certificateNumber: string;
  issuingAuthority: string;
  issuingAuthorityType: string;
  issueDate: string;
  expiryDate: string;
  equipmentId: string;
  notes: string;
}

export const defaultFormData: CertFormData = {
  vesselId: "",
  certificateType: "",
  certificateName: "",
  certificateNumber: "",
  issuingAuthority: "",
  issuingAuthorityType: "",
  issueDate: "",
  expiryDate: "",
  equipmentId: "",
  notes: "",
};
