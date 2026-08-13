export type GalleryItem = {
  id: string;
  category: "Gym" | "Equipment" | "Classes" | "Events" | "Transformations";
  title: string;
  gradient: string;
};

export const GALLERY_CATEGORIES = [
  "All",
  "Gym",
  "Equipment",
  "Classes",
  "Events",
  "Transformations",
] as const;

export const GALLERY_ITEMS: GalleryItem[] = [
  { id: "g1", category: "Gym", title: "Main training floor", gradient: "from-blue-900 via-zinc-900 to-black" },
  { id: "g2", category: "Gym", title: "Free weight zone", gradient: "from-zinc-800 via-zinc-900 to-black" },
  { id: "g3", category: "Gym", title: "Cardio deck", gradient: "from-blue-800 via-black to-zinc-900" },
  { id: "e1", category: "Equipment", title: "Squat rack row", gradient: "from-zinc-700 via-zinc-900 to-black" },
  { id: "e2", category: "Equipment", title: "Competition platform", gradient: "from-blue-900 via-zinc-800 to-black" },
  { id: "e3", category: "Equipment", title: "Cable machine wall", gradient: "from-zinc-800 via-black to-zinc-900" },
  { id: "c1", category: "Classes", title: "Iron HIIT circuit", gradient: "from-blue-800 via-zinc-900 to-black" },
  { id: "c2", category: "Classes", title: "Power Yoga flow", gradient: "from-zinc-700 via-zinc-900 to-black" },
  { id: "c3", category: "Classes", title: "Sunrise Spin room", gradient: "from-blue-900 via-black to-zinc-900" },
  { id: "ev1", category: "Events", title: "Member competition day", gradient: "from-zinc-800 via-blue-900 to-black" },
  { id: "ev2", category: "Events", title: "Community BBQ", gradient: "from-zinc-700 via-black to-zinc-900" },
  { id: "t1", category: "Transformations", title: "Arjun's 9-month journey", gradient: "from-blue-900 via-zinc-900 to-black" },
  { id: "t2", category: "Transformations", title: "Neha's 6-month journey", gradient: "from-zinc-800 via-zinc-900 to-black" },
  { id: "t3", category: "Transformations", title: "Rahul's 12-month journey", gradient: "from-blue-800 via-black to-zinc-900" },
];
