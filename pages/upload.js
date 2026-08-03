// ── upload.js — Upload page logic ───────────────────────────
var _upStep=1,_coverFile=null,_videoFile=null,_coverURL='',_videoURL='';

function initUploadPage(){
  var pgL=document.getElementById('pgLoad');
  var u=getUser();
  if(!u){window.location.href='../pages/login.html?redirect=../pages/upload.html';return;}
  if(pgL)pgL.style.display='none';
  updateNavUI();startPing();
  // Char counters
  var ti=document.getElementById('upTitle'),di=document.getElementById('upDesc');
  if(ti)ti.addEventListener('input',function(){var c=document.getElementById('titleCount');if(c)c.textContent=ti.value.length+'/100';});
  if(di)di.addEventListener('input',function(){var c=document.getElementById('descCount');if(c)c.textContent=di.value.length+'/2000';});
  // Edit mode
  var editId=getParam('edit');
  if(editId){
    api('getMovie',{id:editId},function(r){
      if(r.ok&&(r.movie.uploaderGmail===u.gmail||getAdminToken())){
        prefillEditForm(r.movie);
      }
    });
  }
  goUploadStep(1);
}

function prefillEditForm(m){
  var ti=document.getElementById('upTitle');if(ti)ti.value=m.name||'';
  var di=document.getElementById('upDesc');if(di)di.value=m.description||'';
  var ty=document.getElementById('upType');if(ty)ty.value=m.type||'movie';
  var ca=document.getElementById('upCat');if(ca)ca.value=m.category||'movies';
  var co=document.getElementById('upCountry');if(co)co.value=m.country||'';
  var yr=document.getElementById('upYear');if(yr)yr.value=m.year||2026;
  var rt=document.getElementById('upRating');if(rt)rt.value=m.rating||'';
  var sn=document.getElementById('upSeason');if(sn)sn.value=m.season||1;
  var ep=document.getElementById('upEpisode');if(ep)ep.value=m.episode||1;
  var fn=document.getElementById('mfNew')||document.getElementById('upIsNew');if(fn)fn.checked=m.isNew||false;
  var ff=document.getElementById('mfFeat')||document.getElementById('upFeatured');if(ff)ff.checked=m.featured||false;
  _coverURL=m.cover||'';_videoURL=m.videoURL||'';
  window._editMovieId=m.id;
}

function goUploadStep(step){
  // Validate current step before advancing
  if(step>_upStep){
    if(_upStep===1){
      var title=document.getElementById('upTitle');
      if(!title||!title.value.trim()){toastErr('Please enter a video title');return;}
    }
    if(_upStep===2&&step===3){
      // Check at least one file or URL exists
    }
  }
  _upStep=step;
  [1,2,3].forEach(function(s){
    var card=document.getElementById('uploadStep'+s);
    if(card)card.classList.toggle('hidden',s!==step);
    var ind=document.getElementById('step'+s+'-ind');
    if(ind){ind.classList.toggle('active',s===step);ind.classList.toggle('done',s<step);}
  });
  if(step===3)fillSummary();
  window.scrollTo({top:0,behavior:'smooth'});
}

function fillSummary(){
  var title=document.getElementById('upTitle'),cat=document.getElementById('upCat'),yr=document.getElementById('upYear');
  var sc=document.getElementById('usSumCover');
  if(sc&&_coverURL)sc.src=_coverURL;
  var st=document.getElementById('usSumTitle');if(st&&title)st.textContent=title.value;
  var sm=document.getElementById('usSumMeta');
  if(sm){sm.textContent=[cat?cat.options[cat.selectedIndex].text:'',yr?yr.value:''].filter(Boolean).join(' · ');}
}

