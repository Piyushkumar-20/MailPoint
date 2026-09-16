import type { SVGProps } from "react";

/**
 * MailPoint AI signature 4-pointed diamond sparkle star icon.
 * Matches the reference design in both the header and center hero.
 */
export function MailPointAiIcon({
  className = "size-5",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4772 12 22C12 16.4772 16.4772 12 22 12C16.4772 12 12 7.52285 12 2Z" />
    </svg>
  );
}
