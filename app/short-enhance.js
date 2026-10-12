/* short-enhance.js — load AFTER short.js, BEFORE initShorts() */
(function(){
'use strict';
var P={
heart:'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
comment:'M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z',
save:'M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z',
share:'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z',
eye:'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z'
};
function svg(k){return '<svg viewBox="0 0 24 24"><path d="'+P[k]+'"/></svg>';}

/* ---- replace emoji icons with SVG ---- */
var icons=document.querySelectorAll('.ks-action-icon');
['heart','comment','save','share','eye'].forEach(function(k,i){if(icons[i])icons[i].innerHTML=svg(k);});

/* ---- icon state functions (override) ---- */
window.updateLikeIcon=function(){var i=document.getElementById('ksLikeIcon');if(i){i.innerHTML=svg('heart');i.classList.toggle('on',!!window._isLiked);}};
window.updateSaveIcon=function(){var i=document.getElementById('ksSaveIcon'),t=document.getElementById('ksSaveTxt');if(i){i.innerHTML=svg('save');i.classList.toggle('on',!!window._isSaved);}if(t)t.textContent=window._isSaved?'Saved':'Save';};

/* ---- fixed resetActions (original referenced undefined "dot" and crashed) ---- */
window.resetActions=function(){
 ['ksLikeCount','ksCmtCount','ksViewCount'].forEach(function(id){setText(id,'0');});
 setText('ksSaveTxt','Save');
 var l=document.getElementById('ksLikeIcon');if(l){l.innerHTML=svg('heart');l.classList.remove('on');}
 var s=document.getElementById('ksSaveIcon');if(s){s.innerHTML=svg('save');s.classList.remove('on');}
 var d=document.getElementById('ksFollowDot');if(d){d.textContent='+';d.classList.remove('following');}
 var im=document.getElementById('ksChImg');if(im){im.src='';im.style.display='none';}
 var n=document.getElementById('ksChInit');if(n){n.textContent='?';n.style.display='';}
};

/* ---- hearts ---- */
var stage=document.getElementById('ksStage');
var layer=document.createElement('div');layer.className='ks-hearts';layer.id='ksHearts';stage.appendChild(layer);
var COLORS=['#ff2d55','#ff4d6d','#ff6a8b','#ff3b30','#ff7ab6','#ffffff'];
function rand(a,b){return a+Math.random()*(b-a);}
function hearts(x,y){
 var r=stage.getBoundingClientRect();x-=r.left;y-=r.top;
 var rip=document.createElement('div');rip.className='ks-ripple';rip.style.left=x+'px';rip.style.top=y+'px';layer.appendChild(rip);setTimeout(function(){rip.remove();},700);
 var b=document.createElement('div');b.className='ks-heart-big';b.style.left=x+'px';b.style.top=y+'px';b.style.setProperty('--rot',rand(-18,18)+'deg');b.innerHTML=svg('heart');layer.appendChild(b);setTimeout(function(){b.remove();},1100);
 var n=9+Math.floor(Math.random()*5);
 for(var i=0;i<n;i++){(function(){
  var s=document.createElement('div');s.className='ks-heart-sm';
  s.style.left=x+'px';s.style.top=y+'px';
  s.style.setProperty('--s',rand(16,34)+'px');
  s.style.setProperty('--dx',rand(-110,110)+'px');
  s.style.setProperty('--dy',rand(-260,-90)+'px');
  s.style.setProperty('--rot',rand(-40,40)+'deg');
  s.style.setProperty('--d',rand(0,.25)+'s');
  s.style.setProperty('--c',COLORS[Math.floor(Math.random()*COLORS.length)]);
  s.innerHTML=svg('heart');layer.appendChild(s);setTimeout(function(){s.remove();},1600);
 })();}
 if(navigator.vibrate)try{navigator.vibrate(18);}catch(e){}
}

/* ---- tap handling: single tap = prev/next, double tap = like ---- */
document.querySelectorAll('.ks-tap-prev,.ks-tap-next').forEach(function(z){z.onclick=null;z.removeAttribute('onclick');});
var lastT=0,lastX=0,lastY=0,timer=null;
stage.addEventListener('click',function(e){
 if(e.target.closest('.ks-autonext'))return;
 var now=Date.now(),x=e.clientX,y=e.clientY;
 if(now-lastT<300&&Math.abs(x-lastX)<70&&Math.abs(y-lastY)<70){
  clearTimeout(timer);lastT=0;
  hearts(x,y);
  var u=getUser();
  if(!u){setTimeout(showLoginReq,500);return;}
  if(!window._isLiked)toggleLike();
  var li=document.getElementById('ksLikeIcon');if(li){li.classList.remove('pop');void li.offsetWidth;li.classList.add('pop');}
  return;
 }
 lastT=now;lastX=x;lastY=y;
 var r=stage.getBoundingClientRect(),side=(x-r.left)/r.width,inZone=y>r.top+80&&y<r.bottom-120;
 clearTimeout(timer);
 if(!inZone)return;
 timer=setTimeout(function(){if(side<.4)prevVideo();else if(side>.6)nextVideo();},280);
});

/* one-time hint */
try{if(!localStorage.getItem('ks_dt_hint')){localStorage.setItem('ks_dt_hint','1');setTimeout(function(){toast('Double-tap to like ❤️','');var t=document.getElementById('toast');},2500);}}catch(e){}
})();
