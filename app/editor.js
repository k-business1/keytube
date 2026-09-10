// ── editor.js — KeyVideo Editor Advanced ────────────────────
'use strict';

var _user=null,_tool='select',_playing=false,_muted=false;
var _video=null,_canvas=null,_ctx=null;
var _overCanvas=null,_overCtx=null;
var _drawCanvas=null,_drawCtx=null;
var _rafId=null;
var _layers=[],_sel=null;
var _undoStack=[],_redoStack=[];
var _trimStart=0,_trimEnd=0,_trimActive=false,_trimDragging=null;
var _drawing=false,_brush={color:'#ff2d55',size:8,opacity:1,tool:'pen'};
var _audioCtx=null,_audioBuffer=null,_audioSource=null,_audioGain=null;
var _audioTracks=[];
var _vidLayers=[];
var _drag=null,_resize=null,_pinchDist=null;
var _bannerCtx=null,_bannerItems=[];
var _exportCancelFlag=false;

var COLORS=['#ffffff','#000000','#ff2d55','#0a84ff','#30d158','#ffd60a','#bf5af2','#ff9f0a','#64d2ff','#ff6961','#ffb480','#c1e1c1'];
var STICKERS=['😂','❤','🔥','😍','🤣','💯','😎','🎬','⭐','🏆','👍','👏','🎉','🎊','💥','✨','🌟','💫','🤩','😆','😜','🤪','😏','🥳','🎭','🎵','🎶','🎤','📱','💡','🚀','💪','🙌','👀','💬','📢','⚡','🌈','🦁','🐯','🍿','🎯','🏅','🥇','🎮','🕹','📸','🎥','📺','🌍'];

// ── INIT ─────────────────────────────────────────────────────
window.onload=function(){
  var u=typeof getUser==='function'?getUser():null;
  if(!u){document.getElementById('evGate').style.display='flex';document.getElementById('evApp').style.display='none';return;}
  _user=u;
  document.getElementById('evGate').style.display='none';
  document.getElementById('evApp').style.display='flex';
  _canvas=document.getElementById('evCanvas');
  _ctx=_canvas.getContext('2d');
  _overCanvas=document.getElementById('evOverlayCanvas');
  _overCtx=_overCanvas.getContext('2d');
  _drawCanvas=document.getElementById('evDrawCanvas');
  _drawCtx=_drawCanvas.getContext('2d');
  _video=document.getElementById('evVideo');
  var bc=document.getElementById('evBannerCanvas');
  _bannerCtx=bc.getContext('2d');
  clearBannerCanvas();
  _video.ontimeupdate=onTimeUpdate;
  _video.onended=function(){setPlay(false);};
  _video.onloadedmetadata=onVideoLoaded;
  _overCanvas.addEventListener('mousedown',onMD);
  _overCanvas.addEventListener('mousemove',onMM);
  _overCanvas.addEventListener('mouseup',onMU);
  _overCanvas.addEventListener('dblclick',onDbl);
  _overCanvas.addEventListener('wheel',function(e){if(!_sel)return;e.preventDefault();applyZoom(_sel,e.deltaY<0?1.08:0.92);},{passive:false});
  _overCanvas.addEventListener('touchstart',function(e){if(e.touches.length===2){_pinchDist=touchDist(e.touches);return;}onMD(t2m(e));},{passive:false});
  _overCanvas.addEventListener('touchmove',function(e){e.preventDefault();if(e.touches.length===2){if(_sel){var d=touchDist(e.touches);if(_pinchDist)applyZoom(_sel,d/_pinchDist);_pinchDist=d;}return;}onMM(t2m(e));},{passive:false});
  _overCanvas.addEventListener('touchend',function(e){if(e.touches.length<2)_pinchDist=null;onMU(t2m(e));},{passive:false});
  var ca=document.getElementById('evCanvasArea');
  ca.addEventListener('dragover',function(e){e.preventDefault();});
  ca.addEventListener('drop',function(e){e.preventDefault();var f=e.dataTransfer.files[0];if(f&&f.type.startsWith('video/'))loadVideoBlob(f);});
  var ad=document.getElementById('audioDrop');
  if(ad){ad.addEventListener('dragover',function(e){e.preventDefault();ad.classList.add('over');});ad.addEventListener('dragleave',function(){ad.classList.remove('over');});ad.addEventListener('drop',function(e){e.preventDefault();ad.classList.remove('over');var f=e.dataTransfer.files[0];if(f&&f.type.startsWith('audio/'))loadAudioBlob(f);});}
  setupTrimHandles();
  document.addEventListener('keydown',onKey);
  buildStickers();
  buildColors('txtColorRow',function(c){document.getElementById('txtClr').value=c;});
  buildColors('drawColorRow',function(c){document.getElementById('drClr').value=c;updBrush();});
  updBrush();
  updateWmPrev();
  document.addEventListener('click',function(e){
    if(window.innerWidth>768)return;
    var panel=document.getElementById('evRight');
    if(!panel||!panel.classList.contains('open'))return;
    if(!panel.contains(e.target)&&!e.target.closest('.ev-stool,.ev-mob-tool,.ev-ptab'))panel.classList.remove('open');
  });
};

// ── TOOL ─────────────────────────────────────────────────────
function setTool(t){
  _tool=t;
  document.querySelectorAll('.ev-stool').forEach(function(b){b.classList.remove('act');});
  var sb=document.getElementById('st-'+t);if(sb)sb.classList.add('act');
  document.querySelectorAll('.ev-mob-tool').forEach(function(b){b.classList.remove('act');});
  var mb=document.getElementById('mob-'+t);if(mb)mb.classList.add('act');
  switchPanel(t);
  var r=document.getElementById('evRight');if(r)r.classList.add('open');
  if(_overCanvas)_overCanvas.style.cursor=t==='draw'?'crosshair':'default';
}
function switchPanel(t){
  document.querySelectorAll('.ev-ptab').forEach(function(b){b.classList.remove('act');});
  document.querySelectorAll('.ev-section').forEach(function(s){s.classList.remove('act');});
  var pt=document.getElementById('pt-'+t);if(pt)pt.classList.add('act');
  var sc=document.getElementById('sec-'+t);if(sc)sc.classList.add('act');
}

