const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('propbot_access_token') : null;

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorDetails = data?.error;
    throw new ApiError(
      errorDetails?.code || 'API_ERROR',
      errorDetails?.message || `Request failed with status ${response.status}`,
      response.status,
    );
  }

  return (data?.data ?? data) as T;
}
