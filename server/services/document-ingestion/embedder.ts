import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Services:DocumentIngestion:Embedder");
import { generateEmbedding } from "../../embedding-service";

export interface EmbedOptions {
  openAiKey?: string;
  orgId?: string;
}

export interface ChunkWithEmbedding {
  text: string;
  embedding: number[];
  ord: number;
}

export async function embedChunks(
  chunks: string[],
  options: EmbedOptions = {}
): Promise<ChunkWithEmbedding[]> {
  const { openAiKey, orgId } = options;
  const results: ChunkWithEmbedding[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i] ?? '';
    logger.info(`[DocIngestion:Embed] Processing chunk ${i + 1}/${chunks.length}`);

    const embedFn = generateEmbedding as object as (text: string, opts?: { useOpenAIFallback?: boolean; openAiKey?: string; orgId?: string }) => Promise<number[]>;
    const embedding = await embedFn(chunk, {
      useOpenAIFallback: !!openAiKey,
      openAiKey,
      orgId,
    });

    results.push({
      text: chunk,
      embedding,
      ord: i,
    });
  }

  return results;
}
