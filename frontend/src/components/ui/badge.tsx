import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type BadgeVariant = "neutral" | "possible" | "not-possible" | "no-data" | "warning";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return <span className={cn("ui-badge", `ui-badge-${variant}`, className)} {...props} />;
}
