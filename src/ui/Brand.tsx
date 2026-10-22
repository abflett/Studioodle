export function Brand({ decorative = false }: { decorative?: boolean }) {
  const Container = decorative ? 'span' : 'div';
  const Name = decorative ? 'span' : 'h1';
  return (
    <Container className="brand" aria-label={decorative ? undefined : "Studioodle"} aria-hidden={decorative || undefined}>
      <svg className="brand-icon" viewBox="0 0 180 180" aria-hidden="true">
        <rect className="brand-tile" x="18" y="18" width="144" height="144" rx="44" fill="currentColor" />
        <g transform="rotate(-9 90 90)">
          <path d="M49 42h65l21 23v65a12 12 0 0 1-12 12H49a12 12 0 0 1-12-12V54a12 12 0 0 1 12-12Z" fill="var(--brand-paper)" stroke="var(--brand-ink)" strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M113 43v22h21" fill="var(--brand-gold)" stroke="var(--brand-ink)" strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M57 111c-15-30 23-40 24-18s-15 29-14 11 32-26 37-7" fill="none" stroke="var(--brand-paint)" strokeWidth="8" strokeLinecap="round" />
        </g>
        <g transform="rotate(33 121 87)">
          <rect x="110" y="44" width="22" height="67" rx="5" fill="var(--brand-pencil)" stroke="var(--brand-ink)" strokeWidth="3.5" />
          <path d="m110 110 11 24 11-24" fill="var(--brand-gold)" stroke="var(--brand-ink)" strokeWidth="3.5" strokeLinejoin="round" />
          <path d="m117 125 4 9 4-9" fill="var(--brand-ink)" />
          <path d="M112 60h18" stroke="var(--brand-paper)" strokeWidth="5" />
        </g>
        <path className="brand-spark" d="m151 20 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" fill="var(--brand-gold)" />
        <circle cx="22" cy="135" r="7" fill="var(--brand-paint)" />
      </svg>
      <Name className="brand-name" aria-hidden="true">Studi<span className="brand-loop">oo</span>dle<span className="brand-dot">.</span></Name>
    </Container>
  );
}
