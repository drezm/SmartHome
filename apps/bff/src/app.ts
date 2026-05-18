import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import type { Database } from "better-sqlite3";
import { env } from "./config/env.js";
import { getDatabase } from "./db/database.js";
import { getPostgresPool, verifySupabaseSchema } from "./db/postgres.js";
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
  storage: "sqlite" | "supabase";
};

export function createApp(db: Database = getDatabase()) {
  const users = new UserRepository(db);
  return createAppWithServices({
    auth: new AuthService(users),
    home: new HomeService(new HomeRepository(db), users),
    storage: "sqlite"
  });
}

export async function createRuntimeApp() {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Configure it with your Supabase Postgres connection string before starting the BFF.");
  }

  const pool = getPostgresPool();
  await verifySupabaseSchema(pool);
  const users = new PostgresUserRepository(pool);

  return createAppWithServices({
    auth: new AuthService(users),
    home: new HomeService(new PostgresHomeRepository(pool), users),
    storage: "supabase"
  });
}

function createAppWithServices({ auth, home, storage }: AppDependencies) {
  const app = express();
  app.locals.homeService = home;

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
    response.json({
      status: "ok",
      service: "smart-flow-bff",
      storage,
      weather: {
        provider: "open-meteo",
        apiUrl: env.WEATHER_API_URL
      }
    });
  });

  app.use("/api/auth", authRoutes(auth));
  app.use("/api", homeRoutes(auth, home));
  app.use(errorHandler);

  return app;
}
