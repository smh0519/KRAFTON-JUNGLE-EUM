export default function SkeletonLoader() {
  return (
    <div className="animate-pulse space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <div className="w-10 h-10 bg-white/5 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-white/10 rounded-lg w-1/3" />
            <div className="h-3 bg-white/5 rounded-lg w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
