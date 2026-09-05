// ── editor.js — KeyVideo Editor ─────────────────────────────
var _user = null;
var _video = null;
var _canvas = null;
var _ctx = null;
var _layers = [];          // all overlay elements
var _selectedLayer = null;
var _tool = 'select';
var _playing = false;
var _muted = false;
var _rafId = null;
var _exportCancelled = false;
var _undoStack = [];
var _drawCanvas = null;    // separate canvas for drawing
var _drawCtx = null;
var _isDrawing = false;
var _drawPath = [];
var _dragState = null;     // {layer, startX, startY, origX, origY}
var _resizeState = null;
var _exportBlob = null;    // final exported video blob

var COLORS = ['#ffffff','#000000','#ff2d55','#0a84ff','#30d158','#ffd60a','#bf5af2','#ff9f0a','#64d2ff','#ff6961','#ffb480'];

// ── INIT ─────────────────────────────────────────────────────
window.onload = function(){
  // Auth check
  var u = getUser ? getUser() : null;
  if(!u){
    document.getElementById('evLoginGate').style.display = 'flex';
    document.getElementById('evApp').style.display = 'none';
    return;
  }
  _user = u;
  document.getElementById('evLoginGate').style.display = 'none';
  document.getElementById('evApp').style.display = 'flex';

  // Init canvas
  _canvas = document.getElementById('evCanvas');
  _ctx    = _canvas.getContext('2d');

  // Init draw canvas (overlay)
  _drawCanvas = document.createElement('canvas');
  _drawCtx    = _drawCanvas.getContext('2d');

  // Build sticker grid
  buildStickerGrid();

  // Build color pickers
  buildColorPickers('txtColorRow',  function(c){ document.getElementById('txtColorPicker').value = c; });
  buildColorPickers('drawColorRow', function(c){ document.getElementById('drawColorPicker').value = c; updateBrush(); });

  // Video element
  _video = document.getElementById('evVideo');
  _video.addEventListener('timeupdate',  onTimeUpdate);
  _video.addEventListener('ended',       function(){ setPlaying(false); });
  _video.addEventListener('loadedmetadata', onVideoLoaded);

  // Canvas mouse events
  _canvas.addEventListener('mousedown',  onCanvasMouseDown);
  _canvas.addEventListener('mousemove',  onCanvasMouseMove);
  _canvas.addEventListener('mouseup',    onCanvasMouseUp);
  _canvas.addEventListener('dblclick',   onCanvasDblClick);
  _canvas.addEventListener('touchstart', onTouchStart, {passive:false});
  _canvas.addEventListener('touchmove',  onTouchMove,  {passive:false});
  _canvas.addEventListener('touchend',   onTouchEnd,   {passive:false});

  // Keyboard shortcuts
  document.addEventListener('keydown', onKeyDown);

  // Watermark preview init
  updateWmPreview();
  updateBrush();
};

// ── TOOL SELECTION ────────────────────────────────────────────
function setTool(tool){
  _tool = tool;
  document.querySelectorAll('.ev-tool-btn').forEach(function(b){ b.classList.remove('active'); });
  var btn = document.getElementById('tool-' + tool);
  if(btn) btn.classList.add('active');
  document.querySelectorAll('.ev-panel').forEach(function(p){ p.classList.remove('active'); });
  var panel = document.getElementById('panel-' + tool);
  if(panel) panel.classList.add('active');
  // Cursor
  _canvas.style.cursor = tool === 'draw' ? 'crosshair' : (tool === 'select' ? 'default' : 'crosshair');
  _selectedLayer = null;
  updateSelControls();
}

// ── FILE OPEN ─────────────────────────────────────────────────
function openFile(){
  document.getElementById('evFileInput').click();
}

function loadVideoFile(input){
  var file = input.files[0];
  if(!file) return;
  evToast('Loading video…');
  var url = URL.createObjectURL(file);
  _video.src = url;
  _video.load();
  document.getElementById('evProjectName').textContent = file.name.replace(/\.[^.]+$/,'');
  input.value = '';
}

