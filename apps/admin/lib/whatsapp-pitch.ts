/**
 * Sector wording shared by the manual WhatsApp dialog (generator page) and
 * the auto-send-on-generate flow, so both produce the same pitch. Add a new
 * entry here whenever a new template ships (see
 * packages/templates/src/registry.tsx for the matching template list).
 */
export interface SectorPitch {
  test: RegExp;
  /** What the business is called mid-sentence, e.g. "your {noun}". */
  noun: string;
  /** Dental leads get the "Dr." honorific; everyone else gets a plain greeting. */
  useDrGreeting?: boolean;
}

export const SECTOR_PITCHES: SectorPitch[] = [
  { test: /dental|dentist|orthodont/i, noun: "clinic", useDrGreeting: true },
  { test: /restaurant|cafe|café|dhaba|bakery|food|diner|eatery/i, noun: "restaurant" },
  { test: /salon|spa|parlour|parlor|beauty/i, noun: "salon" },
  { test: /gym|fitness|crossfit|yoga|workout/i, noun: "gym" },
  { test: /clinic|hospital|physio|health/i, noun: "clinic" },
];

const DEFAULT_PITCH: Pick<SectorPitch, "noun" | "useDrGreeting"> = { noun: "business" };

export function pitchFor(category: string | null): Pick<SectorPitch, "noun" | "useDrGreeting"> {
  if (category) {
    const match = SECTOR_PITCHES.find((p) => p.test.test(category));
    if (match) return match;
  }
  return DEFAULT_PITCH;
}

/** Freeform pitch text — used for manual sends and as the readable copy stored on the message row. */
export function buildDemoPitchText({
  ownerName,
  category,
  demoLink,
  callNumber,
}: {
  ownerName: string | null;
  category: string | null;
  demoLink: string;
  callNumber?: string | null;
}): string {
  const { noun, useDrGreeting } = pitchFor(category);
  const greeting = useDrGreeting
    ? ownerName
      ? `Hi Dr. ${ownerName} 👋`
      : "Hi Dr. 👋"
    : ownerName
      ? `Hi ${ownerName} 👋`
      : "Hi there 👋";

  return [
    greeting,
    `Noticed your ${noun}'s great Google reviews — made you a free demo website.`,
    `🌐 ${demoLink}`,
    callNumber
      ? `Like it? Reply here or call ${callNumber} to make it official.`
      : `Like it? Reply here or call me to make it official.`,
  ].join("\n");
}

/** A single template body parameter — use {name} for named-variable templates ({{name}} syntax). */
export interface TemplateParam {
  name?: string;
  value: string;
}

/**
 * Body variables for the approved `demo_pitch_intro` Meta template.
 * Named variables: {{name}}, {{business_type}}, {{demo_link}}, {{call_number}}.
 */
export function buildDemoPitchTemplateParams({
  ownerName,
  category,
  demoLink,
  callNumber,
}: {
  ownerName: string | null;
  category: string | null;
  demoLink: string;
  callNumber: string;
}): TemplateParam[] {
  const { noun } = pitchFor(category);
  return [
    { name: "name", value: ownerName?.trim() || "there" },
    { name: "business_type", value: noun },
    { name: "demo_link", value: demoLink },
    { name: "call_number", value: callNumber },
  ];
}

/**
 * Body variables for the approved `reply_team_followup` Meta template.
 * Named variables: {{name}}, {{business_type}}, {{call_number}}.
 */
export function buildReplyFollowupTemplateParams({
  ownerName,
  category,
  callNumber,
}: {
  ownerName: string | null;
  category: string | null;
  callNumber: string;
}): TemplateParam[] {
  const { noun } = pitchFor(category);
  return [
    { name: "name", value: ownerName?.trim() || "there" },
    { name: "business_type", value: noun },
    { name: "call_number", value: callNumber },
  ];
}