// Cover selection
function onCoverSelected(input){
  var file=input.files[0];if(!file)return;
  if(file.size>5*1024*1024){toastErr('Cover image must be under 5MB');input.value='';return;}
  _coverFile=file;
  var fn=document.getElementById('coverFilename');if(fn){fn.textContent=file.name;fn.classList.remove('hidden');}
  var dz=document.getElementById('coverDropZone');if(dz)dz.style.display='none';
  var pr=document.getElementById('coverPreviewRow');if(pr)pr.classList.remove('hidden');
  var img=document.getElementById('coverPreviewImg');
  if(img){var reader=new FileReader();reader.onload=function(e){img.src=e.target.result;};reader.readAsDataURL(file);}
}
function handleCoverDrop(e){e.preventDefault();var dt=e.dataTransfer;if(dt.files.length){var input=document.getElementById('coverFile');input.files=dt.files;onCoverSelected(input);}var dz=document.getElementById('coverDropZone');if(dz)dz.classList.remove('dz-hover');}
function removeCover(){_coverFile=null;_coverURL='';var dz=document.getElementById('coverDropZone');if(dz)dz.style.display='';var pr=document.getElementById('coverPreviewRow');if(pr)pr.classList.add('hidden');var fi=document.getElementById('coverFile');if(fi)fi.value='';}

// Video selection
var _MAX_VIDEO=100*1024*1024;
function onVideoSelected(input){
  var file=input.files[0];if(!file)return;
  if(file.size>_MAX_VIDEO){var se=document.getElementById('videoSizeErr');if(se)se.classList.remove('hidden');input.value='';return;}
  var se=document.getElementById('videoSizeErr');if(se)se.classList.add('hidden');
  _videoFile=file;
  var fn=document.getElementById('videoFilename');if(fn){fn.textContent=file.name+' ('+Math.round(file.size/1024/1024,1)+' MB)';fn.classList.remove('hidden');}
  var dz=document.getElementById('videoDropZone');if(dz)dz.style.display='none';
  var pr=document.getElementById('videoPreviewRow');if(pr)pr.classList.remove('hidden');
  var vid=document.getElementById('videoPreviewVid');
  if(vid){var url=URL.createObjectURL(file);vid.src=url;}
}
function handleVideoDrop(e){e.preventDefault();var dt=e.dataTransfer;if(dt.files.length){var input=document.getElementById('videoFile');input.files=dt.files;onVideoSelected(input);}var dz=document.getElementById('videoDropZone');if(dz)dz.classList.remove('dz-hover');}
function removeVideo(){_videoFile=null;_videoURL='';var dz=document.getElementById('videoDropZone');if(dz)dz.style.display='';var pr=document.getElementById('videoPreviewRow');if(pr)pr.classList.add('hidden');var fi=document.getElementById('videoFile');if(fi)fi.value='';}

// Upload & publish
async function startUpload(){
  var u=getUser();if(!u)return;
  var btn=document.getElementById('uploadSubmitBtn'),sa=document.getElementById('step3Actions'),st=document.getElementById('uploadStatus');
  if(btn){btn.disabled=true;btn.textContent='Uploading…';}
  // Phase 1: cover
  if(_coverFile){
    setPhase(1,'📷 Uploading cover image…');
    try{
      var coverRes=await uploadToCloudinaryAsync(_coverFile,CDN_USER,'upCoverBar','upCoverPct');
      _coverURL=coverRes.url;setPhase(1,'✅ Cover uploaded');
    }catch(e){setPhase(1,'❌ Cover upload failed: '+e.message);if(btn){btn.disabled=false;btn.textContent='⬆ Upload & Publish';}return;}
  }
  // Phase 2: video
  if(_videoFile){
    setPhase(2,'🎬 Uploading video (this may take a while)…');
    try{
      var vidRes=await uploadToCloudinaryAsync(_videoFile,CDN_USER,'upVideoBar','upVideoPct');
      _videoURL=vidRes.url;setPhase(2,'✅ Video uploaded');
    }catch(e){setPhase(2,'❌ Video upload failed: '+e.message);showRetry();if(btn){btn.disabled=false;btn.textContent='⬆ Upload & Publish';}return;}
  }
  // Phase 3: save to sheet
  setPhase(3,'💾 Saving to KEYTUBE…');
  var title=document.getElementById('upTitle'),desc=document.getElementById('upDesc'),
      type=document.getElementById('upType'),cat=document.getElementById('upCat'),
      country=document.getElementById('upCountry'),yr=document.getElementById('upYear'),
      rating=document.getElementById('upRating'),season=document.getElementById('upSeason'),
      episode=document.getElementById('upEpisode'),isNew=document.getElementById('upIsNew'),feat=document.getElementById('upFeatured');
  var data={gmail:u.gmail,name:title?title.value.trim():'Untitled',description:desc?desc.value.trim():'',type:type?type.value:'movie',category:cat?cat.value:'movies',cover:_coverURL,videoURL:_videoURL,downloadURL:_videoURL,country:country?country.value.trim():'',year:yr?yr.value:2026,rating:rating?rating.value.trim():'',season:season?season.value:'1',episode:episode?episode.value:'1',isNew:isNew?isNew.checked:true,featured:feat?feat.checked:false,language:cat?cat.value:''};
  var editId=window._editMovieId;
  var action=editId?'updateMovie':'addMovie';
  if(editId)data.id=editId;
  api(action,data,function(r){
    if(r.ok){
      setPhase(3,'✅ Published!');
      var done=document.getElementById('uploadDone');if(done)done.classList.remove('hidden');
      if(sa)sa.style.display='none';
      var wnb=document.getElementById('watchNowBtn');if(wnb&&r.id)wnb.onclick=function(){window.open('../pages/watch.html?id='+r.id,'_blank');};
      if(st)st.textContent='';
      toastOK('Video published! 🎉');
    }else{
      setPhase(3,'❌ Save failed: '+r.msg);showRetry();
      if(btn){btn.disabled=false;btn.textContent='⬆ Upload & Publish';}
    }
  });
}

