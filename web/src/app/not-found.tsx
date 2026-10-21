import Link from "next/link";

// Requests the language routing can't handle (e.g. a file that doesn't exist).
export default function RootNotFound() {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "6rem 1rem" }}>
        <h1>Page not found</h1>
        <p>
          <Link href="/">Go to the home page</Link>
        </p>
      </body>
    </html>
  );
}
