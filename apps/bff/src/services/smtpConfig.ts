export type SmtpProvider = "custom" | "gmail" | "yandex" | "mailru" | "icloud";

export type SmtpConfigInput = {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  password?: string;
  from?: string;
};

export type ResolvedSmtpConfig = {
  provider: SmtpProvider;
  from: string;
  transport: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
};

type ProviderPreset = {
  provider: Exclude<SmtpProvider, "custom">;
  host: string;
  port: number;
  secure: boolean;
};

const presets: Record<Exclude<SmtpProvider, "custom">, ProviderPreset> = {
  gmail: { provider: "gmail", host: "smtp.gmail.com", port: 587, secure: false },
  yandex: { provider: "yandex", host: "smtp.yandex.com", port: 465, secure: true },
  mailru: { provider: "mailru", host: "smtp.mail.ru", port: 465, secure: true },
  icloud: { provider: "icloud", host: "smtp.mail.me.com", port: 587, secure: false }
};

const providerDomains: Record<string, Exclude<SmtpProvider, "custom">> = {
  "gmail.com": "gmail",
  "googlemail.com": "gmail",
  "yandex.ru": "yandex",
  "yandex.com": "yandex",
  "ya.ru": "yandex",
  "yandex.by": "yandex",
  "yandex.kz": "yandex",
  "yandex.uz": "yandex",
  "yandex.com.tr": "yandex",
  "mail.ru": "mailru",
  "bk.ru": "mailru",
  "inbox.ru": "mailru",
  "list.ru": "mailru",
  "internet.ru": "mailru",
  "icloud.com": "icloud",
  "me.com": "icloud",
  "mac.com": "icloud"
};

export function resolveSmtpConfig(input: SmtpConfigInput): ResolvedSmtpConfig {
  const user = input.user?.trim();
  const password = input.password?.trim();

  if (!user || !password) {
    throw new Error("SMTP не настроен. Заполните SMTP_USER и SMTP_PASSWORD. Для неподдерживаемых доменов также укажите SMTP_HOST и SMTP_PORT");
  }

  const from = input.from?.trim() || `SmartHome <${user}>`;
  const customHost = input.host?.trim();

  if (customHost) {
    const port = input.port ?? 587;
    return {
      provider: "custom",
      from,
      transport: {
        host: customHost,
        port,
        secure: input.secure ?? port === 465,
        auth: { user, pass: password }
      }
    };
  }

  const domain = user.split("@").at(-1)?.toLowerCase();
  const provider = domain ? providerDomains[domain] : undefined;
  if (!provider) {
    throw new Error("Не удалось определить SMTP по email. Укажите SMTP_HOST/SMTP_PORT вручную");
  }

  const preset = presets[provider];
  return {
    provider: preset.provider,
    from,
    transport: {
      host: preset.host,
      port: preset.port,
      secure: preset.secure,
      auth: { user, pass: password }
    }
  };
}
