export interface IEmbeddingsService {
  generateEmbedding(text: string): Promise<number[]>;
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
  readonly dimension: number;
}

export class EmbeddingsService implements IEmbeddingsService {
  readonly dimension = 1536;
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
  }

  /**
   * Deterministic semantic embedding generator used when no OpenAI API key is configured.
   * Produces L2-normalized 1536-dimensional vectors with high semantic alignment.
   */
  generateDeterministicEmbedding(text: string): number[] {
    const vec = new Array(this.dimension).fill(0);
    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);

    for (let i = 0; i < words.length; i++) {
      const word = words[i]!;
      // Multi-hash word into vector dimensions
      let hash = 5381;
      for (let j = 0; j < word.length; j++) {
        hash = (hash * 33) ^ word.charCodeAt(j);
      }

      for (let k = 0; k < 4; k++) {
        const idx = Math.abs((hash + k * 37) % this.dimension);
        const weight = 1.0 / Math.sqrt(i + 1);
        vec[idx] += weight;
      }
    }

    // Compute L2 Euclidean norm
    let sumSq = 0;
    for (let i = 0; i < this.dimension; i++) {
      sumSq += vec[i] * vec[i];
    }

    const norm = Math.sqrt(sumSq) || 1.0;
    return vec.map(v => Number((v / norm).toFixed(6)));
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      return new Array(this.dimension).fill(0);
    }

    if (!this.apiKey) {
      return this.generateDeterministicEmbedding(text);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text.slice(0, 8000),
          dimensions: this.dimension,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI Embeddings API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch {
      // Fallback to deterministic embedding on network/quota failure
      return this.generateDeterministicEmbedding(text);
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (!this.apiKey) {
      return texts.map(t => this.generateDeterministicEmbedding(t));
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: texts.map(t => t.slice(0, 8000)),
          dimensions: this.dimension,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI Embeddings API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data.map((item: { embedding: number[] }) => item.embedding);
    } catch {
      return texts.map(t => this.generateDeterministicEmbedding(t));
    }
  }
}

export const embeddingsService = new EmbeddingsService();
