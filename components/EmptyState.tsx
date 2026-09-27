import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div 
      className="flex flex-col items-center justify-center p-8 md:p-12 text-center rounded-2xl border border-dashed border-[var(--border-primary)] bg-[var(--bg-card)] max-w-2xl mx-auto my-8"
    >
      <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center mb-6">
        <Icon size={32} strokeWidth={1.5} />
      </div>
      <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">
        {title}
      </h3>
      <p className="text-[var(--text-secondary)] mb-8 max-w-md">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-2.5 rounded-lg font-medium text-white shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: "var(--accent)" }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
