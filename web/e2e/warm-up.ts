// Loads each page once before the tests, so the first tests don't pay for the
// servers' cold start (loading route code, the first database connection).
const PAGES = ["/en/register", "/en/login", "/ar/login", "/en/applications", "/en/applications/new", "/en/applications/00000000-0000-4000-8000-000000000000", "/en/forgot-password"];

export default async function warmUp(): Promise<void> {
  for (const path of PAGES) {
    await fetch(`http://localhost:3000${path}`, { redirect: "manual" });
  }
  await fetch("http://localhost:8000/ready");
}
