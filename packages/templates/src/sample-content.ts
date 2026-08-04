import { siteContentSchema, type SiteContent } from "./schema";

/** Sample content per template for gallery previews and tests. */

interface SampleSeed {
  name: string;
  category: string;
  area: string;
  city: string;
  phone: string;
  rating: number;
  reviewCount: number;
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  ctaPrimary: string;
  aboutBody: string;
  highlights: string[];
  services: { name: string; description: string; icon: string }[];
  whyUs: { title: string; description: string }[];
  faqs: { q: string; a: string }[];
  snippets: string[];
  tagline: string;
}

function build(seed: SampleSeed): SiteContent {
  return siteContentSchema.parse({
    meta: {
      title: `${seed.name} — ${seed.category} in ${seed.area}, ${seed.city}`.slice(0, 70),
      description: `${seed.name}: trusted ${seed.category.toLowerCase()} in ${seed.area}, ${seed.city}. ${seed.heroSubtitle}`.slice(0, 200),
      keywords: [seed.category.toLowerCase(), seed.area.toLowerCase(), seed.city.toLowerCase()],
    },
    business: {
      name: seed.name,
      category: seed.category,
      phone: seed.phone,
      whatsapp: seed.phone,
      email: `hello@${seed.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.in`,
      address: `12, Main Market, ${seed.area}`,
      area: seed.area,
      city: seed.city,
      rating: seed.rating,
      reviewCount: seed.reviewCount,
      socials: { instagram: `instagram.com/${seed.name.toLowerCase().replace(/\s+/g, "")}`, facebook: "", linkedin: "" },
      openingHours: [
        { days: "Mon – Sat", hours: "10:00 AM – 8:30 PM" },
        { days: "Sunday", hours: "11:00 AM – 5:00 PM" },
      ],
    },
    hero: {
      badge: seed.heroBadge,
      title: seed.heroTitle,
      subtitle: seed.heroSubtitle,
      ctaPrimary: seed.ctaPrimary,
      ctaSecondary: "Call Now",
    },
    about: {
      heading: `About ${seed.name}`,
      body: seed.aboutBody,
      highlights: seed.highlights,
    },
    services: { heading: "Our Services", items: seed.services },
    whyUs: { heading: "Why Choose Us", items: seed.whyUs },
    testimonials: {
      heading: "What Customers Say",
      items: [
        { name: "Happy Customer", text: "Excellent service and very professional team. Highly recommended!", rating: 5 },
        { name: "Local Resident", text: "Best in the area — friendly staff and great value for money.", rating: 5 },
        { name: "First-time Visitor", text: "Was recommended by a friend and it exceeded expectations.", rating: 4 },
      ],
    },
    faqs: { heading: "Frequently Asked Questions", items: seed.faqs },
    reviews: { heading: "Loved on Google", snippets: seed.snippets },
    cta: {
      heading: "Ready to get started?",
      subheading: `Message ${seed.name} on WhatsApp — replies within minutes.`,
      buttonText: seed.ctaPrimary,
    },
    contact: { heading: "Contact Us", note: `Find us in ${seed.area}, ${seed.city}.` },
    footer: { tagline: seed.tagline },
  });
}

