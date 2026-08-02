// ── comments.js ─────────────────────────────────────────────
var _EMOJIS=['💬','😂','❤️','😭','🔥','😍','👍','🤣','😮','💯','😎','🎬'];
var _selEmoji='💬';

function loadComments(movieId){
  api('getComments',{movieId:movieId},function(r){
    if(!r.ok)return;
    var list=r.comments||[];
    var cnt=document.getElementById('cmtCnt');if(cnt)cnt.textContent='('+list.length+')';
    var ctab=document.getElementById('cmtTabCount');if(ctab)ctab.textContent=list.length;
    var cl=document.getElementById('cmtList');if(cl)cl.innerHTML='';
    list.forEach(function(c){var d=makeCmtItem(c);if(cl)cl.appendChild(d);});
    renderCmtForm(movieId);
  });
}

function makeCmtItem(c){
  var d=document.createElement('div');d.className='cmt-item';
  var u=getUser();var init=(c.name||c.gmail||'?')[0].toUpperCase();
  var adm=getAdminToken();
  d.innerHTML='<div class="cmt-av">'+init+'</div>'+
    '<div style="flex:1"><div class="cmt-name">'+h(c.name||c.gmail)+'<span class="cmt-emoji">'+h(c.emoji||'💬')+'</span></div>'+
    '<div class="cmt-txt">'+h(c.comment)+'</div>'+
    '<div class="cmt-date">'+fmtDate(c.date)+'</div></div>'+
    ((adm||(u&&u.gmail===c.gmail))?'<span class="cmt-del" onclick="deleteCommentById(\''+c.id+'\')">🗑</span>':'');
  return d;
}

function renderCmtForm(movieId){
  var u=getUser();
  var cfa=document.getElementById('cmtFA');if(!cfa)return;
  if(u){
    var emoRow='<div class="emoji-row">'+_EMOJIS.map(function(e){return'<button class="emoj" onclick="selEmoji(this,\''+e+'\')" type="button">'+e+'</button>';}).join('')+'</div>';
    cfa.innerHTML=emoRow+'<div class="cmt-form"><textarea id="cmtTxt" placeholder="Add a comment…"></textarea><button onclick="postComment(\''+movieId+'\')">Post</button></div>';
    var first=cfa.querySelector('.emoj');if(first)first.classList.add('sel');_selEmoji='💬';
  }else{
    cfa.innerHTML='<div class="sign-cmt" onclick="showLoginReq()">🔒 Sign in to comment</div>';
  }
}

function selEmoji(btn,emoji){
  _selEmoji=emoji;
  document.querySelectorAll('.emoj').forEach(function(b){b.classList.remove('sel');});
  btn.classList.add('sel');
}

function postComment(movieId){
  var u=getUser();if(!u){showLoginReq();return;}
  var ta=document.getElementById('cmtTxt');
  if(!ta||!ta.value.trim()){toastErr('Write something first');return;}
  api('addComment',{gmail:u.gmail,name:u.name||u.gmail,movieId:movieId,comment:ta.value.trim(),emoji:_selEmoji},function(r){
    if(r.ok){toastOK('Comment posted ✓');ta.value='';loadComments(movieId);}
    else toastErr(r.msg||'Error posting comment');
  });
}

function deleteCommentById(id){
  if(!confirm('Delete this comment?'))return;
  var u=getUser();var adm=getAdminToken();
  var m=window._currentMovie;
  api('deleteComment',{token:adm||'',gmail:u?u.gmail:'',id:id},function(r){
    if(r.ok){toastOK('Deleted');if(m)loadComments(m.id);}
    else toastErr(r.msg||'Error');
  });
}
