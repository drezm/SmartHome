import type { NextFunction, Request, Response } from "express";
import type { User } from "../domain/types.js";
import type { AuthService } from "../services/authService.js";

export type AuthenticatedRequest = Request & {
  user: User;
};

export function authMiddleware(auth: AuthService) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const header = request.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

    if (!token) {
      response.status(401).json({ message: "Требуется авторизация" });
      return;
    }

    try {
      (request as AuthenticatedRequest).user = await auth.verify(token);
      next();
    } catch {
      response.status(401).json({ message: "Сессия истекла или недействительна" });
    }
  };
}
