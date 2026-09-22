// Four-colour "spark" mark in the Google palette. This is a custom mark, not
// the Google Cloud logo — if you have brand approval to use the official logo,
// drop the SVG in public/ and swap it in here.
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 2c1.5 9.5 4.5 13.5 12 16-7.5 2.5-10.5 6.5-12 16-1.5-9.5-4.5-13.5-12-16 7.5-2.5 10.5-6.5 12-16z" fill="#4285F4" />
      <path d="M37 26c.9 5.2 2.6 7.4 7 8.8-4.4 1.4-6.1 3.6-7 8.8-.9-5.2-2.6-7.4-7-8.8 4.4-1.4 6.1-3.6 7-8.8z" fill="#EA4335" />
      <path d="M12 30c.7 4 2 5.7 5.4 6.8-3.4 1.1-4.7 2.8-5.4 6.8-.7-4-2-5.7-5.4-6.8C10 35.7 11.3 34 12 30z" fill="#FBBC04" />
      <circle cx="35" cy="10" r="3.2" fill="#34A853" />
    </svg>
  );
}

export function GoogleDots() {
  return (
    <span className="google-dots" aria-hidden="true">
      <i style={{ background: "#4285F4" }} />
      <i style={{ background: "#EA4335" }} />
      <i style={{ background: "#FBBC04" }} />
      <i style={{ background: "#34A853" }} />
    </span>
  );
}
