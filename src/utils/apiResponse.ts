import type { Response } from 'express';

interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

interface ErrorResponse {
  success: false;
  message: string;
  errors?: Array<{ path: string; message: string }>;
}

type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

export function sendSuccess<T>(
  res: Response,
  data: T,
  options?: {
    message?: string;
    statusCode?: number;
    meta?: SuccessResponse<T>['meta'];
  }
): Response<ApiResponse<T>> {
  const { message, statusCode = 200, meta } = options ?? {};

  const response: SuccessResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
    ...(meta && { meta }),
  };

  return res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  message: string,
  options?: {
    statusCode?: number;
    errors?: ErrorResponse['errors'];
  }
): Response<ApiResponse<never>> {
  const { statusCode = 400, errors } = options ?? {};

  const response: ErrorResponse = {
    success: false,
    message,
    ...(errors && { errors }),
  };

  return res.status(statusCode).json(response);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  }
): Response<ApiResponse<T[]>> {
  const { page, limit, total } = pagination;
  const totalPages = Math.ceil(total / limit);

  return sendSuccess(res, data, {
    meta: { page, limit, total, totalPages },
  });
}
