import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";

const palette = [
  "bg-avatar-1 text-avatar-1-foreground",
  "bg-avatar-2 text-avatar-2-foreground",
  "bg-avatar-3 text-avatar-3-foreground",
  "bg-avatar-4 text-avatar-4-foreground",
  "bg-avatar-5 text-avatar-5-foreground",
  "bg-avatar-6 text-avatar-6-foreground",
];

// Same name always gets the same color
function colorFor(name: string) {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

export function ContactAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-heading font-medium select-none",
        size === "md"
          ? "size-10 text-base"
          : "size-16 text-2xl md:size-20 md:text-3xl",
        colorFor(name),
        className,
      )}
    >
      {getInitials(name)}
    </span>
  );
}
