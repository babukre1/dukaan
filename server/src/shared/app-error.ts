export class AppError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly details?: unknown) {
    super(message)
  }
}

export const notFound = (message = 'Resource not found') => new AppError(404, 'RESOURCE_NOT_FOUND', message)
export const forbidden = (message = 'You do not have permission to perform this action') => new AppError(403, 'FORBIDDEN', message)
export const unauthorized = (message = 'Authentication is required') => new AppError(401, 'UNAUTHORIZED', message)
