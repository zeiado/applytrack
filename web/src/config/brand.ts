// The product name in one place, so a rebrand is one change (or one env var).
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Sekka";

// Where people write about their data or the terms. Empty hides the address on the
// privacy and terms pages, which then point to settings instead.
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";

// A short feedback form (for example Tally or Google Forms). Only https links count;
// empty hides the feedback links.
const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL ?? "";
export const FEEDBACK_URL = feedbackUrl.startsWith("https://") ? feedbackUrl : "";