// ── FILE ─────────────────────────────────────────────────────
function openFile(){document.getElementById('evFileIn').click();}
function loadVideo(input){var f=input.files[0];if(!f)return;loadVideoBlob(f);input.value='';}
function loadVideoBlob(f){
  evToast('Loading…');
  _video.src=URL.createObjectURL(f);
  _video.load();
  document.getElementById('evProjName').textContent=f.name.replace(/\.[^.]+$/,'');
}
function onVideoLoaded(){
  var W=_video.videoWidth||1280,H=_video.videoHeight||720;
  var ca=document.getElementById('evCanvasArea');
  var sc=Math.min((ca.clientWidth-10)/W,(ca.clientHeight-10)/H,1);
  var cW=Math.round(W*sc),cH=Math.round(H*sc);
  [_canvas,_overCanvas,_drawCanvas].forEach(function(c){c.width=W;c.height=H;c.style.width=cW+'px';c.style.height=cH+'px';});
  document.getElementById('evCanvasWrap').style.display='inline-block';
  document.getElementById('evHint').style.display='none';
  _trimStart=0;_trimEnd=_video.duration;_trimActive=false;
  var ti=document.getElementById('trimEndIn');if(ti)ti.value=_video.duration.toFixed(1);
  updateTrimUI();enableButtons(true);startRender();setPlay(true);
  evToast('Video loaded ✓','ok');
  setTimeout(bannerFromFrame,1000);
}
function enableButtons(on){
  ['evExportBtn','evTrimBtn','evUploadBtn','mobExportBtn','mobTrimBtn','mobUploadBtn'].forEach(function(id){var el=document.getElementById(id);if(el)el.disabled=!on;});
}

// ── RENDER ───────────────────────────────────────────────────
function startRender(){cancelAnimationFrame(_rafId);function loop(){renderFrame();_rafId=requestAnimationFrame(loop);}loop();}
function renderFrame(){
  if(!_canvas||!_video||!_video.readyState)return;
  _ctx.clearRect(0,0,_canvas.width,_canvas.height);
  _ctx.drawImage(_video,0,0,_canvas.width,_canvas.height);
  _vidLayers.forEach(function(vl){
    if(vl.video&&vl.video.readyState>=2){
      _ctx.save();_ctx.globalAlpha=(vl.opacity||100)/100;
      _ctx.drawImage(vl.video,vl.x,vl.y,vl.w,vl.h);_ctx.restore();
      if(vl===_sel){_ctx.save();_ctx.strokeStyle='#0a84ff';_ctx.lineWidth=2;_ctx.setLineDash([5,3]);_ctx.strokeRect(vl.x-5,vl.y-5,vl.w+10,vl.h+10);_ctx.setLineDash([]);_ctx.fillStyle='#0a84ff';_ctx.fillRect(vl.x+vl.w+5,vl.y+vl.h+5,10,10);_ctx.restore();}
    }
  });
  _ctx.drawImage(_drawCanvas,0,0);
  _overCtx.clearRect(0,0,_overCanvas.width,_overCanvas.height);
  _layers.forEach(function(l){drawLayer(_overCtx,l,l===_sel);});
}

// ── DRAW LAYER ───────────────────────────────────────────────
function drawLayer(ctx,l,sel){
  ctx.save();ctx.globalAlpha=(l.opacity||100)/100;
  if(l.type==='sticker'){ctx.font=(l.size||64)+'px serif';ctx.textBaseline='top';ctx.fillText(l.emoji,l.x,l.y);}
  else if(l.type==='text'){
    var fs=l.fontSize||36,fw=(l.bold?'bold ':'')+(l.italic?'italic ':'');
    ctx.font=fw+fs+'px '+(l.font||'Arial');ctx.textBaseline='top';
    if(l.bg&&l.bg!=='none'){var tw=ctx.measureText(l.text||'').width;ctx.fillStyle=l.bg;ctx.fillRect(l.x-4,l.y-4,tw+8,fs+8);}
    if(l.stroke&&l.stroke!=='none'){ctx.strokeStyle=l.stroke;ctx.lineWidth=2;ctx.strokeText(l.text||'',l.x,l.y);}
    ctx.fillStyle=l.color||'#fff';ctx.fillText(l.text||'',l.x,l.y);
  }
  else if(l.type==='watermark'){
    if(l.wmType==='image'&&l.img){var b0=layerBounds(l),p0=wmPos(l.position,b0.w,b0.h);ctx.drawImage(l.img,p0.x,p0.y,b0.w,b0.h);}
    else{var sz=l.size||80,fs2=Math.round(sz*.22);ctx.font='bold '+fs2+'px Arial';ctx.textBaseline='top';var txt=l.text||'KEYTUBE',tw2=ctx.measureText(txt).width,pos=wmPos(l.position,tw2,sz);if(l.img)ctx.drawImage(l.img,pos.x,pos.y,sz,sz);ctx.fillStyle=l.color||'#fff';ctx.fillText(txt,pos.x+(l.img?sz+6:0),pos.y+(l.img?sz/2-fs2/2:0));}
  }
  if(sel){var b=layerBounds(l);ctx.globalAlpha=1;ctx.strokeStyle='#0a84ff';ctx.lineWidth=2;ctx.setLineDash([5,3]);ctx.strokeRect(b.x-5,b.y-5,b.w+10,b.h+10);ctx.setLineDash([]);ctx.fillStyle='#0a84ff';ctx.fillRect(b.x+b.w+5,b.y+b.h+5,10,10);}
  ctx.restore();
}
function layerBounds(l){
  if(l.type==='sticker')return{x:l.x,y:l.y,w:l.size||64,h:l.size||64};
  if(l.type==='text'){_overCtx.font=(l.fontSize||36)+'px '+(l.font||'Arial');return{x:l.x,y:l.y,w:_overCtx.measureText(l.text||'').width,h:l.fontSize||36};}
  if(l.video)return{x:l.x||0,y:l.y||0,w:l.w||100,h:l.h||100};
  return{x:l.x||0,y:l.y||0,w:l.w||l.size||80,h:l.h||l.size||80};
}
function wmPos(pos,w,h){
  var cW=_canvas.width,cH=_canvas.height,p=18;
  if(pos==='tl')return{x:p,y:p};if(pos==='tr')return{x:cW-w-p,y:p};
  if(pos==='bl')return{x:p,y:cH-h-p};if(pos==='br')return{x:cW-w-p,y:cH-h-p};
  return{x:cW/2-w/2,y:cH/2-h/2};
}

// ── ZOOM ─────────────────────────────────────────────────────
function touchDist(t){var dx=t[0].clientX-t[1].clientX,dy=t[0].clientY-t[1].clientY;return Math.sqrt(dx*dx+dy*dy);}
function applyZoom(l,f){
  if(l.video){var b=layerBounds(l);l.w=Math.max(30,Math.round(b.w*f));l.h=Math.round(l.w*((l.video.videoHeight||9)/(l.video.videoWidth||16)));return;}
  if(l.type==='watermark'&&l.wmType==='image'){var b2=layerBounds(l);l.w=Math.max(20,Math.round(b2.w*f));l.h=Math.max(20,Math.round(b2.h*f));}
  else if(l.type==='watermark'){l.size=Math.max(20,Math.round((l.size||80)*f));}
  else if(l.type==='text'){l.fontSize=Math.max(8,Math.round((l.fontSize||36)*f));}
  else{l.size=Math.max(12,Math.round((l.size||64)*f));}
}

