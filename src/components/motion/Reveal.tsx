"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "left" | "right" | "none";
  distance?: number;
};

const OFFSETS: Record<NonNullable<RevealProps["direction"]>, [number, number]> = {
  up: [0, 1],
  left: [-1, 0],
  right: [1, 0],
  none: [0, 0],
};

export default function Reveal({
  children,
  className,
  delay = 0,
  direction = "up",
  distance = 32,
}: RevealProps) {
  const [x, y] = OFFSETS[direction];

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x: x * distance, y: y * distance }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
