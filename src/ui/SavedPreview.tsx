import { paperSize } from '../editor/document';
import type { SavedPicture } from '../editor/storage';
const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
export function SavedPreview({ picture }: { picture: SavedPicture }) {
  const { width, height } = paperSize(picture.format);
  return <svg className="saved-preview" viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ background: picture.background }}>
    <rect width={width} height={height} fill={picture.background} />
    {picture.marks.map((mark, index) => mark.kind === 'stroke' ? <g key={index} fill={hex(mark.color)}>
      <polyline points={mark.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={hex(mark.color)} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      {mark.points.length === 1 && <circle cx={mark.points[0]!.x} cy={mark.points[0]!.y} r="5" />}
    </g> : <g key={index} transform={`translate(${mark.x},${mark.y})`} stroke="#39483e" strokeWidth="5">
      {mark.kind === 'tree' ? <><rect x="-22" width="44" height="120" rx="8" fill="#c99569" /><rect x="-95" y="-110" width="190" height="160" rx="65" fill={hex(mark.color)} /></> : mark.kind === 'circle' ? <circle r={80} fill={hex(mark.color)} /> : mark.kind === 'square' ? <rect x={-80} y={-80} width={160} height={160} fill={hex(mark.color)} /> : mark.kind === 'triangle' ? <path d="M0 -85 -85 75 85 75Z" fill={hex(mark.color)} /> : <>
        <path d="M0 0v120" stroke="#87b999" strokeWidth="12" />
        {Array.from({ length: 5 }, (_, i) => { const angle = i * Math.PI * 2 / 5 - Math.PI / 2; return <circle key={i} cx={Math.cos(angle) * 42} cy={Math.sin(angle) * 42} r="32" fill={hex(mark.color)} />; })}
        <circle r="26" fill="#e7c46e" />
      </>}
    </g>)}
  </svg>;
}

