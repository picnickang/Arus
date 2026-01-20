import type { TextExtractor, SupportedFileType } from '../types';
import * as XLSX from 'xlsx';
import { logger } from '../../../utils/logger';

export const xlsxExtractor: TextExtractor = {
  supportedTypes: ['xlsx'] as SupportedFileType[],
  
  async extract(buffer: Buffer): Promise<string> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const textParts: string[] = [];
      
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const sheetData = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
        
        if (sheetData.trim()) {
          textParts.push(`## Sheet: ${sheetName}\n\n${sheetData}`);
        }
      }
      
      const text = textParts.join('\n\n---\n\n');
      
      if (!text.trim()) {
        throw new Error('XLSX file contains no extractable text content');
      }
      
      return text.trim();
    } catch (error) {
      logger.error('XlsxExtractor', 'Failed to extract text from XLSX', { error });
      throw new Error(`XLSX extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};