// ── STICKERS ─────────────────────────────────────────────────
function buildStickers(){var g=document.getElementById('stkGrid');if(!g)return;STICKERS.forEach(function(e){var b=document.createElement('div');b.className='stk-btn';b.textContent=e;b.onclick=function(){addSticker(e);};g.appendChild(b);});}
function addSticker(e){if(!_video||!_video.src){evToast('Open a video first','err');return;}pushUndo();var l={id:'s'+Date.now(),type:'sticker',emoji:e,x:_canvas.width/2-32,y:_canvas.height/2-32,size:64,opacity:100,name:e+' Sticker'};_layers.push(l);_sel=l;updLayers();updSelCtrl();evToast(e+' added!','ok');}

// ── TEXT ─────────────────────────────────────────────────────
var _txtBold=true,_txtItal=false;
function toggleTxtBold(){_txtBold=!_txtBold;document.getElementById('txtBoldBtn').style.color=_txtBold?'#fff':'var(--t2)';}
function toggleTxtItal(){_txtItal=!_txtItal;document.getElementById('txtItalBtn').style.color=_txtItal?'#fff':'var(--t2)';}
function addText(){
  if(!_video||!_video.src){evToast('Open a video first','err');return;}
  var txt=(document.getElementById('txtIn').value||'').trim();if(!txt){evToast('Enter text first','err');return;}
  pushUndo();
  var l={id:'t'+Date.now(),type:'text',text:txt,x:_canvas.width/2-80,y:_canvas.height/2-20,fontSize:parseInt(document.getElementById('txtSz').value)||36,font:document.getElementById('txtFont').value,color:document.getElementById('txtClr').value,bg:document.getElementById('txtBg').value,stroke:document.getElementById('txtStroke').value,bold:_txtBold,italic:_txtItal,opacity:100,name:'"'+txt.slice(0,14)+'"'};
  _layers.push(l);_sel=l;updLayers();updSelCtrl();evToast('Text added!','ok');
}

// ── WATERMARK ────────────────────────────────────────────────
function addKeytubeWM(){if(!_video||!_video.src){evToast('Open a video first','err');return;}pushUndo();var l={id:'wm'+Date.now(),type:'watermark',text:'KEYTUBE',wmType:'keytube',position:'br',size:80,color:'#ffffff',opacity:70,name:'🔖 KEYTUBE WM'};loadWMImg(l);_layers.push(l);_sel=l;updLayers();updSelCtrl();evToast('Watermark added ✓','ok');}
function addWatermark(){
  if(!_video||!_video.src){evToast('Open a video first','err');return;}pushUndo();
  var type=document.getElementById('wmType').value;
  var l={id:'wm'+Date.now(),type:'watermark',wmType:type,text:type==='keytube'?'KEYTUBE':(document.getElementById('wmTxt').value||'@Channel'),position:document.getElementById('wmPos').value,size:parseInt(document.getElementById('wmSz').value)||80,opacity:parseInt(document.getElementById('wmOp').value)||70,color:'#ffffff',name:'🔖 Watermark'};
  if(type!=='text')loadWMImg(l);_layers.push(l);_sel=l;updLayers();updSelCtrl();evToast('Watermark added ✓','ok');
}
function loadWMImg(l){var isPages=window.location.pathname.indexOf('/pages/')!==-1;var src=(isPages?'../':'')+'imagelib/watermark.png';var img=new Image();img.crossOrigin='anonymous';img.onload=function(){l.img=img;};img.onerror=function(){l.img=null;};img.src=src;}
function updateWmPrev(){var type=document.getElementById('wmType').value;document.getElementById('wmTxtRow').style.display=type==='keytube'?'none':'';document.getElementById('wmPrev').textContent=type==='keytube'?'Preview: [KEYTUBE logo] bottom-right':type==='text'?'Preview: "'+document.getElementById('wmTxt').value+'"':'Preview: Logo + "'+document.getElementById('wmTxt').value+'"';}
function loadCustomWmImage(input){var f=input.files[0];if(!f)return;if(!_video||!_video.src){evToast('Open a video first','err');input.value='';return;}var img=new Image();img.onload=function(){pushUndo();var ar=img.width/img.height;var l={id:'wm'+Date.now(),type:'watermark',wmType:'image',text:'',position:'br',w:100,h:Math.round(100/ar),opacity:100,img:img,name:'🖼 Image WM'};_layers.push(l);_sel=l;updLayers();updSelCtrl();evToast('Image watermark added ✓','ok');};img.onerror=function(){evToast('Could not load image','err');};img.src=URL.createObjectURL(f);input.value='';}

// ── DRAW ─────────────────────────────────────────────────────
function updBrush(){_brush.color=document.getElementById('drClr').value;_brush.size=parseInt(document.getElementById('drSz').value)||8;_brush.opacity=parseInt(document.getElementById('drOp').value)/100;_brush.tool=document.getElementById('drTool').value;}
function clrDraw(){_drawCtx.clearRect(0,0,_drawCanvas.width,_drawCanvas.height);evToast('Drawing cleared');}

