import { pdfExtractor } from "./pdf";
import { imageExtractor } from "./image";
import { txtExtractor } from "./txt";
import { docxExtractor } from "./docx";
import { xlsxExtractor } from "./xlsx";
import type { TextExtractor, SupportedFileType } from "../types";

const extractorRegistry: Map<SupportedFileType, TextExtractor> = new Map();

function registerExtractor(extractor: TextExtractor): void {
  for (const type of extractor.supportedTypes) {
    extractorRegistry.set(type, extractor);
  }
}

registerExtractor(pdfExtractor);
registerExtractor(imageExtractor);
registerExtractor(txtExtractor);
registerExtractor(docxExtractor);
registerExtractor(xlsxExtractor);

export function getExtractor(fileType: SupportedFileType): TextExtractor | undefined {
  return extractorRegistry.get(fileType);
}

export function getSupportedTypes(): SupportedFileType[] {
  return Array.from(extractorRegistry.keys());
}

export async function extractText(buffer: Buffer, fileType: SupportedFileType): Promise<string> {
  const extractor = getExtractor(fileType);
  if (!extractor) {
    throw new Error(`Unsupported file type: ${fileType}`);
  }
  return extractor.extract(buffer);
}

export { pdfExtractor, imageExtractor, txtExtractor, docxExtractor, xlsxExtractor };
