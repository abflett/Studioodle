/** An explicit target set keeps partial rebuilds and their audits in agreement. */
export function selectBatchAssets(manifest,ids){
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)throw Error('Batch target IDs must be a nonempty unique array');
 const selected=ids.map(id=>{const asset=manifest.find(asset=>asset.id===id);if(!asset)throw Error(`Unknown batch asset: ${id}`);return asset;});
 return selected;
}