// ── CANVAS EVENTS ────────────────────────────────────────────
function getCP(e){var r=_overCanvas.getBoundingClientRect();var sx=_canvas.width/r.width,sy=_canvas.height/r.height;return{x:(e.clientX-r.left)*sx,y:(e.clientY-r.top)*sy};}
function t2m(e){if(e.preventDefault)e.preventDefault();var t=e.touches&&e.touches[0]?e.touches[0]:e.changedTouches&&e.changedTouches[0]?e.changedTouches[0]:{clientX:0,clientY:0};return{clientX:t.clientX,clientY:t.clientY,preventDefault:function(){}};}
function onMD(e){
  if(e.preventDefault)e.preventDefault();var p=getCP(e);
  if(_tool==='draw'){_drawing=true;_drawCtx.beginPath();_drawCtx.moveTo(p.x,p.y);return;}
  if(_sel){var b=layerBounds(_sel);if(Math.abs(p.x-(b.x+b.w+5))<14&&Math.abs(p.y-(b.y+b.h+5))<14){_resize={layer:_sel,sx:p.x,sy:p.y,ow:b.w,oh:b.h};return;}}
  var hit=null;
  for(var i=_layers.length-1;i>=0;i--){var b2=layerBounds(_layers[i]);if(p.x>=b2.x-8&&p.x<=b2.x+b2.w+8&&p.y>=b2.y-8&&p.y<=b2.y+b2.h+8){hit=_layers[i];break;}}
  if(!hit){for(var j=_vidLayers.length-1;j>=0;j--){var vl=_vidLayers[j];if(p.x>=vl.x-8&&p.x<=vl.x+vl.w+8&&p.y>=vl.y-8&&p.y<=vl.y+vl.h+8){hit=vl;break;}}}
  if(hit){_sel=hit;_drag={layer:hit,sx:p.x,sy:p.y,ox:hit.x||0,oy:hit.y||0};updSelCtrl();}
  else{_sel=null;updSelCtrl();}
}
function onMM(e){
  if(e.preventDefault)e.preventDefault();var p=getCP(e);
  if(_tool==='draw'&&_drawing){_drawCtx.globalCompositeOperation=_brush.tool==='eraser'?'destination-out':'source-over';_drawCtx.globalAlpha=_brush.opacity;_drawCtx.strokeStyle=_brush.color;_drawCtx.lineWidth=_brush.size;_drawCtx.lineCap='round';_drawCtx.lineJoin='round';_drawCtx.lineTo(p.x,p.y);_drawCtx.stroke();_drawCtx.beginPath();_drawCtx.moveTo(p.x,p.y);return;}
  if(_resize){var dx=p.x-_resize.sx,sc=1+dx/(_resize.ow||100);if(sc>0.1){var l=_resize.layer;if(l.video){l.w=Math.max(30,Math.round(_resize.ow*sc));l.h=Math.round(l.w*((l.video.videoHeight||9)/(l.video.videoWidth||16)));}else if(l.type==='text'){l.fontSize=Math.max(8,Math.round(_resize.oh*sc));}else if(l.type==='watermark'&&l.wmType==='image'){l.w=Math.max(20,Math.round(_resize.ow*sc));l.h=Math.max(20,Math.round(_resize.oh*sc));}else if(l.type==='watermark'){l.size=Math.max(20,Math.round(_resize.ow*sc));}else{l.size=Math.max(12,Math.round(_resize.ow*sc));}}return;}
  if(_drag&&_drag.layer){_drag.layer.x=Math.max(0,Math.min(_canvas.width-10,Math.round(_drag.ox+(p.x-_drag.sx))));_drag.layer.y=Math.max(0,Math.min(_canvas.height-10,Math.round(_drag.oy+(p.y-_drag.sy))));}
}
function onMU(e){_drawing=false;_drag=null;_resize=null;_drawCtx.globalAlpha=1;_drawCtx.globalCompositeOperation='source-over';}
function onDbl(e){if(_sel&&_sel.type==='text'){var t=prompt('Edit text:',_sel.text);if(t!==null)_sel.text=t;}}

// ── LAYERS ───────────────────────────────────────────────────
function updLayers(){
  var list=document.getElementById('layersList'),empty=document.getElementById('layersEmpty');if(!list)return;list.innerHTML='';
  if(!_layers.length){if(empty)empty.style.display='block';return;}if(empty)empty.style.display='none';
  var icons={sticker:'😀',text:'T',watermark:'🔖'};
  _layers.slice().reverse().forEach(function(l){var d=document.createElement('div');d.className='layer-row'+(l===_sel?' sel':'');d.innerHTML='<div class="layer-thumb2">'+(icons[l.type]||'?')+'</div><div class="layer-nm">'+(l.name||l.type)+'</div><button class="layer-del2" onclick="removeLayer(\''+l.id+'\')">✕</button>';d.onclick=function(e){if(e.target.classList.contains('layer-del2'))return;_sel=l;updSelCtrl();updLayers();};list.appendChild(d);});
  var ot=document.getElementById('tlOverlayTrack');if(ot)ot.style.display=_layers.length?'':'none';
}
function removeLayer(id){pushUndo();_layers=_layers.filter(function(l){return l.id!==id;});if(_sel&&_sel.id===id)_sel=null;updLayers();updSelCtrl();}
function delSel(){if(!_sel)return;if(_sel.video){var idx=_vidLayers.indexOf(_sel);if(idx>-1){_vidLayers[idx].video.pause();_vidLayers.splice(idx,1);renderVidLayers();}_sel=null;updSelCtrl();return;}removeLayer(_sel.id);}
function dupeSel(){if(!_sel||_sel.video)return;pushUndo();var c=Object.assign({},_sel,{id:_sel.type+Date.now(),x:(_sel.x||0)+20,y:(_sel.y||0)+20});_layers.push(c);_sel=c;updLayers();}
function bringFwd(){if(!_sel||_sel.video)return;var i=_layers.indexOf(_sel);if(i<_layers.length-1){_layers.splice(i,1);_layers.splice(i+1,0,_sel);updLayers();}}
function sendBck(){if(!_sel||_sel.video)return;var i=_layers.indexOf(_sel);if(i>0){_layers.splice(i,1);_layers.splice(i-1,0,_sel);updLayers();}}
function clearAll(){if(!confirm('Remove all overlays and drawing?'))return;pushUndo();_layers=[];_sel=null;_drawCtx.clearRect(0,0,_drawCanvas.width,_drawCanvas.height);updLayers();updSelCtrl();}
function updSelCtrl(){var c=document.getElementById('selCtrl');if(!c)return;if(_sel){c.style.display='';var nm=document.getElementById('selName');if(nm)nm.textContent=_sel.name||_sel.type||'Layer';var op=document.getElementById('selOp');if(op)op.value=_sel.opacity||100;}else c.style.display='none';}

// ── UNDO/REDO ────────────────────────────────────────────────
function pushUndo(){var snap=JSON.stringify(_layers.map(function(l){return Object.assign({},l,{img:null});}));_undoStack.push(snap);if(_undoStack.length>25)_undoStack.shift();_redoStack=[];document.getElementById('evUndoBtn').disabled=false;document.getElementById('evRedoBtn').disabled=true;}
function undoAct(){if(!_undoStack.length)return;_redoStack.push(JSON.stringify(_layers.map(function(l){return Object.assign({},l,{img:null});})));_layers=JSON.parse(_undoStack.pop());_sel=null;updLayers();updSelCtrl();document.getElementById('evUndoBtn').disabled=!_undoStack.length;document.getElementById('evRedoBtn').disabled=false;}
function redoAct(){if(!_redoStack.length)return;_undoStack.push(JSON.stringify(_layers.map(function(l){return Object.assign({},l,{img:null});})));_layers=JSON.parse(_redoStack.pop());_sel=null;updLayers();updSelCtrl();document.getElementById('evRedoBtn').disabled=!_redoStack.length;document.getElementById('evUndoBtn').disabled=false;}

