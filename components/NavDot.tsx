/** Small dot on a menu item meaning "something here needs your attention". */
export function NavDot({ show, className = "", label = "Needs your attention" }: { show: boolean; className?: string; label?: string }) {
  if (!show) return null;
  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${className}`}
      style={{ background: "var(--accent)" }}
    />
  );
}
