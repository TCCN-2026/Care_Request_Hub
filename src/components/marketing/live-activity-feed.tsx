/**
 * Public "what people are looking for" ticker - visible to anyone,
 * including fully anonymous visitors. Deliberately renders category names
 * only (see supabase/migrations/0020_public_activity_feed.sql for the
 * matching database-side guarantee) - never a title, description,
 * postcode, budget or reference number, which is what would actually
 * risk identifying who posted a request.
 *
 * No client-side JS: the loop is a plain CSS animation, paused on hover
 * and disabled entirely under prefers-reduced-motion.
 */
export function LiveActivityFeed({ categories }: { categories: string[] }) {
  if (categories.length === 0) {
    return (
      <p className="text-center text-sm text-zinc-500">
        Requests from care providers will appear here as they go live.
      </p>
    );
  }

  // Duplicated so the marquee can loop seamlessly - see the @keyframes
  // comment in globals.css for why -50% is the right end point.
  const track = [...categories, ...categories];

  return (
    <div
      className="group overflow-hidden"
      style={{ maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)" }}
    >
      <ul className="flex w-max gap-3 [animation:marquee_40s_linear_infinite] motion-reduce:animate-none group-hover:[animation-play-state:paused]">
        {track.map((category, index) => (
          <li
            key={`${category}-${index}`}
            className="shrink-0 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium whitespace-nowrap text-zinc-700"
          >
            {category}
          </li>
        ))}
      </ul>
    </div>
  );
}
