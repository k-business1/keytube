var _selAdType = 'banner';
var _selBudget = '$50–$150';
var _selCurrency = 'monthly';
 
window.onload = function(){
  var pgL=document.getElementById('pgLoad');if(pgL)pgL.style.display='none';
  // Load stats
  api('getStats',{token:''},function(r){
    if(r.ok&&r.stats){
      var u=document.getElementById('heroUsers');if(u&&r.stats.users>0)u.textContent=(r.stats.users>1000?Math.round(r.stats.users/1000)+'K+':r.stats.users+'+');
      var m=document.getElementById('heroMovies');if(m&&r.stats.movies>0)m.textContent=r.stats.movies+'+';}
  });
  // Set min date to today
  var today=new Date().toISOString().split('T')[0];
  var sd=document.getElementById('startDate'),ed=document.getElementById('endDate');
  if(sd)sd.min=today;if(ed)ed.min=today;
  // Char counters
  document.getElementById('adTitle').addEventListener('input',function(){document.getElementById('titleCount').textContent=this.value.length;});
  document.getElementById('adDesc').addEventListener('input',function(){document.getElementById('descCount').textContent=this.value.length;});
  showPreview();
};
 
function selectAdType(type,card){
  _selAdType=type;
  document.querySelectorAll('.adv-type-card').forEach(function(c){c.classList.remove('selected');});
  card.classList.add('selected');
  document.getElementById('adTypeField').value=type;
  onAdTypeChange(type);
}
 
function onAdTypeChange(type){
  _selAdType=type;
  var imgRow=document.getElementById('imgRow');
  var vidRow=document.getElementById('vidRow');
  if(type==='video'){if(imgRow)imgRow.style.display='none';if(vidRow)vidRow.style.display='';}
  else{if(imgRow)imgRow.style.display='';if(vidRow)vidRow.style.display='none';}
  showPreview();
}
 
function showPreview(){
  var p=document.getElementById('adPreview');if(p)p.classList.add('show');
}
 
function updatePreview(){
  var title=document.getElementById('adTitle').value||'Your Ad Title';
  var desc=document.getElementById('adDesc').value||'Your ad description will appear here.';
  var img=document.getElementById('adImage');
  var pt=document.getElementById('prevTitle');if(pt)pt.textContent=title.slice(0,60);
  var pd=document.getElementById('prevDesc');if(pd)pd.textContent=desc.slice(0,120);
  var pw=document.getElementById('prevImgWrap');
  if(pw&&img&&img.value){pw.innerHTML='<img src="'+h(img.value)+'" onerror="this.parentNode.innerHTML=\'<span style=font-size:1.4rem>🖼</span>\'">';}
  else if(pw){pw.innerHTML='<span style="font-size:1.4rem">🖼</span>';}
}
 
function selectBudget(budget,type,pill){
  _selBudget=budget;_selCurrency=type;
  document.querySelectorAll('.budget-pill').forEach(function(p){p.classList.remove('selected');});
  pill.classList.add('selected');
}
 
function toggleFaq(item){item.classList.toggle('open');}
 
function submitAd(){
  var er=document.getElementById('advErr');er.textContent='';
 
  var data={
    businessName: (document.getElementById('bizName').value||'').trim(),
    contactName:  (document.getElementById('contactName').value||'').trim(),
    email:        (document.getElementById('contactEmail').value||'').trim(),
    phone:        (document.getElementById('contactPhone').value||'').trim(),
    website:      (document.getElementById('contactWebsite').value||'').trim(),
    adType:       _selAdType,
    adTitle:      (document.getElementById('adTitle').value||'').trim(),
    adDescription:(document.getElementById('adDesc').value||'').trim(),
    adImageURL:   (document.getElementById('adImage').value||'').trim(),
    adVideoURL:   (document.getElementById('adVideo')?document.getElementById('adVideo').value:'').trim(),
    adLinkURL:    (document.getElementById('adLink').value||'').trim(),
    targetCategory:document.getElementById('adCategory').value,
    budget:       _selBudget,
    currency:     document.getElementById('adCurrency').value,
    startDate:    document.getElementById('startDate').value,
    endDate:      document.getElementById('endDate').value,
    message:      (document.getElementById('adMessage').value||'').trim()
  };
 
  // Validate
  if(!data.businessName){ er.textContent='Enter your business name.'; window.scrollTo({top:document.querySelector('.adv-form-wrap').offsetTop,behavior:'smooth'}); return;}
  if(!data.contactName){er.textContent='Enter your contact name.';return;}
  if(!data.email){er.textContent='Enter your email address.';return;}
  if(!data.adTitle){er.textContent='Enter your ad title.';return;}
  if(!data.adDescription){er.textContent='Enter your ad description.';return;}
  if(!data.adLinkURL){er.textContent='Enter your destination link (where users go when they click).';return;}
 
  var btn=document.getElementById('advSubmitBtn');
  btn.disabled=true;btn.textContent='Submitting…';
 
  api('submitAdRequest',data,function(r){
    btn.disabled=false;btn.textContent='📤 Submit Ad Request';
    if(r.ok){
      document.getElementById('advFormWrap').style.display='none';
      document.querySelector('.adv-types').style.display='none';
      var succ=document.getElementById('advSuccess');succ.classList.add('show');
      var ref=document.getElementById('advRefId');if(ref&&r.id)ref.textContent='Ref: #'+r.id;
      window.scrollTo({top:0,behavior:'smooth'});
      toastOK('Ad request submitted! ✓');
    } else {
      er.textContent=r.msg||'Submission failed. Please try again.';
      window.scrollTo({top:document.getElementById('advErr').offsetTop-20,behavior:'smooth'});
    }
  });
}
 
function resetForm(){
  document.getElementById('advFormWrap').style.display='';
  document.querySelector('.adv-types').style.display='';
  document.getElementById('advSuccess').classList.remove('show');
  ['bizName','contactName','contactEmail','contactPhone','contactWebsite','adTitle','adDesc','adLink','adImage','adMessage'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  window.scrollTo({top:0,behavior:'smooth'});
}
 
function h(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
