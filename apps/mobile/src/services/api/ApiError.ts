export type ApiErrorKind =
  | 'AUTH_INVALID_TOKEN'
  | 'AUTH_INVALID_GOOGLE_TOKEN'
  | 'AUTH_NOT_ALLOWLISTED'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'PROVIDER_UNAVAILABLE'
  | 'NETWORK_OFFLINE'
  | 'UNKNOWN';

export class ApiError extends Error {
  readonly name = 'ApiError';
  readonly status: number | null;
  readonly kind: ApiErrorKind;
  readonly cause: unknown;
  constructor(input: {
    message: string;
    status: number | null;
    kind: ApiErrorKind;
    cause?: unknown;
  }) {
    super(input.message);
    this.status = input.status;
    this.kind = input.kind;
    this.cause = input.cause;
  }
}
