import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth.js";
import type { AuthService } from "../services/authService.js";

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(128)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128)
});

export function authRoutes(auth: AuthService) {
  const router = Router();

  router.post(
    "/register",
    asyncHandler(async (request, response) => {
      const input = registerSchema.parse(request.body);
      const session = await auth.register(input);
      response.status(201).json(session);
    })
  );

  router.post(
    "/login",
    asyncHandler(async (request, response) => {
      const input = loginSchema.parse(request.body);
      response.json(await auth.login(input));
    })
  );

  router.get(
    "/me",
    authMiddleware(auth),
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      response.json({ user: request.user });
    })
  );

  return router;
}
