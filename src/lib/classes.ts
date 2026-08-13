export type GymClass = {
  slug: string;
  name: string;
  category: string;
  tagline: string;
  description: string;
  benefits: string[];
  duration: string;
  level: "All Levels" | "Beginner" | "Intermediate" | "Advanced";
  schedule: { day: string; time: string }[];
  instructorSlug: string;
};

export const CLASSES: GymClass[] = [
  {
    slug: "iron-hiit",
    name: "Iron HIIT",
    category: "Conditioning",
    tagline: "High-intensity intervals that torch calories fast.",
    description:
      "High-intensity interval circuits mixing kettlebells, sleds, and bodyweight work, designed to build conditioning and burn fat in 45 minutes flat.",
    benefits: [
      "Improves cardiovascular endurance",
      "Burns calories for hours after class",
      "Builds full-body functional strength",
    ],
    duration: "45 min",
    level: "All Levels",
    schedule: [{ day: "Mon / Wed / Fri", time: "6:00am, 5:30pm" }],
    instructorSlug: "dana-ruiz",
  },
  {
    slug: "forge-strength",
    name: "Forge Strength",
    category: "Strength",
    tagline: "Coached barbell strength sessions.",
    description:
      "A coached barbell strength class focused on the squat, bench, and deadlift, with progressive programming designed by our head strength coach.",
    benefits: [
      "Builds raw strength with proven programming",
      "Coached form checks on every lift",
      "Progressive overload tracked weekly",
    ],
    duration: "60 min",
    level: "Intermediate",
    schedule: [{ day: "Tue / Thu", time: "6:30am, 6:00pm" }],
    instructorSlug: "marcus-bell",
  },
  {
    slug: "sunrise-spin",
    name: "Sunrise Spin",
    category: "Cardio",
    tagline: "High-energy indoor cycling to start your day.",
    description:
      "A high-energy indoor cycling class to build endurance and burn fat, set to a killer playlist that keeps the room moving.",
    benefits: [
      "Low-impact cardio for all fitness levels",
      "Builds leg strength and endurance",
      "Music-driven pacing keeps you motivated",
    ],
    duration: "45 min",
    level: "All Levels",
    schedule: [{ day: "Mon / Wed / Fri", time: "5:15am" }],
    instructorSlug: "elena-petrova",
  },
  {
    slug: "power-yoga",
    name: "Power Yoga",
    category: "Recovery",
    tagline: "Flow-based yoga for strength and mobility.",
    description:
      "A flow-based yoga class to build mobility, core control, and recovery between heavy training days — open to all experience levels.",
    benefits: [
      "Improves flexibility and joint mobility",
      "Reduces injury risk between lifting days",
      "Builds core strength and breath control",
    ],
    duration: "50 min",
    level: "All Levels",
    schedule: [{ day: "Tue / Thu / Sat", time: "8:00am" }],
    instructorSlug: "priya-nair",
  },
  {
    slug: "enhanced-yoga",
    name: "Enhanced Yoga",
    category: "Recovery",
    tagline: "Advanced yoga for deeper mobility work.",
    description:
      "A more advanced yoga session layering in longer holds, deeper stretches, and breathwork techniques for members ready to go further.",
    benefits: [
      "Deepens flexibility beyond Power Yoga",
      "Advanced breathwork and holds",
      "Ideal complement to heavy strength training",
    ],
    duration: "60 min",
    level: "Intermediate",
    schedule: [{ day: "Sun", time: "9:00am" }],
    instructorSlug: "priya-nair",
  },
  {
    slug: "zumba",
    name: "Zumba",
    category: "Dance Fitness",
    tagline: "Dance-based cardio that doesn't feel like a workout.",
    description:
      "A fun, dance-based cardio class blending Latin rhythms with easy-to-follow choreography — no dance experience required.",
    benefits: [
      "Full-body cardio disguised as a dance party",
      "Beginner-friendly choreography",
      "Great for stress relief",
    ],
    duration: "50 min",
    level: "Beginner",
    schedule: [{ day: "Wed / Sat", time: "6:30pm" }],
    instructorSlug: "elena-petrova",
  },
  {
    slug: "dance-fitness",
    name: "Dance Fitness",
    category: "Dance Fitness",
    tagline: "High-energy choreography for cardio and coordination.",
    description:
      "A high-energy dance cardio class covering hip-hop, pop, and freestyle choreography to keep every session fresh.",
    benefits: [
      "Improves coordination and rhythm",
      "Torches calories through continuous movement",
      "New choreography every week",
    ],
    duration: "45 min",
    level: "Beginner",
    schedule: [{ day: "Fri", time: "7:00pm" }],
    instructorSlug: "dana-ruiz",
  },
  {
    slug: "crossfit",
    name: "CrossFit",
    category: "Strength",
    tagline: "Constantly varied, high-intensity functional movement.",
    description:
      "A constantly varied strength and conditioning class combining Olympic lifts, gymnastics movements, and metabolic conditioning.",
    benefits: [
      "Builds strength, power, and endurance together",
      "Workout of the day keeps training varied",
      "Strong community and team-based workouts",
    ],
    duration: "60 min",
    level: "Advanced",
    schedule: [{ day: "Mon / Wed / Fri", time: "7:00am" }],
    instructorSlug: "marcus-bell",
  },
  {
    slug: "kids-fitness",
    name: "Kids Fitness",
    category: "Youth",
    tagline: "Fun, safe fitness fundamentals for ages 7–12.",
    description:
      "A fun, age-appropriate fitness class introducing kids to movement, coordination, and healthy habits in a safe, encouraging environment.",
    benefits: [
      "Builds coordination and body awareness",
      "Introduces healthy habits early",
      "Safe, supervised group setting",
    ],
    duration: "40 min",
    level: "Beginner",
    schedule: [{ day: "Sat", time: "11:00am" }],
    instructorSlug: "sam-whitfield",
  },
  {
    slug: "senior-fitness",
    name: "Senior Fitness",
    category: "Low-Impact",
    tagline: "Gentle strength and balance training for 55+.",
    description:
      "A low-impact strength and balance class designed for older adults, focused on functional movement, joint health, and confidence.",
    benefits: [
      "Improves balance and fall prevention",
      "Builds functional strength for daily life",
      "Supportive, low-pressure environment",
    ],
    duration: "45 min",
    level: "Beginner",
    schedule: [{ day: "Tue / Thu", time: "10:00am" }],
    instructorSlug: "sam-whitfield",
  },
  {
    slug: "box-conditioning",
    name: "Box Conditioning",
    category: "Conditioning",
    tagline: "Boxing fundamentals, zero sparring.",
    description:
      "Boxing fundamentals paired with conditioning drills — footwork, combinations, and pad work. All work, no sparring.",
    benefits: [
      "Builds coordination and reflexes",
      "Full-body conditioning workout",
      "Stress relief through structured striking",
    ],
    duration: "50 min",
    level: "Beginner",
    schedule: [{ day: "Mon / Thu", time: "7:00pm" }],
    instructorSlug: "tyler-osei",
  },
];

export function getClassBySlug(slug: string) {
  return CLASSES.find((c) => c.slug === slug);
}
