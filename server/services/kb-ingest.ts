/**
 * Knowledge-base ingest shim. Consumers tolerate this being absent.
 */

export interface KbDocument {
  id?: string;
  title: string;
  content: string;
  [k: string]: unknown;
}

export async function ingestDocuments(_documents: KbDocument[]): Promise<void> {
  // no-op
}
