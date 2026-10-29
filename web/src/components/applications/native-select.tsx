import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** The browser's own select, styled like the inputs. On phones it opens the system
 * picker, which is easier to use than a custom one. */
export function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(
          "bg-transparent h-12 w-full appearance-none rounded-xs border ps-4 pe-10 text-base outline-none transition-[border-color,box-shadow] border-input hover:border-foreground focus-visible:border-primary focus-visible:shadow-[inset_0_0_0_1px_var(--primary)] aria-invalid:border-destructive aria-invalid:shadow-[inset_0_0_0_1px_var(--destructive)]",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute end-3.5 top-1/2 size-4 -translate-y-1/2"
      />
    </div>
  );
}
