import Image from "next/image";

/**
 * The church logo at the size it's shown. next/image serves a resized copy
 * (a few KB, 1x/2x for sharp screens) instead of the 110 KB / 283px original.
 */
export function Logo({ size, className = "", priority = false, alt = "Imprint Global Church" }: {
  size: number;
  className?: string;
  priority?: boolean;
  alt?: string;
}) {
  return (
    <Image src="/logo.png" alt={alt} width={size} height={size} priority={priority} className={`object-contain ${className}`} />
  );
}
