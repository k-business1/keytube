// ── aimanagement.js ─────────────────────────────────────────
var API='https://script.google.com/macros/s/AKfycbxbYUKZYwYRssm80AnP8kDj-8_ymsaFczKmecbchEntyhhr5-zqAIDYov-Nt7Ko0pDOMA/exec';
var TOKEN='';
var _allTerms=[];
var _editId=null;
var _catFilter='all';

// ── HELPERS ──────────────────────────────────────────────────
function h(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function toast(msg,type){var t=document.getElementById('toast');if(t){t.textContent=msg;t.className='show'+(type?' '+type:'');clearTimeout(t._t);t._t=setTimeout(function(){t.className='';},3200);}}
function setText(id,v){var el=document.getElementById(id);if(el)el.textContent=v;}
var pW=0,pT;
function pStart(){pW=0;var e=document.getElementById('pbar');if(e){e.className='';e.style.width='0%';}clearInterval(pT);pT=setInterval(function(){pW=Math.min(pW+Math.random()*8,88);if(e)e.style.width=pW+'%';},120);}
function pDone(){clearInterval(pT);var e=document.getElementById('pbar');if(e){e.style.width='100%';setTimeout(function(){e.className='done';setTimeout(function(){e.style.width='0%';e.className='';},500);},280);}}
function api(action,data,cb){pStart();fetch(API,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(Object.assign({},data||{},{action:action})),redirect:'follow'}).then(function(r){return r.json();}).then(function(res){pDone();if(cb)cb(res);}).catch(function(e){pDone();toast('Connection error','terr');console.error(e);});}

// ── INIT ─────────────────────────────────────────────────────
window.onload=function(){
  TOKEN=sessionStorage.getItem('kt_a')||'';
  if(!TOKEN){toast('Not logged in as admin','terr');setTimeout(function(){window.location.href='../admin/admin.html';},1500);return;}
  loadTerms();
};

// ── LOAD TERMS ────────────────────────────────────────────────
function loadTerms(){
  api('getAIKeyTerms',{token:TOKEN},function(r){
    if(!r.ok){toast(r.msg,'terr');return;}
    _allTerms=r.terms||[];
    updateStats();
    renderTerms(_allTerms);
  });
}

function updateStats(){
  var active=_allTerms.filter(function(t){return t.active;}).length;
  var cats=new Set(_allTerms.map(function(t){return t.category;})).size;
  var withFetch=_allTerms.filter(function(t){return t.dataFetch&&t.dataFetch.trim();}).length;
  setText('statTerms',_allTerms.length);
  setText('statActive',active);
  setText('statCats',cats);
  setText('statFetch',withFetch);
}

function filterCat(cat,btn){
  _catFilter=cat;
  document.querySelectorAll('.cat-pill').forEach(function(b){b.classList.remove('active');});
  if(btn)btn.classList.add('active');
  var filtered=cat==='all'?_allTerms:_allTerms.filter(function(t){return t.category===cat;});
  renderTerms(filtered);
}

function renderTerms(list){
  var el=document.getElementById('termsList');
  var empty=document.getElementById('termsEmpty');
  if(!el)return;
  el.innerHTML='';
  if(!list.length){if(empty)empty.classList.remove('hidden');return;}
  if(empty)empty.classList.add('hidden');
  list.forEach(function(t){el.appendChild(makeTermCard(t));});
}

function makeTermCard(t){
  var d=document.createElement('div');
  d.className='term-item'+(t.active?'':' inactive');
  var catColors={greeting:'cat-greeting',movies:'cat-movies',channels:'cat-channels',help:'cat-help',earnings:'cat-earnings',support:'cat-support',general:'cat-general'};
  var catClass=catColors[t.category]||'cat-general';
  var hasMore=t.response.length>120;
  d.innerHTML=
    '<div class="term-hd">'+
      '<span class="term-cat '+catClass+'">'+cap(t.category)+'</span>'+
      '<div class="term-keywords">🔑 '+h(t.keywords)+'</div>'+
    '</div>'+
    '<div class="term-response" id="tr-'+t.id+'">'+
      h(t.response)+
      (hasMore?'<div class="term-fade" id="tf-'+t.id+'"></div>':'')+'</div>'+
    (hasMore?'<button class="t-btn" style="margin-bottom:6px;font-size:.69rem" onclick="toggleExpand(\''+t.id+'\',this)">Show more ▼</button>':'')+
    (t.dataFetch?'<div class="term-data">📡 Fetches: '+h(t.dataFetch)+'</div>':'')+
    '<div class="term-actions">'+
      '<button class="t-btn t-btn-ai" onclick="openEdit(\''+t.id+'\')">✏️ Edit</button>'+
      '<button class="t-btn t-btn-red" onclick="deleteTerm(\''+t.id+'\')">🗑 Delete</button>'+
      '<label class="toggle-switch" title="Active/Inactive">'+
        '<input type="checkbox" '+(t.active?'checked':'')+' onchange="toggleActive(\''+t.id+'\',this.checked)">'+
        '<span class="ts-slider"></span>'+
      '</label>'+
      '<span style="font-size:.7rem;color:var(--t2)">'+(t.active?'Active':'Inactive')+'</span>'+
    '</div>';
  return d;
}

