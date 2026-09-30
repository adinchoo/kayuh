// app.js v8.4.3 FULL iPhone 14 FIXED - upload + chart lock + tap
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
let records = {activities:[], weights:[], food_logs:[], steps:[], sleep:[]};
let profile = JSON.parse(localStorage.getItem('dreeve_profile')||'null') || {full_name:"Adinchoo Dreeve", primary_goal:"improve_fitness", target_weight_kg:75, target_steps:10000, target_calories:2200, target_protein:140};

function toast(msg,isErr=false){ const t=$("#toast"); t.textContent=msg; t.style.background=isErr?"#ff4444":"#222"; t.style.display="block"; clearTimeout(t._tm); t._tm=setTimeout(()=>t.style.display="none",3000); }
function esc(s){ return String(s||"").replace(/[&<>"]/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function switchView(id){ $$('.view').forEach(v=>v.classList.remove('active')); const el=document.getElementById(id); if(el) el.classList.add('active'); $$('.bottom-nav button').forEach(b=>b.classList.toggle('active', b.dataset.view===id)); window.scrollTo(0,0); if(id==='dashboardView') setTimeout(renderDreeveCharts,100); }
$$('.bottom-nav button').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));

let charts={};
function destroyCharts(){ Object.values(charts).forEach(c=>{try{c.destroy()}catch(e){}}); charts={}; }
function safeChart(canvas){
  if(!canvas) return null;
  canvas.removeAttribute('height');
  canvas.removeAttribute('width');
  canvas.style.width='100%'; canvas.style.height='100%';
  let wrap=canvas.closest('.chart-wrap');
  if(!wrap){ const w=document.createElement('div'); w.className='chart-wrap'; canvas.parentNode.insertBefore(w,canvas); w.appendChild(canvas); wrap=w; }
  return canvas;
}
function renderDreeveCharts(){
  destroyCharts();
  const commonOpts={responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:'#222'},ticks:{color:'#888'}},y:{grid:{color:'#222'},ticks:{color:'#888'}}}};
  try{
    const wCtx=safeChart($("#weightChart"));
    if(wCtx) charts.w=new Chart(wCtx,{type:'line',data:{labels:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],datasets:[{data:[76.2,76.0,75.8,75.7,75.5,75.4,75.2],borderColor:'#c6ff00',backgroundColor:'rgba(198,255,0,.15)',fill:true,tension:.4}]},options:commonOpts});
    const cCtx=safeChart($("#caloriesChart"));
    if(cCtx) charts.c=new Chart(cCtx,{type:'bar',data:{labels:['M','T','W','T','F','S','S'],datasets:[{data:[2100,1800,2200,2000,2300,1900,2050],backgroundColor:'#c6ff00'}]},options:commonOpts});
    const sCtx=safeChart($("#stepsChart"));
    if(sCtx) charts.s=new Chart(sCtx,{type:'line',data:{labels:['M','T','W','T','F','S','S'],datasets:[{data:[8000,10500,9200,11000,7500,12000,9800],borderColor:'#58a9ff',tension:.4}]},options:commonOpts});
    const mCtx=safeChart($("#monthlyChart"));
    if(mCtx) charts.m=new Chart(mCtx,{type:'line',data:{labels:['W1','W2','W3','W4'],datasets:[{label:'km',data:[12,18,15,22],borderColor:'#5de8b6',tension:.4}]},options:commonOpts});
  }catch(e){ console.warn('chart err',e); }
}

function renderActivitiesTable(filter=''){
  const el=document.getElementById('activitiesTable'); if(!el) return;
  let list=[...records.activities].sort((a,b)=>new Date(b.logged_at)-new Date(a.logged_at));
  if(filter){ const f=filter.toLowerCase(); list=list.filter(a=> new Date(a.logged_at).toISOString().startsWith(filter) || String(a.activity_name||"").toLowerCase().includes(f) || String(a.source||"").toLowerCase().includes(f)); }
  if(!list.length){ el.innerHTML='<div class="muted" style="padding:20px;text-align:center">No activities - import GPX/FIT file</div>'; }
  else{
    el.innerHTML=list.slice(0,150).map(a=>`<div class="row act-row" data-act-id="${a.id}" style="cursor:pointer"><div style="flex:1"><strong>${esc(a.activity_name)} • ${a.distance_km}km</strong><br><small class="muted">${new Date(a.logged_at).toLocaleDateString('en-GB')} • ${a.duration_minutes}min • ${esc(a.source||'')} ${a.avg_hr? '• ❤️'+a.avg_hr:''}</small></div><div style="text-align:right"><span style="font-weight:800">${a.calories_burned||0}</span><br><small style="color:#c6ff00;font-weight:700">View →</small></div></div>`).join('');
    el.querySelectorAll('.act-row').forEach(r=>{ const fn=()=>viewActivityReport(r.dataset.actId); r.addEventListener('click',fn); r.addEventListener('touchend',fn,{passive:true}); });
  }
  const recent=document.getElementById('recentActivities');
  if(recent){
    recent.innerHTML=list.slice(0,5).map(a=>`<div class="row recent-row" data-act-id="${a.id}" style="cursor:pointer"><div><strong>${esc(a.activity_name)}</strong> • ${a.distance_km}km</div><small class="muted">${new Date(a.logged_at).toLocaleDateString('en-GB')}</small></div>`).join('')||'<div class="muted">No activities yet</div>';
    recent.querySelectorAll('.recent-row').forEach(r=>{ const fn=()=>viewActivityReport(r.dataset.actId); r.addEventListener('click',fn); });
  }
}