export const SAMPLE_CONTENT: Record<string, SiteContent> = {
  dental: build({
    name: "Smile Dental Care",
    category: "Dental Clinic",
    area: "Karol Bagh",
    city: "New Delhi",
    phone: "+91 98100 00001",
    rating: 4.7,
    reviewCount: 312,
    heroBadge: "Painless • Modern • Trusted",
    heroTitle: "Healthy smiles for the whole family",
    heroSubtitle: "Advanced, painless dentistry in the heart of Karol Bagh — trusted by 300+ happy patients.",
    ctaPrimary: "Book Appointment",
    aboutBody:
      "Led by experienced dental surgeons, our clinic combines modern equipment with gentle, patient-first care. From routine check-ups to full smile makeovers, every treatment is planned around your comfort.",
    highlights: ["Single-sitting RCT", "Digital X-ray", "EMI available", "Strict sterilization"],
    services: [
      { name: "Root Canal Treatment", description: "Single-sitting, painless RCT with digital guidance.", icon: "tooth" },
      { name: "Dental Implants", description: "Permanent, natural-looking teeth replacements.", icon: "implant" },
      { name: "Braces & Aligners", description: "Metal, ceramic and invisible options for all ages.", icon: "braces" },
      { name: "Teeth Whitening", description: "Visibly brighter smile in a single visit.", icon: "sparkles" },
      { name: "Kids Dentistry", description: "Gentle, friendly care for little smiles.", icon: "smile" },
      { name: "Full Mouth Rehab", description: "Complete smile restoration, planned end-to-end.", icon: "shield" },
    ],
    whyUs: [
      { title: "Painless Treatment", description: "Modern anaesthesia and rotary endodontics." },
      { title: "Transparent Pricing", description: "Estimates before every procedure. EMI plans." },
      { title: "Experienced Team", description: "10+ years across 10,000+ procedures." },
      { title: "Hygiene First", description: "Hospital-grade sterilization for every tool." },
    ],
    faqs: [
      { q: "Is root canal treatment painful?", a: "No — with modern anaesthesia and rotary tools, most patients feel no pain during single-sitting RCT." },
      { q: "Do you offer EMI for implants?", a: "Yes, flexible EMI plans are available for implants and full-mouth treatments." },
      { q: "Do you see emergency cases?", a: "Yes, same-day emergency appointments are available — call us directly." },
    ],
    snippets: [
      "Completely painless root canal, doctor explained everything clearly.",
      "Very hygienic clinic and courteous staff. Worth every rupee.",
      "My kids actually enjoy dental visits now!",
    ],
    tagline: "Gentle dentistry, brilliant smiles.",
  }),

  restaurant: build({
    name: "Tandoori Nights",
    category: "Restaurant",
    area: "Greater Kailash",
    city: "New Delhi",
    phone: "+91 98100 00002",
    rating: 4.3,
    reviewCount: 1240,
    heroBadge: "North Indian • Mughlai • Since 1998",
    heroTitle: "Flavours that feel like a celebration",
    heroSubtitle: "Charcoal tandoor, slow-cooked gravies and warm hospitality in GK-II — dine in, take away or cater your next event.",
    ctaPrimary: "Reserve a Table",
    aboutBody:
      "For over two decades, our chefs have served recipes passed down three generations — marinated overnight, cooked over charcoal, and plated with pride. Family dinners, office parties or a quiet date night: your table is ready.",
    highlights: ["Charcoal tandoor", "Family seating", "Party catering", "Home delivery"],
    services: [
      { name: "Signature Tandoori", description: "Charcoal-grilled kebabs and tikkas, marinated overnight.", icon: "food" },
      { name: "Mughlai Classics", description: "Slow-cooked gravies — butter chicken to nihari.", icon: "utensils" },
      { name: "Party Catering", description: "Weddings, birthdays and office events for 20–500 guests.", icon: "star" },
      { name: "Express Delivery", description: "Hot food at your door in 40 minutes, GK & nearby.", icon: "clock" },
    ],
    whyUs: [
      { title: "25 Years of Taste", description: "Three generations of recipes." },
      { title: "Fresh Every Day", description: "Meats and produce sourced each morning." },
      { title: "Family Friendly", description: "Spacious seating and a kids' menu." },
      { title: "Event Ready", description: "Custom menus for every budget." },
    ],
    faqs: [
      { q: "Do you take table reservations?", a: "Yes — WhatsApp us your date, time and group size; weekend evenings fill fast." },
      { q: "Is pure veg available?", a: "Yes, we run a separate veg section in the kitchen with dedicated utensils." },
      { q: "Do you cater outside Delhi?", a: "We cater across Delhi NCR including Gurugram and Noida." },
    ],
    snippets: [
      "Butter chicken here is the best in South Delhi, period.",
      "Catered our wedding for 300 guests — flawless.",
      "Generous portions and the kebabs are outstanding.",
    ],
    tagline: "Where every meal is a celebration.",
  }),

  salon: build({
    name: "Glow & Grace Salon",
    category: "Salon",
    area: "DLF Phase 4",
    city: "Gurugram",
    phone: "+91 98100 00003",
    rating: 4.8,
    reviewCount: 189,
    heroBadge: "Hair • Skin • Bridal",
    heroTitle: "Look stunning, feel unstoppable",
    heroSubtitle: "Premium hair, skin and bridal studio in DLF Phase 4 — internationally trained stylists, luxury products.",
    ctaPrimary: "Book a Session",
    aboutBody:
      "A boutique salon built around you: unhurried consultations, premium product lines and stylists trained in the latest international techniques. Walk in for a trim, walk out transformed.",
    highlights: ["L'Oréal & O3+ products", "Bridal packages", "Ladies-only hours", "Home service"],
    services: [
      { name: "Hair Styling & Color", description: "Cuts, balayage, keratin and smoothening.", icon: "scissors" },
      { name: "Skin & Facials", description: "Hydra facials, clean-ups and anti-ageing rituals.", icon: "sparkles" },
      { name: "Bridal Studio", description: "Complete bridal packages with trials.", icon: "heart" },
      { name: "Nail Art", description: "Gel extensions, art and spa manicures.", icon: "brush" },
    ],
    whyUs: [
      { title: "Certified Stylists", description: "Trained in London & Mumbai academies." },
      { title: "Premium Products", description: "Only authentic international brands." },
      { title: "Hygiene Promise", description: "Fresh towels and sanitized tools, always." },
      { title: "On-time Service", description: "Appointments that respect your schedule." },
    ],
    faqs: [
      { q: "Do you offer bridal trials?", a: "Yes — every bridal package includes a full makeup and hair trial." },
      { q: "Can I book home service?", a: "Home services are available across Gurugram for select treatments." },
      { q: "What brands do you use?", a: "L'Oréal Professionnel, O3+, Kérastase and other authentic lines." },
    ],
    snippets: [
      "Best balayage I've had in Gurugram, and I've tried many places.",
      "Bridal makeup was flawless and lasted the whole night.",
      "Truly premium experience without the premium attitude.",
    ],
    tagline: "Your glow, our craft.",
  }),

  gym: build({
    name: "Iron Temple Gym",
    category: "Gym",
    area: "Sector 18",
    city: "Noida",
    phone: "+91 98100 00004",
    rating: 4.5,
    reviewCount: 267,
    heroBadge: "24×7 Access • Certified Trainers",
    heroTitle: "Stronger every single day",
    heroSubtitle: "5,000 sq ft of iron, certified coaches and a community that shows up — first workout is on us.",
    ctaPrimary: "Get Free Trial",
    aboutBody:
      "No shortcuts, no gimmicks — just proper programming, honest coaching and equipment that can take a beating. Whether it's your first squat or your first powerlifting meet, we've got your back.",
    highlights: ["24×7 access", "Certified coaches", "Diet planning", "Steam & recovery"],
    services: [
      { name: "Strength Training", description: "Full free-weight floor with competition racks.", icon: "dumbbell" },
      { name: "Personal Training", description: "1-on-1 programs with monthly assessments.", icon: "star" },
      { name: "Group Classes", description: "HIIT, CrossFit-style and Zumba, every evening.", icon: "heart" },
      { name: "Nutrition Coaching", description: "Practical Indian diet plans that stick.", icon: "shield" },
    ],
    whyUs: [
      { title: "Real Equipment", description: "Eleiko-grade bars, dumbbells to 60kg." },
      { title: "Certified Coaches", description: "ACE/K11 certified, ego-free coaching." },
      { title: "Open 24×7", description: "Train on your schedule, every day." },
      { title: "Results Tracked", description: "Monthly InBody scans included." },
    ],
    faqs: [
      { q: "Is there a joining fee?", a: "No joining fee this season — pay only your membership. First trial workout is free." },
      { q: "Do memberships pause?", a: "Yes, freeze your membership up to 30 days a year at no cost." },
      { q: "Are trainers included?", a: "Floor trainers are always included; 1-on-1 personal training is a separate package." },
    ],
    snippets: [
      "Serious lifting culture and the cleanest gym in Sector 18.",
      "Lost 12kg in 5 months with their nutrition coaching.",
      "24×7 access is a game changer for my shift job.",
    ],
    tagline: "Show up. We handle the rest.",
  }),

  general: build({
    name: "Kapoor & Associates",
    category: "General Business",
    area: "Connaught Place",
    city: "New Delhi",
    phone: "+91 98100 00005",
    rating: 4.9,
    reviewCount: 58,
    heroBadge: "Trusted since 2009",
    heroTitle: "Professional services you can rely on",
    heroSubtitle: "From compliance to consulting — clear advice, honest pricing and on-time delivery in the heart of Delhi.",
    ctaPrimary: "Get a Callback",
    aboutBody:
      "We believe good service is simple: listen carefully, advise honestly and deliver on time. That philosophy has earned us long-term clients across Delhi NCR — and their referrals are how we grow.",
    highlights: ["15+ years experience", "Transparent pricing", "On-time delivery", "500+ clients"],
    services: [
      { name: "Consulting", description: "Practical advice tailored to your situation.", icon: "briefcase" },
      { name: "Compliance & Filing", description: "Deadlines handled, penalties avoided.", icon: "shield" },
      { name: "Registrations", description: "Company, GST, MSME and more — end to end.", icon: "star" },
      { name: "Ongoing Support", description: "A dedicated point of contact all year round.", icon: "clock" },
    ],
    whyUs: [
      { title: "Experienced Team", description: "Seasoned professionals across domains." },
      { title: "Fixed-fee Pricing", description: "Know the cost before we start." },
      { title: "Always Reachable", description: "Same-day response on WhatsApp." },
      { title: "Proven Record", description: "4.9★ from verified Google reviews." },
    ],
    faqs: [
      { q: "How do consultations work?", a: "The first 15-minute call is free — we understand your need and quote a fixed fee." },
      { q: "Do you work with startups?", a: "Yes, from incorporation to compliance calendars, startups are a core focus." },
      { q: "Which areas do you serve?", a: "Clients across Delhi NCR, with remote support pan-India." },
    ],
    snippets: [
      "Filed everything on time for 3 years straight. Zero stress.",
      "Explained my options in plain language — rare and valuable.",
      "Fast, honest and reasonably priced.",
    ],
    tagline: "Clear advice. Honest work.",
  }),
};