function toggleExpand(id,btn){
  var el=document.getElementById('tr-'+id);
  var fade=document.getElementById('tf-'+id);
  if(!el)return;
  var expanded=el.classList.toggle('expanded');
  if(fade)fade.style.display=expanded?'none':'';
  if(btn)btn.textContent=expanded?'Show less ▲':'Show more ▼';
}

function cap(s){return s?String(s)[0].toUpperCase()+String(s).slice(1):'';}

// ── ADD / EDIT ────────────────────────────────────────────────
function openAddModal(){
  _editId=null;
  var modalTitle=document.getElementById('modalTitle');if(modalTitle)modalTitle.textContent='➕ Add Key Term';
  var fKeywords=document.getElementById('fKeywords');if(fKeywords)fKeywords.value='';
  var fResponse=document.getElementById('fResponse');if(fResponse)fResponse.value='';
  var fDataFetch=document.getElementById('fDataFetch');if(fDataFetch)fDataFetch.value='';
  var fCategory=document.getElementById('fCategory');if(fCategory)fCategory.value='general';
  var fActive=document.getElementById('fActive');if(fActive)fActive.checked=true;
  var saveBtn=document.getElementById('saveBtn');if(saveBtn)saveBtn.textContent='💾 Save';
  var editModal=document.getElementById('editModal');if(editModal)editModal.classList.add('open');
}

function openEdit(id){
  var term=_allTerms.find(function(t){return t.id===id;});
  if(!term)return;
  _editId=id;
  var modalTitle=document.getElementById('modalTitle');if(modalTitle)modalTitle.textContent='✏️ Edit Key Term';
  var fKeywords=document.getElementById('fKeywords');if(fKeywords)fKeywords.value=term.keywords;
  var fResponse=document.getElementById('fResponse');if(fResponse)fResponse.value=term.response;
  var fDataFetch=document.getElementById('fDataFetch');if(fDataFetch)fDataFetch.value=term.dataFetch||'';
  var fCategory=document.getElementById('fCategory');if(fCategory)fCategory.value=term.category||'general';
  var fActive=document.getElementById('fActive');if(fActive)fActive.checked=term.active;
  var saveBtn=document.getElementById('saveBtn');if(saveBtn)saveBtn.textContent='💾 Update';
  var editModal=document.getElementById('editModal');if(editModal)editModal.classList.add('open');
  var modalBox=document.querySelector('.modal-box');
  if(modalBox)modalBox.scrollTop=0;
}

function closeModal(){
  var editModal=document.getElementById('editModal');
  if(editModal)editModal.classList.remove('open');
  _editId=null;
}

function saveTerm(){
  var kwEl=document.getElementById('fKeywords');
  var respEl=document.getElementById('fResponse');
  var kw=kwEl?kwEl.value.trim():'';
  var resp=respEl?respEl.value.trim():'';
  if(!kw||!resp){toast('Keywords and response are required','terr');return;}

  if(privacyCheck(resp)){toast('❌ Response contains private information. Remove emails, passwords or user IDs.','terr');return;}

  var dataFetchEl=document.getElementById('fDataFetch');
  var fCategoryEl=document.getElementById('fCategory');
  var fActiveEl=document.getElementById('fActive');

  var data={
    token:TOKEN, keywords:kw,
    response:resp,
    dataFetch:dataFetchEl?dataFetchEl.value.trim():'',
    category:fCategoryEl?fCategoryEl.value:'general',
    active:fActiveEl?fActiveEl.checked:true
  };

  var btn=document.getElementById('saveBtn');
  if(btn){btn.disabled=true;btn.textContent='Saving…';}

  if(_editId){
    data.id=_editId;
    api('updateAIKeyTerm',data,function(r){
      if(btn){btn.disabled=false;btn.textContent='💾 Update';}
      if(r.ok){toast('Updated ✓','tok');closeModal();loadTerms();}
      else toast(r.msg,'terr');
    });
  } else {
    api('addAIKeyTerm',data,function(r){
      if(btn){btn.disabled=false;btn.textContent='💾 Save';}
      if(r.ok){toast('Key term added ✓','tok');closeModal();loadTerms();}
      else toast(r.msg,'terr');
    });
  }
}

