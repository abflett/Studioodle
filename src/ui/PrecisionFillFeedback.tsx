import type { Point } from '../editor/document';

function Cross({ elapsed }: { elapsed?: number }) {
  return <span className="precision-fill-cross">
    {(['top', 'right', 'bottom', 'left'] as const).map(direction =>
      <i key={direction} className={`aim-${direction}`} style={elapsed === undefined ? undefined : { animationDelay: `-${elapsed}ms` }} />)}
  </span>;
}

export function PrecisionFillFeedback({ aim, magnified, releasedAim }: {
  aim?: Point & { sequence: number };
  magnified: boolean;
  releasedAim?: Point & { elapsed: number };
}) {
  return <>
    {aim && <span key={aim.sequence} className={`precision-fill-aim ${magnified ? 'is-magnified' : 'is-holding'}`} aria-hidden="true" style={{ left: aim.x, top: aim.y }}><Cross /></span>}
    {releasedAim && <span className="precision-fill-aim is-released" aria-hidden="true" style={{ left: releasedAim.x, top: releasedAim.y }}><Cross elapsed={releasedAim.elapsed} /></span>}
  </>;
}
