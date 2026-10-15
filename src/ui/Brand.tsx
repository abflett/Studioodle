export function Brand() {
  return (
    <div className="brand" aria-label="Studioodle">
      <svg className="brand-icon" viewBox="0 0 180 180" aria-hidden="true">
        <rect className="brand-tile" x="18" y="18" width="144" height="144" rx="44" fill="currentColor" />
        <g transform="rotate(-9 90 90)">
          <path d="M49 42h65l21 23v65a12 12 0 0 1-12 12H49a12 12 0 0 1-12-12V54a12 12 0 0 1 12-12Z" fill="#fff5df" stroke="#46584c" strokeWidth="4" strokeLinejoin="round" />
          <path d="M113 43v22h21" fill="#e7c46e" stroke="#46584c" strokeWidth="4" strokeLinejoin="round" />
          <path d="M57 111c-15-30 23-40 24-18s-15 29-14 11 32-26 37-7" fill="none" stroke="#a38bc9" strokeWidth="8" strokeLinecap="round" />
        </g>
        <g transform="rotate(33 121 87)">
          <rect x="110" y="44" width="22" height="67" rx="5" fill="#e9a07e" stroke="#46584c" strokeWidth="4" />
          <path d="m110 110 11 24 11-24" fill="#e7c46e" stroke="#46584c" strokeWidth="4" strokeLinejoin="round" />
          <path d="m117 125 4 9 4-9" fill="#46584c" />
          <path d="M112 60h18" stroke="#fff5df" strokeWidth="5" />
        </g>
        <path className="brand-spark" d="m151 20 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" fill="#e7c46e" />
        <circle cx="22" cy="135" r="7" fill="#b3a0d4" />
      </svg>
      <h1 className="brand-name" aria-hidden="true">Studi<span className="brand-loop">oo</span>dle<span className="brand-dot">.</span></h1>
    </div>
  );
}
