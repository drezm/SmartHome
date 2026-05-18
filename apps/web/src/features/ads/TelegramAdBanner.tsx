import { ExternalLink } from "lucide-react";

const TELEGRAM_CHANNEL_URL = "https://t.me/smarthome_t";

export function TelegramAdBanner({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href={TELEGRAM_CHANNEL_URL}
      target="_blank"
      rel="noreferrer"
      className={`block overflow-hidden rounded-2xl border border-sky-400/20 bg-sky-500/10 transition hover:border-sky-300/40 hover:bg-sky-500/15 ${compact ? "p-3" : "p-4"}`}
    >
      <img src="/ads/telegram-channel.webp" alt="Telegram-канал SmartHome" loading="lazy" className="w-full rounded-xl object-cover" />
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-sky-200">Реклама</p>
          <p className="mt-1 text-sm font-medium text-white">Telegram-канал SmartHome</p>
          <p className="mt-1 text-xs text-zinc-400">Рекламодатель «SmartHome»</p>
        </div>
        <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-sky-200" />
      </div>
    </a>
  );
}
