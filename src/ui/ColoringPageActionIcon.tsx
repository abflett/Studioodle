/** Custom open pages: the action sits outside the book, away from its page art. */
export function ColoringPageActionIcon({ added }: { added: boolean }) {
  return <svg viewBox="0 0 32 32" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 12C12 8 7 7 3 10v15c4-2 9-1 13 2 4-3 9-4 13-2V13M16 12v15m0-15c2-2 4-3 6-3M5 28c4-1 8 0 11 2 4-2 8-3 11-2" />
    <path d={added ? 'm23 5 3 3 5-6' : 'M27 1v8m-4-4h8'} />
  </svg>;
}
