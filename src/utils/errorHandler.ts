import { NextFunction, Request, Response } from "express";

export class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  next(new ApiError(404, `Not Found - ${req.originalUrl}`));
};

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const status = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ success: false, message, status });
};
