// The product name in one place, so a rebrand is one change (or one env var).
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Sekka";

// Where people write about their data or the terms. Empty hides the address on the
// privacy and terms pages, which then point to settings instead.
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";
