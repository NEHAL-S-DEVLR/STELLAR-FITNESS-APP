export type Trainer = {
  slug: string;
  name: string;
  initials: string;
  role: string;
  specialty: string;
  bio: string;
  philosophy: string;
  experience: string;
  certifications: string[];
  achievements: string[];
  schedule: { day: string; time: string }[];
  instagram: string;
};

// The real roster now lives in the database (added via the admin portal's
// Trainers & Staff page) and is served to the public site through
// /api/public/trainers — see TrainerGrid, HomeTrainers, and TrainerProfile.
// This file keeps only the type + a helper that other pages (class detail,
// transformations) use to optionally credit an instructor by a fixed slug;
// with no static roster left, that lookup always misses and those pages'
// already-conditional "instructor" blocks simply don't render.
export const TRAINERS: Trainer[] = [];

export function getTrainerBySlug(slug: string) {
  return TRAINERS.find((t) => t.slug === slug);
}
