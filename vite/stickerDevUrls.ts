import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { normalizePath } from 'vite';
import type { Plugin } from 'vite';

/** In dev, eager URL globs otherwise create one JS request per SVG at startup.
 * Literal URLs keep images lazy. Production retains Vite's hashed asset imports. */
export function stickerDevUrls(): Plugin {
  let moduleId='', directory='';
  return {
    name:'sticker-dev-urls',apply:'serve',enforce:'pre',
    configResolved(config){moduleId=normalizePath(resolve(config.root,'src/editor/stickerUrls.ts'));directory=normalizePath(resolve(config.root,'src/assets/vector'));},
    configureServer(server){
      const refresh=(file:string)=>{
        const path=normalizePath(file);
        if(!path.startsWith(directory+'/')||!path.endsWith('.svg'))return;
        const modules=server.moduleGraph.getModulesByFile(moduleId);
        if(modules?.size){for(const module of modules)server.moduleGraph.invalidateModule(module);server.ws.send({type:'full-reload'});}
      };
      server.watcher.on('add',refresh).on('unlink',refresh);
      server.httpServer?.once('close',()=>{server.watcher.off('add',refresh).off('unlink',refresh);});
    },
    async transform(_code,id,options){
      if(options?.ssr||normalizePath(id.split('?')[0]!)!==moduleId)return;
      const names=(await readdir(directory)).filter(name=>name.endsWith('.svg')).sort();
      const entries=names.map(name=>{const path=`../assets/vector/${name}`;return `${JSON.stringify(path)}:new URL(${JSON.stringify(path)},import.meta.url).href`;});
      return `const svgUrls={${entries.join(',')}};export function vectorStickerUrl(kind){return svgUrls['../assets/vector/'+kind+'.svg'];}`;
    },
  };
}
