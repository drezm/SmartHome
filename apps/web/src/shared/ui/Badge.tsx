import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

export function Badge({ className, children }: HTMLAttributes<HTMLSpanElement> & { children: ReactNode }) {
  return <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-medium", className)}>{children}</span>;
}
