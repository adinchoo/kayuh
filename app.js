"use strict";
// ADINCHOO DREEVE v8.4.2 - STABLE + Activities Full Report like GPX
const SUPABASE_URL = "https://dxgzluurwsoytqlasuup.supabase.co";
const SUPABASE_KEY = "sb_publishable_RTeGJ9m_CL26fUMXwEGLJQ_JfGiLyit";
let db=null,user=null,profile=null;
let records={meals:[],activities:[],body:[],workoutSessions:[],workoutExercises:[],photos:[],water:[],sleep:[],steps:[],hr:[]};
let selectedFoods=[], currentCategory="Main", currentCalendarDate=new Date();
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

function updateStandaloneChecks(){
  const el = $("#checkSW");
  if(el) el.textContent = ('serviceWorker' in navigator)? 'Supported' : 'No';
  if('serviceWorker' in navigator){
    navigator.serviceWorker.getRegistration().then(reg=>{
      if(el) el.textContent = reg? `Registered ${reg.active?'active':''}` : 'Not registered';
    });
  }
}
const show=id=>{
  ["setupScreen","authScreen","app"].forEach(x=>{
    const el=$("#"+x);
    if(!el) return;
    el.classList.toggle("hidden", x!==id);
  });
};
const toast=(m,bad=false)=>{const t=$("#toast"); if(!t) return; t.textContent=m; t.style.background=bad?"#ff7a86":"#c6ff00"; t.style.color=bad?"#fff":"#000"; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),3500)};
const esc=v=>{const d=document.createElement("div");d.textContent=String(v??"");return d.innerHTML};
const dayStr=d=>{const dt=new Date(d);return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`};
const todayStr=()=>dayStr(new Date());
const isSameDay=(a,b)=>dayStr(a)===dayStr(b);
const isToday=d=>isSameDay(d,new Date());
function client(){ if(!window.supabase) throw new Error("Supabase SDK not loaded"); db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true, flowType:'pkce'}}) }

async function registerSW(){
  if(!('serviceWorker' in navigator)) { updateStandaloneChecks(); return; }
  try{
    const reg = await navigator.serviceWorker.register('./sw.js', {scope:'./', updateViaCache:'none'});
    updateStandaloneChecks();
    reg.addEventListener('updatefound', ()=>{
      const nw = reg.installing;
      nw.addEventListener('statechange', ()=>{
        if(nw.state==='installed' && navigator.serviceWorker.controller){
          toast('Update available - close app to update');
        }
      });
    });
    document.addEventListener('visibilitychange', ()=>{
      if(document.visibilityState==='visible'){ reg.update().catch(()=>{}); }
    });
  }catch(e){ console.warn('SW reg failed', e); if($("#checkSW")) $("#checkSW").textContent = 'Failed: '+e.message; }
}

async function boot(){
  try{
    registerSW();
    client();
    const {data:{session}} = await db.auth.getSession();
    if(session){ user=session.user; await enterApp(); }
    else { show("authScreen"); if(window.setAuthTab) window.setAuthTab("login"); }
    db.auth.onAuthStateChange(async (ev,s)=>{
      if(ev==="SIGNED_IN"&&s?.user){ user=s.user; await enterApp(); }
      if(ev==="SIGNED_OUT"){ show("authScreen"); if(window.setAuthTab) window.setAuthTab("login"); }
    });
    window.addEventListener('orientationchange', ()=>{
      setTimeout(()=>{ if(window.GpxReport?.map){ window.GpxReport.map.invalidateSize(); } renderDreeveCharts(); }, 600);
    });
    if(isIOS && window.visualViewport){
      window.visualViewport.addEventListener('resize', ()=>{
        document.documentElement.style.setProperty('--vh', `${window.visualViewport.height * 0.01}px`);
      });
    }
  }catch(e){ console.error(e); show("authScreen"); toast(e.message,true) }
}

function initAuth(){
  const loginForm=$("#loginForm");
  const signupForm=$("#signupForm");
  const createBtn=$("#createAccountBtn");
  if(createBtn){ createBtn.disabled=false; createBtn.style.pointerEvents="auto"; createBtn.style.opacity="1"; }
  loginForm?.addEventListener("submit", async e=>{
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    const btn=e.currentTarget.querySelector('button[type="submit"]');
    const oldText=btn?btn.textContent:"";
    if(btn){ btn.disabled=true; btn.textContent="Signing in..."; }
    const {data,error}=await db.auth.signInWithPassword({email:String(f.get("email")||"").trim(),password:String(f.get("password")||"")});
    if(btn){ btn.disabled=false; btn.textContent=oldText; }
    if(error) return toast(error.message,true);
    user=data.user; await enterApp(); toast("Welcome back" + (isStandalone?" - PWA":""));
  });
  signupForm?.addEventListener("submit", async e=>{
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    const pass=String(f.get("password")||"");
    const confirm=String(f.get("confirm_password")||"");
    if(pass!==confirm) return toast("Passwords mismatch",true);
    if(pass.length<8) return toast("Password min 8 chars",true);
    const btn=e.currentTarget.querySelector('button[type="submit"]');
    const oldText=btn?btn.textContent:"";
    if(btn){ btn.disabled=true; btn.textContent="Creating..."; }
    const detail={
      full_name:String(f.get("full_name")||"").trim()||"User",
      date_of_birth:String(f.get("date_of_birth")||"")||null,
      height_cm:String(f.get("height_cm")||"170"),
      current_weight_kg:String(f.get("current_weight_kg")||"70"),
      starting_weight_kg:String(f.get("current_weight_kg")||"70"),
      target_weight_kg:String(f.get("target_weight_kg")||"68"),
      primary_goal:String(f.get("primary_goal")||"lose_weight"),
      target_calories:String(f.get("target_calories")||"2200"),
      target_protein_g:String(f.get("target_protein_g")||"180"),
      target_steps:"10000", target_sleep_hours:"7.5",
    };
    const {data,error}=await db.auth.signUp({email:String(f.get("email")||"").trim(),password:pass,options:{data:detail}});
    if(btn){ btn.disabled=false; btn.textContent=oldText; }
    if(error) return toast(error.message,true);
    if(data.session){ user=data.user; await enterApp(); toast("Account created"); }
    else { toast("Account created — check email"); if(window.setAuthTab) window.setAuthTab("login"); }
  });
  $("#forgotButton")?.addEventListener('click',async()=>{ const email=prompt("Email for reset:"); if(!email) return; const {error}=await db.auth.resetPasswordForEmail(email); toast(error?error.message:"Reset sent",!!error); });
  $("#logoutButton")?.addEventListener('click',async()=>{ await db.auth.signOut(); user=null; profile=null; show("authScreen"); if(window.setAuthTab) window.setAuthTab("login"); });
  $("#syncButton")?.addEventListener('click',async()=>{ await loadRecords(); renderAll(); toast("Synced") });
}

async function enterApp(){
  show("app");
  const ps=$("#pageSub"); if(ps) ps.textContent=`${new Date().getFullYear()} • iPhone 14 PWA ${isStandalone?'Installed ✓':'Browser'} • ${SUPABASE_URL.split('.')[0].split('//')[1]}`;
  await Promise.all([loadProfile(), loadRecords()]);
  initUI(); renderAll(); updateAutoSyncUrl();
  const params = new URLSearchParams(location.search);
  const viewParam = params.get('view');
  if(viewParam && document.getElementById(viewParam)){ setTimeout(()=>switchView(viewParam), 300); }
}
function updateAutoSyncUrl(){
  const el=$("#finalUrl"); if(!el||!user) return;
  el.textContent = `${SUPABASE_URL}/functions/v1/health-auto-export?user_id=${user.id}`;
  const uid=$("#userIdDisplay"); if(uid) uid.textContent=user.id;
}
async function loadProfile(){
  const {data,error}=await db.from("profiles").select("*").eq("id",user.id).single();
  if(error){
    const meta=user.user_metadata||{};
    const payload={
      id:user.id, full_name:meta.full_name||'User', date_of_birth:meta.date_of_birth||null,
      height_cm:parseFloat(meta.height_cm)||170, starting_weight_kg:parseFloat(meta.current_weight_kg)||70,
      current_weight_kg:parseFloat(meta.current_weight_kg)||70, target_weight_kg:parseFloat(meta.target_weight_kg)||68,
      target_calories:parseInt(meta.target_calories)||2200, target_protein_g:parseInt(meta.target_protein_g)||180,
      target_steps:10000, target_sleep_hours:7.5,
    };
    const {data:ins,[STRIPPED] db.from("profiles").insert(payload).select().single();
    if(ie){ profile=payload; } else profile=ins;
  } else profile=data;
}
async function loadRecords(){
  const tasks=[
    db.from("meal_logs").select("*").order("logged_at",{ascending:false}).limit(300),
    db.from("activity_logs").select("*").order("logged_at",{ascending:false}).limit(300),
    db.from("body_logs").select("*").order("logged_at",{ascending:false}).limit(300),
    db.from("steps_logs").select("*").order("logged_at",{ascending:false}).limit(300),
    db.from("heart_rate_logs").select("*").order("logged_at",{ascending:false}).limit(300),
    db.from("sleep_logs").select("*").order("logged_at",{ascending:false}).limit(100),
  ];
  const res=await Promise.allSettled(tasks);
  records.meals=res[0].value?.data||[]; records.activities=res[1].value?.data||[];
  records.body=res[2].value?.data||[]; records.steps=res[3].value?.data||[];
  records.hr=res[4].value?.data||[]; records.sleep=res[5].value?.data||[];
  try{
    const {data:gpxData}=await db.from("gpx_tracks").select("*").order("logged_at",{ascending:false}).limit(100);
    if(gpxData?.length){
      gpxData.forEach(g=>{
        if(!records.activities.find(a=>a.gpx_track_id===g.id)){
          records.activities.push({id:g.id, activity_name:g.activity_type, distance_km:g.distance_km, duration_minutes:g.duration_minutes, calories_burned:g.calories_est, source:'GPX', logged_at:g.logged_at, gpx_track_id:g.id, elevation_gain_m:g.elevation_gain_m, avg_hr:g.avg_hr, max_hr:g.max_hr});
        }
      });
    }
  }catch(e){}
}

async function handleFoodPhoto(file){
  if(!file) return;
  const status=$("#foodPhotoStatus"), previewWrap=$("#mealPhotoPreview"), previewImg=$("#mealPreviewImg"), logBtn=$("#logMealBtn");
  if(previewWrap&&previewImg){ previewImg.src=URL.createObjectURL(file); previewWrap.classList.remove("hidden"); }
  if(status) status.innerHTML=`<div style="display:flex;gap:10px;align-items:center"><div class="spinner"></div><strong>AI Analyzing...</strong></div>`;
  if(logBtn){ logBtn.disabled=true; logBtn.textContent='Analyzing...'; }
  try{
    const res=await AI.analyzeFoodPhoto(file);
    if(res.error) throw new Error(res.error);
    if(status) status.innerHTML=`✅ <strong>${esc(res.name)}</strong> • ${res.calories} kcal`;
    addSelected({name:res.name,kcal:res.calories,protein:res.protein_g||0,carbs:res.carbs_g||0,fat:res.fat_g||0});
  }catch(e){ if(status) status.innerHTML=`<span style="color:#ff7a86">❌ ${esc(e.message)}</span>`; }
  finally{ if(logBtn){ logBtn.disabled=false; renderSelected(); } }
}

function initUI(){
  $$('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
  $$('[data-open]').forEach(b=>b.addEventListener('click',()=>{ const d=$("#"+b.dataset.open); if(!d) return; d.showModal?.(); }));
  $$('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest("dialog")?.close()));
  const cats=Object.keys(window.FOOD_DB||{}); const ct=$("#mealCatTabs"); if(ct) ct.innerHTML=cats.map(c=>`<button type="button" data-cat="${c}" class="btn small">${c}</button>`).join("");
  ct?.querySelectorAll('[data-cat]')?.forEach(b=>b.addEventListener('click',()=>{ currentCategory=b.dataset.cat; renderMealOptions(); }));
  $("#mealCameraInput")?.addEventListener('change',e=>handleFoodPhoto(e.target.files[0]));
  $("#foodPhotoInput")?.addEventListener('change',e=>handleFoodPhoto(e.target.files[0]));
  $("#bodyForm")?.addEventListener('submit',saveBody);
  $("#mealForm")?.addEventListener('submit',saveMeal);
  $("#chartMetric")?.addEventListener('change',()=>{ destroyCharts(); setTimeout(renderDreeveCharts,100); });
  $("#sportFilter")?.addEventListener('change',e=>renderActivitiesTable(e.target.value==='all'?'':e.target.value));
  $("#searchAct")?.addEventListener('input',e=>renderActivitiesTable(e.target.value));
  $("#yearFilter")?.addEventListener('change',()=>{ destroyCharts(); setTimeout(renderDreeveCharts,100); });
  $("#prevMonth")?.addEventListener('click',()=>{ currentCalendarDate.setMonth(currentCalendarDate.getMonth()-1); renderCalendar(); });
  $("#nextMonth")?.addEventListener('click',()=>{ currentCalendarDate.setMonth(currentCalendarDate.getMonth()+1); renderCalendar(); });
  const gpxFile=$("#gpxReportFile");
  if(gpxFile){
    gpxFile.onchange=async e=>{
      const f=e.target.files[0];
      if(!f) return;
      try{
        await GpxReport.loadFile(f);
        switchView('gpxReportView');
        toast('Loaded '+f.name);
      }catch(err){toast(err.message,true);}
      e.target.value=''; // reset for iOS re-select same file
    };
  }
    const dz=$("#gpxDropZone");
    if(dz){
      dz.ondragover=e=>{ e.preventDefault(); dz.style.borderColor='#c6ff00'; };
      dz.ondragleave=()=>dz.style.borderColor='';
      dz.ondrop=e=>{ e.preventDefault(); const f=e.dataTransfer.files[0]; if(f){ GpxReport.loadFile(f).then(()=>switchView('gpxReportView')); } };
      dz.onclick=()=>{ if(isIOS) $("#gpxReportFile")?.click(); };
    }
  }
  buildProfileForm();
}
function switchView(id){
  $$('[data-view]').forEach(x=>x.classList.toggle("active",x.dataset.view===id));
  $$('.view').forEach(v=>v.classList.toggle("active",v.id===id));
  const titles={dashboardView:'Dashboard',monthlyView:'Monthly',activitiesView:'Activities',gpxReportView:'GPX Report',foodView:'Nutrition',profileView:'Settings'};
  const pt=$("#pageTitle"); if(pt) pt.textContent=titles[id]||id;
  window.scrollTo(0,0);
  if(id==="dashboardView"){ setTimeout(()=>{ renderDreeveCharts(); },150); }
  if(id==="gpxReportView"&&window.GpxReport?.data) setTimeout(()=>{ GpxReport.drawMap?.(); },200);
}
function renderAll(){
  const latestWeight=records.body[0]?.weight_kg||profile?.current_weight_kg||0;
  const startWeight=[...records.body].sort((a,b)=>new Date(a.logged_at)-new Date(b.logged_at))[0]?.weight_kg||profile?.starting_weight_kg||latestWeight;
  const wv=$("#weightValue"); if(wv) wv.textContent=latestWeight||"--";
  const ws=$("#weightSub"); if(ws) ws.textContent=`Start ${startWeight}kg`;
  const todayCal=records.meals.filter(m=>isToday(m.logged_at)).reduce((s,x)=>s+Number(x.calories||0),0);
  const todayPro=records.meals.filter(m=>isToday(m.logged_at)).reduce((s,x)=>s+Number(x.protein_g||0),0);
  const cv=$("#calValue"); if(cv) cv.textContent=todayCal;
  const ct=$("#calTarget"); if(ct) ct.textContent=`${profile?.target_calories||2200} target`;
  const pv=$("#proValue"); if(pv) pv.textContent=Math.round(todayPro);
  const pt=$("#proTarget"); if(pt) pt.textContent=`${profile?.target_protein_g||180}g`;
  const sv=$("#stepsValue"); if(sv) sv.textContent=records.steps.filter(s=>isToday(s.logged_at)).reduce((s,x)=>s+Number(x.steps||0),0).toLocaleString();
  renderMealOptions(); renderTodayLogs(); renderDreeveCharts(); renderActivitiesTable(); renderCalendar();
}
function renderTodayLogs(){
  const el=$("#todayLogs"); if(!el) return;
  const items=[...records.meals.map(x=>({...x,_d:x.meal_name,_m:`${x.calories} kcal`})),
          ...records.activities.map(x=>({...x,_d:x.activity_name,_m:`${x.distance_km}km`}))]
          .sort((a,b)=>new Date(b.logged_at)-new Date(a.logged_at));
  el.innerHTML=items.slice(0,8).map(x=>`<div class="row"><div><strong>${esc(x._d)}</strong><br><small class="muted">${new Date(x.logged_at).toLocaleTimeString()} • ${x._m}</small></div></div>`).join('')||'<div class="muted">No logs today</div>';
}
function renderMealOptions(){
  const container=$("#mealOptions"); if(!container) return;
  const list=(window.FOOD_DB?.[currentCategory])||[];
  container.innerHTML=list.map((f,idx)=>{
    const isSel=selectedFoods.find(s=>s.idx===idx&&s.cat===currentCategory);
    const kcal=f.kcal||f.sizes?.M?.kcal||0;
    return `<div class="row ${isSel?'has':''}" onclick="toggleFood(${idx})" style="cursor:pointer"><div><strong>${esc(f.name)}</strong><br><small class="muted">${kcal} kcal</small></div><span>${isSel?'✔':'➕'}</span></div>`;
  }).join('');
}
window.toggleFood=(idx)=>{
  const cat=currentCategory; const i=selectedFoods.findIndex(s=>s.idx===idx&&s.cat===cat);
  if(i>=0) selectedFoods.splice(i,1);
  else{ const f=FOOD_DB[cat][idx]; const sz=f.sizes?f.sizes['M']:f; selectedFoods.push({idx,cat,name:f.name,kcal:sz.kcal||0,protein:sz.protein||0}); }
  renderMealOptions(); renderSelected();
};
function addSelected(item){ selectedFoods.push({idx:-1,cat:'Custom',name:item.name,kcal:item.kcal,protein:item.protein,carbs:item.carbs||0,fat:item.fat||0}); renderSelected(); }
function renderSelected(){
  const cont=$("#mealSelected"); if(!cont) return;
  const totalK=selectedFoods.reduce((s,x)=>s+Number(x.kcal||0),0);
  cont.innerHTML=selectedFoods.map((s,i)=>`<div class="row"><div><strong>${esc(s.name)}</strong> ${s.kcal}kcal</div><button class="link" onclick="removeSelected(${i})" type="button">✕</button></div>`).join('')+(totalK?`<div style="margin-top:8px"><strong>Total ${totalK} kcal</strong></div>`:'');
  const dCont=$("#mealSelectedDialog"); if(dCont) dCont.innerHTML=cont.innerHTML;
  const btn=$("#logMealBtn"); if(btn) btn.textContent=selectedFoods.length?`Log ${totalK} kcal`:'Log Meal';
}
window.removeSelected=(i)=>{ selectedFoods.splice(i,1); renderMealOptions(); renderSelected(); };
async function saveMeal(e){ e.preventDefault(); if(!selectedFoods.length) return toast("Select food first",true);
  const totalK=selectedFoods.reduce((s,x)=>s+Number(x.kcal||0),0); const totalP=selectedFoods.reduce((s,x)=>s+Number(x.protein||0),0);
  const name=selectedFoods.map(s=>s.name).join(' + ');
  const {error}=await db.from('meal_logs').insert({user_id:user.id,meal_name:name,calories:totalK,protein_g:totalP,carbs_g:0,fat_g:0,source:'Manual',logged_at:new Date().toISOString()});
  if(error) return toast(error.message,true);
  selectedFoods=[]; renderSelected(); $("#mealDialog")?.close(); await loadRecords(); renderAll(); toast(`Logged ${totalK} kcal`);
}
async function saveBody(e){ e.preventDefault(); const fd=new FormData(e.currentTarget); const {error}=await db.from('body_logs').insert({user_id:user.id,weight_kg:parseFloat(fd.get('weight_kg')),logged_at:new Date().toISOString()}); if(error) return toast(error.message,true); e.currentTarget.closest('dialog')?.close(); await loadRecords(); renderAll(); }
function buildProfileForm(){ const f=$("#profileForm"); if(!f||!profile) return; f.innerHTML=`<label>Full name<input name="full_name" value="${esc(profile.full_name||'')}" ></label><label>Target kg<input name="target_weight_kg" type="number" step="0.1" value="${profile.target_weight_kg||68}" inputmode="decimal"></label><button class="btn primary" type="submit">Save</button>`; f.onsubmit=async e=>{ e.preventDefault(); const fd=new FormData(f); const {error}=await db.from("profiles").update({full_name:String(fd.get("full_name")||""),target_weight_kg:+fd.get("target_weight_kg")}).eq("id",user.id); if(error) return toast(error.message,true); toast("Saved"); }; }

let monthlyChartObj=null, sportChartObj=null, weightChartObj=null, eleHrChartObj=null, monthDetailChartObj=null;
function destroyCharts(){
  [monthlyChartObj,sportChartObj,weightChartObj,eleHrChartObj,monthDetailChartObj].forEach(c=>{ try{ c?.destroy(); }catch(e){} });
  monthlyChartObj=sportChartObj=weightChartObj=eleHrChartObj=monthDetailChartObj=null;
}
function safeChart(ctx){
  if(!ctx) return null;
  let wrap=ctx.closest('.chart-wrap');
  if(!wrap){
    const newWrap=document.createElement('div');
    newWrap.className='chart-wrap';
    ctx.parentNode.insertBefore(newWrap, ctx);
    newWrap.appendChild(ctx);
    wrap=newWrap;
  }
  return ctx;
}
function renderDreeveCharts(){
  if(typeof Chart==='undefined') return;
  // FIX SIDEBAR TOTALS - ALL TIME not filtered
  const totalDistAll = records.activities.reduce((s,a)=>s+Number(a.distance_km||0),0);
  const totalMinAll = records.activities.reduce((s,a)=>s+Number(a.duration_minutes||0),0);
  const sbD=$("#sbDist"); if(sbD) sbD.textContent=totalDistAll.toFixed(1)+' km';
  const sbT=$("#sbTime"); if(sbT) sbT.textContent=(totalMinAll/60).toFixed(1)+' h';
  const sbC=$("#sbCount"); if(sbC) sbC.textContent=records.activities.length;

  let allActs=[...records.activities];
  const yearSel=$("#yearFilter")?.value||'All time';
  if(yearSel!=='All time'){ const y=parseInt(yearSel); if(!isNaN(y)) allActs=allActs.filter(a=>new Date(a.logged_at).getFullYear()===y); }
  allActs=[...allActs,...records.steps.map(s=>({distance_km:s.distance_km||0,duration_minutes:0,logged_at:s.logged_at,activity_name:'Walking',calories_burned:0}))];
  const metric=$("#chartMetric")?.value||'distance';
  const byMonth={}; for(let i=11;i>=0;i--){ const d=new Date(); d.setMonth(d.getMonth()-i); const k=d.toISOString().slice(0,7); byMonth[k]=0; }
  allActs.forEach(a=>{ const k=new Date(a.logged_at).toISOString().slice(0,7); if(byMonth[k]!==undefined){ if(metric==='distance') byMonth[k]+=Number(a.distance_km||0); else if(metric==='duration') byMonth[k]+=Number(a.duration_minutes||0); else if(metric==='calories') byMonth[k]+=Number(a.calories_burned||0); else byMonth[k]+=Number(a.distance_km||0); } });
  const labels=Object.keys(byMonth); const vals=labels.map(k=>Number(byMonth[k].toFixed(2)));
  let ctx=document.getElementById('monthlyChart'); ctx=safeChart(ctx);
  if(ctx){
    if(monthlyChartObj) { try{ monthlyChartObj.destroy(); }catch(e){} }
    monthlyChartObj=new Chart(ctx,{type:'bar',data:{labels,datasets:[{label:metric,data:vals,backgroundColor:'#c6ff00',borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,animation:false,resizeDelay:250,interaction:{mode:'index',intersect:false},onClick:(e,els)=>{ if(els.length){ const m=labels[els[0].index]; renderMonthDetail(m); switchView('monthlyView'); }},plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:'#8a8a8a'}},y:{grid:{color:'#1e1e1e'},ticks:{color:'#8a8a8a'},beginAtZero:true}}}});
  }
  const bySport={}; allActs.forEach(a=>{ const s=a.activity_name||'Workout'; bySport[s]=(bySport[s]||0)+(metric==='duration'?Number(a.duration_minutes||0):Number(a.distance_km||0)); });
  let ctx2=document.getElementById('sportChart'); ctx2=safeChart(ctx2);
  if(ctx2&&Object.keys(bySport).length){
    if(sportChartObj) { try{ sportChartObj.destroy(); }catch(e){} }
    sportChartObj=new Chart(ctx2,{type:'doughnut',data:{labels:Object.keys(bySport),datasets:[{data:Object.values(bySport),backgroundColor:['#c6ff00','#5de8b6','#58a9ff','#ff7a86','#ffd76e','#9d86ff'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,animation:false,resizeDelay:250,cutout:'62%',onClick:(e,els)=>{ if(els.length){ const sport=Object.keys(bySport)[els[0].index]; const si=$("#searchAct"); if(si) si.value=sport; renderActivitiesTable(sport); switchView('activitiesView'); }},plugins:{legend:{position:'bottom',labels:{color:'#8a8a8a',boxWidth:12}}}}});
  }
  const weights=[...records.body].sort((a,b)=>new Date(a.logged_at)-new Date(b.logged_at)).slice(-30);
  let ctxW=document.getElementById('weightChart'); ctxW=safeChart(ctxW);
  if(ctxW){
    if(weightChartObj) { try{ weightChartObj.destroy(); }catch(e){} }
    if(weights.length){
      weightChartObj=new Chart(ctxW,{type:'line',data:{labels:weights.map(w=>dayStr(w.logged_at).slice(5)),datasets:[{label:'kg',data:weights.map(w=>w.weight_kg),borderColor:'#c6ff00',backgroundColor:'rgba(198,255,0,0.15)',fill:true,tension:0.35,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,animation:false,resizeDelay:250,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:'#8a8a8a'}},y:{grid:{color:'#1e1e1e'},ticks:{color:'#8a8a8a'}}}}});
    }
  }
}
function renderMonthDetail(ym){
  const el=$("#monthDetailList"), canvas=document.getElementById('monthDetailChart'); if(!el) return;
  const acts=records.activities.filter(a=>new Date(a.logged_at).toISOString().startsWith(ym)).sort((a,b)=>new Date(a.logged_at)-new Date(b.logged_at));
  if(!acts.length){ el.innerHTML=`<div class="muted" style="padding:20px">No activities in ${ym}</div>`; if(canvas){ const wrap=canvas.closest('.chart-wrap'); if(wrap) wrap.style.display='none'; } return; }
  const byDay={}; acts.forEach(a=>{ const d=dayStr(a.logged_at); byDay[d]=(byDay[d]||0)+Number(a.distance_km||0); });
  if(canvas){
    let c=safeChart(canvas);
    if(c){
      const wrap=c.closest('.chart-wrap'); if(wrap) wrap.style.display='block';
      if(monthDetailChartObj) { try{ monthDetailChartObj.destroy(); }catch(e){} }
      monthDetailChartObj=new Chart(c,{type:'bar',data:{labels:Object.keys(byDay),datasets:[{data:Object.values(byDay),backgroundColor:'#c6ff00',borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,animation:false,resizeDelay:250,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:'#8a8a8a'}},y:{grid:{color:'#1e1e1e'},ticks:{color:'#8a8a8a'},beginAtZero:true}}}});
    }
  }
  el.innerHTML=acts.map(a=>`<div class="row" style="cursor:pointer" onclick="viewActivityReport('${a.id}')"><div><strong>${esc(a.activity_name)}</strong><br><small class="muted">${new Date(a.logged_at).toLocaleDateString()} • ${a.distance_km}km</small></div><span>${a.calories_burned||0} kcal</span></div>`).join('');
}

// NEW: FULL REPORT LIKE GPX REPORT
function renderActivitiesTable(filter=''){
  const el=document.getElementById('activitiesTable'); if(!el) return;
  let list=[...records.activities].sort((a,b)=>new Date(b.logged_at)-new Date(a.logged_at));
  if(filter) list=list.filter(a=> new Date(a.logged_at).toISOString().startsWith(filter) || String(a.activity_name||"").toLowerCase().includes(filter.toLowerCase()));
  el.innerHTML=list.slice(0,150).map(a=>`<div class="row" style="cursor:pointer;padding:14px;align-items:center" onclick="viewActivityReport('${a.id}')">
    <div style="flex:1"><strong style="font-size:15px">${esc(a.activity_name)} • ${a.distance_km}km</strong><br><small class="muted">${new Date(a.logged_at).toLocaleDateString('en-GB')} • ${a.distance_km}km • ${a.duration_minutes}min • ${esc(a.source||'')} ${a.gpx_track_id?'• 🗺 Map':''}</small></div>
    <div style="text-align:right"><span style="font-weight:800">${a.calories_burned||0} kcal</span><br><small style="color:#c6ff00">View →</small></div>
  </div>`).join('')||'<div class="muted" style="padding:20px;text-align:center">No activities — import FIT/GPX</div>';
  const recent=document.getElementById('recentActivities'); if(recent) recent.innerHTML=list.slice(0,5).map(a=>`<div class="row" style="cursor:pointer" onclick="viewActivityReport('${a.id}')"><div>${esc(a.activity_name)} • ${a.distance_km}km</div><small class="muted">${new Date(a.logged_at).toLocaleDateString()}</small></div>`).join('');
}

window.viewActivityReport = async (id)=>{
  const act=records.activities.find(a=>a.id===id);
  if(!act) return toast("Not found",true);
  toast(`Opening ${act.activity_name}...`);
  switchView('gpxReportView');
  window.scrollTo(0,0);
  // Try load from gpx_tracks if linked
  if(act.gpx_track_id){
    try{
      const dbc = db || (window.supabase? window.supabase.createClient(GpxReport.SUPA_URL,GpxReport.SUPA_KEY,{auth:{persistSession:true}}) : null);
      if(dbc){
        const {data:track} = await dbc.from("gpx_tracks").select("*").eq("id",act.gpx_track_id).single();
        if(track){
          if(track.gpx_raw){
            const file = new File([track.gpx_raw], track.file_name || `${act.activity_name}.gpx`, {type:'application/gpx+xml'});
            await GpxReport.loadFile(file);
            return;
          }
          if(track.track_data && track.track_data.length){
            GpxReport.buildFromTrackData(track);
            GpxReport.render();
            setTimeout(()=>{ GpxReport.drawMap(); GpxReport.drawCharts(); GpxReport.drawTables(); },200);
            return;
          }
        }
      }
    }catch(e){ console.log("load track failed",e.message); }
  }
  // Fallback activity-only report
  GpxReport.buildFromActivity(act);
  GpxReport.render();
  setTimeout(()=>{ GpxReport.drawMap(); GpxReport.drawCharts(); GpxReport.drawTables(); },200);
};

window.selectActivity=(id)=>{ viewActivityReport(id); };

function renderCalendar(){
  const cal=document.getElementById('calendarGrid'); if(!cal) return;
  const ml=document.getElementById('monthLabel'); if(ml) ml.textContent=currentCalendarDate.toLocaleString('en',{month:'long',year:'numeric'});
  const y=currentCalendarDate.getFullYear(), m=currentCalendarDate.getMonth();
  const first=new Date(y,m,1); const days=new Date(y,m+1,0).getDate();
  const byDay={}; records.activities.forEach(a=>{ const d=dayStr(a.logged_at); if(new Date(a.logged_at).getMonth()===m&&new Date(a.logged_at).getFullYear()===y) byDay[d]=(byDay[d]||0)+1; });
  let html=''; for(let i=0;i<first.getDay();i++) html+='<div></div>';
  for(let d=1;d<=days;d++){ const iso=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; const has=byDay[iso]; const isTodayFlag=iso===todayStr(); html+=`<div class="${has?'has':''} ${isTodayFlag?'today':''}" ${has?`onclick="renderMonthDetailDay('${iso}')"` :''}><strong>${d}</strong><br><small>${has?has+'x':''}</small></div>`; }
  cal.innerHTML=html;
}
window.renderMonthDetailDay=(iso)=>{
  const acts=records.activities.filter(a=>dayStr(a.logged_at)===iso);
  const el=$("#monthDetailList"); if(el) el.innerHTML=`<h4 style="margin:10px 0">${iso} • ${acts.length} activities • ${acts.reduce((s,a)=>s+Number(a.distance_km||0),0).toFixed(1)}km</h4>`+acts.map(a=>`<div class="row" style="cursor:pointer" onclick="viewActivityReport('${a.id}')"><div><strong>${esc(a.activity_name)}</strong><br><small class="muted">${a.distance_km}km • ${a.duration_minutes}min</small></div><span>${a.calories_burned||0} kcal</span></div>`).join('');
};
window.handleQuickImport=async()=>{
  const file=document.getElementById("quickImportFile")?.files[0]; if(!file) return toast("Select file",true);
  if(file.name.toLowerCase().endsWith('.gpx')) return handleGpxImport(file);
  if(file.name.toLowerCase().endsWith('.fit')) return handleFitImport(file);
  return handleFitImport(file);
};
window.handleGpxImport=async(fileOverride)=>{
  const file=fileOverride||document.getElementById('quickImportFile')?.files[0]||document.getElementById('gpxReportFile')?.files[0]; if(!file) return toast('Select.gpx',true);
  const el=document.getElementById('quickImportStatus'); if(el) el.textContent='Parsing GPX '+file.name+'...';
  try{
    if(window.GpxReport){ await GpxReport.loadFile(file); switchView('gpxReportView'); }
    const acts=await Integrations.importGpx(file);
    for(let a of acts){ await db.from('activity_logs').insert({user_id:user.id,activity_name:a.activity_name,duration_minutes:a.duration_minutes,distance_km:a.distance_km,calories_burned:a.calories_burned||0,source:'GPX',logged_at:new Date(a.logged_at).toISOString()}); }
    if(el) el.textContent=`✅ Imported ${acts.length} GPX`; await loadRecords(); renderAll(); toast(`GPX imported ${acts.length}`);
  }catch(e){ if(el) el.textContent="❌ "+e.message; toast(e.message,true); }
};
window.handleFitImport=async(fileOverride)=>{
  const file=fileOverride||document.getElementById('quickImportFile')?.files[0]||document.getElementById('gpxReportFile')?.files[0]; if(!file) return toast('Select.fit',true);
  const el=document.getElementById('quickImportStatus'); if(el) el.textContent='Parsing FIT '+file.name+'...';
  try{
    if(window.GpxReport){ try{ await GpxReport.loadFile(file); switchView('gpxReportView'); }catch(e){} }
    const acts=await Integrations.importFit(file);
    for(let a of acts){ await db.from('activity_logs').insert({user_id:user.id,activity_name:a.activity_name,duration_minutes:a.duration_minutes,distance_km:a.distance_km,calories_burned:a.calories_burned||0,source:'FIT',logged_at:new Date(a.logged_at).toISOString()}); }
    if(el) el.textContent=`✅ Imported ${acts.length} FIT`; await loadRecords(); renderAll(); toast(`FIT imported ${acts.length}`);
  }catch(e){ if(el) el.textContent="❌ "+e.message; toast(e.message,true); }
};
initAuth();
boot();