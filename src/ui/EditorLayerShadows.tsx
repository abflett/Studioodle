import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useLatest } from './useLatest';

type Box = { x: number; y: number; width: number; height: number };
const rectangle = (b: Box) => `M${b.x} ${b.y}h${b.width}v${b.height}h${-b.width}Z`;
function drawerShape(b: Box, radius: number) {
  const r = Math.min(radius, b.width / 2, b.height / 2), right = b.x + b.width, bottom = b.y + b.height;
  return `M${b.x} ${b.y}H${right}V${bottom-r}Q${right} ${bottom} ${right-r} ${bottom}H${b.x+r}Q${b.x} ${bottom} ${b.x} ${bottom-r}Z`;
}
const shadows = [ ['ribbon-to-submenu',1], ['ribbon-to-paper',2], ['ribbon-to-desk',3], ['submenu-to-paper',1], ['submenu-to-desk',2] ] as const;
/** Small CSS casters clipped to receivers; no artwork rasterization or shadow-driven React renders. */
export function EditorLayerShadows({ studio, viewKey, drawerVisible, hidden, focused }: {
  studio: RefObject<HTMLElement | null>; viewKey: string; drawerVisible: boolean; hidden: boolean; focused: boolean;
}) {
  const overlay = useRef<HTMLDivElement>(null);
  const measure = useLatest(() => {
    const element = overlay.current, root = studio.current ?? element?.closest<HTMLElement>('.art-studio');
    if (!root || !element) return;
    const bounds = root.getBoundingClientRect();
    const read = (selector: string): Box | undefined => {
      const b = root.querySelector(selector)?.getBoundingClientRect();
      return b && b.width && b.height ? { x: b.left-bounds.left, y: b.top-bounds.top, width: b.width, height: b.height } : undefined;
    };
    const ribbon = hidden ? undefined : read('.main-ribbon'), drawer = hidden ? undefined : read('.sticker-ribbon');
    const drawerRadius = parseFloat(getComputedStyle(root.querySelector('.sticker-ribbon') ?? root).borderBottomLeftRadius) || 0;
    const drawerPath = drawer ? drawerShape(drawer, drawerRadius) : '';
    const paper = focused ? undefined : read('.canvas-host');
    const full = rectangle({x:0,y:0,width:bounds.width,height:bounds.height});
    const outsidePaper = full + (paper ? rectangle(paper) : '');
    const outsideDrawer = full + drawerPath;
    const outsideRibbon = full + (ribbon ? rectangle(ribbon) : '');
    const configure = (name: string, caster: Box | undefined, receiver: string | undefined, exclusion: string) => {
      const region = element.querySelector<HTMLElement>(`[data-layer-shadow="${name}"]`)!;
      region.hidden = !caster || !receiver;
      if (!caster || !receiver) return;
      region.style.clipPath = `path(evenodd, "${receiver}")`;
      const inner = region.firstElementChild as HTMLElement, frame = inner.firstElementChild as HTMLElement;
      inner.style.clipPath = `path(evenodd, "${exclusion}")`;
      Object.assign(frame.style,{left:`${caster.x}px`,top:`${caster.y}px`,width:`${caster.width}px`,height:`${caster.height}px`});
    };
    configure('ribbon-to-submenu',ribbon,drawer && drawerPath,outsideRibbon);
    configure('ribbon-to-paper',ribbon,paper && rectangle(paper),outsideDrawer);
    configure('ribbon-to-desk',ribbon,outsidePaper,outsideDrawer);
    configure('submenu-to-paper',drawer,paper && rectangle(paper),outsideRibbon);
    configure('submenu-to-desk',drawer,outsidePaper,outsideRibbon);
  });
  useLayoutEffect(() => { measure.current(); }, [measure,viewKey,drawerVisible,hidden,focused]);
  useLayoutEffect(() => {
    const root = studio.current ?? overlay.current?.closest<HTMLElement>('.art-studio');
    if (!root) return;
    const observer = new ResizeObserver(() => measure.current());
    observer.observe(root);
    for (const element of root.querySelectorAll('.main-ribbon, .sticker-ribbon, .canvas-host')) observer.observe(element);
    return () => observer.disconnect();
  }, [studio,measure,drawerVisible]);
  return <div ref={overlay} className="editor-layer-shadows" aria-hidden="true">
    {shadows.map(([name,tier]) => <div key={name} className="layer-shadow-clip" data-layer-shadow={name} hidden>
      <div className="layer-shadow-clip"><div className={`layer-shadow-caster shadow-tier-${tier}`} data-shadow={name} data-tier={tier} /></div>
    </div>)}
  </div>;
}