function onVideoLoaded(){
  var W = _video.videoWidth  || 1280;
  var H = _video.videoHeight || 720;

  // Size canvas to fit center area
  var center = document.getElementById('evCenter');
  var maxW   = center.clientWidth  - 20;
  var maxH   = center.clientHeight - 20;
  var scale  = Math.min(maxW/W, maxH/H, 1);
  var cW     = Math.round(W * scale);
  var cH     = Math.round(H * scale);

  _canvas.width  = W;
  _canvas.height = H;
  _canvas.style.width  = cW + 'px';
  _canvas.style.height = cH + 'px';
  _drawCanvas.width  = W;
  _drawCanvas.height = H;

  document.getElementById('evCanvasWrap').style.display = 'inline-block';
  document.getElementById('evHint').style.display       = 'none';

  // Enable buttons
  document.getElementById('evExportBtn').disabled  = false;
  document.getElementById('evUploadBtn').disabled  = false;

  _layers = [];
  _undoStack = [];
  updateLayersList();
  startRenderLoop();

  evToast('Video loaded ✓', 'ok');
  setPlaying(true);
}

// ── RENDER LOOP ───────────────────────────────────────────────
function startRenderLoop(){
  cancelAnimationFrame(_rafId);
  function loop(){
    drawFrame();
    _rafId = requestAnimationFrame(loop);
  }
  loop();
}

function drawFrame(){
  if(!_canvas || !_video || !_video.readyState) return;
  _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
  // Draw video frame
  _ctx.drawImage(_video, 0, 0, _canvas.width, _canvas.height);
  // Draw drawing canvas
  _ctx.drawImage(_drawCanvas, 0, 0);
  // Draw all layers
  _layers.forEach(function(layer, idx){
    drawLayer(layer, idx === _layers.indexOf(_selectedLayer));
  });
}

function drawLayer(layer, selected){
  _ctx.save();
  _ctx.globalAlpha = (layer.opacity || 100) / 100;

  if(layer.type === 'sticker'){
    _ctx.font = layer.size + 'px serif';
    _ctx.textBaseline = 'top';
    _ctx.fillText(layer.emoji, layer.x, layer.y);
  }
  else if(layer.type === 'text'){
    var fs   = layer.fontSize || 36;
    var font = layer.font || 'bold Arial';
    _ctx.font = fs + 'px ' + font;
    _ctx.textBaseline = 'top';
    // Background
    if(layer.bg && layer.bg !== 'none'){
      var tw = _ctx.measureText(layer.text).width;
      _ctx.fillStyle = layer.bg;
      _ctx.fillRect(layer.x - 4, layer.y - 4, tw + 8, fs + 8);
    }
    // Stroke
    if(layer.stroke && layer.stroke !== 'none'){
      _ctx.strokeStyle = layer.stroke;
      _ctx.lineWidth   = 2;
      _ctx.strokeText(layer.text, layer.x, layer.y);
    }
    _ctx.fillStyle = layer.color || '#ffffff';
    _ctx.fillText(layer.text, layer.x, layer.y);
  }
  else if(layer.type === 'watermark'){
    var fs2 = layer.size || 80;
    _ctx.font = 'bold ' + Math.round(fs2*0.22) + 'px Arial';
    _ctx.textBaseline = 'top';
    var txt  = layer.text || 'KEYTUBE';
    var tw2  = _ctx.measureText(txt).width;
    var pos  = getWmPos(layer.position, tw2, fs2);
    if(layer.img){
      _ctx.drawImage(layer.img, pos.x, pos.y, fs2, fs2 * (layer.img.naturalHeight/layer.img.naturalWidth||1));
    } else {
      _ctx.fillStyle = layer.color || '#ffffff';
      _ctx.fillText(txt, pos.x, pos.y);
    }
  }
  else if(layer.type === 'image' && layer.img){
    _ctx.drawImage(layer.img, layer.x, layer.y, layer.w || 100, layer.h || 100);
  }

  // Selection outline
  if(selected){
    var bounds = getLayerBounds(layer);
    _ctx.globalAlpha = 1;
    _ctx.strokeStyle = '#0a84ff';
    _ctx.lineWidth   = 2;
    _ctx.setLineDash([5,3]);
    _ctx.strokeRect(bounds.x-4, bounds.y-4, bounds.w+8, bounds.h+8);
    _ctx.setLineDash([]);
    // Resize handle
    _ctx.fillStyle = '#0a84ff';
    _ctx.fillRect(bounds.x+bounds.w+4, bounds.y+bounds.h+4, 10, 10);
  }
  _ctx.restore();
}

function getLayerBounds(layer){
  if(layer.type === 'sticker'){
    var size = layer.size || 48;
    return {x:layer.x, y:layer.y, w:size, h:size};
  }
  if(layer.type === 'text'){
    _ctx.font = (layer.fontSize||36)+'px '+(layer.font||'bold Arial');
    var tw = _ctx.measureText(layer.text||'').width;
    return {x:layer.x, y:layer.y, w:tw, h:layer.fontSize||36};
  }
  if(layer.type === 'watermark'){
    return {x:layer.x||0, y:layer.y||0, w:layer.size||80, h:layer.size||80};
  }
  return {x:layer.x||0, y:layer.y||0, w:layer.w||100, h:layer.h||100};
}

