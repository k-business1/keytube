// ── UNKNOWN QUESTIONS ────────────────────────────────────────
var _allQuestions = [];
var _qFilter = 'all';
 
function loadUnknownQuestions(){
  api('getUnknownQuestions',{token:TOKEN},function(r){
    if(!r.ok){toast(r.msg,'terr');return;}
    _allQuestions = r.questions||[];
    var badge = document.getElementById('pendingBadge');
    if(badge){
      if(r.pendingCount>0){badge.style.display='inline';badge.textContent=r.pendingCount+' pending';}
      else badge.style.display='none';
    }
    renderQuestions(_allQuestions);
  });
}
 
function filterQuestions(f){
  _qFilter=f;
  var filtered=f==='all'?_allQuestions:_allQuestions.filter(function(q){return q.status===f;});
  renderQuestions(filtered);
}
 
function renderQuestions(list){
  var el=document.getElementById('unknownList');
  var empty=document.getElementById('unknownEmpty');
  if(!el)return;
  el.innerHTML='';
 
  var show=_qFilter==='all'?list:list.filter(function(q){return q.status===_qFilter;});
  if(!show.length){empty.style.display='block';return;}
  empty.style.display='none';
 
  show.forEach(function(q){
    var d=document.createElement('div');
    d.style.cssText='padding:12px 14px;border:1px solid var(--brd);border-radius:var(--r);margin-bottom:8px;background:var(--w);transition:border-color .15s';
    if(q.status==='pending')d.style.borderLeftColor='var(--red)';
    if(q.status==='pending')d.style.borderLeftWidth='3px';
 
    var statusColors={pending:'#d32f2f',answered:'#2ba640',ignored:'#aaa'};
    var statusLabels={pending:'⏳ Pending',answered:'✅ Answered',ignored:'🚫 Ignored'};
    var sc=statusColors[q.status]||'#aaa';
    var sl=statusLabels[q.status]||q.status;
 
    // Anonymize gmail for display
    var displayUser=q.gmail==='guest'?'Guest':q.gmail.replace(/(.{2}).+(@.+)/,'$1…$2');
 
    d.innerHTML=
      '<div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap">'+
        '<div style="flex:1;min-width:200px">'+
          '<div style="font-size:.86rem;font-weight:600;color:var(--txt);margin-bottom:4px">❓ '+h(q.question)+'</div>'+
          '<div style="display:flex;gap:10px;font-size:.71rem;color:var(--t2);flex-wrap:wrap">'+
            '<span>👤 '+displayUser+'</span>'+
            '<span>📅 '+fmtDate(q.date)+'</span>'+
            '<span style="color:'+sc+';font-weight:700">'+sl+'</span>'+
            (q.notes?'<span style="color:var(--ai)">📝 '+h(q.notes)+'</span>':'')+
          '</div>'+
        '</div>'+
        '<div style="display:flex;gap:5px;flex-shrink:0;flex-wrap:wrap">'+
          (q.status==='pending'?
            '<button class="t-btn t-btn-ai" onclick="openConvertModal(\''+q.id+'\',\''+h(q.question)+'\')">🔑 Teach AI</button>'+
            '<button class="t-btn" onclick="ignoreQuestion(\''+q.id+'\')" style="color:#888">🚫 Ignore</button>':
            '<button class="t-btn" onclick="reopenQuestion(\''+q.id+'\')" style="color:var(--t2)">↺ Reopen</button>')+
          '<button class="t-btn t-btn-red" onclick="deleteQuestion(\''+q.id+'\')">🗑</button>'+
        '</div>'+
      '</div>';
    el.appendChild(d);
  });
}
 
// ── CONVERT MODAL ─────────────────────────────────────────────
function openConvertModal(id,question){
  document.getElementById('convertQId').value=id;
  document.getElementById('convertOrigQ').textContent=question;
  document.getElementById('convertKeywords').value=question;
  document.getElementById('convertResponse').value='';
  document.getElementById('convertDataFetch').value='';
  document.getElementById('convertCategory').value='general';
  document.getElementById('convertModal').classList.add('open');
  document.getElementById('convertResponse').focus();
}
 
function closeConvertModal(){
  document.getElementById('convertModal').classList.remove('open');
}
 
function saveConvertedKeyTerm(){
  var kw=document.getElementById('convertKeywords').value.trim();
  var resp=document.getElementById('convertResponse').value.trim();
  var qId=document.getElementById('convertQId').value;
  if(!kw||!resp){toast('Fill keywords and response','terr');return;}
  api('convertToKeyTerm',{
    token:TOKEN, keywords:kw, response:resp,
    dataFetch:document.getElementById('convertDataFetch').value.trim(),
    category:document.getElementById('convertCategory').value,
    questionId:qId
  },function(r){
    if(r.ok){
      toast(r.msg,'tok');
      closeConvertModal();
      loadUnknownQuestions();
      loadTerms(); // refresh key terms list
    } else toast(r.msg,'terr');
  });
}
 
function ignoreQuestion(id){
  api('markQuestionAnswered',{token:TOKEN,id:id,status:'ignored',notes:'Marked as irrelevant'},function(r){
    if(r.ok){toast('Ignored','tok');loadUnknownQuestions();}
    else toast(r.msg,'terr');
  });
}
 
function reopenQuestion(id){
  api('markQuestionAnswered',{token:TOKEN,id:id,status:'pending',notes:''},function(r){
    if(r.ok){toast('Reopened','tok');loadUnknownQuestions();}
    else toast(r.msg,'terr');
  });
}
 
function deleteQuestion(id){
  if(!confirm('Delete this question?'))return;
  api('deleteUnknownQuestion',{token:TOKEN,id:id},function(r){
    if(r.ok){toast('Deleted','tok');loadUnknownQuestions();}
    else toast(r.msg,'terr');
  });
}
 
function fmtDate(d){var dt=new Date(d);return isNaN(dt)?d||'':dt.toLocaleDateString();}
 
// Load questions on page load — add this to the existing window.onload:
// loadUnknownQuestions();
