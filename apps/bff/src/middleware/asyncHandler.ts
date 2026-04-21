import type { NextFunction, Request, Response } from "express";

export function asyncHandler<TRequest extends Request = Request>(
  handler: (request: TRequest, response: Response, next: NextFunction) => Promise<unknown>
) {
  return (request: Request, response: Response, next: NextFunction) => {
    Promise.resolve(handler(request as TRequest, response, next)).catch(next);
  };
}
