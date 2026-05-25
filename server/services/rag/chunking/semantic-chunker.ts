/**
 * Semantic Chunking Service
 * Intelligent document chunking based on semantic boundaries
 */

export interface ChunkingConfig {
  targetChunkSize: number;
  minChunkSize: number;
  maxChunkSize: number;
  overlapPercentage: number;
  respectParagraphs: boolean;
  respectSentences: boolean;
}

export interface SemanticChunk {
  content: string;
  startIndex: number;
  endIndex: number;
  metadata: {
    sentenceCount: number;
    paragraphCount: number;
    hasHeading: boolean;
    headingText?: string | undefined;
  };
}

const DEFAULT_CONFIG: ChunkingConfig = {
  targetChunkSize: 512,
  minChunkSize: 100,
  maxChunkSize: 1024,
  overlapPercentage: 0.15,
  respectParagraphs: true,
  respectSentences: true,
};

const SENTENCE_ENDINGS = /[.!?]+[\s\n]+/g;
const PARAGRAPH_BREAKS = /\n\s*\n+/g;
const HEADING_PATTERNS = [
  /^#{1,6}\s+.+$/gm,
  /^[A-Z][A-Z\s]+:?\s*$/gm,
  /^\d+\.\s+[A-Z]/gm,
  /^[IVX]+\.\s+/gm,
];

export class SemanticChunker {
  private config: ChunkingConfig;

