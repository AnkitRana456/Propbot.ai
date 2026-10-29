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

async function request(endpoint: string, options: RequestInit): Promise<unknown> {
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
    if (response.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('propbot_access_token');
      localStorage.removeItem('propbot_user');
      localStorage.removeItem('propbot_company');
      window.dispatchEvent(new CustomEvent('propbot:unauthorized'));
    }
    const errorDetails = data?.error;
    throw new ApiError(
      errorDetails?.code || 'API_ERROR',
      errorDetails?.message || `Request failed with status ${response.status}`,
      response.status,
    );
  }

  return data;
}

/** Returns the payload: `{ success, data }` responses are unwrapped to `data`. */
export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const body = (await request(endpoint, options)) as { data?: unknown } | null;
  return (body?.data ?? body) as T;
}

/** Endpoint and headers for a JSON POST sent with XMLHttpRequest (UploadCard), since fetch can't report upload progress. */
export function xhrJsonTarget(endpoint: string): { endpoint: string; headers: Record<string, string> } {
  const token = typeof window !== 'undefined' ? localStorage.getItem('propbot_access_token') : null;
  return { endpoint: `${API_BASE_URL}${endpoint}`, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } };
}

/** Returns the whole response body. Use it for list endpoints that send `{ success, data, pagination }`. */
export async function apiRequestEnvelope<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  return (await request(endpoint, options)) as T;
}
