export interface RawChunk {
  content: string;
  metadata: {
    sectionHeader?: string;
    pageNumber?: number;
    tokenCount: number;
    sourceTitle?: string;
    [key: string]: unknown;
  };
}

export class ChunkingService {
  /**
   * Approximate token count by splitting whitespace and punctuation
   * 1 token ≈ 4 characters or 0.75 words in English
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.33);
  }

  /**
   * Cleans raw text by normalizing whitespace, standardizing line breaks,
   * and removing unprintable or control characters.
   */
  cleanText(raw: string): string {
    return raw
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // remove ASCII control chars
      .replace(/[ \t]+/g, ' ') // collapse horizontal spaces
      .replace(/\n{3,}/g, '\n\n') // collapse multiple blank lines
      .trim();
  }

  /**
   * Chunks document content into approximately 500-token sections with 50-token overlap,
   * respecting sentence boundaries and markdown headers.
   */
  chunkText(
    text: string,
    options: {
      targetTokens?: number;
      overlapTokens?: number;
      sourceTitle?: string;
    } = {},
  ): RawChunk[] {
    const targetTokens = options.targetTokens ?? 500;
    const overlapTokens = options.overlapTokens ?? 50;
    const cleaned = this.cleanText(text);

    if (!cleaned) {
      return [];
    }

    // Split text into paragraphs first
    const paragraphs = cleaned.split(/\n\n+/).filter(p => p.trim().length > 0);
    const chunks: RawChunk[] = [];

    let currentSectionHeader = options.sourceTitle || 'General';
    let currentChunkTokens = 0;
    let currentChunkSentences: string[] = [];

    for (const paragraph of paragraphs) {
      // Check if paragraph is a markdown header
      const headerMatch = paragraph.match(/^(#{1,6})\s+(.+)$/m);
      if (headerMatch && headerMatch[2]) {
        currentSectionHeader = headerMatch[2].trim();
      }

      // Split paragraph into sentences
      const sentences = paragraph
        .split(/(?<=[.?!])\s+(?=[A-Z0-9])/)
        .map(s => s.trim())
        .filter(Boolean);

      for (const sentence of sentences) {
        const sentenceTokens = this.estimateTokens(sentence);

        if (currentChunkTokens + sentenceTokens > targetTokens && currentChunkSentences.length > 0) {
          // Commit current chunk
          const chunkContent = currentChunkSentences.join(' ');
          chunks.push({
            content: chunkContent,
            metadata: {
              sectionHeader: currentSectionHeader,
              sourceTitle: options.sourceTitle,
              tokenCount: this.estimateTokens(chunkContent),
            },
          });

          // Compute overlap sentences
          const overlapSentences: string[] = [];
          let overlapCount = 0;
          for (let i = currentChunkSentences.length - 1; i >= 0; i--) {
            const s = currentChunkSentences[i]!;
            const t = this.estimateTokens(s);
            if (overlapCount + t <= overlapTokens) {
              overlapSentences.unshift(s);
              overlapCount += t;
            } else {
              break;
            }
          }

          currentChunkSentences = [...overlapSentences, sentence];
          currentChunkTokens = overlapCount + sentenceTokens;
        } else {
          currentChunkSentences.push(sentence);
          currentChunkTokens += sentenceTokens;
        }
      }
    }

    // Commit final remaining chunk
    if (currentChunkSentences.length > 0) {
      const finalContent = currentChunkSentences.join(' ');
      chunks.push({
        content: finalContent,
        metadata: {
          sectionHeader: currentSectionHeader,
          sourceTitle: options.sourceTitle,
          tokenCount: this.estimateTokens(finalContent),
        },
      });
    }

    return chunks;
  }
}

export const chunkingService = new ChunkingService();