// ── STICKERS ─────────────────────────────────────────────────
var _STICKERS = [
  '😂','❤️','🔥','😍','🤣','💯','😎','🎬','⭐','🏆',
  '👍','👏','🎉','🎊','💥','✨','🌟','💫','🤩','😆',
  '😜','🤪','😏','🥳','🎭','🎵','🎶','🎤','📱','💡',
  '🚀','💪','🙌','👀','💬','📢','⚡','🌈','🦁','🐯',
  '🍿','🎯','🏅','🥇','🎮','🕹️','📸','🎥','📺','🌍'
];

function buildStickerGrid(){
  var grid = document.getElementById('stickerGrid');
  if(!grid) return;
  _STICKERS.forEach(function(emoji){
    var btn = document.createElement('div');
    btn.className = 'sticker-item';
    btn.textContent = emoji;
    btn.onclick = function(){ addSticker(emoji); };
    grid.appendChild(btn);
  });
}

function addSticker(emoji){
  if(!_video || !_video.src){ evToast('Open a video first','err'); return; }
  pushUndo();
  var layer = {
    id:      'sticker_' + Date.now(),
    type:    'sticker',
    emoji:   emoji,
    x:       _canvas.width  / 2 - 24,
    y:       _canvas.height / 2 - 24,
    size:    64,
    opacity: 100,
    name:    emoji + ' Sticker'
  };
  _layers.push(layer);
  _selectedLayer = layer;
  updateLayersList();
  updateSelControls();
  evToast(emoji + ' added!', 'ok');
}

// ── TEXT ──────────────────────────────────────────────────────
function addText(){
  if(!_video || !_video.src){ evToast('Open a video first','err'); return; }
  var content = document.getElementById('txtContent').value.trim();
  if(!content){ evToast('Enter some text first','err'); return; }
  pushUndo();
  var layer = {
    id:       'text_' + Date.now(),
    type:     'text',
    text:     content,
    x:        _canvas.width  / 2 - 80,
    y:        _canvas.height / 2 - 20,
    fontSize: parseInt(document.getElementById('txtSize').value) || 36,
    font:     document.getElementById('txtFont').value,
    color:    document.getElementById('txtColorPicker').value,
    bg:       document.getElementById('txtBg').value,
    stroke:   document.getElementById('txtStroke').value,
    opacity:  100,
    name:     '"' + content.slice(0,16) + '"'
  };
  _layers.push(layer);
  _selectedLayer = layer;
  updateLayersList();
  updateSelControls();
  evToast('Text added!', 'ok');
}

// ── WATERMARK ─────────────────────────────────────────────────
function addKeytubeWatermark(){
  if(!_video || !_video.src){ evToast('Open a video first','err'); return; }
  pushUndo();
  var layer = {
    id:       'wm_' + Date.now(),
    type:     'watermark',
    text:     'Downloaded from KEYTUBE',
    wmType:   'keytube',
    position: 'br',
    size:     80,
    color:    '#ffffff',
    opacity:  70,
    name:     '🔖 KEYTUBE Watermark'
  };
  // Try to load logo image
  var isPages = window.location.pathname.indexOf('/pages/') !== -1;
  var logoSrc = (isPages ? '../' : '') + 'imagelib/watermark.png';
  var img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload  = function(){ layer.img = img; };
  img.onerror = function(){ layer.img = null; };
  img.src = logoSrc;
  _layers.push(layer);
  _selectedLayer = layer;
  updateLayersList();
  updateSelControls();
  evToast('KEYTUBE watermark added ✓', 'ok');
}

function addWatermark(){
  if(!_video || !_video.src){ evToast('Open a video first','err'); return; }
  pushUndo();
  var wmType = document.getElementById('wmType').value;
  var txt    = document.getElementById('wmText').value || '@MyChannel';
  var layer  = {
    id:       'wm_' + Date.now(),
    type:     'watermark',
    wmType:   wmType,
    text:     wmType === 'keytube' ? 'KEYTUBE' : txt,
    position: document.getElementById('wmPos').value,
    size:     parseInt(document.getElementById('wmSize').value) || 80,
    opacity:  parseInt(document.getElementById('wmOpacity').value) || 70,
    color:    '#ffffff',
    name:     '🔖 Watermark'
  };
  _layers.push(layer);
  _selectedLayer = layer;
  updateLayersList();
  updateSelControls();
  evToast('Watermark added ✓', 'ok');
}