// ── PLAYBACK ─────────────────────────────────────────────────
function togglePlay(){if(!_video||!_video.src)return;setPlay(!_playing);}
function setPlay(p){_playing=p;if(p){_video.play();document.getElementById('evPlayBtn').textContent='⏸';}else{_video.pause();document.getElementById('evPlayBtn').textContent='▶';}if(p&&_audioBuffer)playAudio();}
function onTimeUpdate(){
  var cur=_video.currentTime||0,dur=_video.duration||0,pct=dur?cur/dur*100:0;
  var sf=document.getElementById('evSeekFill');if(sf)sf.style.width=pct+'%';
  var tf=document.getElementById('tlVideoFill');if(tf)tf.style.width=pct+'%';
  var et=document.getElementById('evTime');if(et)et.textContent=fmtT(cur)+' / '+fmtT(dur);
  if(_trimActive&&cur>=_trimEnd){_video.currentTime=_trimStart;if(!_playing)_video.pause();}
  if(_trimActive&&dur){var ph=document.getElementById('trimPlayhead');if(ph){var w=document.getElementById('trimWrap');if(w){var pp=(cur-_trimStart)/((_trimEnd-_trimStart)||1)*w.clientWidth;ph.style.left=Math.max(0,Math.min(w.clientWidth,pp))+'px';}}}
}
function seekClick(e){if(!_video||!_video.duration)return;var r=document.getElementById('evSeekWrap').getBoundingClientRect();_video.currentTime=(e.clientX-r.left)/r.width*_video.duration;}
function toggleMute(){_muted=!_muted;_video.muted=_muted;document.getElementById('evVolIc').textContent=_muted?'🔇':'🔊';}
function setVol(v){_video.volume=v/100;document.getElementById('evVolIc').textContent=v>0?'🔊':'🔇';}
function fmtT(s){s=s||0;var m=Math.floor(s/60),sec=Math.floor(s%60);return m+':'+(sec<10?'0':'')+sec;}

// ── TRIM ─────────────────────────────────────────────────────
function openTrimModal(){if(!_video||!_video.duration)return;updateTrimUI();openModal('trimModal');}
function setupTrimHandles(){
  var wrap=document.getElementById('trimWrap'),hl=document.getElementById('trimHandleL'),hr=document.getElementById('trimHandleR');
  if(!wrap||!hl||!hr)return;
  function bind(el,side){
    function start(e){e.preventDefault();
      function mv(e2){var r=wrap.getBoundingClientRect();var cx=e2.touches?e2.touches[0].clientX:e2.clientX;var pct=Math.max(0,Math.min(1,(cx-r.left)/r.width));var t=pct*(_video.duration||0);if(side==='l'){_trimStart=Math.min(t,_trimEnd-0.5);}else{_trimEnd=Math.max(t,_trimStart+0.5);}_trimStart=Math.max(0,_trimStart);_trimEnd=Math.min(_video.duration||0,_trimEnd);updateTrimUI();}
      function up(){document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);document.removeEventListener('touchmove',mv);document.removeEventListener('touchend',up);}
      document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);document.addEventListener('touchmove',mv,{passive:false});document.addEventListener('touchend',up);
    }
    el.addEventListener('mousedown',start);el.addEventListener('touchstart',start,{passive:false});
  }
  bind(hl,'l');bind(hr,'r');
}
function updateTrimUI(){
  var dur=_video&&_video.duration||0;if(!dur)return;
  var lP=_trimStart/dur*100,rP=_trimEnd/dur*100;
  var reg=document.getElementById('trimRegion'),hl=document.getElementById('trimHandleL'),hr=document.getElementById('trimHandleR');
  if(reg){reg.style.left=lP+'%';reg.style.width=(rP-lP)+'%';}
  if(hl)hl.style.left=lP+'%';if(hr)hr.style.right=(100-rP)+'%';
  var sl=document.getElementById('trimStartLabel'),el=document.getElementById('trimEndLabel'),dl=document.getElementById('trimDurLabel');
  if(sl)sl.textContent='Start: '+fmtT(_trimStart);if(el)el.textContent='End: '+fmtT(_trimEnd);if(dl)dl.textContent='Duration: '+fmtT(_trimEnd-_trimStart);
  var si=document.getElementById('trimStartIn'),ei=document.getElementById('trimEndIn');
  if(si)si.value=_trimStart.toFixed(1);if(ei)ei.value=_trimEnd.toFixed(1);
  var badge=document.getElementById('evTrimBadge');
  if(badge){if(_trimActive){badge.classList.remove('hidden');badge.textContent='✂ Trim: '+fmtT(_trimStart)+' → '+fmtT(_trimEnd);}else badge.classList.add('hidden');}
}
function onTrimInput(){var s=parseFloat(document.getElementById('trimStartIn').value)||0;var e=parseFloat(document.getElementById('trimEndIn').value)||_video.duration;var dur=_video.duration||0;_trimStart=Math.max(0,Math.min(s,dur-0.5));_trimEnd=Math.max(_trimStart+0.5,Math.min(e,dur));updateTrimUI();}
function previewTrim(){if(!_video)return;_video.currentTime=_trimStart;setPlay(true);}
function resetTrim(){_trimStart=0;_trimEnd=_video.duration||0;_trimActive=false;updateTrimUI();}
function applyTrim(){_trimActive=true;updateTrimUI();_video.currentTime=_trimStart;evToast('Trim applied ✓','ok');closeModal('trimModal');}

