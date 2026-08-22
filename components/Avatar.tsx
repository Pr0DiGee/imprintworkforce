const COLORS = [
  "bg-blue-600", "bg-emerald-600", "bg-purple-600", "bg-amber-600",
  "bg-rose-600", "bg-cyan-600", "bg-indigo-600", "bg-teal-600",
];

function getColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

interface AvatarProps {
  name: string;
  uid?: string;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-xs",
  lg: "w-10 h-10 text-sm",
};

export function Avatar({ name, uid = name, size = "md" }: AvatarProps) {
  return (
    <div
      className={`${SIZES[size]} ${getColor(uid)} rounded-full flex items-center justify-center text-white font-semibold shrink-0 select-none`}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}
