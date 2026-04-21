import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

type ButtonVariant = "primary" | "soft" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

const variants: Record<ButtonVariant, string> = {
  primary: "border-violet-400/20 bg-violet-600 text-white hover:bg-violet-500",
  soft: "border-white/10 bg-white/5 text-white hover:bg-white/10",
  ghost: "border-transparent bg-transparent text-zinc-300 hover:bg-white/5 hover:text-white",
  danger: "border-red-400/20 bg-red-500/15 text-red-200 hover:bg-red-500/25"
};

export function Button({ className, variant = "primary", children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
