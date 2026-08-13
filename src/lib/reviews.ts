export type Review = {
  name: string;
  rating: number;
  date: string;
  text: string;
};

export const REVIEWS: Review[] = [
  {
    name: "Ananya R.",
    rating: 5,
    date: "3 weeks ago",
    text: "I've tried a lot of gyms. Stellar is the first place where the coaches actually watch your form and the community keeps you coming back.",
  },
  {
    name: "Vikram S.",
    rating: 5,
    date: "1 month ago",
    text: "Marcus's strength programming got me a 40kg PR on my deadlift in six months. The coaching here is a different level.",
  },
  {
    name: "Fatima K.",
    rating: 5,
    date: "2 months ago",
    text: "Power Yoga with Priya is the best recovery session I've found anywhere in the city. Genuinely changed how my body feels between lifts.",
  },
  {
    name: "Rohan M.",
    rating: 4,
    date: "2 months ago",
    text: "Great equipment, great classes, gets busy in the evenings but honestly that's a good problem for a gym to have.",
  },
  {
    name: "Divya P.",
    rating: 5,
    date: "3 months ago",
    text: "Iron HIIT with Dana is brutal in the best way. Down 8kg since I started and the class energy is unmatched.",
  },
  {
    name: "Karan T.",
    rating: 5,
    date: "4 months ago",
    text: "Sam's 1-on-1 coaching was exactly what I needed as a complete beginner. Patient, clear, never made me feel out of place.",
  },
];
