import type { QaPair } from '@propbot/shared';

export class ParserService {
  /**
   * Formats Q&A pairs into conversational real-estate knowledge entries
   */
  formatQaPairs(pairs: QaPair[]): string {
    return pairs
      .map(
        (p, idx) =>
          `### Frequently Asked Question ${idx + 1}\nQuestion: ${p.question.trim()}\nAnswer: ${p.answer.trim()}`,
      )
      .join('\n\n');
  }

  /**
   * Extracts readable text from CSV content
   */
  parseCsv(content: string): string {
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return '';

    const headers = lines[0]!.split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const rows = lines.slice(1);

    const formattedRows = rows.map((line, idx) => {
      const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      const details = headers
        .map((h, i) => `${h}: ${values[i] || 'N/A'}`)
        .join(' | ');
      return `Item ${idx + 1}: ${details}`;
    });

    return formattedRows.join('\n');
  }

  /**
   * Strips HTML markup, scripts, and navigation to extract main text from web content
   */
  parseHtml(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // remove scripts
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // remove styles
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '') // remove nav
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '') // remove footer
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '') // remove header
      .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n### $1\n\n') // convert headers
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '\n- $1') // convert lists
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n\n$1\n\n') // convert paragraphs
      .replace(/<br\s*\/?>/gi, '\n') // convert line breaks
      .replace(/<[^>]+>/g, ' ') // strip remaining tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Extracts text from PDF files using pdf-parse
   */
  async parsePdf(buffer: Buffer): Promise<string> {
    try {
      const pdfModule = await import('pdf-parse');
      const moduleRecord = pdfModule as Record<string, unknown>;
      if ('PDFParse' in moduleRecord && typeof moduleRecord.PDFParse === 'function') {
        const PDFParseClass = moduleRecord.PDFParse as new (data: Uint8Array) => { getText: () => Promise<{ text: string }> };
        const parser = new PDFParseClass(new Uint8Array(buffer));
        const result = await parser.getText();
        return result?.text || '';
      }
      if (typeof moduleRecord.default === 'function') {
        const defaultFn = moduleRecord.default as (buf: Buffer) => Promise<{ text: string }>;
        const result = await defaultFn(buffer);
        return result?.text || '';
      }
      return buffer.toString('utf-8');
    } catch {
      return buffer.toString('utf-8');
    }
  }

  /**
   * Extracts text from DOCX files using mammoth
   */
  async parseDocx(buffer: Buffer): Promise<string> {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  /**
   * Extracts text from uploaded files (PDF, DOCX, TXT, CSV, JSON, Markdown, or readable binary/PDF streams)
   */
  async parseFileBuffer(buffer: Buffer, mimeType?: string, fileName?: string): Promise<string> {
    const nameLower = (fileName || '').toLowerCase();
    const mimeLower = (mimeType || '').toLowerCase();

    if (nameLower.endsWith('.pdf') || mimeLower === 'application/pdf') {
      return this.parsePdf(buffer);
    }

    if (
      nameLower.endsWith('.docx') ||
      mimeLower === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      return this.parseDocx(buffer);
    }

    if (nameLower.endsWith('.csv') || mimeLower === 'text/csv') {
      return this.parseCsv(buffer.toString('utf-8'));
    }

    if (nameLower.endsWith('.json') || mimeLower === 'application/json') {
      try {
        const parsed = JSON.parse(buffer.toString('utf-8'));
        return JSON.stringify(parsed, null, 2);
      } catch {
        return buffer.toString('utf-8');
      }
    }

    if (nameLower.endsWith('.html') || nameLower.endsWith('.htm')) {
      return this.parseHtml(buffer.toString('utf-8'));
    }

    // Default text decoding with basic binary/PDF string extraction fallback
    const rawString = buffer.toString('utf-8');
    // Extract printable strings of length >= 4 if file contains binary markers
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x08\x0E-\x1F]/.test(rawString)) {
      const matches = rawString.match(/[\x20-\x7E\s]{4,}/g);
      return matches ? matches.join('\n').trim() : '';
    }

    return rawString.trim();
  }
}

export const parserService = new ParserService();
