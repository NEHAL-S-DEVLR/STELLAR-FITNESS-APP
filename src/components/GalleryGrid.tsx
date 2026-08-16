"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";
import { GALLERY_CATEGORIES } from "@/lib/gallery";

type ApiGalleryItem = {
  id: number;
  category: string;
  title: string;
  imageUrl: string;
};

export default function GalleryGrid() {
  const [filter, setFilter] = useState<(typeof GALLERY_CATEGORIES)[number]>("All");
  const [active, setActive] = useState<ApiGalleryItem | null>(null);
  const [allItems, setAllItems] = useState<ApiGalleryItem[] | null>(null);

  useEffect(() => {
    fetch("/api/public/gallery")
      .then((res) => (res.ok ? res.json() : []))
      .then(setAllItems)
      .catch(() => setAllItems([]));
  }, []);

  const items =
    allItems === null
      ? null
      : filter === "All"
        ? allItems
        : allItems.filter((item) => item.category === filter);

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {GALLERY_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilter(cat)}
            className={`rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-wide transition-colors ${
              filter === cat
                ? "bg-blue-600 text-white"
                : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {items === null ? (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl bg-zinc-950" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-10 text-sm text-zinc-500">
          Photos are being added — check back soon.
        </p>
      ) : (
        <StaggerGroup className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <StaggerItem key={item.id}>
              <button
                type="button"
                onClick={() => setActive(item)}
                className="group relative flex h-56 w-full items-end overflow-hidden rounded-2xl bg-zinc-950 p-5 text-left"
              >
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent transition-colors group-hover:from-black/90" />
                <span className="relative text-sm font-bold uppercase tracking-wide text-white/90">
                  {item.title}
                </span>
              </button>
            </StaggerItem>
          ))}
        </StaggerGroup>
      )}

      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-6"
            onClick={() => setActive(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="relative flex h-[70vh] w-full max-w-3xl items-end overflow-hidden rounded-2xl bg-zinc-950 p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={active.imageUrl}
                alt={active.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
              <button
                type="button"
                onClick={() => setActive(null)}
                aria-label="Close"
                className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
              >
                ✕
              </button>
              <div className="relative">
                <span className="text-xs font-bold uppercase tracking-widest text-white/70">
                  {active.category}
                </span>
                <p className="mt-1 text-2xl font-bold text-white">
                  {active.title}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
