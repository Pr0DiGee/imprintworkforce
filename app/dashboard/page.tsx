"use client";

import { useAuth } from "@/context/AuthContext";

// ─── Module placeholder card ──────────────────────────────────────────────────

function ModuleCard({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {phase}
        </span>
      </div>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const MODULES = [
  {
    title: "Department Reports",
    description: "Submit and review weekly Sunday reports for your department.",
    phase: "Phase 2",
  },
  {
    title: "Task Management",
    description: "Assign, track, and complete tasks across the team.",
    phase: "Phase 2",
  },
  {
    title: "Service Roster",
    description: "Manage duty assignments for upcoming services.",
    phase: "Phase 3",
  },
  {
    title: "Devotion Schedule",
    description: "Plan and annotate devotion sessions with teaching notes.",
    phase: "Phase 3",
  },
  {
    title: "Service Feedback",
    description: "Collect structured feedback after each service.",
    phase: "Phase 3",
  },
];

export default function DashboardPage() {
  const { userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Welcome banner */}
      <div className="bg-white border border-gray-200 rounded-lg px-5 py-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Welcome back{userProfile?.name ? `, ${userProfile.name}` : ""}
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          You are signed in as{" "}
          <span className="font-medium text-gray-700">
            {userProfile?.role?.replace(/_/g, " ") ?? "…"}
          </span>
          {userProfile?.department ? ` · ${userProfile.department}` : ""}
        </p>
      </div>

      {/* Module grid */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Modules
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MODULES.map((mod) => (
            <ModuleCard key={mod.title} {...mod} />
          ))}
        </div>
      </section>
    </div>
  );
}
