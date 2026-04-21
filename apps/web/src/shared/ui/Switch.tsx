import { cn } from "../lib/cn";

type SwitchProps = {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export function Switch({ checked, disabled, onCheckedChange }: SwitchProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={checked}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition disabled:opacity-50",
        checked ? "border-violet-400/40 bg-violet-600" : "border-white/10 bg-white/10"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
          checked ? "left-[1.25rem]" : "left-0.5"
        )}
      />
    </button>
  );
}