function updateWmPreview(){
  var wmType = document.getElementById('wmType');
  var preview = document.getElementById('wmPreview');
  var wmTextRow = document.getElementById('wmTextRow');
  if(!wmType || !preview) return;
  var type = wmType.value;
  wmTextRow.style.display = type === 'keytube' ? 'none' : '';
  preview.textContent = type === 'keytube' ? 'Preview: [KEYTUBE Logo] bottom-right' :
    type === 'text' ? 'Preview: "' + (document.getElementById('wmText').value||'@Channel') + '"' :
    'Preview: [Logo] + "' + (document.getElementById('wmText').value||'@Channel') + '"';
}

function getWmPos(pos, w, h){
  var cW = _canvas.width, cH = _canvas.height, pad = 20;
  if(pos === 'tl') return {x:pad, y:pad};
  if(pos === 'tr') return {x:cW-w-pad, y:pad};
  if(pos === 'bl') return {x:pad, y:cH-h-pad};
  if(pos === 'br') return {x:cW-w-pad, y:cH-h-pad};
  return {x:cW/2-w/2, y:cH/2-h/2};
}

// ── DRAW ─────────────────────────────────────────────────────
var _brush = {color:'#ff2d55', size:8, opacity:1, erase:false};

function updateBrush(){
  _brush.color   = document.getElementById('drawColorPicker').value;
  _brush.size    = parseInt(document.getElementById('drawSize').value) || 8;
  _brush.opacity = parseInt(document.getElementById('drawOpacity').value) / 100;
  var sel = document.getElementById('drawTool');
  _brush.erase   = sel && sel.selectedIndex === 1;
}

function clearDrawing(){
  _drawCtx.clearRect(0, 0, _drawCanvas.width, _drawCanvas.height);
  evToast('Drawing cleared');
}

// ── CANVAS INTERACTION ────────────────────────────────────────
function getCanvasPos(e){
  var rect  = _canvas.getBoundingClientRect();
  var scaleX = _canvas.width  / rect.width;
  var scaleY = _canvas.height / rect.height;
  var clientX = e.touches ? e.touches[0].clientX : e.clientX;
  var clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top)  * scaleY
  };
}

function onCanvasMouseDown(e){
  e.preventDefault();
  var pos = getCanvasPos(e);

  if(_tool === 'draw'){
    _isDrawing = true;
    _drawCtx.beginPath();
    _drawCtx.moveTo(pos.x, pos.y);
    _drawPath = [pos];
    return;
  }

  if(_tool === 'select' || _tool === 'sticker' || _tool === 'text' || _tool === 'watermark'){
    // Check resize handle first
    if(_selectedLayer){
      var b = getLayerBounds(_selectedLayer);
      if(Math.abs(pos.x-(b.x+b.w+4)) < 14 && Math.abs(pos.y-(b.y+b.h+4)) < 14){
        _resizeState = {layer:_selectedLayer, startX:pos.x, startY:pos.y, origW:b.w, origH:b.h};
        return;
      }
    }
    // Hit-test layers (top to bottom)
    var hit = null;
    for(var i=_layers.length-1; i>=0; i--){
      var b2 = getLayerBounds(_layers[i]);
      if(pos.x >= b2.x-8 && pos.x <= b2.x+b2.w+8 && pos.y >= b2.y-8 && pos.y <= b2.y+b2.h+8){
        hit = _layers[i]; break;
      }
    }
    if(hit){
      _selectedLayer = hit;
      var b3 = getLayerBounds(hit);
      _dragState = {layer:hit, startX:pos.x, startY:pos.y, origX:hit.x||0, origY:hit.y||0};
      updateSelControls();
    } else {
      _selectedLayer = null;
      updateSelControls();
    }
  }
}

