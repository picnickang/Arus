/**
 * Local minimal declaration for @google-cloud/storage.
 *
 * The real package is not installed in this environment (it has native
 * dependencies that don't build everywhere); object storage is dynamically
 * imported and only used in Replit. This declaration keeps the type-only
 * imports in server/objectStorage.ts compiling without forcing an install.
 */

declare module "@google-cloud/storage" {
  export interface SignedUrlOptions {
    version?: "v2" | "v4";
    action: "read" | "write" | "delete" | "resumable";
    expires: number | Date | string;
    contentType?: string;
    extensionHeaders?: Record<string, string>;
  }

  export interface FileMetadata {
    contentType?: string;
    size?: string | number;
    md5Hash?: string;
    updated?: string;
    [k: string]: unknown;
  }

  export interface File {
    name: string;
    bucket: Bucket;
    metadata: FileMetadata;
    exists(): Promise<[boolean]>;
    delete(): Promise<unknown>;
    download(): Promise<[Buffer]>;
    getMetadata(): Promise<[FileMetadata]>;
    setMetadata(metadata: Partial<FileMetadata>): Promise<unknown>;
    getSignedUrl(options: SignedUrlOptions): Promise<[string]>;
    createReadStream(): NodeJS.ReadableStream;
    createWriteStream(options?: { metadata?: FileMetadata; resumable?: boolean }): NodeJS.WritableStream;
    save(data: Buffer | string, options?: { metadata?: FileMetadata }): Promise<unknown>;
  }

  export interface Bucket {
    name: string;
    file(name: string): File;
    exists(): Promise<[boolean]>;
    getFiles(query?: { prefix?: string; maxResults?: number }): Promise<[File[]]>;
    upload(localPath: string, options?: { destination?: string }): Promise<[File]>;
  }

  export interface StorageOptions {
    projectId?: string;
    keyFilename?: string;
    credentials?: Record<string, unknown>;
  }

  export class Storage {
    constructor(options?: StorageOptions);
    bucket(name: string): Bucket;
    getBuckets(): Promise<[Bucket[]]>;
  }
}
