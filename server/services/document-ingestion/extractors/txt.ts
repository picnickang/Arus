import type { TextExtractor, SupportedFileType } from '../types';

export const txtExtractor: TextExtractor = {
  supportedTypes: ['txt', 'md'] as SupportedFileType[],
  
  async extract(buffer: Buffer): Promise<string> {
    const text = buffer.toString('utf-8').trim();
    if (!text) {
      throw new Error('TXT/MD file contains no extractable text content');
    }
    return text;
  },
};
