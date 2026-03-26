import { logger } from "../../utils/logger";

const LOG_CTX = "DocumentSanitizer";

const DANGEROUS_PATTERNS = [
  /javascript\s*:/gi,
  /<script[\s>]/gi,
  /<\/script>/gi,
  /on\w+\s*=\s*["']/gi,
  /ignore\s+(?:all\s+)?previous\s+instructions/gi,
  /you\s+are\s+now\s+(?:a|an)\s+/gi,
  /system\s*:\s*you\s+(?:are|must|should)/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<\|(?:im_start|im_end|system|user|assistant)\|>/gi,
  /fetch\s*\(/gi,
  /XMLHttpRequest/gi,
  /\.(?:call|apply|bind)\s*\(/gi,
];

const STRIP_PATTERNS = [
  /\x00/g,
  /[\x01-\x08\x0e-\x1f]/g,
  /[ \t]{20,}/g,
  /\n{5,}/g,
];

interface SanitizationResult {
  content: string;
  wasSanitized: boolean;
  strippedPatterns: string[];
  blockedPatterns: string[];
  originalLength: number;
  sanitizedLength: number;
}

export function sanitizeDocumentContent(rawContent: string): SanitizationResult {
  let content = rawContent;
  const strippedPatterns: string[] = [];
  const blockedPatterns: string[] = [];
  const originalLength = content.length;

  for (const pattern of DANGEROUS_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      blockedPatterns.push(`${pattern.source} (${matches.length} occurrences)`);
      content = content.replace(pattern, "[REMOVED]");
    }
  }

  for (const pattern of STRIP_PATTERNS) {
    const before = content.length;
    content = content.replace(pattern, (match) => {
      if (match.includes("\n")) return "\n\n";
      return " ";
    });
    if (content.length !== before) {
      strippedPatterns.push(pattern.source);
    }
  }

  content = content.trim();

  const wasSanitized = blockedPatterns.length > 0 || strippedPatterns.length > 0;

  if (blockedPatterns.length > 0) {
    logger.warn(LOG_CTX, `Blocked ${blockedPatterns.length} dangerous patterns in document`, { blockedPatterns });
  }

  return {
    content,
    wasSanitized,
    strippedPatterns,
    blockedPatterns,
    originalLength,
    sanitizedLength: content.length,
  };
}

export function validatePdfSafety(pdfBuffer: Buffer): {
  safe: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const content = pdfBuffer.toString("latin1");

  if (/\/JavaScript\s/i.test(content) || /\/JS\s/i.test(content)) {
    warnings.push("PDF contains embedded JavaScript");
  }

  if (/\/OpenAction\s/i.test(content)) {
    warnings.push("PDF contains auto-open actions");
  }

  if (/\/SubmitForm\s/i.test(content)) {
    warnings.push("PDF contains form submission actions");
  }

  if (/\/Launch\s/i.test(content)) {
    warnings.push("PDF contains launch actions");
  }

  const safe = warnings.length === 0;

  if (!safe) {
    logger.warn(LOG_CTX, `PDF safety validation failed: ${warnings.join(", ")}`);
  }

  return { safe, warnings };
}

export default { sanitizeDocumentContent, validatePdfSafety };
