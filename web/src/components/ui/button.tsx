import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Material 3 buttons: pill shaped, with a state layer for hover, focus and press
// (globals.css). default = filled, secondary = tonal, outline = outlined, text = text,
// ghost = a neutral icon or menu button. Each variant sets its own border colour: `cn` keeps
// both of two conflicting classes, so the base can't set one.
const buttonVariants = cva(
  "group/button state-layer relative inline-flex shrink-0 items-center justify-center rounded-full border bg-clip-padding text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow] outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1.125rem]",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:shadow-sm",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-input text-primary aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        text: "border-transparent text-primary",
        ghost: "border-transparent text-foreground aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        destructive: "border-transparent bg-destructive/10 text-destructive dark:bg-destructive/20",
        link: "border-transparent text-primary underline-offset-4 before:hidden hover:underline",
      },
      size: {
        default: "h-10 gap-2 px-6 has-data-[icon=inline-end]:pe-4 has-data-[icon=inline-start]:ps-4",
        xs: "h-7 gap-1 px-3 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 px-4 text-[0.8125rem] has-data-[icon=inline-end]:pe-3 has-data-[icon=inline-start]:ps-3 [&_svg:not([class*='size-'])]:size-4",
        lg: "h-12 gap-2 px-7 text-base",
        xl: "h-14 gap-2 px-8 text-lg",
        icon: "size-10",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