  constructor(config: Partial<ChunkingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  chunk(text: string): SemanticChunk[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const normalizedText = this.normalizeText(text);
    const paragraphs = this.splitIntoParagraphs(normalizedText);
    const sections = this.groupIntoSections(paragraphs);
    const chunks = this.createChunksFromSections(sections);
    return this.addOverlap(chunks);
  }

  private normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\t/g, "  ")
      .replace(/\u00A0/g, " ")
      .trim();
  }

  private splitIntoParagraphs(text: string): string[] {
    return text
      .split(PARAGRAPH_BREAKS)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  private splitIntoSentences(text: string): string[] {
    const sentences: string[] = [];
    let lastIndex = 0;

    const matches = text.matchAll(SENTENCE_ENDINGS);
    for (const match of matches) {
      if (match.index !== undefined) {
        const sentence = text.substring(lastIndex, match.index + match[0].length).trim();
        if (sentence.length > 0) {
          sentences.push(sentence);
        }
        lastIndex = match.index + match[0].length;
      }
    }

    const remaining = text.substring(lastIndex).trim();
    if (remaining.length > 0) {
      sentences.push(remaining);
    }

    return sentences;
  }

  private isHeading(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.length > 100) {
      return false;
    }

    for (const pattern of HEADING_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(trimmed)) {
        return true;
      }
    }

    return trimmed.length < 50 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
  }

  private groupIntoSections(paragraphs: string[]): Array<{ heading?: string; content: string[] }> {
    const sections: Array<{ heading?: string; content: string[] }> = [];
    let currentSection: { heading?: string; content: string[] } = { content: [] };

    for (const paragraph of paragraphs) {
      if (this.isHeading(paragraph)) {
        if (currentSection.content.length > 0) {
          sections.push(currentSection);
        }
        currentSection = { heading: paragraph, content: [] };
      } else {
        currentSection.content.push(paragraph);
      }
    }

    if (currentSection.content.length > 0 || currentSection.heading) {
      sections.push(currentSection);
    }

    return sections;
  }

  private createChunksFromSections(
    sections: Array<{ heading?: string; content: string[] }>
  ): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    let currentOffset = 0;

    for (const section of sections) {
      const sectionChunks = this.chunkSection(section, currentOffset);
      chunks.push(...sectionChunks);

      const sectionText = [section.heading, ...section.content].filter(Boolean).join("\n\n");
      currentOffset += sectionText.length + 2;
    }

    return chunks;
  }

  private chunkSection(
    section: { heading?: string; content: string[] },
    startOffset: number
  ): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    const headingPrefix = section.heading ? `${section.heading}\n\n` : "";

    let currentContent = headingPrefix;
    let currentSentences = 0;
    let currentParagraphs = 0;
    let chunkStartIndex = startOffset;

    for (const paragraph of section.content) {
      const sentences = this.splitIntoSentences(paragraph);
      const paragraphText = `${paragraph}\n\n`;

      if (
        currentContent.length + paragraphText.length > this.config.maxChunkSize &&
        currentContent.length >= this.config.minChunkSize
      ) {
        chunks.push(
          this.createChunk(
            currentContent.trim(),
            chunkStartIndex,
            chunkStartIndex + currentContent.length,
            currentSentences,
            currentParagraphs,
            section.heading
          )
        );

        currentContent = headingPrefix;
        currentSentences = 0;
        currentParagraphs = 0;
        chunkStartIndex = startOffset + currentContent.length;
      }

      if (this.config.respectSentences && paragraphText.length > this.config.maxChunkSize) {
        for (const sentence of sentences) {
          if (
            currentContent.length + sentence.length > this.config.maxChunkSize &&
            currentContent.length >= this.config.minChunkSize
          ) {
            chunks.push(
              this.createChunk(
                currentContent.trim(),
                chunkStartIndex,
                chunkStartIndex + currentContent.length,
                currentSentences,
                currentParagraphs,
                section.heading
              )
            );

            currentContent = headingPrefix;
            currentSentences = 0;
            currentParagraphs = 0;
            chunkStartIndex = startOffset + currentContent.length;
          }

          currentContent += `${sentence} `;
          currentSentences++;
        }
        currentParagraphs++;
      } else {
        currentContent += paragraphText;
        currentSentences += sentences.length;
        currentParagraphs++;
      }
    }

    if (currentContent.trim().length >= this.config.minChunkSize) {
      chunks.push(
        this.createChunk(
          currentContent.trim(),
          chunkStartIndex,
          chunkStartIndex + currentContent.length,
          currentSentences,
          currentParagraphs,
          section.heading
        )
      );
    } else if (chunks.length > 0 && currentContent.trim().length > 0) {
      const lastChunk = chunks[chunks.length - 1];
      if (lastChunk) {
        lastChunk.content += `\n\n${currentContent.trim()}`;
        lastChunk.endIndex = chunkStartIndex + currentContent.length;
        lastChunk.metadata.sentenceCount += currentSentences;
        lastChunk.metadata.paragraphCount += currentParagraphs;
      }
    } else if (currentContent.trim().length > 0) {
      chunks.push(
        this.createChunk(
          currentContent.trim(),
          chunkStartIndex,
          chunkStartIndex + currentContent.length,
          currentSentences,
          currentParagraphs,
          section.heading
        )
      );
    }

    return chunks;
  }

  private createChunk(
    content: string,
    startIndex: number,
    endIndex: number,
    sentenceCount: number,
    paragraphCount: number,
    headingText?: string
  ): SemanticChunk {
    return {
      content,
      startIndex,
      endIndex,
      metadata: {
        sentenceCount,
        paragraphCount,
        hasHeading: !!headingText,
        headingText,
      },
    };
  }

  private addOverlap(chunks: SemanticChunk[]): SemanticChunk[] {
    if (chunks.length <= 1 || this.config.overlapPercentage <= 0) {
      return chunks;
    }

    const overlappedChunks: SemanticChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk) continue;
      let content = chunk.content;

      if (i > 0) {
        const prevChunk = chunks[i - 1];
        if (prevChunk) {
          const overlapSize = Math.floor(prevChunk.content.length * this.config.overlapPercentage);
          const overlapText = this.getEndingContext(prevChunk.content, overlapSize);
          if (overlapText) {
            content = `...${overlapText}\n\n${content}`;
          }
        }
      }

      overlappedChunks.push({
        ...chunk,
        content,
      });
    }

    return overlappedChunks;
  }

  private getEndingContext(text: string, targetLength: number): string {
    if (targetLength <= 0) {
      return "";
    }

    const sentences = this.splitIntoSentences(text);
    let context = "";

    for (let i = sentences.length - 1; i >= 0; i--) {
      const potential = sentences[i] + (context ? ` ${context}` : "");
      if (potential.length > targetLength) {
        break;
      }
      context = potential;
    }

    return context;
  }

  getConfig(): ChunkingConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<ChunkingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export const semanticChunker = new SemanticChunker();
