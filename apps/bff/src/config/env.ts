import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  BFF_PORT: z.coerce.number().default(3000),
  JWT_SECRET: z.string().min(12).default("dev-smart-flow-secret"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  HUB_ID: z.string().default("home-1"),
  DB_PATH: z.string().default("./data/smart-home.sqlite"),
  DATABASE_URL: z.string().optional(),
  DATABASE_SSL: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  COLLECTOR_GRPC_URL: z.string().default("disabled"),
  CORS_ORIGIN: z.string().default("http://localhost:5173")
});

export const env = envSchema.parse(process.env);
