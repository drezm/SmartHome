import { ZodError } from "zod";
import type { NextFunction, Request, Response } from "express";

export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    response.status(400).json({
      message: "Некорректные данные",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
    return;
  }

  if (error instanceof Error) {
    const status = error.message.includes("не найден") ? 404 : 400;
    response.status(status).json({ message: error.message });
    return;
  }

  response.status(500).json({ message: "Внутренняя ошибка сервера" });
}
