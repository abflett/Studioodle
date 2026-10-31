/** Compare the drawer against the same uncovered viewport pixels. */
export async function checkRibbonBackground({evaluate,cdp}) {
 await evaluate("import('/src/ui/styles.css')");
 await evaluate(`(async()=>{for(let i=0;i<200&&!document.querySelector('#root')?.firstElementChild;i++)await new Promise(r=>setTimeout(r,25));if(!document.querySelector('#root')?.firstElementChild)throw Error('App did not mount');})()`);
 const results=[];
 for(const theme of ['light','dark']){
  await evaluate(String.raw`(async()=>{
   const host=document.createElement('main');host.id='ribbon-background-test';host.className='art-studio';host.dataset.previousTheme=document.documentElement.dataset.theme??'';
   document.documentElement.dataset.theme=${JSON.stringify(theme)};
   host.style.cssText='position:fixed;inset:0;z-index:9999';
   host.innerHTML='<div class="ribbon-shell" style="box-shadow:none"><header class="art-ribbon main-ribbon" style="height:60px;padding:0"></header><div class="art-ribbon sticker-ribbon" style="width:min(700px,calc(100% - 20px));height:100px;box-shadow:none;visibility:hidden"></div></div><section class="art-canvas"></section>';
   document.body.append(host);
   const source=getComputedStyle(host).backgroundImage.match(/url\(["']?([^"')]+)/)[1];
   await new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=reject;image.src=source;});
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  })()`);
  try{
   const before=await cdp('Page.captureScreenshot',{format:'png'});
   const box=await evaluate(`(()=>{const drawer=document.querySelector('#ribbon-background-test .sticker-ribbon');drawer.style.visibility='visible';const b=drawer.getBoundingClientRect();return {left:b.left,top:b.top,right:b.right,bottom:b.bottom};})()`);
   const after=await cdp('Page.captureScreenshot',{format:'png'});
   const difference=await evaluate(`(async()=>{
    const read=async(data)=>{const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return {pixels:ctx.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width};};
    const a=await read(${JSON.stringify(before.data)}),b=await read(${JSON.stringify(after.data)}),box=${JSON.stringify(box)};let max=0,count=0,total=0;
    for(let y=Math.ceil(box.top+20);y<box.bottom-20;y+=8)for(let x=Math.ceil(box.left+20);x<box.right-20;x+=8)for(let channel=0;channel<3;channel++){const i=(y*a.width+x)*4+channel,d=Math.abs(a.pixels[i]-b.pixels[i]);max=Math.max(max,d);total+=d;count++;}
    return {max,mean:total/count,count};
   })()`);
   if(!difference.count||difference.max>2||difference.mean>.25)throw Error('Drawer background differs from workspace: '+JSON.stringify({theme,...difference}));
   results.push({theme,...difference});
  }finally{
   await evaluate(`(()=>{const host=document.querySelector('#ribbon-background-test');if(host.dataset.previousTheme)document.documentElement.dataset.theme=host.dataset.previousTheme;else delete document.documentElement.dataset.theme;host.remove();})()`);
  }
 }
 return results;
}
