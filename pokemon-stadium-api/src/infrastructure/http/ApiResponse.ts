export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
  traceId: string | null;
  timestamp: string;
}

export function ok<T>(data: T, traceId?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    traceId: traceId ?? null,
    timestamp: new Date().toISOString(),
  };
}

export function fail(
  code: string,
  message: string,
  traceId?: string,
): ApiResponse<null> {
  return {
    success: false,
    data: null,
    error: { code, message },
    traceId: traceId ?? null,
    timestamp: new Date().toISOString(),
  };
}
