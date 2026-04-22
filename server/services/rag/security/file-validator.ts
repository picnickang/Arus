/**
 * File Validator for Document Ingestion
 * Validates file types, sizes, and content before processing
 */

import path from "path";
import { logger } from "../../../utils/logger.js";
import type { RagSecurityConfig } from "./types.js";

export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  quarantine: boolean;
  detectedMimeType?: string;
  sanitizedFilename?: string;
}

// Magic bytes for common file types
const MAGIC_BYTES: Record<string, Buffer> = {
  'application/pdf': Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
  'image/png': Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  'image/jpeg': Buffer.from([0xFF, 0xD8, 0xFF]),
  'image/webp': Buffer.from([0x52, 0x49, 0x46, 0x46]), // RIFF (need to check for WEBP later)
  'application/zip': Buffer.from([0x50, 0x4B, 0x03, 0x04]), // Also DOCX/XLSX
};

// Dangerous file patterns
const DANGEROUS_PATTERNS = [
  /\.exe$/i,
  /\.dll$/i,
  /\.bat$/i,
  /\.cmd$/i,
  /\.sh$/i,
  /\.ps1$/i,
  /\.vbs$/i,
  /\.js$/i, // Unless explicitly allowed
  /\.php$/i,
  /\.asp$/i,
  /\.jsp$/i,
  /\.scr$/i,
  /\.pif$/i,
  /\.msi$/i,
  /\.hta$/i,
];

export class FileValidator {
  private config: RagSecurityConfig['ingestion'];

  constructor(config: RagSecurityConfig['ingestion']) {
    this.config = config;
  }

  /**
   * Validate a file before ingestion
   */
  async validate(
    filename: string,
    buffer: Buffer,
    declaredMimeType?: string
  ): Promise<FileValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let quarantine = false;

    // 1. Validate file size
    const sizeMB = buffer.length / (1024 * 1024);
    if (sizeMB > this.config.maxFileSizeMB) {
      errors.push(`File size (${sizeMB.toFixed(2)}MB) exceeds maximum allowed (${this.config.maxFileSizeMB}MB)`);
    }

    // 2. Validate extension
    const ext = path.extname(filename).toLowerCase();
    if (!this.config.allowedExtensions.includes(ext)) {
      errors.push(`File extension '${ext}' is not allowed. Allowed: ${this.config.allowedExtensions.join(', ')}`);
    }

