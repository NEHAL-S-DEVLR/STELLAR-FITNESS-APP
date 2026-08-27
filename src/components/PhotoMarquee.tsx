export default function PhotoMarquee({ files }: { files: string[] }) {
  const loop = [...files, ...files];

  return (
    <div className="group overflow-hidden bg-black py-2">
      <div className="animate-photo-marquee flex w-max gap-2">
        {loop.map((file, i) => (
          <div
            key={`${file}-${i}`}
            className="relative h-28 w-44 flex-shrink-0 overflow-hidden sm:h-36 sm:w-56"
          >
            <img
              src={`/gallery/${file}`}
              alt=""
              className="h-full w-full object-cover grayscale transition-[filter] duration-500 hover:grayscale-0"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
