import type { ReactNode } from "react";

type BrandWordmarkSize = "sm" | "md" | "lg";

type BrandWordmarkProps = {
  size?: BrandWordmarkSize;
  showTagline?: boolean;
  className?: string;
  tagline?: ReactNode;
};

const sizeClasses: Record<BrandWordmarkSize, string> = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl md:text-5xl",
};

export function BrandWordmark({
  size = "md",
  showTagline = false,
  className = "",
  tagline = "From sketch to stunning in seconds.",
}: BrandWordmarkProps) {
  return (
    <span className={`inline-flex flex-col ${className}`.trim()}>
      <span
        className={`inline-flex items-center gap-1 font-sans font-extrabold tracking-[-0.025em] antialiased ${sizeClasses[size]}`}
      >
        <span className="bg-gradient-to-r from-warm-black via-cognac to-gold bg-clip-text text-transparent dark:from-cream dark:via-gold-light dark:to-gold">
          Kairos
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />
      </span>

      {showTagline && (
        <span className="mt-1 text-xs font-medium tracking-[0.14em] text-warm-stone/90 uppercase dark:text-cream/80">
          {tagline}
        </span>
      )}
    </span>
  );
}