function onCanvasMouseMove(e){
  e.preventDefault();
  var pos = getCanvasPos(e);

  if(_tool === 'draw' && _isDrawing){
    _drawCtx.globalCompositeOperation = _brush.erase ? 'destination-out' : 'source-over';
    _drawCtx.globalAlpha  = _brush.opacity;
    _drawCtx.strokeStyle  = _brush.color;
    _drawCtx.lineWidth    = _brush.size;
    _drawCtx.lineCap      = 'round';
    _drawCtx.lineJoin     = 'round';
    _drawCtx.lineTo(pos.x, pos.y);
    _drawCtx.stroke();
    _drawCtx.beginPath();
    _drawCtx.moveTo(pos.x, pos.y);
    return;
  }

  if(_resizeState){
    var dx    = pos.x - _resizeState.startX;
    var layer = _resizeState.layer;
    var scale = 1 + dx / (_resizeState.origW || 100);
    if(scale > 0.1){
      layer.size     = Math.max(12, Math.round((_resizeState.origW||100)*scale));
      layer.fontSize = Math.max(8,  Math.round((_resizeState.origH||36)*scale));
    }
    return;
  }

  if(_dragState && _dragState.layer){
    var layer2 = _dragState.layer;
    layer2.x = Math.round(_dragState.origX + (pos.x - _dragState.startX));
    layer2.y = Math.round(_dragState.origY + (pos.y - _dragState.startY));
    // Clamp inside canvas
    layer2.x = Math.max(0, Math.min(_canvas.width  - 10, layer2.x));
    layer2.y = Math.max(0, Math.min(_canvas.height - 10, layer2.y));
  }
}

function onCanvasMouseUp(e){
  _isDrawing   = false;
  _dragState   = null;
  _resizeState = null;
  if(_drawCtx){
    _drawCtx.globalAlpha = 1;
    _drawCtx.globalCompositeOperation = 'source-over';
  }
}

function onCanvasDblClick(e){
  if(_selectedLayer && _selectedLayer.type === 'text'){
    var newText = prompt('Edit text:', _selectedLayer.text);
    if(newText !== null) _selectedLayer.text = newText;
  }
}

// Touch wrappers
function onTouchStart(e){ onCanvasMouseDown(e); }
function onTouchMove(e) { onCanvasMouseMove(e); }
function onTouchEnd(e)  { onCanvasMouseUp(e);   }

// ── LAYER MANAGEMENT ─────────────────────────────────────────
function updateLayersList(){
  var list  = document.getElementById('layersList');
  var empty = document.getElementById('layersEmpty');
  if(!list) return;
  list.innerHTML = '';
  if(!_layers.length){ if(empty) empty.style.display='block'; return; }
  if(empty) empty.style.display = 'none';

  var icons = {sticker:'😀', text:'T', watermark:'🔖', image:'🖼', draw:'✏️'};
  _layers.slice().reverse().forEach(function(layer){
    var d = document.createElement('div');
    d.className = 'layer-item' + (layer === _selectedLayer ? ' selected' : '');
    d.innerHTML =
      '<div class="layer-thumb">' + (icons[layer.type]||'?') + '</div>'+
      '<div class="layer-name">'  + (layer.name||layer.type) + '</div>'+
      '<button class="layer-del" onclick="removeLayer(\''+layer.id+'\')" title="Delete">✕</button>';
    d.onclick = function(e){
      if(e.target.classList.contains('layer-del')) return;
      _selectedLayer = layer;
      updateSelControls();
      updateLayersList();
    };
    list.appendChild(d);
  });
}

function removeLayer(id){
  pushUndo();
  _layers = _layers.filter(function(l){ return l.id !== id; });
  if(_selectedLayer && _selectedLayer.id === id) _selectedLayer = null;
  updateLayersList();
  updateSelControls();
}

function deleteSelected(){
  if(!_selectedLayer) return;
  removeLayer(_selectedLayer.id);
}

function duplicateSelected(){
  if(!_selectedLayer) return;
  pushUndo();
  var copy = Object.assign({}, _selectedLayer, {id: _selectedLayer.type+'_'+Date.now(), x:(_selectedLayer.x||0)+20, y:(_selectedLayer.y||0)+20});
  _layers.push(copy);
  _selectedLayer = copy;
  updateLayersList();
}

function bringForward(){
  if(!_selectedLayer) return;
  var idx = _layers.indexOf(_selectedLayer);
  if(idx < _layers.length-1){
    _layers.splice(idx,1);
    _layers.splice(idx+1,0,_selectedLayer);
    updateLayersList();
  }
}

function sendBackward(){
  if(!_selectedLayer) return;
  var idx = _layers.indexOf(_selectedLayer);
  if(idx > 0){
    _layers.splice(idx,1);
    _layers.splice(idx-1,0,_selectedLayer);
    updateLayersList();
  }
}

function clearCanvas(){
  if(!confirm('Remove all overlays and clear drawing?')) return;
  pushUndo();
  _layers = [];
  _selectedLayer = null;
  _drawCtx && _drawCtx.clearRect(0,0,_drawCanvas.width,_drawCanvas.height);
  updateLayersList();
  updateSelControls();
  evToast('Canvas cleared');
}

