import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type SheetProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Sheet({ className, children, ...props }: SheetProps) {
  return (
    <div className={cn("ui-sheet-backdrop", className)} role="dialog" aria-modal="true" {...props}>
      <aside className="ui-sheet">{children}</aside>
    </div>
  );
}
