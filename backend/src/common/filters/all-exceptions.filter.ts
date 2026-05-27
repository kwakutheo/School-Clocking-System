import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errorType = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res: any = exception.getResponse();
      
      // Handle NestJS built-in validation errors which return { message: string[], error: string, statusCode: number }
      if (typeof res === 'object' && res !== null) {
        message = res.message || res.error || exception.message;
        errorType = res.error || exception.name;
      } else {
        message = res || exception.message;
        errorType = exception.name;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      errorType = exception.name;
    }

    // Log the error for backend debugging
    if (status >= 500) {
      this.logger.error(`[${request.method} ${request.url}] ${errorType}: ${message}`, (exception as any)?.stack);
    } else {
      this.logger.warn(`[${request.method} ${request.url}] ${status} ${errorType}: ${Array.isArray(message) ? message[0] : message}`);
    }

    // Standardized response body
    response.status(status).json({
      statusCode: status,
      error: errorType,
      message: Array.isArray(message) ? message[0] : message, // Always return a single string message to make frontend parsing easier
      details: Array.isArray(message) ? message : undefined,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
