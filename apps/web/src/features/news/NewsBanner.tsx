import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { NewsItem } from "@/shared/api/types";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent } from "@/shared/ui/Card";

export function NewsBanner({ items }: { items: NewsItem[] }) {
  const [index, setIndex] = useState(0);
  const news = items[index];

  if (!news) {
    return null;
  }

  return (
    <Card className="rounded-3xl border-white/10 bg-white/5">
      <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase text-zinc-500">IT-новости</p>
          <a href={news.url} target="_blank" rel="noreferrer" className="mt-1 flex items-start gap-2 text-base font-medium text-white transition hover:text-violet-200">
            <span className="break-words">{news.title}</span>
            <ExternalLink className="mt-1 h-4 w-4 shrink-0" />
          </a>
          <p className="mt-2 text-sm text-zinc-400">{news.source}{news.publishedAt ? ` · ${new Date(news.publishedAt).toLocaleDateString("ru-RU")}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="soft" aria-label="Предыдущая новость" onClick={() => setIndex((current) => (current === 0 ? items.length - 1 : current - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-10 text-center text-sm text-zinc-400">{index + 1}/{items.length}</span>
          <Button variant="soft" aria-label="Следующая новость" onClick={() => setIndex((current) => (current + 1) % items.length)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