// ── AUDIO ────────────────────────────────────────────────────
function loadAudioFile(input){var f=input.files[0];if(!f)return;loadAudioBlob(f);input.value='';}
function loadAudioBlob(f){
  evToast('Loading audio…');var reader=new FileReader();
  reader.onload=function(e){
    if(!_audioCtx)_audioCtx=new(window.AudioContext||window.webkitAudioContext)();
    _audioCtx.decodeAudioData(e.target.result,function(buf){
      _audioBuffer=buf;_audioTracks.push({name:f.name,buffer:buf,volume:0.8,duration:buf.duration});
      renderAudioTracks();evToast('Audio added ✓','ok');
      var agc=document.getElementById('audioGlobalCtrl');if(agc)agc.style.display='';
      var at=document.getElementById('tlAudioTrack');if(at)at.style.display='';
    },function(){evToast('Audio decode failed','err');});
  };reader.readAsArrayBuffer(f);
}
function renderAudioTracks(){
  var list=document.getElementById('audioTracks'),empty=document.getElementById('audioEmpty');
  if(list)list.innerHTML='';if(!_audioTracks.length){if(empty)empty.style.display='block';return;}if(empty)empty.style.display='none';
  _audioTracks.forEach(function(t,i){var d=document.createElement('div');d.className='audio-track-item';d.innerHTML='<span style="font-size:1.1rem">🎵</span><div style="flex:1;min-width:0"><div style="font-size:.77rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+h(t.name)+'</div><div style="font-size:.68rem;color:var(--t2);margin-top:1px">'+fmtT(t.duration)+'</div></div><button onclick="removeAudio('+i+')" style="background:none;border:none;color:var(--t3);cursor:pointer;font-size:.8rem;padding:3px">✕</button>';if(list)list.appendChild(d);});
  var af=document.getElementById('tlAudioFill');if(af)af.style.width='100%';
}
function removeAudio(i){_audioTracks.splice(i,1);_audioBuffer=null;renderAudioTracks();if(!_audioTracks.length){var agc=document.getElementById('audioGlobalCtrl');if(agc)agc.style.display='none';var at=document.getElementById('tlAudioTrack');if(at)at.style.display='none';}}
function setAudioVol(v){if(_audioGain)_audioGain.gain.value=v/100;}
function playAudio(){if(!_audioCtx||!_audioBuffer)return;if(_audioSource){try{_audioSource.stop();}catch(e){}}_audioGain=_audioCtx.createGain();_audioGain.gain.value=parseInt(document.getElementById('audioVol').value)/100;_audioGain.connect(_audioCtx.destination);_audioSource=_audioCtx.createBufferSource();_audioSource.buffer=_audioBuffer;_audioSource.connect(_audioGain);_audioSource.start(0,Math.min(_video.currentTime,_audioBuffer.duration));}

// ── VIDEO LAYERS (PiP) ───────────────────────────────────────
function addVideoLayer(input){var f=input.files[0];if(!f)return;addVideoLayerBlob(f);input.value='';}
function addVideoLayerBlob(f){
  var vid=document.createElement('video');vid.src=URL.createObjectURL(f);vid.muted=true;vid.loop=true;vid.playsinline=true;vid.preload='auto';
  vid.onloadedmetadata=function(){var vl={id:'vl'+Date.now(),type:'vidlayer',name:f.name,video:vid,x:20,y:20,w:Math.round(_canvas.width*0.3),h:Math.round(_canvas.height*0.3),opacity:100};_vidLayers.push(vl);vid.play();renderVidLayers();evToast('Video layer added ✓','ok');};
}
function renderVidLayers(){
  var list=document.getElementById('vidLayerList'),empty=document.getElementById('vidLayerEmpty');
  if(list)list.innerHTML='';if(!_vidLayers.length){if(empty)empty.style.display='block';return;}if(empty)empty.style.display='none';
  _vidLayers.forEach(function(vl,i){var d=document.createElement('div');d.style.cssText='padding:8px 10px;border-bottom:1px solid var(--brd)';d.innerHTML='<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px"><span>🎞</span><span style="font-size:.77rem;font-weight:600;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+h(vl.name)+'</span><button onclick="removeVidLayer('+i+')" style="background:none;border:none;color:var(--t3);cursor:pointer">✕</button></div><label style="font-size:.64rem;color:var(--t2);font-weight:700;text-transform:uppercase;display:block;margin-bottom:3px">Size (drag corner on canvas to resize)</label><input type="range" class="ev-range" min="50" max="'+_canvas.width+'" value="'+vl.w+'" oninput="resizeVidLayer('+i+',this.value)" style="width:100%">';if(list)list.appendChild(d);});
}
function resizeVidLayer(i,w){w=parseInt(w);if(_vidLayers[i]){_vidLayers[i].w=w;_vidLayers[i].h=Math.round(w*(_vidLayers[i].video.videoHeight||9)/(_vidLayers[i].video.videoWidth||16));}}
function removeVidLayer(i){if(_sel===_vidLayers[i])_sel=null;_vidLayers[i].video.pause();_vidLayers.splice(i,1);renderVidLayers();updSelCtrl();}

// ── EXPORT ───────────────────────────────────────────────────
function startExport(){
  if(!_video||!_video.src||!_video.duration){evToast('No video loaded','err');return;}
  _exportCancelFlag=false;
  document.getElementById('evExportOv').classList.add('open');
  setExportProg(0,'Preparing export…');setPlay(false);
  exportProcess().then(function(blob){
    document.getElementById('evExportOv').classList.remove('open');
    window._lastExportBlob=blob;
    var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(document.getElementById('evProjName').textContent||'keyvideo')+'_edited.webm';document.body.appendChild(a);a.click();document.body.removeChild(a);
    evToast('Export done ✓ ('+(blob.size/1024/1024).toFixed(1)+'MB)','ok');
  }).catch(function(err){document.getElementById('evExportOv').classList.remove('open');if(err.message!=='cancelled')evToast('Export failed: '+err.message,'err');});
}
function cancelExp(){_exportCancelFlag=true;}

function exportProcess(){
  return new Promise(function(resolve,reject){
    if(!_video||!_video.duration){reject(new Error('No video'));return;}
    if(!window.MediaRecorder){reject(new Error('MediaRecorder not supported — use Chrome or Edge'));return;}
    var start=_trimActive?_trimStart:0,end=_trimActive?_trimEnd:_video.duration;
    var W=_canvas.width,H=_canvas.height;
    var mime='';
    ['video/webm;codecs=vp8','video/webm','video/mp4'].forEach(function(m){if(!mime&&MediaRecorder.isTypeSupported(m))mime=m;});
    if(!mime){reject(new Error('No supported export format — try Chrome'));return;}
    var off=document.createElement('canvas');off.width=W;off.height=H;var oc=off.getContext('2d');
    var stream;try{stream=off.captureStream(25);}catch(e){reject(new Error('Canvas capture not supported'));return;}
    // Attach audio
    if(_audioCtx&&_audioBuffer){try{var dest=_audioCtx.createMediaStreamDestination();var asrc=_audioCtx.createBufferSource();var agn=_audioCtx.createGain();agn.gain.value=parseInt((document.getElementById('audioVol')||{value:80}).value)/100;asrc.buffer=_audioBuffer;asrc.connect(agn);agn.connect(dest);asrc.start(0,Math.max(0,start));dest.stream.getAudioTracks().forEach(function(t){stream.addTrack(t);});}catch(e){console.warn('Audio attach failed:',e);}}
    var rec;try{rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1500000});}catch(e){reject(new Error('Recorder init failed: '+e.message));return;}
    var chunks=[],stopped=false;
    rec.ondataavailable=function(e){if(e.data&&e.data.size>0)chunks.push(e.data);};
    rec.onstop=function(){if(!chunks.length){reject(new Error('No data captured — try again'));return;}var blob=new Blob(chunks,{type:mime});if(blob.size<500){reject(new Error('Export too small — try again'));return;}resolve(blob);};
    rec.onerror=function(){reject(new Error('Recorder error'));};
    _video.pause();_video.currentTime=start;
    function afterSeek(){
      _video.removeEventListener('seeked',afterSeek);
      rec.start(200);
      _video.play().catch(function(e){reject(new Error('Play failed: '+e.message));});
      var rafId,lastPct=-1;
      function frame(){
        if(_exportCancelFlag){_video.pause();cancelAnimationFrame(rafId);if(!stopped){stopped=true;setTimeout(function(){rec.stop();},100);}reject(new Error('cancelled'));return;}
        var cur=_video.currentTime,dur2=(end-start)||1,pct=Math.min(99,Math.round((cur-start)/dur2*100));
        if(pct!==lastPct){lastPct=pct;setExportProg(pct,'Exporting '+pct+'%  ('+fmtT(cur)+' / '+fmtT(end)+')');}
        if(_video.readyState>=2){oc.clearRect(0,0,W,H);oc.drawImage(_video,0,0,W,H);oc.drawImage(_drawCanvas,0,0);_layers.forEach(function(l){drawLayer(oc,l,false);});_vidLayers.forEach(function(vl){if(vl.video&&vl.video.readyState>=2){oc.save();oc.globalAlpha=(vl.opacity||100)/100;oc.drawImage(vl.video,vl.x,vl.y,vl.w,vl.h);oc.restore();}});}
        if(cur>=end-0.08||_video.ended||_video.paused){_video.pause();cancelAnimationFrame(rafId);setExportProg(99,'Finalizing…');if(!stopped){stopped=true;setTimeout(function(){rec.stop();},700);}return;}
        rafId=requestAnimationFrame(frame);
      }
      rafId=requestAnimationFrame(frame);
    }
    _video.addEventListener('seeked',afterSeek);
  });
}
function setExportProg(pct,msg){var b=document.getElementById('evExportBar');if(b)b.style.width=pct+'%';var p=document.getElementById('evExportPct');if(p)p.textContent=pct+'%';var s=document.getElementById('evExportSub');if(s)s.textContent=msg||'';}

// ── BANNER ───────────────────────────────────────────────────
function clearBannerCanvas(){var bc=document.getElementById('evBannerCanvas');if(!bc||!_bannerCtx)return;_bannerCtx.fillStyle='#111';_bannerCtx.fillRect(0,0,bc.width,bc.height);_bannerCtx.fillStyle='rgba(255,255,255,.15)';_bannerCtx.font='bold 48px Arial';_bannerCtx.textAlign='center';_bannerCtx.textBaseline='middle';_bannerCtx.fillText('KEYTUBE',bc.width/2,bc.height/2);_bannerCtx.textAlign='left';}
function bannerFromFrame(){if(!_video||!_video.readyState)return;var bc=document.getElementById('evBannerCanvas');if(!bc||!_bannerCtx)return;_bannerCtx.drawImage(_video,0,0,bc.width,bc.height);_bannerItems.forEach(function(item){drawBannerItem(item);});evToast('Banner grabbed ✓','ok');}
function loadBannerImg(input){var f=input.files[0];if(!f)return;input.value='';var img=new Image();img.onload=function(){var bc=document.getElementById('evBannerCanvas');if(!bc||!_bannerCtx)return;var sc=Math.min(bc.width/img.width,bc.height/img.height);var w=img.width*sc,hh=img.height*sc;_bannerCtx.fillStyle='#000';_bannerCtx.fillRect(0,0,bc.width,bc.height);_bannerCtx.drawImage(img,(bc.width-w)/2,(bc.height-hh)/2,w,hh);};img.src=URL.createObjectURL(f);}
function openBannerText(){document.getElementById('bannerTextForm').style.display='';}
function addBannerText(){var txt=(document.getElementById('bannerTxtIn').value||'').trim();if(!txt)return;var bc=document.getElementById('evBannerCanvas');if(!bc||!_bannerCtx)return;var item={type:'text',text:txt,color:document.getElementById('bannerTxtClr').value,size:parseInt(document.getElementById('bannerTxtSz').value)||60,pos:document.getElementById('bannerTxtPos').value};_bannerItems.push(item);drawBannerItem(item);document.getElementById('bannerTextForm').style.display='none';evToast('Text added to banner ✓','ok');}
function drawBannerItem(item){var bc=document.getElementById('evBannerCanvas');if(!bc||!_bannerCtx)return;if(item.type==='text'){var W=bc.width,H=bc.height,pad=30;_bannerCtx.font='bold '+item.size+'px Arial';_bannerCtx.textBaseline='alphabetic';var tw=_bannerCtx.measureText(item.text).width,x=pad,y=H-pad;if(item.pos==='tc'){x=W/2-tw/2;y=item.size+pad;}else if(item.pos==='tl'){x=pad;y=item.size+pad;}else if(item.pos==='bc'){x=W/2-tw/2;y=H-pad;}else if(item.pos==='br'){x=W-tw-pad;y=H-pad;}_bannerCtx.shadowColor='rgba(0,0,0,.7)';_bannerCtx.shadowBlur=8;_bannerCtx.fillStyle=item.color;_bannerCtx.fillText(item.text,x,y);_bannerCtx.shadowBlur=0;}}
function addBannerWM(){var bc=document.getElementById('evBannerCanvas');if(!bc||!_bannerCtx)return;var isPages=window.location.pathname.indexOf('/pages/')!==-1;var src=(isPages?'../':'')+'imagelib/watermark.png';var img=new Image();img.crossOrigin='anonymous';img.onload=function(){_bannerCtx.globalAlpha=.65;_bannerCtx.drawImage(img,14,14,60,60);_bannerCtx.globalAlpha=1;evToast('Watermark added to banner ✓','ok');};img.onerror=function(){_bannerCtx.font='bold 22px Arial';_bannerCtx.fillStyle='rgba(255,255,255,.7)';_bannerCtx.textBaseline='top';_bannerCtx.fillText('KEYTUBE',14,14);};img.src=src;}
function clearBanner(){_bannerItems=[];clearBannerCanvas();}

// ── UPLOAD ───────────────────────────────────────────────────
function openUploadModal(){if(!_video||!_video.src){evToast('Open a video first','err');return;}document.getElementById('upTitle').value=document.getElementById('evProjName').textContent||'My Edited Video';document.getElementById('upErr').textContent='';document.getElementById('upProgRow').style.display='none';openModal('uploadModal');}

function canvasToBlob(canvas,type,quality){
  return new Promise(function(resolve,reject){
    if(!canvas){reject(new Error('No canvas'));return;}
    try{canvas.toBlob(function(b){b?resolve(b):reject(new Error('toBlob returned null'));},type||'image/jpeg',quality||0.88);}
    catch(e){reject(e);}
  });
}

async function doUpload(){
  var title=(document.getElementById('upTitle').value||'').trim();
  var err=document.getElementById('upErr');err.textContent='';
  if(!title){err.textContent='Enter a video title.';return;}
  if(!_user){err.textContent='Not logged in.';return;}
  var btn=document.getElementById('upSubmitBtn'),prog=document.getElementById('upProgRow');
  btn.disabled=true;prog.style.display='';
  try{
    // STEP 1 — Export
    var blob=window._lastExportBlob||null;
    if(!blob){
      closeModal('uploadModal');_exportCancelFlag=false;
      document.getElementById('evExportOv').classList.add('open');setExportProg(0,'Preparing export…');
      try{blob=await exportProcess();window._lastExportBlob=blob;}
      catch(exportErr){
        document.getElementById('evExportOv').classList.remove('open');
        if(exportErr.message==='cancelled'){btn.disabled=false;prog.style.display='none';return;}
        throw new Error('Export failed: '+exportErr.message);
      }
      document.getElementById('evExportOv').classList.remove('open');
      openModal('uploadModal');
    }
    var sizeMB=blob.size/1024/1024;
    setUpProg('Export ready ('+sizeMB.toFixed(1)+' MB). Uploading banner…',8);
    // STEP 2 — Banner (optional)
    var coverURL='';
    try{
      var bannerBlob=await canvasToBlob(document.getElementById('evBannerCanvas'),'image/jpeg',0.88);
      setUpProg('Uploading banner…',18);
      var cRes=await uploadToCloudinary(new File([bannerBlob],'banner.jpg',{type:'image/jpeg'}),CDN_USER,null);
      coverURL=cRes.url;
    }catch(be){console.warn('Banner skipped:',be.message);}
    // STEP 3 — Size check
    if(sizeMB>90){throw new Error('Video is '+sizeMB.toFixed(0)+'MB — too large. Trim to under 3 minutes and export again.');}
    // STEP 4 — Upload video
    var ext=(blob.type||'').indexOf('mp4')!==-1?'.mp4':'.webm';
    var vidFile=new File([blob],(title.replace(/\s+/g,'_')||'keyvideo')+'_edited'+ext,{type:blob.type||'video/webm'});
    setUpProg('Uploading video ('+sizeMB.toFixed(1)+'MB)…',30);
    var videoURL='';
    try{var vRes=await uploadToCloudinary(vidFile,CDN_USER,function(p){setUpProg('Uploading video '+p+'%…',30+Math.round(p*.55));});videoURL=vRes.url;}
    catch(ve){throw new Error('Video upload failed: '+ve.message);}
    // STEP 5 — Save to KEYTUBE
    setUpProg('Saving to your channel…',92);
    var saved=await new Promise(function(res,rej){
      api('addMovie',{gmail:_user.gmail,name:title,description:(document.getElementById('upDesc').value||'').trim(),category:(document.getElementById('upCat')||{value:'comedy'}).value,type:(document.getElementById('upType')||{value:'movie'}).value,cover:coverURL,videoURL:videoURL,downloadURL:videoURL,year:new Date().getFullYear(),isNew:true,featured:false},function(r){if(r&&r.ok)res(r);else rej(new Error(r?r.msg||'Save failed':'No server response'));});
    });
    // SUCCESS
    setUpProg('Done! 🎉',100);window._lastExportBlob=null;
    setTimeout(function(){btn.disabled=false;prog.style.display='none';closeModal('uploadModal');evToast('Uploaded to KEYTUBE! 🎉','ok');setTimeout(function(){var base=window.location.pathname.indexOf('/pages/')!==-1?'':'pages/';window.location.href=base+'watch.html?id='+saved.id;},1200);},800);
  }catch(e){btn.disabled=false;prog.style.display='none';err.textContent=e.message||'Upload failed. Please try again.';evToast(e.message||'Upload failed','err');console.error('[doUpload]',e);}
}
function setUpProg(msg,pct){var s=document.getElementById('upStatus');if(s)s.textContent=msg;var b=document.getElementById('upBar');if(b)b.style.width=pct+'%';}

// ── MODALS ───────────────────────────────────────────────────
function openModal(id){var m=document.getElementById(id);if(m)m.classList.add('open');}
function closeModal(id){var m=document.getElementById(id);if(m)m.classList.remove('open');}
document.addEventListener('click',function(e){['trimModal','uploadModal'].forEach(function(id){var m=document.getElementById(id);if(m&&e.target===m)closeModal(id);});});
document.addEventListener('keydown',function(e){if(e.key==='Escape')['trimModal','uploadModal'].forEach(closeModal);});

// ── KEYBOARD ─────────────────────────────────────────────────
function onKey(e){var tag=document.activeElement.tagName;if(tag==='INPUT'||tag==='TEXTAREA'||document.activeElement.contentEditable==='true')return;if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();delSel();}if(e.key===' '){e.preventDefault();togglePlay();}if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undoAct();}if((e.ctrlKey||e.metaKey)&&(e.key==='y'||(e.shiftKey&&e.key==='z'))){e.preventDefault();redoAct();}if((e.ctrlKey||e.metaKey)&&e.key==='d'){e.preventDefault();dupeSel();}}

// ── COLORS ───────────────────────────────────────────────────
function buildColors(id,fn){var row=document.getElementById(id);if(!row)return;COLORS.forEach(function(c){var d=document.createElement('div');d.className='ev-cdot';d.style.background=c;if(c==='#ffffff')d.style.border='2px solid #555';d.onclick=function(){row.querySelectorAll('.ev-cdot').forEach(function(x){x.classList.remove('act');});d.classList.add('act');if(fn)fn(c);};row.appendChild(d);});}

// ── TOAST & HELPERS ──────────────────────────────────────────
function evToast(msg,type){var t=document.getElementById('evToast');if(!t)return;t.textContent=msg;t.className='show'+(type==='ok'?' ok':type==='err'?' err':'');clearTimeout(t._t);t._t=setTimeout(function(){t.className='';},2800);}
function h(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function cap(s){return s?String(s)[0].toUpperCase()+String(s).slice(1):'';}
function getUser(){try{var u=sessionStorage.getItem('kt_u')||localStorage.getItem('kt_u');return u?JSON.parse(u):null;}catch(e){return null;}}
