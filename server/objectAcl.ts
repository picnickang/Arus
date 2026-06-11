/**
 * Object ACL stub. The original implementation managed per-object access
 * policies in GCS. We keep the surface so dependent code compiles; in this
 * environment, ACL checks default-allow for the local sandbox.
 */

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
  DELETE = "delete",
}

export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
  aclRules?: Array<{ subject: string; permission: ObjectPermission }>;
}

export async function getObjectAclPolicy(_file: unknown): Promise<ObjectAclPolicy | null> {
  return null;
}

export async function setObjectAclPolicy(_file: unknown, _policy: ObjectAclPolicy): Promise<void> {
  // no-op
}

export async function canAccessObject(args: {
  file: unknown;
  userId?: string;
  requestedPermission: ObjectPermission;
}): Promise<boolean> {
  // Deny-by-default for write/delete when no user identity is supplied.
  // The original GCS-backed ACL is not available in this environment;
  // returning true unconditionally would be a security regression.
  if (args.requestedPermission === ObjectPermission.READ) {
    return true;
  }
  return Boolean(args.userId);
}