async function viewActivityReport(id){
  try{
    const act=records.activities.find(a=>String(a.id)===String(id));
    if(!act) return toast('Activity not found',true);
    toast('Opening '+act.activity_name+'...');
    if(typeof GpxReport==='undefined'){ return toast('gpx-report.js not loaded',true); }
    let trackData=null;
    try{ trackData=await GpxReport.loadActivityById(id); }catch(e){}
    if(trackData && trackData.points){ await GpxReport.buildFromTrackData(trackData); }
    else{ await GpxReport.buildFromActivity(act); }
    switchView('gpxReportView');
  }catch(e){ toast('Report failed: '+e.message,true); console.error(e); }
}
window.viewActivityReport=viewActivityReport;

function initGpxUpload(){
  const gpxFile=document.getElementById('gpxReportFile');
  const drop=document.getElementById('gpxDropZone');
  if(!gpxFile) return;
  gpxFile.addEventListener('change', async e=>{
    const f=e.target.files[0]; if(!f) return;
    try{
      toast('Reading '+f.name+'...');
      if(typeof GpxReport==='undefined') throw new Error('gpx-report.js missing');
      await GpxReport.loadFile(f);
      switchView('gpxReportView');
      toast('✅ Loaded '+f.name);
      renderActivitiesTable();
    }catch(err){ toast(err.message,true); console.error(err); }
    e.target.value='';
  });
  if(drop){
    drop.addEventListener('dragover',ev=>{ev.preventDefault(); drop.style.borderColor='#c6ff00';});
    drop.addEventListener('dragleave',()=>{drop.style.borderColor='#333';});
    drop.addEventListener('drop',async ev=>{ ev.preventDefault(); drop.style.borderColor='#333'; const f=ev.dataTransfer.files[0]; if(f){ try{ await GpxReport.loadFile(f); switchView('gpxReportView'); toast('✅ '+f.name); renderActivitiesTable(); }catch(err){toast(err.message,true);} } });
  }
}

function boot(){
  const params=new URLSearchParams(location.search);
  const viewParam=params.get('view');
  if(viewParam && document.getElementById(viewParam)) switchView(viewParam);
  else switchView('dashboardView');
  setTimeout(renderDreeveCharts,200);
  initGpxUpload();
  try{
    const saved=JSON.parse(localStorage.getItem('dreeve_activities')||'[]');
    if(saved.length) records.activities=saved;
  }catch{}
  if(!records.activities.length){
    records.activities=[
      {id:'demo_run_'+Date.now(), activity_name:'Running', distance_km:5.23, duration_minutes:32, calories_burned:320, avg_hr:145, max_hr:172, logged_at:new Date().toISOString(), source:'Demo'},
      {id:'demo_bike_'+(Date.now()-1), activity_name:'Cycling', distance_km:22.5, duration_minutes:68, calories_burned:540, avg_hr:132, max_hr:160, logged_at:new Date(Date.now()-86400000).toISOString(), source:'Demo'}
    ];
  }
  renderActivitiesTable();
  document.getElementById('activityDateFilter')?.addEventListener('change',e=>renderActivitiesTable(e.target.value));
  document.getElementById('activitySearchFilter')?.addEventListener('input',e=>renderActivitiesTable(e.target.value));
  document.getElementById('profileContent').innerHTML=`<div><strong>${esc(profile.full_name)}</strong><br><small class="muted">Goal: ${esc(profile.primary_goal)} • Target: ${profile.target_weight_kg}kg</small></div>`;
}
document.addEventListener('DOMContentLoaded', boot);
let _resizeTimer; window.addEventListener('resize', ()=>{ clearTimeout(_resizeTimer); _resizeTimer=setTimeout(()=>renderDreeveCharts(),400); });
window.addEventListener('orientationchange', ()=>{ setTimeout(renderDreeveCharts,500); });