function updateSelControls(){
  var ctrl = document.getElementById('selControls');
  var nm   = document.getElementById('selName');
  var opc  = document.getElementById('selOpacity');
  if(!ctrl) return;
  if(_selectedLayer){
    ctrl.style.display = '';
    if(nm) nm.textContent = _selectedLayer.name || _selectedLayer.type;
    if(opc) opc.value = _selectedLayer.opacity || 100;
  } else {
    ctrl.style.display = 'none';
  }
}

function setSelOpacity(val){
  if(_selectedLayer) _selectedLayer.opacity = parseInt(val);
}

// ── UNDO ─────────────────────────────────────────────────────
function pushUndo(){
  _undoStack.push(JSON.stringify(_layers.map(function(l){
    return Object.assign({}, l, {img: null}); // can't serialize image objects
  })));
  if(_undoStack.length > 30) _undoStack.shift();
  document.getElementById('evUndoBtn').disabled = false;
}

function undoAction(){
  if(!_undoStack.length) return;
  _layers = JSON.parse(_undoStack.pop());
  _selectedLayer = null;
  updateLayersList();
  updateSelControls();
  if(!_undoStack.length) document.getElementById('evUndoBtn').disabled = true;
  evToast('Undone');
}

// ── PLAYBACK ─────────────────────────────────────────────────
function togglePlay(){
  if(!_video || !_video.src) return;
  setPlaying(!_playing);
}

function setPlaying(play){
  _playing = play;
  var btn = document.getElementById('evPlayBtn');
  if(play){
    _video.play();
    if(btn) btn.textContent = '⏸';
  } else {
    _video.pause();
    if(btn) btn.textContent = '▶';
  }
}

function onTimeUpdate(){
  var cur = _video.currentTime || 0;
  var dur = _video.duration    || 0;
  var pct = dur ? (cur/dur*100) : 0;
  var fill = document.getElementById('evSeekFill');
  if(fill) fill.style.width = pct + '%';
  var timeEl = document.getElementById('evTime');
  if(timeEl) timeEl.textContent = fmtTime(cur) + ' / ' + fmtTime(dur);
}

function seekTo(e){
  if(!_video || !_video.duration) return;
  var wrap = document.getElementById('evSeekWrap');
  var rect = wrap.getBoundingClientRect();
  var pct  = (e.clientX - rect.left) / rect.width;
  _video.currentTime = pct * _video.duration;
}

function toggleMute(){
  _muted = !_muted;
  _video.muted = _muted;
  document.getElementById('evVolIcon').textContent = _muted ? '🔇' : '🔊';
}

function setVolume(val){
  _video.volume = val / 100;
  document.getElementById('evVolIcon').textContent = val > 0 ? '🔊' : '🔇';
}

function fmtTime(s){
  s = s||0;
  var m = Math.floor(s/60);
  var sec = Math.floor(s%60);
  return m + ':' + (sec<10?'0':'') + sec;
}

