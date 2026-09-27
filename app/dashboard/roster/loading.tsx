import { Skeleton, SkeletonTable } from "@/components/Skeleton";

export default function RosterLoading() {
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-300">
      <div className="mb-6">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="bg-card border border-border rounded-lg p-6">
        <SkeletonTable rows={4} />
      </div>
    </div>
  );
}
