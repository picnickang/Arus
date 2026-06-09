import { apiRequest } from "@/lib/queryClient";
import type { DevLoginRequest, DevLoginResponse } from "@shared/dev-login";

export type { DevLoginRequest, DevLoginResponse } from "@shared/dev-login";

export function requestDevLogin(input: DevLoginRequest): Promise<DevLoginResponse> {
  return apiRequest("POST", "/api/portal/dev-login", input);
}
