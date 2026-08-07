// ── comments.js — Comments with profile picture support ─────
var _EMOJIS=['💬','😂','❤️','😭','🔥','😍','👍','🤣','😮','💯','😎','🎬'];
var _selEmoji='💬';

function loadComments(movieId){
  api('getComments',{movieId:movieId},function(r){
    if(!r.ok)return;
    var list=r.comments||[];
    // Update counts
    var cnt=document.getElementById('cmtCnt');if(cnt)cnt.textContent='('+list.length+')';
    var ctab=document.getElementById('cmtTabCount');if(ctab)ctab.textContent=list.length;
    // Render list
    var cl=document.getElementById('cmtList');if(cl)cl.innerHTML='';
    list.forEach(function(c){if(cl)cl.appendChild(makeCmtItem(c));});
    // Render input form
    renderCmtForm(movieId);
  });
}

// Build one comment row — shows profile photo if available, else coloured initial
function makeCmtItem(c){
  var d=document.createElement('div');
  d.className='cmt-item';
  var u=getUser();
  var adm=getAdminToken();
  var init=(c.name||c.gmail||'?')[0].toUpperCase();
  // Avatar: real photo if stored, coloured circle with initial otherwise
  var avatarHTML;
  if(c.avatar&&c.avatar.trim()){
    avatarHTML=
      '<div class="cmt-av cmt-av-img">'+
        '<img src="'+h(c.avatar)+'" alt="'+init+'" '+
             'onerror="this.style.display=\'none\';this.nextSibling.style.display=\'grid\'">'+
        '<span class="cmt-av-fallback" style="display:none">'+init+'</span>'+
      '</div>';
  }else{
    avatarHTML='<div class="cmt-av">'+init+'</div>';
  }
  var canDelete=adm||(u&&u.gmail===c.gmail);
  d.innerHTML=
    avatarHTML+
    '<div style="flex:1;min-width:0">'+
      '<div class="cmt-name">'+
        h(c.name||c.gmail)+
        '<span class="cmt-emoji">'+h(c.emoji||'💬')+'</span>'+
      '</div>'+
      '<div class="cmt-txt">'+h(c.comment)+'</div>'+
      '<div class="cmt-date">'+fmtDate(c.date)+'</div>'+
    '</div>'+
    (canDelete?'<span class="cmt-del" onclick="deleteCommentById(\''+c.id+'\')">🗑</span>':'');
  return d;
}

// Comment input form
function renderCmtForm(movieId){
  var u=getUser();
  var cfa=document.getElementById('cmtFA');if(!cfa)return;
  if(u){
    // Show commenter's own avatar above the input
    var init=(u.name||u.gmail||'U')[0].toUpperCase();
    var myAvatarHTML;
    if(u.avatar){
      myAvatarHTML=
        '<div class="cmt-av cmt-av-img" style="width:34px;height:34px;flex-shrink:0">'+
          '<img src="'+h(u.avatar)+'" alt="'+init+'" '+
               'onerror="this.style.display=\'none\';this.nextSibling.style.display=\'grid\'">'+
          '<span class="cmt-av-fallback" style="display:none">'+init+'</span>'+
        '</div>';
    }else{
      myAvatarHTML='<div class="cmt-av" style="width:34px;height:34px;flex-shrink:0">'+init+'</div>';
    }
    var emoRow='<div class="emoji-row">'+
      _EMOJIS.map(function(e){
        return'<button class="emoj" onclick="selEmoji(this,\''+e+'\')" type="button">'+e+'</button>';
      }).join('')+
    '</div>';
    cfa.innerHTML=
      emoRow+
      '<div class="cmt-form" style="align-items:flex-start">'+
        myAvatarHTML+
        '<div style="flex:1">'+
          '<textarea id="cmtTxt" placeholder="Add a comment…"></textarea>'+
        '</div>'+
        '<button onclick="postComment(\''+movieId+'\')" style="align-self:flex-end">Post</button>'+
      '</div>';
    var first=cfa.querySelector('.emoj');
    if(first)first.classList.add('sel');
    _selEmoji='💬';
  }else{
    cfa.innerHTML='<div class="sign-cmt" onclick="showLoginReq()">🔒 Sign in to join the conversation</div>';
  }
}

function selEmoji(btn,emoji){
  _selEmoji=emoji;
  document.querySelectorAll('.emoj').forEach(function(b){b.classList.remove('sel');});
  btn.classList.add('sel');
}

// Post a comment — sends avatar so it's stored in the sheet
function postComment(movieId){
  var u=getUser();if(!u){showLoginReq();return;}
  var ta=document.getElementById('cmtTxt');
  if(!ta||!ta.value.trim()){toastErr('Write something first');return;}
  api('addComment',{
    gmail:u.gmail,
    name:u.name||u.gmail,
    movieId:movieId,
    comment:ta.value.trim(),
    emoji:_selEmoji,
    avatar:u.avatar||''      // ← saved to sheet col 9
  },function(r){
    if(r.ok){toastOK('Comment posted ✓');ta.value='';loadComments(movieId);}
    else toastErr(r.msg||'Error posting comment');
  });
}

function deleteCommentById(id){
  if(!confirm('Delete this comment?'))return;
  var u=getUser();var adm=getAdminToken();
  var m=window._currentMovie;
  api('deleteComment',{token:adm||'',gmail:u?u.gmail:'',id:id},function(r){
    if(r.ok){toastOK('Comment deleted');if(m)loadComments(m.id);}
    else toastErr(r.msg||'Error');
  });
}
