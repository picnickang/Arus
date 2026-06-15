// Stub file - embedding service consolidated into RAG
export async function generateEmbedding(_text: string): Promise<number[]> {
  return new Array(384).fill(0);
}

export async function generateEmbeddings(_texts: string[]): Promise<number[][]> {
  return _texts.map(() => new Array(384).fill(0));
}

export function cosineSimilarity(_a: number[], _b: number[]): number {
  return 0;
}
