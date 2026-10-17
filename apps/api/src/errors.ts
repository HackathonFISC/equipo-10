import type { ApiFieldError, ApiErrorResponse } from "@equipo10/contracts";

export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly fieldErrors: ApiFieldError[];

  constructor(
    status: number,
    code: string,
    message: string,
    retryable = false,
    fieldErrors: ApiFieldError[] = []
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    this.fieldErrors = fieldErrors;
  }

  toPayload(requestId: string): ApiErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        field_errors: this.fieldErrors,
        retryable: this.retryable,
      },
      request_id: requestId,
    };
  }
}
