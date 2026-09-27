import { SkeletonPage } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-in fade-in duration-300">
      <SkeletonPage />
    </div>
  );
}
