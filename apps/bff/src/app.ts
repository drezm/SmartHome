import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import type { Database } from "better-sqlite3";
import { env } from "./config/env.js";
import { getDatabase } from "./db/database.js";
import { getPostgresPool, migratePostgres } from "./db/postgres.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRoutes } from "./routes/authRoutes.js";
import { homeRoutes } from "./routes/homeRoutes.js";
import { HomeRepository } from "./repositories/homeRepository.js";
import { PostgresHomeRepository } from "./repositories/postgresHomeRepository.js";
import { PostgresUserRepository } from "./repositories/postgresUserRepository.js";
import { UserRepository } from "./repositories/userRepository.js";
import { AuthService } from "./services/authService.js";
import { HomeService } from "./services/homeService.js";

type AppDependencies = {
  auth: AuthService;
  home: HomeService;
};

export function createApp(db: Database = getDatabase()) {
  return createAppWithServices({
    auth: new AuthService(new UserRepository(db)),
    home: new HomeService(new HomeRepository(db))
  });
}

export async function createRuntimeApp() {
  if (!env.DATABASE_URL) {
    return createApp();
  }

  const pool = getPostgresPool();
  await migratePostgres(pool);

  return createAppWithServices({
    auth: new AuthService(new PostgresUserRepository(pool)),
    home: new HomeService(new PostgresHomeRepository(pool))
  });
}

function createAppWithServices({ auth, home }: AppDependencies) {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(env.NODE_ENV === "test" ? "tiny" : "dev"));

  app.get("/api/health", async (_request, response) => {
    const dashboard = await home.getDashboard("health-check");

    response.json({
      status: "ok",
      service: "smart-flow-bff",
      storage: env.DATABASE_URL ? "postgres" : "sqlite",
      collector: dashboard.backendStatus
    });
  });

  app.use("/api/auth", authRoutes(auth));
  app.use("/api", homeRoutes(auth, home));
  app.use(errorHandler);

  return app;
}
