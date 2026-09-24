const bar = "animate-pulse rounded-[8px] bg-white/[0.07]"

export function PostCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#111212]" aria-hidden="true">
      <div className={`aspect-[16/10] w-full rounded-none ${bar}`} />
      <div className="space-y-[12px] p-[20px]">
        <div className={`h-[10px] w-[70px] ${bar}`} />
        <div className={`h-[18px] w-[92%] ${bar}`} />
        <div className={`h-[18px] w-[64%] ${bar}`} />
        <div className={`h-[12px] w-full ${bar}`} />
        <div className={`h-[12px] w-[80%] ${bar}`} />
        <div className="flex items-center gap-[10px] pt-[10px]">
          <div className={`h-[24px] w-[24px] rounded-full ${bar}`} />
          <div className={`h-[10px] w-[150px] ${bar}`} />
        </div>
      </div>
    </div>
  )
}

export function PostGridSkeleton({ count = 6 }) {
  return (
    <div className="grid gap-[22px] sm:grid-cols-2" role="status" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function FeaturedSkeleton() {
  return (
    <div className="grid overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#111212] xl:grid-cols-[1.2fr_1fr]" aria-hidden="true">
      <div className={`aspect-[16/10] w-full rounded-none xl:aspect-auto xl:min-h-[400px] ${bar}`} />
      <div className="space-y-[14px] p-[24px] sm:p-[40px]">
        <div className={`h-[22px] w-[90px] ${bar}`} />
        <div className={`h-[34px] w-[95%] ${bar}`} />
        <div className={`h-[34px] w-[70%] ${bar}`} />
        <div className={`h-[13px] w-full ${bar}`} />
        <div className={`h-[13px] w-[85%] ${bar}`} />
        <div className={`h-[13px] w-[60%] ${bar}`} />
      </div>
    </div>
  )
}

export function BlogListSkeleton() {
  return (
    <div className="bg-[#0a0a0a] pb-[80px]">
      <div className="border-b border-white/[0.07] pb-[48px] pt-[130px] sm:pt-[144px]">
        <div className="mx-auto max-w-[1240px] px-[20px] sm:px-[32px]">
          <div className={`h-[26px] w-[90px] rounded-full ${bar}`} />
          <div className={`mt-[20px] h-[52px] w-[min(640px,90%)] ${bar}`} />
          <div className={`mt-[14px] h-[16px] w-[min(480px,80%)] ${bar}`} />
        </div>
      </div>
      <div className="mx-auto grid max-w-[1240px] gap-[48px] px-[20px] pt-[36px] sm:px-[32px] lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <FeaturedSkeleton />
          <div className="mt-[48px]">
            <PostGridSkeleton count={4} />
          </div>
        </div>
        <div className="hidden space-y-[20px] lg:block" aria-hidden="true">
          <div className={`aspect-[4/5] w-full rounded-[18px] ${bar}`} />
          <div className={`h-[240px] w-full rounded-[18px] ${bar}`} />
        </div>
      </div>
    </div>
  )
}

export function ArticleSkeleton() {
  return (
    <div className="bg-[#0a0a0a] pb-[80px] pt-[130px]" role="status" aria-busy="true">
      <div className="mx-auto max-w-[820px] px-[20px] sm:px-[32px]">
        <div className={`h-[12px] w-[160px] ${bar}`} />
        <div className={`mt-[22px] h-[44px] w-full ${bar}`} />
        <div className={`mt-[12px] h-[44px] w-[70%] ${bar}`} />
        <div className="mt-[22px] flex items-center gap-[12px]">
          <div className={`h-[40px] w-[40px] rounded-full ${bar}`} />
          <div className="space-y-[8px]">
            <div className={`h-[11px] w-[140px] ${bar}`} />
            <div className={`h-[10px] w-[100px] ${bar}`} />
          </div>
        </div>
      </div>
      <div className="mx-auto mt-[36px] max-w-[1080px] px-[20px] sm:px-[32px]">
        <div className={`aspect-[16/9] w-full rounded-[20px] ${bar}`} />
      </div>
      <div className="mx-auto mt-[40px] max-w-[720px] space-y-[14px] px-[20px] sm:px-[32px]">
        {[100, 96, 100, 88, 100, 72].map((w, i) => (
          <div key={i} className={`h-[15px] ${bar}`} style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  )
}

export function CommentsSkeleton({ count = 3 }) {
  return (
    <div className="space-y-[18px]" role="status" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex gap-[12px]" aria-hidden="true">
          <div className={`h-[36px] w-[36px] shrink-0 rounded-full ${bar}`} />
          <div className="flex-1 space-y-[9px]">
            <div className={`h-[11px] w-[130px] ${bar}`} />
            <div className={`h-[12px] w-full ${bar}`} />
            <div className={`h-[12px] w-[70%] ${bar}`} />
          </div>
        </div>
      ))}
    </div>
  )
}
