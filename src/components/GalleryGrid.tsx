"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";
import { GALLERY_CATEGORIES, GALLERY_ITEMS, type GalleryItem } from "@/lib/gallery";

export default function GalleryGrid() {
  const [filter, setFilter] = useState<(typeof GALLERY_CATEGORIES)[number]>("All");
  const [active, setActive] = useState<GalleryItem | null>(null);

  const items =
    filter === "All"
      ? GALLERY_ITEMS
      : GALLERY_ITEMS.filter((item) => item.category === filter);

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

      <StaggerGroup className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <StaggerItem key={item.id}>
            <button
              type="button"
              onClick={() => setActive(item)}
              className={`group relative flex h-56 w-full items-end overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-left ${item.gradient}`}
            >
              <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
              <span className="relative text-sm font-bold uppercase tracking-wide text-white/90">
                {item.title}
              </span>
            </button>
          </StaggerItem>
        ))}
      </StaggerGroup>

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
              className={`relative flex h-[70vh] w-full max-w-3xl items-end overflow-hidden rounded-2xl bg-gradient-to-br p-8 ${active.gradient}`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setActive(null)}
                aria-label="Close"
                className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
              >
                ✕
              </button>
              <div>
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
