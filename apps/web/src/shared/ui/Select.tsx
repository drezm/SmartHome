import type { SelectHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white outline-none focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/20",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