function uploadToCloudinaryAsync(file,config,barId,pctId){
  return new Promise(function(resolve,reject){
    var fd=new FormData();fd.append('file',file);fd.append('upload_preset',config.preset);fd.append('folder',config.folder);
    var xhr=new XMLHttpRequest();
    xhr.open('POST','https://api.cloudinary.com/v1_1/'+config.cloud+'/upload');
    xhr.upload.onprogress=function(e){
      if(e.lengthComputable){
        var p=Math.round(e.loaded/e.total*100);
        var bar=document.getElementById(barId),pct=document.getElementById(pctId);
        if(bar)bar.style.width=p+'%';if(pct)pct.textContent=p+'%';
      }
    };
    xhr.onload=function(){
      try{var r=JSON.parse(xhr.responseText);if(r.secure_url)resolve({url:r.secure_url,publicId:r.public_id});else reject(new Error(r.error&&r.error.message||'Upload failed'));}
      catch(e){reject(e);}
    };
    xhr.onerror=function(){reject(new Error('Network error'));};
    xhr.send(fd);
  });
}

function setPhase(phase,msg){
  var p1=document.getElementById('upPhase1'),p2=document.getElementById('upPhase2'),p3=document.getElementById('upPhase3');
  var st=document.getElementById('uploadStatus');
  if(st)st.textContent=msg;
  var labels={1:'upCoverPct',2:'upVideoPct',3:'upSavePct'};
  var el=document.getElementById(labels[phase]);if(el)el.textContent=msg;
}

function showRetry(){var rr=document.getElementById('retryRow'),sa=document.getElementById('step3Actions');if(rr)rr.classList.remove('hidden');if(sa)sa.style.display='none';}
function retrySave(){var sa=document.getElementById('step3Actions'),rr=document.getElementById('retryRow');if(sa)sa.style.display='';if(rr)rr.classList.add('hidden');startUpload();}
function resetUpload(){
  _upStep=1;_coverFile=null;_videoFile=null;_coverURL='';_videoURL='';window._editMovieId=null;
  ['upTitle','upDesc','upCountry','upRating'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  var done=document.getElementById('uploadDone');if(done)done.classList.add('hidden');
  var sa=document.getElementById('step3Actions');if(sa)sa.style.display='';
  var btn=document.getElementById('uploadSubmitBtn');if(btn){btn.disabled=false;btn.textContent='⬆ Upload & Publish';}
  removeCover();removeVideo();goUploadStep(1);
}