// ── EXPORT ────────────────────────────────────────────────────
function exportVideo(){
  if(!_video || !_video.src || !_video.duration){ evToast('No video loaded','err'); return; }
  _exportCancelled = false;

  var overlay = document.getElementById('evExportOverlay');
  overlay.classList.add('show');
  setExportProgress(0, 'Preparing export…');

  // Pause video and go to start
  setPlaying(false);
  _video.currentTime = 0;

  var dur    = _video.duration;
  var W      = _canvas.width;
  var H      = _canvas.height;
  var fps    = 25;
  var chunks = [];

  // Create offscreen canvas
  var offCanvas = document.createElement('canvas');
  offCanvas.width  = W;
  offCanvas.height = H;
  var offCtx = offCanvas.getContext('2d');

  var stream   = offCanvas.captureStream(fps);
  var mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm';
  var recorder = new MediaRecorder(stream, {mimeType:mimeType, videoBitsPerSecond:3000000});

  recorder.ondataavailable = function(e){ if(e.data.size>0) chunks.push(e.data); };
  recorder.onstop = function(){
    var blob = new Blob(chunks, {type:'video/webm'});
    _exportBlob = blob;
    overlay.classList.remove('show');
    evToast('Export complete ✓', 'ok');
    // Trigger download
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (document.getElementById('evProjectName').textContent||'keyvideo') + '_edited.webm';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  recorder.start(200);

  // Seek and render frame by frame
  var frameTime = 1/fps;
  var t         = 0;

  function renderNextFrame(){
    if(_exportCancelled){ recorder.stop(); return; }
    if(t > dur + frameTime){ recorder.stop(); return; }

    var pct = Math.min(t/dur*100, 100);
    setExportProgress(Math.round(pct), 'Exporting ' + Math.round(pct) + '%…');

    _video.currentTime = Math.min(t, dur);
    _video.onseeked = function(){
      // Draw frame
      offCtx.drawImage(_video, 0, 0, W, H);
      offCtx.drawImage(_drawCanvas, 0, 0);
      _layers.forEach(function(layer){
        drawLayerOnCtx(offCtx, layer, W, H);
      });
      t += frameTime;
      setTimeout(renderNextFrame, 1000/fps);
    };
  }

  renderNextFrame();
}

function drawLayerOnCtx(ctx, layer, W, H){
  ctx.save();
  ctx.globalAlpha = (layer.opacity||100)/100;
  if(layer.type==='sticker'){
    ctx.font = (layer.size||64)+'px serif';
    ctx.textBaseline='top';
    ctx.fillText(layer.emoji, layer.x, layer.y);
  } else if(layer.type==='text'){
    var fs=layer.fontSize||36;
    ctx.font = fs+'px '+(layer.font||'bold Arial');
    ctx.textBaseline='top';
    if(layer.bg&&layer.bg!=='none'){var tw=ctx.measureText(layer.text||'').width;ctx.fillStyle=layer.bg;ctx.fillRect(layer.x-4,layer.y-4,tw+8,fs+8);}
    if(layer.stroke&&layer.stroke!=='none'){ctx.strokeStyle=layer.stroke;ctx.lineWidth=2;ctx.strokeText(layer.text||'',layer.x,layer.y);}
    ctx.fillStyle=layer.color||'#fff';
    ctx.fillText(layer.text||'',layer.x,layer.y);
  } else if(layer.type==='watermark'){
    var fs2=Math.round((layer.size||80)*0.22);
    ctx.font='bold '+fs2+'px Arial';
    ctx.textBaseline='top';
    var txt=layer.text||'KEYTUBE';
    var tw2=ctx.measureText(txt).width;
    var pos=getWmPos(layer.position,tw2,layer.size||80);
    if(layer.img){ctx.drawImage(layer.img,pos.x,pos.y,layer.size||80,layer.size||80);}
    else{ctx.fillStyle=layer.color||'#fff';ctx.fillText(txt,pos.x,pos.y);}
  }
  ctx.restore();
}

function setExportProgress(pct, msg){
  var bar  = document.getElementById('evExportBar');
  var pctEl= document.getElementById('evExportPct');
  var sub  = document.getElementById('evExportSub');
  if(bar)  bar.style.width = pct + '%';
  if(pctEl)pctEl.textContent = pct + '%';
  if(sub)  sub.textContent = msg || '';
}

function cancelExport(){
  _exportCancelled = true;
  document.getElementById('evExportOverlay').classList.remove('show');
  evToast('Export cancelled');
}

// ── UPLOAD TO KEYTUBE ─────────────────────────────────────────
function openUploadModal(){
  if(!_video || !_video.src){ evToast('No video loaded','err'); return; }
  document.getElementById('evUploadOverlay').classList.add('show');
  var name = document.getElementById('evProjectName').textContent || 'My Edited Video';
  document.getElementById('upTitle').value = name;
}

function closeUploadModal(){
  document.getElementById('evUploadOverlay').classList.remove('show');
}

async function doUploadToKeytube(){
  var title = (document.getElementById('upTitle').value||'').trim();
  var err   = document.getElementById('upErr');
  err.textContent = '';
  if(!title){ err.textContent = 'Enter a title.'; return; }

  var btn = document.getElementById('upSubmitBtn');
  var progress = document.getElementById('upProgressRow');
  var statusEl = document.getElementById('upStatus');
  var bar      = document.getElementById('upBar');

  btn.disabled = true;
  progress.style.display = '';
  setUpStatus('Exporting video…', 10, bar, statusEl);

  // Step 1: Export if not already done
  var blob = _exportBlob;
  if(!blob){
    try {
      blob = await exportForUpload();
    } catch(e){
      btn.disabled = false;
      progress.style.display = 'none';
      err.textContent = 'Export failed: ' + e.message;
      return;
    }
  }

  setUpStatus('Uploading to Cloudinary…', 40, bar, statusEl);

  // Step 2: Upload to Cloudinary
  var file = new File([blob], (title.replace(/\s+/g,'_')||'keyvideo') + '_edited.webm', {type:'video/webm'});
  var videoURL = '';
  try {
    var res = await uploadToCloudinary(file, CDN_USER, function(p){
      setUpStatus('Uploading video ' + p + '%…', 40 + Math.round(p*0.4), bar, statusEl);
    });
    videoURL = res.url;
  } catch(e){
    btn.disabled = false;
    progress.style.display = 'none';
    err.textContent = 'Upload failed: ' + e.message;
    return;
  }

  setUpStatus('Saving to KEYTUBE…', 90, bar, statusEl);

  // Step 3: Save to KEYTUBE
  var data = {
    gmail:       _user.gmail,
    name:        title,
    description: document.getElementById('upDesc').value.trim(),
    category:    document.getElementById('upCategory').value,
    type:        document.getElementById('upType').value,
    cover:       document.getElementById('upCover').value.trim(),
    videoURL:    videoURL,
    downloadURL: videoURL,
    year:        new Date().getFullYear(),
    isNew:       true,
    featured:    false
  };

  api('addMovie', data, function(r){
    btn.disabled = false;
    progress.style.display = 'none';
    if(r.ok){
      closeUploadModal();
      evToast('Uploaded to KEYTUBE! 🎉', 'ok');
      setTimeout(function(){
        var base = window.location.pathname.indexOf('/pages/')!==-1?'':'pages/';
        window.location.href = base + 'watch.html?id=' + r.id;
      }, 1500);
    } else {
      err.textContent = r.msg || 'Save failed.';
    }
  });
}

function setUpStatus(msg, pct, bar, statusEl){
  if(bar)      bar.style.width = pct + '%';
  if(statusEl) statusEl.textContent = msg;
}

function exportForUpload(){
  return new Promise(function(resolve, reject){
    if(!_video || !_video.src){ reject(new Error('No video')); return; }
    setPlaying(false);
    _video.currentTime = 0;
    var dur=_video.duration, W=_canvas.width, H=_canvas.height, fps=20;
    var off=document.createElement('canvas'); off.width=W; off.height=H;
    var octx=off.getContext('2d');
    var stream=off.captureStream(fps);
    var mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')?'video/webm;codecs=vp8,opus':'video/webm';
    var rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:2500000});
    var chunks=[];
    rec.ondataavailable=function(e){if(e.data.size>0)chunks.push(e.data);};
    rec.onstop=function(){resolve(new Blob(chunks,{type:'video/webm'}));};
    rec.start(200);
    var t=0, ft=1/fps;
    function nextFrame(){
      if(t>dur+ft){rec.stop();return;}
      _video.currentTime=Math.min(t,dur);
      _video.onseeked=function(){
        octx.drawImage(_video,0,0,W,H);
        octx.drawImage(_drawCanvas,0,0);
        _layers.forEach(function(l){drawLayerOnCtx(octx,l,W,H);});
        t+=ft;
        setTimeout(nextFrame,1000/fps);
      };
    }
    nextFrame();
  });
}

