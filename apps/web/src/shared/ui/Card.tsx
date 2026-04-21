import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn("border border-white/10 bg-[#111216] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.03)]", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return <div className={cn("space-y-1.5 p-5 pb-3", className)}>{children}</div>;
}

export function CardTitle({ className, children }: HTMLAttributes<HTMLHeadingElement> & { children: ReactNode }) {
  return <h3 className={cn("text-lg font-semibold text-white", className)}>{children}</h3>;
}

export function CardDescription({ className, children }: HTMLAttributes<HTMLParagraphElement> & { children: ReactNode }) {
  return <p className={cn("text-sm text-zinc-400", className)}>{children}</p>;
}

export function CardContent({ className, children }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}
