export default function Marquee({ items }: { items: string[] }) {
  const loop = [...items, ...items];

  return (
    <div className="overflow-hidden border-b border-white/10 bg-blue-600 py-4">
      <div className="animate-marquee flex w-max gap-12">
        {[...loop, ...loop].map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="font-display flex items-center gap-12 whitespace-nowrap text-xl text-black sm:text-2xl"
          >
            {item}
            <span aria-hidden className="text-black/40">
              ✦
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
