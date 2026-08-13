export type VideoGuide = {
  id: string;
  title: string;
  category: "Tutorial" | "Machine Guide" | "Warmup" | "Stretching" | "Nutrition";
  duration: string;
  description: string;
};

export const VIDEO_GUIDES: VideoGuide[] = [
  {
    id: "v1",
    title: "Perfect Your Squat Setup",
    category: "Tutorial",
    duration: "6:24",
    description: "Marcus breaks down bar placement, stance width, and bracing for a safer, stronger squat.",
  },
  {
    id: "v2",
    title: "Deadlift Form Fundamentals",
    category: "Tutorial",
    duration: "8:10",
    description: "A step-by-step guide to hip hinge mechanics and setting up a safe pull.",
  },
  {
    id: "v3",
    title: "Using the Cable Machine",
    category: "Machine Guide",
    duration: "4:12",
    description: "How to adjust pulleys, attachments, and cable height for common exercises.",
  },
  {
    id: "v4",
    title: "Smith Machine Basics",
    category: "Machine Guide",
    duration: "3:45",
    description: "Safety pins, bar path, and when to choose the Smith machine over free weights.",
  },
  {
    id: "v5",
    title: "5-Minute Dynamic Warmup",
    category: "Warmup",
    duration: "5:00",
    description: "A full-body warmup routine to prep joints and muscles before any strength session.",
  },
  {
    id: "v6",
    title: "Post-Workout Stretch Routine",
    category: "Stretching",
    duration: "7:30",
    description: "Priya's go-to cooldown stretch sequence for lifters and runners alike.",
  },
  {
    id: "v7",
    title: "Protein Intake for Muscle Growth",
    category: "Nutrition",
    duration: "6:50",
    description: "How much protein you actually need, and simple ways to hit your daily target.",
  },
  {
    id: "v8",
    title: "Hip Mobility for Better Squats",
    category: "Stretching",
    duration: "5:40",
    description: "Targeted mobility drills to improve squat depth and reduce hip tightness.",
  },
];
