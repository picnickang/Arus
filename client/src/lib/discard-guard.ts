/**
 * Pure decision behind useDiscardGuard: a close attempt (`nextOpen === false`)
 * on a dirty form is intercepted with a confirm step; everything else passes
 * straight through to the dialog's own open-state handler.
 */
export function shouldInterceptClose(nextOpen: boolean, isDirty: boolean): boolean {
  return !nextOpen && isDirty;
}
