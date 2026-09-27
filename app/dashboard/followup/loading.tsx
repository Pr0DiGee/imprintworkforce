import { Skeleton, SkeletonCard } from "@/components/Skeleton";

export default function FollowUpLoading() {
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-300">
      <div className="mb-6">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
