import { Skeleton, SkeletonCard } from "@/components/Skeleton";

export default function NotesLoading() {
  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden animate-in fade-in duration-300">
      <div className="w-64 border-r border-border bg-card p-4 hidden md:block">
        <Skeleton className="h-6 w-32 mb-6" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
      <div className="flex-1 p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}
