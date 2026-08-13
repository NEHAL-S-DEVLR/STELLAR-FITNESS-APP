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

export const TRAINERS: Trainer[] = [
  {
    slug: "marcus-bell",
    name: "Marcus Bell",
    initials: "MB",
    role: "Head Strength Coach",
    specialty: "Powerlifting & Programming",
    bio: "Marcus has spent 12 years coaching everyone from first-time lifters to national-level competitors. He builds the strength programming used across every Forge Strength session at Stellar.",
    philosophy:
      "Strength isn't about looking better. It's about becoming stronger every single day.",
    experience: "12 years",
    certifications: ["NSCA-CSCS", "USAPL Coach", "USAW Level 2"],
    achievements: [
      "Coached 4 athletes to national powerlifting meets",
      "500lb+ raw deadlift, 405lb raw squat",
    ],
    schedule: [
      { day: "Tue / Thu", time: "6:30am, 6:00pm" },
      { day: "Sat", time: "10:00am" },
    ],
    instagram: "@coachmarcusb",
  },
  {
    slug: "dana-ruiz",
    name: "Dana Ruiz",
    initials: "DR",
    role: "Group Fitness Lead",
    specialty: "HIIT & Conditioning",
    bio: "A former collegiate track athlete, Dana designs the Iron HIIT circuits and leads certification for every new group instructor who joins the team.",
    philosophy:
      "The best workout is the one that makes you want to come back tomorrow.",
    experience: "8 years",
    certifications: ["ACE-CPT", "HIIT Specialist"],
    achievements: [
      "Built the Iron HIIT program from the ground up",
      "Trained 200+ members through 12-week transformation cycles",
    ],
    schedule: [{ day: "Mon / Wed / Fri", time: "6:00am, 5:30pm" }],
    instagram: "@danarunsHIIT",
  },
  {
    slug: "priya-nair",
    name: "Priya Nair",
    initials: "PN",
    role: "Yoga & Mobility Coach",
    specialty: "Power Yoga & Recovery",
    bio: "A registered yoga instructor (RYT-500), Priya helps lifters move better, breathe better, and recover faster between heavy training days.",
    philosophy: "Mobility is the foundation every lift is built on.",
    experience: "9 years",
    certifications: ["RYT-500", "Mobility Coach Certification"],
    achievements: [
      "Leads Stellar's injury-prevention mobility clinic",
      "Certified in three yoga disciplines",
    ],
    schedule: [{ day: "Tue / Thu / Sat", time: "8:00am" }],
    instagram: "@priya.flows",
  },
  {
    slug: "tyler-osei",
    name: "Tyler Osei",
    initials: "TO",
    role: "Boxing Coach",
    specialty: "Boxing Conditioning",
    bio: "A former amateur boxer, Tyler brings 8 years of coaching experience to the Box Conditioning program, built for every skill level from complete beginner to advanced.",
    philosophy: "Discipline in the ring builds discipline everywhere else.",
    experience: "8 years",
    certifications: ["USA Boxing Coach", "First Aid & CPR"],
    achievements: [
      "Former amateur boxing regional finalist",
      "Built Stellar's beginner-friendly boxing curriculum",
    ],
    schedule: [{ day: "Mon / Thu", time: "7:00pm" }],
    instagram: "@tylerthrows",
  },
  {
    slug: "sam-whitfield",
    name: "Sam Whitfield",
    initials: "SW",
    role: "Personal Trainer",
    specialty: "1-on-1 Coaching",
    bio: "Sam specializes in onboarding brand-new gym members and building long-term, goal-based programs that actually fit real schedules.",
    philosophy: "Consistency beats intensity every time.",
    experience: "6 years",
    certifications: ["NASM-CPT", "Nutrition Coach"],
    achievements: [
      "500+ personal training sessions delivered",
      "Specializes in first-time gym members",
    ],
    schedule: [{ day: "By appointment", time: "Mon – Sat" }],
    instagram: "@samwtrains",
  },
  {
    slug: "elena-petrova",
    name: "Elena Petrova",
    initials: "EP",
    role: "Cycling Instructor",
    specialty: "Indoor Cycling",
    bio: "Elena brings high-energy, music-driven rides to the early morning Sunrise Spin sessions — a fan favorite among Stellar's early risers.",
    philosophy: "Push the pace, and the results follow.",
    experience: "5 years",
    certifications: ["Schwinn Cycling Certified", "ACE-CPT"],
    achievements: [
      "Highest-attended class at Stellar three years running",
      "Curates a new playlist for every ride",
    ],
    schedule: [{ day: "Mon / Wed / Fri", time: "5:15am" }],
    instagram: "@elenarides",
  },
];

export function getTrainerBySlug(slug: string) {
  return TRAINERS.find((t) => t.slug === slug);
}
