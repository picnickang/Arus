/**
 * RAG Security Configuration Types
 * Defines all security settings for the RAG system
 */

export interface RagSecurityConfig {
  // Authentication settings
  auth: {
    requireSession: boolean;
    allowHeaderOrgId: boolean; // For dev mode only
    streamingTokenTTLSeconds: number;
  };
  
  // Rate limiting settings
  rateLimiting: {
    enabled: boolean;
    requestsPerMinute: number;
    burstLimit: number;
    windowSizeSeconds: number;
    useRedis: boolean;
  };
  
  // Document ingestion settings
  ingestion: {
    maxFileSizeMB: number;
    allowedMimeTypes: string[];
    allowedExtensions: string[];
    enableMalwareScan: boolean;
    quarantineOnSuspicious: boolean;
  };
  
  // Prompt injection protection
  promptSecurity: {
    enabled: boolean;
    sanitizeUserInput: boolean;
    useBoundaryMarkers: boolean;
    filterOutputPatterns: boolean;
    maxQueryLength: number;
    blockedPatterns: string[];
  };
  
  // Audit logging
  audit: {
    enabled: boolean;
    logQueries: boolean;
    logResponses: boolean;
    logDocumentAccess: boolean;
    retentionDays: number;
  };
}

export const DEFAULT_RAG_SECURITY_CONFIG: RagSecurityConfig = {
  auth: {
    requireSession: true,
    allowHeaderOrgId: false, // Only enable in development
    streamingTokenTTLSeconds: 300, // 5 minutes
  },
  rateLimiting: {
    enabled: true,
    requestsPerMinute: 30,
    burstLimit: 10,
    windowSizeSeconds: 60,
    useRedis: true,
  },
  ingestion: {
    maxFileSizeMB: 50,
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/plain',
      'text/markdown',
      'text/csv',
      'image/png',
      'image/jpeg',
      'image/webp',
    ],
    allowedExtensions: ['.pdf', '.doc', '.docx', '.xlsx', '.xls', '.txt', '.md', '.csv', '.png', '.jpg', '.jpeg', '.webp'],
    enableMalwareScan: false, // Requires external service
    quarantineOnSuspicious: true,
  },
  promptSecurity: {
    enabled: true,
    sanitizeUserInput: true,
    useBoundaryMarkers: true,
    filterOutputPatterns: true,
    maxQueryLength: 4000,
    blockedPatterns: [
      'ignore previous instructions',
      'ignore all previous',
      'disregard above',
      'forget everything',
      'new instructions:',
      'system prompt:',
      'you are now',
      'pretend you are',
      'act as if',
      'override your',
      '\\[INST\\]',
      '<<SYS>>',
      '</s>',
      '<|im_start|>',
      '<|im_end|>',
    ],
  },
  audit: {
    enabled: true,
    logQueries: true,
    logResponses: false, // Can be verbose
    logDocumentAccess: true,
    retentionDays: 90,
  },
};

export function mergeWithDefaults(partial: Partial<RagSecurityConfig>): RagSecurityConfig {
  return {
    auth: { ...DEFAULT_RAG_SECURITY_CONFIG.auth, ...partial.auth },
    rateLimiting: { ...DEFAULT_RAG_SECURITY_CONFIG.rateLimiting, ...partial.rateLimiting },
    ingestion: { ...DEFAULT_RAG_SECURITY_CONFIG.ingestion, ...partial.ingestion },
    promptSecurity: { ...DEFAULT_RAG_SECURITY_CONFIG.promptSecurity, ...partial.promptSecurity },
    audit: { ...DEFAULT_RAG_SECURITY_CONFIG.audit, ...partial.audit },
  };
}
