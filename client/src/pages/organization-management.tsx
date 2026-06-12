import { useOrganizationData } from "@/features/settings";
import { OrganizationManagementDialogs } from "./organization-management-dialogs";
import { OrganizationManagementSections } from "./organization-management-sections";

export default function OrganizationManagement() {
  const m = useOrganizationData();

  return (
    <div className="min-h-screen">
      <OrganizationManagementSections m={m} />
      <OrganizationManagementDialogs m={m} />
    </div>
  );
}
