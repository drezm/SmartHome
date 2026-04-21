import type { ReactNode } from "react";
import { cn } from "../lib/cn";

type TabItem<T extends string> = {
  value: T;
  label: string;
};

export function Tabs<T extends string>({
  value,
  items,
  children,
  onChange
}: {
  value: T;
  items: Array<TabItem<T>>;
  children: ReactNode;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <div className="mb-6 flex h-auto gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-1 sm:grid sm:grid-cols-3">
        {items.map((item) => (
          <button
            key={item.value}
            onClick={() => onChange(item.value)}
            className={cn("min-h-10 shrink-0 rounded-xl px-3 py-2 text-sm text-zinc-300 transition sm:shrink", value === item.value && "bg-violet-600 text-white")}
          >
            {item.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
