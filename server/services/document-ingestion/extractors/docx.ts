import type { TextExtractor, SupportedFileType } from '../types';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import AdmZip from 'adm-zip';
import { logger } from '../../../utils/logger';

function extractTextFromXml(xml: string): string {
  const paragraphs: string[] = [];
  const wParagraphRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/gi;
  let match;
  
  while ((match = wParagraphRegex.exec(xml)) !== null) {
    const paragraphContent = match[1];
    const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/gi;
    let textMatch;
    const texts: string[] = [];
    
    while ((textMatch = textRegex.exec(paragraphContent)) !== null) {
      texts.push(textMatch[1]);
    }
    
    if (texts.length > 0) {
      paragraphs.push(texts.join(''));
    }
  }
  
  return paragraphs.join('\n\n');
}

export const docxExtractor: TextExtractor = {
  supportedTypes: ['docx'] as SupportedFileType[],
  
  async extract(buffer: Buffer): Promise<string> {
    try {
      const zip = new AdmZip(buffer);
      const documentXml = zip.getEntry('word/document.xml');
      
      if (!documentXml) {
        throw new Error('Invalid DOCX: word/document.xml not found');
      }
      
      const xmlContent = documentXml.getData().toString('utf-8');
      const text = extractTextFromXml(xmlContent);
      
      if (!text.trim()) {
        throw new Error('DOCX file contains no extractable text content');
      }
      
      return text.trim();
    } catch (error) {
      logger.error('DocxExtractor', 'Failed to extract text from DOCX', { error });
      throw new Error(`DOCX extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};
