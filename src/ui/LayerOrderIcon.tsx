/** The arrow stays outside the page silhouettes for a clear direction cue. */
export function LayerOrderIcon({ direction }: { direction: 'backward' | 'forward' }) {
  const forward = direction === 'forward';
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {forward ? <>
      <rect x="3" y="9" width="9" height="11" rx="1.3" opacity=".65" />
      <rect x="8" y="12" width="9" height="11" rx="1.3" fill="currentColor" stroke="none" />
      <path d="M4 5C12-1 22 2 22 10" />
      <path d="m19.5 7.5 2.5 2.5 1.5-3" />
    </> : <>
      <rect x="7" y="1" width="9" height="11" rx="1.3" fill="currentColor" stroke="none" />
      <rect x="12" y="4" width="9" height="11" rx="1.3" fill="var(--surface)" />
      <path d="M20 19C12 25 2 22 2 14" />
      <path d="m4.5 16.5-2.5-2.5-1.5 3" />
    </>}
  </svg>;
}
