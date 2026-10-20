/** Error carrying an HTTP status and a stable machine-readable code; the central error handler renders it. */
export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const notFound = (what: string) => new ApiError(404, 'NOT_FOUND', `${what} not found.`);
export const conflict = (code: string, message: string) => new ApiError(409, code, message);
export const badRequest = (code: string, message: string, details?: unknown) =>
  new ApiError(400, code, message, details);