    // 3. Check for dangerous file patterns
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(filename)) {
        errors.push(`File matches dangerous pattern: ${pattern.toString()}`);
        quarantine = true;
      }
    }

    // 4. Detect actual MIME type from magic bytes
    const detectedMimeType = this.detectMimeType(buffer, ext);
    
    // 5. Validate MIME type
    if (declaredMimeType && !this.config.allowedMimeTypes.includes(declaredMimeType)) {
      errors.push(`Declared MIME type '${declaredMimeType}' is not allowed`);
    }

    // 6. Check for MIME type mismatch (potential spoofing)
    if (declaredMimeType && detectedMimeType && detectedMimeType !== declaredMimeType) {
      // Some mismatches are OK (e.g., application/octet-stream)
      if (declaredMimeType !== 'application/octet-stream') {
        warnings.push(`MIME type mismatch: declared '${declaredMimeType}', detected '${detectedMimeType}'`);
        if (this.config.quarantineOnSuspicious) {
          quarantine = true;
        }
      }
    }

    // 7. Sanitize filename
    const sanitizedFilename = this.sanitizeFilename(filename);

    // 8. Check for embedded scripts in documents
    const suspiciousContent = this.checkSuspiciousContent(buffer, ext);
    if (suspiciousContent.length > 0) {
      warnings.push(...suspiciousContent);
      if (this.config.quarantineOnSuspicious) {
        quarantine = true;
      }
    }

    const valid = errors.length === 0;

    if (!valid || warnings.length > 0) {
      logger.warn("FileValidator", `Validation issues for ${filename}`, {
        valid,
        errors,
        warnings,
        quarantine,
      });
    }

    return {
      valid,
      errors,
      warnings,
      quarantine,
      detectedMimeType,
      sanitizedFilename,
    };
  }

  /**
   * Detect MIME type from magic bytes
   */
  private detectMimeType(buffer: Buffer, ext: string): string | undefined {
    if (buffer.length < 8) {
      return undefined;
    }

    // Check magic bytes
    for (const [mimeType, magic] of Object.entries(MAGIC_BYTES)) {
      if (buffer.subarray(0, magic.length).equals(magic)) {
        // Special case for WEBP (RIFF container)
        if (mimeType === 'image/webp') {
          if (buffer.length >= 12 && buffer.subarray(8, 12).toString() === 'WEBP') {
            return 'image/webp';
          }
          continue;
        }
        return mimeType;
      }
    }

    // Check for Office Open XML (DOCX, XLSX) - they're ZIP files
    if (buffer.subarray(0, 4).equals(MAGIC_BYTES['application/zip'])) {
      // These are actually ZIP files, we need to check content
      if (ext === '.docx') {return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';}
      if (ext === '.xlsx') {return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';}
      return 'application/zip';
    }

    // Text-based formats
    if (ext === '.txt' || ext === '.md' || ext === '.csv') {
      // Check if it looks like text
      const sample = buffer.subarray(0, Math.min(1000, buffer.length));
      if (this.isLikelyText(sample)) {
        if (ext === '.md') {return 'text/markdown';}
        if (ext === '.csv') {return 'text/csv';}
        return 'text/plain';
      }
    }

    return undefined;
  }

  /**
   * Check if buffer looks like text content
   */
  private isLikelyText(buffer: Buffer): boolean {
    let textChars = 0;
    for (const byte of buffer) {
      // Allow printable ASCII, newlines, tabs
      if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
        textChars++;
      }
    }
    return textChars / buffer.length > 0.9;
  }

  /**
   * Check for suspicious content patterns
   */
  private checkSuspiciousContent(buffer: Buffer, ext: string): string[] {
    const warnings: string[] = [];
    const content = buffer.toString('utf-8', 0, Math.min(50000, buffer.length));

    // Check for script tags in documents
    if (/<script[^>]*>/i.test(content)) {
      warnings.push('Contains embedded <script> tags');
    }

    // Check for JavaScript URLs
    if (/javascript:/i.test(content)) {
      warnings.push('Contains javascript: URLs');
    }

    // Check for VBA macros indicators
    if (/vbaProject\.bin/i.test(content) || /ThisDocument/i.test(content)) {
      warnings.push('May contain VBA macros');
    }

    // Check for embedded executables
    if (/MZ[\x00-\xFF]{58}PE\x00\x00/i.test(content)) {
      warnings.push('Contains embedded executable');
    }

    // Check for base64 encoded executables
    if (/TVqQAAMAAAAEAAAA/i.test(content)) {
      warnings.push('Contains base64 encoded executable');
    }

    return warnings;
  }

  /**
   * Sanitize filename to prevent path traversal and other attacks
   */
  sanitizeFilename(filename: string): string {
    let sanitized = filename;

    // Remove path components
    sanitized = path.basename(sanitized);

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Remove special characters except alphanumeric, dots, hyphens, underscores
    sanitized = sanitized.replace(/[^a-zA-Z0-9.\-_]/g, '_');

    // Prevent multiple dots (but allow one for extension)
    sanitized = sanitized.replace(/\.{2,}/g, '.');

    // Limit length
    if (sanitized.length > 200) {
      const ext = path.extname(sanitized);
      sanitized = sanitized.slice(0, 200 - ext.length) + ext;
    }

    // Ensure it has a name
    if (!sanitized || sanitized === ext) {
      sanitized = `file_${Date.now()}${path.extname(filename)}`;
    }

    return sanitized;
  }

  updateConfig(config: RagSecurityConfig['ingestion']): void {
    this.config = config;
  }
}

let instance: FileValidator | null = null;

export function getFileValidator(config: RagSecurityConfig['ingestion']): FileValidator {
  if (!instance) {
    instance = new FileValidator(config);
  }
  return instance;
}

export function updateFileValidatorConfig(config: RagSecurityConfig['ingestion']): void {
  if (instance) {
    instance.updateConfig(config);
  }
}
