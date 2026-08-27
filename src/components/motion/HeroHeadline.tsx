"use client";

import { motion } from "framer-motion";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
};

const word = {
  hidden: { opacity: 0, y: 40, rotate: -2 },
  show: {
    opacity: 1,
    y: 0,
    rotate: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  },
};

type Line = { words: string[]; accent?: boolean };

export default function HeroHeadline({
  lines,
  className,
  accentClassName = "text-blue-500",
}: {
  lines: Line[];
  className?: string;
  accentClassName?: string;
}) {
  return (
    <motion.h1
      className={className}
      variants={container}
      initial="hidden"
      animate="show"
    >
      {lines.map((line, li) => (
        <span key={li} className="block overflow-hidden">
          {line.words.map((w, wi) => (
            <motion.span
              key={wi}
              variants={word}
              className={`mr-[0.22em] inline-block last:mr-0 ${line.accent ? accentClassName : ""}`}
            >
              {w}
            </motion.span>
          ))}
        </span>
      ))}
    </motion.h1>
  );
}
