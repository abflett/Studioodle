import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planAssetRepairs } from '../scripts/artwork-review-repairs.mjs';
import { selectBatchAssets } from '../scripts/sticker-batch-selection.mjs';
const svg='<svg><g id="regions"><path id="region-1" d="M0 0H90V90H0Z"/><path id="region-2" transform="matrix(2 0 0 2 100 0)" d="M0 0H10V10H0Z"/></g></svg>';
const asset={id:'test',source:'source.svg',width:150,height:100};
const marker=(id,kind,x,y,regionId)=>({id,kind,x,y,regionId,note:''});
test('cutout planning checks transformed region geometry, deduplicates and preserves ambiguous requests',()=>{
 const markers=[marker('a','remove-region',110,10,2),marker('b','remove-region',115,10,2),marker('c','remove-region',5,5,1),marker('d','remove-region',145,95,0),marker('e','remove-region',110,10,1)];
 const result=planAssetRepairs(asset,svg,{notes:'',markers});
 assert.deepEqual(result.cutouts,[{regionId:2,point:[110,10]}]);
 assert.deepEqual(result.operations.map(o=>o.status),['planned','planned','deferred','already-transparent','deferred']);
});
test('an add/fill request inside a marked region prevents automatic removal',()=>{
 const result=planAssetRepairs(asset,svg,{notes:'',markers:[marker('a','remove-region',110,10,2),marker('b','add-region',112,12,2)]});
 assert.equal(result.cutouts.length,0);assert.equal(result.operations[0].status,'deferred');assert.match(result.operations[0].reason,/also contains/);
});
test('partial batches reject unknown or duplicate targets rather than widening their scope',()=>{
 const manifest=[{id:'a'},{id:'b'}];assert.deepEqual(selectBatchAssets(manifest,['b']),[{id:'b'}]);
 assert.throws(()=>selectBatchAssets(manifest,['a','a']));assert.throws(()=>selectBatchAssets(manifest,['c']));assert.throws(()=>selectBatchAssets(manifest,[]));
});
test('cutout planning retains explicit proposed curves without silently applying them',()=>{
 const line={id:'closure',a:{x:1,y:2},b:{x:3,y:4},control:null,width:1,fillSeed:{x:2,y:3}};
 const result=planAssetRepairs(asset,svg,{notes:'',markers:[],closures:[line]});
 assert.deepEqual(result.proposedLines,[line]);assert.equal(result.cutouts.length,0);
});
