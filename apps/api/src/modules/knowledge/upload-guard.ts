/**
 * Upload hardening (spec section 7): 10 MB cap, extension/MIME allow-list, magic-byte checks and a
 * content scan of text-like files for embedded scripts. Pure functions; no I/O.
 *
 * Note on storage: uploaded files are not persisted as binaries in this app. Their extracted text is
 * stored in Postgres (`knowledge_sources.config.rawText`), so there is no local-disk / blob backend to
 * switch between environments.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export class UploadRejectedError extends Error {
  constructor(
    readonly code:
      | 'EMPTY_FILE'
      | 'FILE_TOO_LARGE'
      | 'UNSUPPORTED_FILE_TYPE'
      | 'MIME_MISMATCH'
      | 'CONTENT_MISMATCH'
      | 'MALICIOUS_CONTENT',
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = 'UploadRejectedError';
  }
}

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.csv', '.json']);

/** Allowed extensions and the MIME types browsers/clients legitimately send for them. */
const ALLOWED: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.txt': ['text/plain'],
  '.md': ['text/markdown', 'text/plain', 'text/x-markdown'],
  '.csv': ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'],
  '.json': ['application/json', 'text/json', 'text/plain'],
};

/** Patterns that should never appear in a knowledge document. */
const MALICIOUS_TEXT_PATTERNS: Array<[RegExp, string]> = [
  [/<\s*script\b/i, '<script> tag'],
  [/<\?(php|=)/i, 'PHP tag'],
  [/<\s*(iframe|object|embed)\b/i, 'embedded frame/object'],
  [/javascript\s*:/i, 'javascript: URL'],
  [
    /\bon(error|load|click|dblclick|mouse\w*|focus|blur|submit|change|input|key\w*|toggle|animation\w*|pointer\w*|touch\w*)\s*=/i,
    'inline event handler',
  ],
];

const EXECUTABLE_MAGIC: Array<[number[], string]> = [
  [[0x4d, 0x5a], 'Windows executable'], // MZ
  [[0x7f, 0x45, 0x4c, 0x46], 'ELF executable'],
  [[0x23, 0x21], 'script with shebang'], // #!
  [[0xca, 0xfe, 0xba, 0xbe], 'Java/Mach-O binary'],
];

const startsWith = (buf: Buffer, sig: number[]) => sig.every((b, i) => buf[i] === b);

function extensionOf(fileName: string): string {
  const m = /\.[a-z0-9]+$/i.exec(fileName.trim());
  return m ? m[0].toLowerCase() : '';
}

export function validateUpload(input: { fileName: string; mimeType?: string; buffer: Buffer }): void {
  const { fileName, mimeType, buffer } = input;

  if (buffer.length === 0) {
    throw new UploadRejectedError('EMPTY_FILE', 'The uploaded file is empty.', 400);
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new UploadRejectedError(
      'FILE_TOO_LARGE',
      `File is too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB).`,
      413,
    );
  }

  const ext = extensionOf(fileName);
  const allowedMimes = ALLOWED[ext];
  if (!allowedMimes) {
    throw new UploadRejectedError(
      'UNSUPPORTED_FILE_TYPE',
      `Unsupported file type "${ext || 'unknown'}". Allowed: ${Object.keys(ALLOWED).join(', ')}.`,
      415,
    );
  }

  // The declared MIME type, when provided, must be one that is valid for the extension
  const mime = (mimeType || '').split(';')[0]!.trim().toLowerCase();
  if (mime && mime !== 'application/octet-stream' && !allowedMimes.includes(mime)) {
    throw new UploadRejectedError(
      'MIME_MISMATCH',
      `File type "${mime}" does not match the "${ext}" extension.`,
      415,
    );
  }

  // Executables are rejected no matter what they are named
  for (const [sig, label] of EXECUTABLE_MAGIC) {
    if (startsWith(buffer, sig)) {
      throw new UploadRejectedError('MALICIOUS_CONTENT', `Rejected: file content is a ${label}.`, 422);
    }
  }

  if (ext === '.pdf') {
    if (!startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
      throw new UploadRejectedError('CONTENT_MISMATCH', 'File content is not a valid PDF.', 415);
    }
    // Active content inside a PDF: embedded JavaScript or launch actions
    const head = buffer.toString('latin1');
    if (/\/(JavaScript|JS|Launch)\b/.test(head)) {
      throw new UploadRejectedError('MALICIOUS_CONTENT', 'Rejected: PDF contains active content (JavaScript/Launch).', 422);
    }
    return;
  }

  if (ext === '.docx') {
    if (!startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) {
      throw new UploadRejectedError('CONTENT_MISMATCH', 'File content is not a valid DOCX.', 415);
    }
    // Zip entry names are stored uncompressed: a macro project is visible without unzipping
    if (buffer.includes('vbaProject.bin')) {
      throw new UploadRejectedError('MALICIOUS_CONTENT', 'Rejected: document contains macros.', 422);
    }
    return;
  }

  if (TEXT_EXTENSIONS.has(ext)) {
    if (buffer.includes(0x00)) {
      throw new UploadRejectedError('CONTENT_MISMATCH', 'File is not plain text.', 415);
    }
    const text = buffer.toString('utf-8');
    for (const [pattern, label] of MALICIOUS_TEXT_PATTERNS) {
      if (pattern.test(text)) {
        throw new UploadRejectedError('MALICIOUS_CONTENT', `Rejected: file contains a ${label}.`, 422);
      }
    }
  }
}