function privacyCheck(text){
  var patterns=[
    /@gmail\.com/i, /password/i, /passwd/i,
    /\bUID\b/i, /user_id/i, /account number/i
  ];
  return patterns.some(function(p){return p.test(text);});
}

function toggleActive(id,active){
  api('updateAIKeyTerm',{token:TOKEN,id:id,active:active},function(r){
    if(r.ok){
      var term=_allTerms.find(function(t){return t.id===id;});
      if(term)term.active=active;
      toast(active?'Activated ✓':'Deactivated','tok');
      updateStats();
    } else toast(r.msg,'terr');
  });
}

function deleteTerm(id){
  if(!confirm('Delete this key term?'))return;
  api('deleteAIKeyTerm',{token:TOKEN,id:id},function(r){
    if(r.ok){toast('Deleted','tok');loadTerms();}
    else toast(r.msg,'terr');
  });
}

// ── LOAD DEFAULTS ─────────────────────────────────────────────
function loadDefaults(){
  var btn=document.getElementById('defaultBtn');
  if(!btn)return;
  if(!confirm('This will add default AI key terms. Continue?'))return;
  btn.disabled=true;btn.textContent='Loading…';
  api('initAIDefaults',{token:TOKEN},function(r){
    btn.disabled=false;btn.textContent='⚡ Load Default Key Terms';
    if(r.ok){toast(r.msg,'tok');loadTerms();}
    else toast(r.msg||'Error','terr');
  });
}

// ── SYNTAX INSERT ─────────────────────────────────────────────
function insertSyntax(syntax){
  var ta=document.getElementById('fResponse');
  if(!ta)return;
  var start=ta.selectionStart,end=ta.selectionEnd;
  var val=ta.value;
  ta.value=val.slice(0,start)+syntax+val.slice(end);
  ta.selectionStart=ta.selectionEnd=start+syntax.length;
  ta.focus();
  var df=document.getElementById('fDataFetch');
  if(df){
    var key=syntax.replace(/[{}]/g,'');
    var current=df.value.split(',').map(function(s){return s.trim();}).filter(Boolean);
    if(current.indexOf(key)===-1){current.push(key);df.value=current.join(', ');}
  }
}

// ── TEST AI ───────────────────────────────────────────────────
function testAI(){
  var input=document.getElementById('testInput');
  if(!input)return;
  var q=input.value.trim();if(!q)return;
  input.value='';
  var chat=document.getElementById('testChat');
  if(!chat)return;

  var um=document.createElement('div');um.className='test-msg user';
  um.innerHTML='<div class="test-av-u">U</div><div class="test-bubble user-b">'+h(q)+'</div>';
  chat.appendChild(um);

  var typing=document.createElement('div');typing.className='test-msg';
  typing.innerHTML='<div class="test-av"><img src="../imagelib/ailogo.png" onerror="this.src=\'../imagelib/logo.png\'" alt="AI"></div>'+
    '<div class="test-bubble ai-b"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
  chat.appendChild(typing);
  chat.scrollTop=chat.scrollHeight;

  api('aiQuery',{query:q},function(r){
    if(typing.parentNode===chat)chat.removeChild(typing);
    var am=document.createElement('div');am.className='test-msg';
    var bubble=document.createElement('div');bubble.className='test-bubble ai-b';
    am.innerHTML='<div class="test-av"><img src="../imagelib/ailogo.png" onerror="this.src=\'../imagelib/logo.png\'" alt="AI"></div>';
    am.appendChild(bubble);
    chat.appendChild(am);
    chat.scrollTop=chat.scrollHeight;
    
    streamText(bubble, r.ok?r.response:"I'm not sure about that. Try asking something else!", function(){
      chat.scrollTop=chat.scrollHeight;
    });
    if(r.ok&&r.matched){
      var info=document.createElement('div');
      info.style.cssText='font-size:.67rem;color:var(--ai);margin-top:4px;opacity:.7';
      info.textContent='✓ Matched — category: '+r.category+' (score: '+r.score+')';
      bubble.appendChild(info);
    }
  });
}

function streamText(el, text, onDone){
  var i=0, content='';
  if(!el)return;
  el.innerHTML='';
  var interval=setInterval(function(){
    if(i>=text.length){clearInterval(interval);if(onDone)onDone();return;}
    var chunk=Math.min(3,text.length-i);
    content+=text.slice(i,i+chunk);
    el.style.whiteSpace='pre-wrap';
    el.innerHTML=content+'▌';
    i+=chunk;
  }, 18);
  setTimeout(function(){
    if(el.innerHTML.endsWith('▌'))el.innerHTML=content;
  }, text.length*7+200);
}

document.addEventListener('click',function(e){
  var modal=document.getElementById('editModal');
  if(e.target===modal)closeModal();
});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeModal();});
