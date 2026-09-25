import React from "react";

interface ToolbarBtnProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}

export function ToolbarBtn({
  onClick,
  isActive,
  disabled,
  children,
  title,
}: ToolbarBtnProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`px-2 py-1 rounded text-sm font-medium transition-colors focus:outline-none focus:ring-2 disabled:opacity-40 disabled:cursor-not-allowed ${
        isActive ? "bg-opacity-20" : "hover:bg-opacity-10"
      }`}
      style={{
        color: isActive ? "var(--accent-text)" : "var(--text-secondary)",
        background: isActive ? "var(--accent-subtle)" : "transparent",
      }}
    >
      {children}
    </button>
  );
}
