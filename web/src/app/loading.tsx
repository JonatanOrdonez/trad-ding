import { AssetCardSkeleton } from "@/components/assets/AssetCard";

export default function Loading() {
  return (
    <div className="px-4 sm:px-6 pb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <AssetCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
