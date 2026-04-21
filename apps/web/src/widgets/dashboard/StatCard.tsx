import type { ElementType } from "react";
import { Card, CardContent } from "@/shared/ui/Card";

export function StatCard({ title, value, subtitle, icon: Icon }: { title: string; value: string; subtitle: string; icon: ElementType }) {
  return (
    <Card className="rounded-3xl">
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-400">{title}</p>
            <h3 className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</h3>
            <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
          </div>
          <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-3">
            <Icon className="h-5 w-5 text-violet-300" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
