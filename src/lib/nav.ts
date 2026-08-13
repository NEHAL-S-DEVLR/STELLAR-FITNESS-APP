export const GYM_NAME = "Stellar Fitness Club";
export const GYM_SHORT_NAME = "Stellar";
export const GYM_TAGLINE = "Unleash Your Potential";

export const PRIMARY_NAV = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/trainers", label: "Trainers" },
  { href: "/classes", label: "Classes" },
  { href: "/gallery", label: "Gallery" },
  { href: "/membership", label: "Membership" },
  { href: "/contact", label: "Contact" },
] as const;

export const FOOTER_NAV = {
  Explore: [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/trainers", label: "Trainers" },
    { href: "/classes", label: "Classes" },
    { href: "/membership", label: "Membership" },
  ],
  Community: [
    { href: "/gallery", label: "Gallery" },
    { href: "/videos", label: "Video Guides" },
    { href: "/transformations", label: "Transformations" },
    { href: "/reviews", label: "Reviews" },
  ],
  Support: [
    { href: "/faq", label: "FAQ" },
    { href: "/contact", label: "Contact" },
    { href: "/book-visit", label: "Book a Visit" },
  ],
  Legal: [
    { href: "/privacy-policy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms & Conditions" },
  ],
} as const;
