import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const bffDir = path.resolve(configDir, "../..");
const repoRoot = path.resolve(bffDir, "../..");

dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(repoRoot, ".env.local"), override: true });
dotenv.config({ path: path.join(bffDir, ".env") });
dotenv.config({ path: path.join(bffDir, ".env.local"), override: true });

const optionalEnvString = z.preprocess((value) => (value === "" ? undefined : value), z.string().optional());
const optionalEnvBoolean = z
  .preprocess((value) => (value === "" ? undefined : value), z.enum(["true", "false"]).optional())
  .transform((value) => (value ? value === "true" : undefined));

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  BFF_PORT: z.coerce.number().default(3000),
  JWT_SECRET: z.string().min(12).default("dev-smart-flow-secret"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  HUB_ID: z.string().default("home-1"),
  DB_PATH: z.string().default("./data/smart-home.sqlite"),
  DATABASE_URL: optionalEnvString,
  DATABASE_SSL: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  SECRETS_ENCRYPTION_KEY: z.string().default("dev-smart-flow-encryption-key"),
  SMTP_HOST: optionalEnvString,
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: optionalEnvBoolean,
  SMTP_USER: optionalEnvString,
  SMTP_PASSWORD: optionalEnvString,
  SMTP_FROM: optionalEnvString,
  EMAIL_PROVIDER: z.enum(["resend", "smtp", "dev"]).default("resend"),
  RESEND_API_KEY: optionalEnvString,
  EMAIL_FROM: optionalEnvString,
  APP_PUBLIC_URL: z.string().default("http://localhost:5173"),
  NEWS_RSS_FEEDS: z
    .string()
    .default("https://www.tadviser.ru/index.php/RSS,https://habr.com/ru/rss/articles/?fl=ru"),
  COLLECTOR_GRPC_URL: z.string().default("disabled"),
  CORS_ORIGIN: z.string().default("http://localhost:5173")
});

export const env = envSchema.parse(process.env);
