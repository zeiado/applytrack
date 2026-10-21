// Which pages need a session ("member") and which are only for visitors without one
// ("guest"). Paths are without the language prefix.
const MEMBER_ONLY = ["/applications", "/settings", "/dashboard"];
const GUEST_ONLY = ["/login", "/register"];

function under(path: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function protectedRoute(path: string): "member" | "guest" | null {
  if (under(path, MEMBER_ONLY)) return "member";
  if (under(path, GUEST_ONLY)) return "guest";
  return null;
}
