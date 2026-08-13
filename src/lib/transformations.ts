export type Transformation = {
  name: string;
  duration: string;
  weightChange: string;
  program: string;
  trainerSlug: string;
  story: string;
};

export const TRANSFORMATIONS: Transformation[] = [
  {
    name: "Arjun Mehta",
    duration: "9 months",
    weightChange: "-18 kg",
    program: "Forge Strength + Iron HIIT",
    trainerSlug: "marcus-bell",
    story:
      "Arjun came in barely able to finish a warm-up set. Nine months of coached strength training and consistent HIIT later, he's squatting double bodyweight and hasn't missed a week.",
  },
  {
    name: "Neha Kapoor",
    duration: "6 months",
    weightChange: "-12 kg",
    program: "Sunrise Spin + Power Yoga",
    trainerSlug: "elena-petrova",
    story:
      "Neha started with early morning spin classes to build a habit, then added Power Yoga for recovery. Six months in, she's running her first 10K next month.",
  },
  {
    name: "Rahul Bhat",
    duration: "12 months",
    weightChange: "+9 kg muscle",
    program: "Forge Strength + Personal Coaching",
    trainerSlug: "marcus-bell",
    story:
      "Rahul wanted to bulk up after years of being 'skinny-fat.' A year of structured programming and personal coaching later, he's added 9kg of visible muscle.",
  },
  {
    name: "Sanya Iyer",
    duration: "5 months",
    weightChange: "-9 kg",
    program: "Iron HIIT + Box Conditioning",
    trainerSlug: "tyler-osei",
    story:
      "Sanya used boxing conditioning as a stress outlet during a demanding work year, and the consistency paid off with steady, sustainable fat loss.",
  },
];