// ── COLOR PICKERS ─────────────────────────────────────────────
function buildColorPickers(containerId, onChange){
  var row = document.getElementById(containerId);
  if(!row) return;
  COLORS.forEach(function(color){
    var dot = document.createElement('div');
    dot.className = 'ev-color-dot';
    dot.style.background = color;
    dot.style.border = color==='#ffffff' ? '2px solid #555' : '2px solid transparent';
    dot.onclick = function(){
      row.querySelectorAll('.ev-color-dot').forEach(function(d){ d.classList.remove('active'); });
      dot.classList.add('active');
      if(onChange) onChange(color);
    };
    row.appendChild(dot);
  });
}

// ── KEYBOARD SHORTCUTS ────────────────────────────────────────
function onKeyDown(e){
  if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable==='true') return;
  if(e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
  if(e.key === ' '){ e.preventDefault(); togglePlay(); }
  if((e.ctrlKey||e.metaKey) && e.key==='z'){ e.preventDefault(); undoAction(); }
  if((e.ctrlKey||e.metaKey) && e.key==='d'){ e.preventDefault(); duplicateSelected(); }
}

// ── TOAST ─────────────────────────────────────────────────────
function evToast(msg, type){
  var t = document.getElementById('evToast');
  if(!t) return;
  t.textContent = msg;
  t.className   = 'show' + (type==='ok'?' ok':type==='err'?' err':'');
  clearTimeout(t._t);
  t._t = setTimeout(function(){ t.className=''; }, 2800);
}

// Helpers (if not loaded from api.js)
function h(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function cap(s){return s?String(s)[0].toUpperCase()+String(s).slice(1):'';}
function getUser(){try{var u=sessionStorage.getItem('kt_u')||localStorage.getItem('kt_u');return u?JSON.parse(u):null;}catch(e){return null;}}
