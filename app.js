"use strict";
const SUPABASE_URL = "https://dxgzluurwsoytqlasuup.supabase.co";
const SUPABASE_KEY = "sb_publishable_RTeGJ9m_CL26fUMXwEGLJQ_JfGiLyit";
let db=null,user=null,profile=null;
let records={meals:[],activities:[],body:[],workoutSessions:[],workoutExercises:[],photos:[],water:[],sleep:[],steps:[],hr:[]};
let selectedFoods=[], currentCategory="Main", currentCalendarDate=new Date();
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const show=id=>{["setupScreen","authScreen","app"].forEach(x=>$("#"+x)?.classList.toggle("hidden",x!==id)); const app=$("#app"); if(app) app.style.display = id==="app"? "flex" : "none"; const auth=$("#authScreen"); if(auth) auth.style.display = id==="authScreen"? "block" : "none"; };
const toast=(m,bad=false)=>{const t=$("#toast"); if(!t) return; t.textContent=m; t.style.background=bad?"#ff7a86":"#c6ff00"; t.style.color=bad?"#fff":"#000"; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),3000)};
const esc=v=>{const d=document.createElement("div");d.textContent=String(v??"");return d.innerHTML};
const config=()=>({url:SUPABASE_URL,key:SUPABASE_KEY});
const dayStr=d=>{const dt=new Date(d);return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`};
const todayStr=()=>dayStr(new Date());
const isSameDay=(a,b)=>dayStr(a)===dayStr(b);
const isToday=d=>isSameDay(d,new Date());

function client(){ if(!window.supabase) throw new Error("Supabase SDK not loaded"); db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}) }

async function boot(){
  try{
    client();
    const {data:{session}} = await db.auth.getSession();
    if(session){ user=session.user; await enterApp(); }
    else show("authScreen");
    db.auth.onAuthStateChange(async (ev,s)=>{ if(ev==="SIGNED_IN"&&s?.user){ user=s.user; await enterApp(); } if(ev==="SIGNED_OUT") show("authScreen") });
  }catch(e){ console.error(e); show("authScreen"); toast(e.message,true) }
}

// Auth tabs
$$('[data-auth-tab]').forEach(b=>b.onclick=()=>{
  $$('[data-auth-tab]').forEach(x=>{ x.classList.toggle("active",x===b); x.style.background = x===b? "#1c1c1c" : "#111"; x.style.color = x===b? "#ededed" : "#8a8a8a"; });
  const isLogin=b.dataset.authTab==="login";
  $("#loginForm").style.display=isLogin?"grid":"none";
  $("#signupForm").style.display=isLogin?"none":"grid";
});
$("#loginForm")?.addEventListener("submit", async e=>{
  e.preventDefault();
  const f=new FormData(e.currentTarget);
  const {data,error}=await db.auth.signInWithPassword({email:f.get("email").trim(),password:f.get("password")});
  if(error) return toast(error.message,true);
  user=data.user; await enterApp(); toast("Welcome back");
});
$("#signupForm")?.addEventListener("submit", async e=>{
  e.preventDefault();
  const f=new FormData(e.currentTarget);
  if(f.get("password")!==f.get("confirm_password")) return toast("Passwords mismatch",true);
  const detail={
    full_name:f.get("full_name").trim(),
    date_of_birth:f.get("date_of_birth"),
    height_cm:f.get("height_cm"),
    current_weight_kg:f.get("current_weight_kg"),
    starting_weight_kg:f.get("current_weight_kg"),
    target_weight_kg:f.get("target_weight_kg"),
    primary_goal:f.get("primary_goal"),
    target_calories:f.get("target_calories"),
    target_protein_g:f.get("target_protein_g"),
    target_steps:"10000", target_sleep_hours:"7.5",
  };
  const {data,error}=await db.auth.signUp({email:f.get("email").trim(),password:f.get("password"),options:{data:detail}});
  if(error) return toast(error.message,true);
  if(data.session){ user=data.user; await enterApp(); toast("Account created"); }
  else { toast("Check email to confirm"); document.querySelector('[data-auth-tab="login"]').click() }
});
$("#forgotButton")?.addEventListener('click',async()=>{ const email=prompt("Email:"); if(!email) return; const {error}=await db.auth.resetPasswordForEmail(email); toast(error?error.message:"Reset sent",!!error); });
$("#logoutButton")?.addEventListener('click',async()=>{ await db.auth.signOut(); user=null; profile=null; show("authScreen") });
$("#syncButton")?.addEventListener('click',async()=>{ await loadRecords(); renderAll(); toast("Synced") });

async function enterApp(){
  show("app");
  const ps=$("#pageSub"); if(ps) ps.textContent=new Date().getFullYear()+" • Click charts to drill details • "+SUPABASE_URL;
  await Promise.all([loadProfile(), loadRecords()]);
  initUI(); renderAll(); updateAutoSyncUrl();
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
    const {data:ins,error:ie}=await db.from("profiles").insert(payload).select().single();
    if(ie){ console.error(ie); profile=payload; } else profile=ins;
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
}

async function handleFoodPhoto(file){
  if(!file) return;
  const status=$("#foodPhotoStatus"), previewWrap=$("#mealPhotoPreview"), previewImg=$("#mealPreviewImg"), logBtn=$("#logMealBtn");
  if(previewWrap&&previewImg){ previewImg.src=URL.createObjectURL(file); previewWrap.style.display="block"; }
  if(status) status.innerHTML=`<div style="display:flex;gap:10px;align-items:center"><div style="width:18px;height:18px;border:2px solid #333;border-top-color:#c6ff00;border-radius:50%;animation:spin 0.8s linear infinite"></div><strong>AI Analyzing...</strong></div>`;
  if(logBtn){ logBtn.disabled=true; logBtn.textContent='Analyzing...'; }
  try{
    const res=await AI.analyzeFoodPhoto(file);
    if(res.error) throw new Error(res.error);
    if(status) status.innerHTML=`✅ <strong>${esc(res.name)}</strong> • ${res.calories} kcal • P ${res.protein_g||0}g`;
    addSelected({name:res.name,kcal:res.calories,protein:res.protein_g||0,carbs:res.carbs_g||0,fat:res.fat_g||0});
  }catch(e){ if(status) status.innerHTML=`<span style="color:#ff7a86">❌ ${esc(e.message)}</span>`; }
  finally{ if(logBtn){ logBtn.disabled=false; renderSelected(); } }
}

function initUI(){
  $$('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
  $$('[data-open]').forEach(b=>b.onclick=()=>{ const d=$("#"+b.dataset.open); if(!d) return; d.showModal?.(); });
  $$('[data-close]').forEach(b=>b.onclick=()=>b.closest("dialog")?.close());
  const cats=Object.keys(window.FOOD_DB||{}); const ct=$("#mealCatTabs"); if(ct) ct.innerHTML=cats.map(c=>`<button type="button" data-cat="${c}" style="background:#1c1c1c;border:1px solid #242424;color:#8a8a8a;padding:6px 10px;border-radius:8px;font-size:12px">${c}</button>`).join("");
  $$('#mealCatTabs [data-cat]').forEach(b=>b.onclick=()=>{ currentCategory=b.dataset.cat; renderMealOptions(); });
  $("#mealCameraInput")?.addEventListener('change',e=>handleFoodPhoto(e.target.files[0]));
  $("#foodPhotoInput")?.addEventListener('change',e=>handleFoodPhoto(e.target.files[0]));
  $("#bodyForm")?.addEventListener('submit',saveBody);
  $("#mealForm")?.addEventListener('submit',saveMeal);
  $("#chartMetric")?.addEventListener('change',renderDreeveCharts);
  $("#sportFilter")?.addEventListener('change',e=>renderActivitiesTable(e.target.value==='all'?'':e.target.value));
  $("#searchAct")?.addEventListener('input',e=>renderActivitiesTable(e.target.value));
  $("#yearFilter")?.addEventListener('change',renderDreeveCharts);
  $("#prevMonth")?.addEventListener('click',()=>{ currentCalendarDate.setMonth(currentCalendarDate.getMonth()-1); renderCalendar(); });
  $("#nextMonth")?.addEventListener('click',()=>{ currentCalendarDate.setMonth(currentCalendarDate.getMonth()+1); renderCalendar(); });
  const gpxFile=$("#gpxReportFile");
  if(gpxFile){
    gpxFile.onchange=e=>{ const f=e.target.files[0]; if(f){ GpxReport.loadFile(f).then(()=>{ switchView('gpxReportView'); toast('Loaded '+f.name); renderGpxDetailCharts(); }).catch(err=>toast(err.message,true)); } };
    const dz=$("#gpxDropZone");
    if(dz){ dz.ondragover=e=>{ e.preventDefault(); dz.style.borderColor='#c6ff00'; }; dz.ondragleave=()=>dz.style.borderColor=''; dz.ondrop=e=>{ e.preventDefault(); const f=e.dataTransfer.files[0]; if(f){ GpxReport.loadFile(f).then(()=>{ switchView('gpxReportView'); renderGpxDetailCharts(); }); } }; }
  }
  buildProfileForm();
}
function switchView(id){
  $$('[data-view]').forEach(x=>x.classList.toggle("active",x.dataset.view===id));
  $$('.view').forEach(v=>v.classList.toggle("active",v.id===id));
  const titles={dashboardView:'Dashboard',monthlyView:'Monthly',activitiesView:'Activities',gpxReportView:'GPX Report',foodView:'Nutrition',profileView:'Settings'};
  $("#pageTitle")&&( $("#pageTitle").textContent=titles[id]||id );
  window.scrollTo(0,0);
  if(id==="gpxReportView"&&window.GpxReport?.data) setTimeout(()=>{ GpxReport.drawMap?.(); renderGpxDetailCharts(); },200);
}
function renderAll(){
  const latestWeight=records.body[0]?.weight_kg||profile?.current_weight_kg||0;
  const startWeight=[...records.body].sort((a,b)=>new Date(a.logged_at)-new Date(b.logged_at))[0]?.weight_kg||profile?.starting_weight_kg||latestWeight;
  $("#weightValue")&&( $("#weightValue").textContent=latestWeight||"--" );
  $("#weightSub")&&( $("#weightSub").textContent=`Start ${startWeight}kg` );
  const todayCal=records.meals.filter(m=>isToday(m.logged_at)).reduce((s,x)=>s+x.calories,0);
  const todayPro=records.meals.filter(m=>isToday(m.logged_at)).reduce((s,x)=>s+Number(x.protein_g),0);
  $("#calValue")&&( $("#calValue").textContent=todayCal );
  $("#calTarget")&&( $("#calTarget").textContent=`${profile.target_calories} target` );
  $("#proValue")&&( $("#proValue").textContent=Math.round(todayPro) );
  $("#proTarget")&&( $("#proTarget").textContent=`${profile.target_protein_g}g` );
  $("#stepsValue")&&( $("#stepsValue").textContent=records.steps.filter(s=>isToday(s.logged_at)).reduce((s,x)=>s+x.steps,0).toLocaleString() );
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
  const totalK=selectedFoods.reduce((s,x)=>s+x.kcal,0);
  cont.innerHTML=selectedFoods.map((s,i)=>`<div class="row"><div><strong>${esc(s.name)}</strong> ${s.kcal}kcal</div><button class="link" onclick="removeSelected(${i})" style="background:transparent;border:0;color:#c6ff00">✕</button></div>`).join('')+(totalK?`<div style="margin-top:8px"><strong>Total ${totalK} kcal</strong></div>`:'');
  const dCont=$("#mealSelectedDialog"); if(dCont) dCont.innerHTML=cont.innerHTML;
  const btn=$("#logMealBtn"); if(btn) btn.textContent=selectedFoods.length?`Log ${totalK} kcal`:'Log Meal';
}
window.removeSelected=(i)=>{ selectedFoods.splice(i,1); renderMealOptions(); renderSelected(); };
async function saveMeal(e){ e.preventDefault(); if(!selectedFoods.length) return toast("Select food first",true);
  const totalK=selectedFoods.reduce((s,x)=>s+x.kcal,0); const totalP=selectedFoods.reduce((s,x)=>s+Number(x.protein),0);
  const name=selectedFoods.map(s=>s.name).join(' + ');
  const {error}=await db.from('meal_logs').insert({user_id:user.id,meal_name:name,calories:totalK,protein_g:totalP,carbs_g:0,fat_g:0,source:'Manual',logged_at:new Date().toISOString()});
  if(error) return toast(error.message,true);
  selectedFoods=[]; renderSelected(); $("#mealDialog")?.close(); await loadRecords(); renderAll(); toast(`Logged ${totalK} kcal`);
}
async function saveBody(e){ e.preventDefault(); const fd=new FormData(e.currentTarget); const {error}=await db.from('body_logs').insert({user_id:user.id,weight_kg:parseFloat(fd.get('weight_kg')),logged_at:new Date().toISOString()}); if(error) return toast(error.message,true); e.currentTarget.closest('dialog')?.close(); await loadRecords(); renderAll(); }
function buildProfileForm(){ const f=$("#profileForm"); if(!f||!profile) return; f.innerHTML=`<label>Full name<input name="full_name" value="${esc(profile.full_name)}" style="width:100%;background:#0a0a0a;border:1px solid #242424;color:#ededed;padding:8px;border-radius:8px"></label><label>Target kg<input name="target_weight_kg" type="number" value="${profile.target_weight_kg}" style="width:100%;background:#0a0a0a;border:1px solid #242424;color:#ededed;padding:8px;border-radius:8px"></label><button class="btn primary" type="submit" style="background:#c6ff00;color:#000;border:0;padding:10px;border-radius:8px;font-weight:800">Save</button>`; f.onsubmit=async e=>{ e.preventDefault(); const fd=new FormData(f); const {error}=await db.from("profiles").update({full_name:fd.get("full_name"),target_weight_kg:+fd.get("target_weight_kg")}).eq("id",user.id); if(error) return toast(error.message,true); toast("Saved"); }; }

let monthlyChartObj=null, sportChartObj=null, weightChartObj=null, eleHrChartObj=null, monthDetailChartObj=null;
function renderDreeveCharts(){
  if(typeof Chart==='undefined') return;
  let allActs=[...records.activities];
  const yearSel=$("#yearFilter")?.value||'All time';
  if(yearSel!=='All time'){ const y=parseInt(yearSel); if(!isNaN(y)) allActs=allActs.filter(a=>new Date(a.logged_at).getFullYear()===y); }
  allActs=[...allActs,...records.steps.map(s=>({distance_km:s.distance_km||0,duration_minutes:0,logged_at:s.logged_at,activity_name:'Walking',calories_burned:0}))];
  const totalDist=allActs.reduce((s,a)=>s+Number(a.distance_km||0),0);
  const totalMin=allActs.reduce((s,a)=>s+Number(a.duration_minutes||0),0);
  $("#sbDist")&&( $("#sbDist").textContent=totalDist.toFixed(1)+' km' );
  $("#sbTime")&&( $("#sbTime").textContent=(totalMin/60).toFixed(1)+' h' );
  $("#sbCount")&&( $("#sbCount").textContent=records.activities.length );
  const metric=$("#chartMetric")?.value||'distance';
  const byMonth={}; for(let i=11;i>=0;i--){ const d=new Date(); d.setMonth(d.getMonth()-i); const k=d.toISOString().slice(0,7); byMonth[k]=0; }
  allActs.forEach(a=>{ const k=new Date(a.logged_at).toISOString().slice(0,7); if(byMonth[k]!==undefined){ if(metric==='distance') byMonth[k]+=Number(a.distance_km||0); else if(metric==='duration') byMonth[k]+=Number(a.duration_minutes||0); else if(metric==='calories') byMonth[k]+=Number(a.calories_burned||0); else byMonth[k]+=Number(a.distance_km||0); } });
  const labels=Object.keys(byMonth); const vals=labels.map(k=>Number(byMonth[k].toFixed(2)));
  const ctx=document.getElementById('monthlyChart');
  if(ctx){
    if(monthlyChartObj) monthlyChartObj.destroy();
    monthlyChartObj=new Chart(ctx,{type:'bar',data:{labels,[STRIPPED] if(els.length){ const m=labels[els[0].index]; $("#chartHint")&&( $("#chartHint").textContent='Drill: '+m ); renderMonthDetail(m); switchView('monthlyView'); }},plugins:{legend:{display:false}},scales:{x:{grid:{color:'#1e1e1e'},ticks:{color:'#8a8a8a'}},y:{grid:{color:'#1e1e1e'},ticks:{color:'#8a8a8a'}}}}});
  }
  const bySport={}; allActs.forEach(a=>{ const s=a.activity_name||'Workout'; bySport[s]=(bySport[s]||0)+(metric==='duration'?Number(a.duration_minutes||0):Number(a.distance_km||0)); });
  const ctx2=document.getElementById('sportChart');
  if(ctx2&&Object.keys(bySport).length){
    if(sportChartObj) sportChartObj.destroy();
    sportChartObj=new Chart(ctx2,{type:'doughnut',data:{labels:Object.keys(bySport),[STRIPPED] if(els.length){ const sport=Object.keys(bySport)[els[0].index]; $("#searchAct")&&( $("#searchAct").value=sport ); renderActivitiesTable(sport); switchView('activitiesView'); }},plugins:{legend:{position:'bottom',labels:{color:'#8a8a8a',boxWidth:12}}}}});
  }
  const weights=[...records.body].sort((a,b)=>new Date(a.logged_at)-new Date(b.logged_at)).slice(-30);
  const ctxW=document.getElementById('weightChart');
  if(ctxW){ if(weightChartObj) weightChartObj.destroy(); if(weights.length){ weightChartObj=new Chart(ctxW,{type:'line',data:{labels:weights.map(w=>dayStr(w.logged_at).slice(5)),[STRIPPED]
  }
}
function renderMonthDetail(ym){
  const el=$("#monthDetailList"), canvas=$("#monthDetailChart"); if(!el) return;
  const acts=records.activities.filter(a=>new Date(a.logged_at).toISOString().startsWith(ym)).sort((a,b)=>new Date(a.logged_at)-new Date(b.logged_at));
  if(!acts.length){ el.innerHTML=`<div class="muted" style="padding:20px">No activities in ${ym}</div>`; if(canvas) canvas.style.display='none'; return; }
  const byDay={}; acts.forEach(a=>{ const d=dayStr(a.logged_at); byDay[d]=(byDay[d]||0)+Number(a.distance_km||0); });
  if(canvas){ canvas.style.display='block'; if(monthDetailChartObj) monthDetailChartObj.destroy(); monthDetailChartObj=new Chart(canvas,{type:'bar',data:{labels:Object.keys(byDay),[STRIPPED]
  el.innerHTML=acts.map(a=>`<div class="row"><div><strong>${esc(a.activity_name)}</strong><br><small class="muted">${new Date(a.logged_at).toLocaleDateString()} • ${a.distance_km}km</small></div><span>${a.calories_burned||0} kcal</span></div>`).join('');
}
function renderActivitiesTable(filter=''){
  const el=document.getElementById('activitiesTable'); if(!el) return;
  let list=[...records.activities].sort((a,b)=>new Date(b.logged_at)-new Date(a.logged_at));
  if(filter) list=list.filter(a=> new Date(a.logged_at).toISOString().startsWith(filter) || a.activity_name.toLowerCase().includes(filter.toLowerCase()));
  el.innerHTML=list.slice(0,150).map(a=>`<div class="row" style="cursor:pointer" onclick="selectActivity('${a.id}')"><div><strong>${esc(a.activity_name)}</strong><br><small class="muted">${new Date(a.logged_at).toLocaleDateString()} • ${a.distance_km}km • ${a.duration_minutes}min • ${esc(a.source||'')}</small></div><span>${a.calories_burned||0} kcal</span></div>`).join('')||'<div class="muted" style="padding:20px;text-align:center">No activities — import FIT/GPX</div>';
  const recent=document.getElementById('recentActivities'); if(recent) recent.innerHTML=list.slice(0,5).map(a=>`<div class="row"><div>${esc(a.activity_name)} • ${a.distance_km}km</div><small class="muted">${new Date(a.logged_at).toLocaleDateString()}</small></div>`).join('');
}
window.selectActivity=(id)=>{ const act=records.activities.find(a=>a.id===id); if(act) toast(`${act.activity_name} • ${act.distance_km}km`); };
function renderGpxDetailCharts(){ /* handled by gpx-report.js */ }
function renderCalendar(){
  const cal=document.getElementById('calendarGrid'); if(!cal) return;
  const ml=document.getElementById('monthLabel'); if(ml) ml.textContent=currentCalendarDate.toLocaleString('en',{month:'long',year:'numeric'});
  const y=currentCalendarDate.getFullYear(), m=currentCalendarDate.getMonth();
  const first=new Date(y,m,1); const days=new Date(y,m+1,0).getDate();
  const byDay={}; records.activities.forEach(a=>{ const d=dayStr(a.logged_at); if(new Date(a.logged_at).getMonth()===m&&new Date(a.logged_at).getFullYear()===y) byDay[d]=(byDay[d]||0)+1; });
  let html=''; for(let i=0;i<first.getDay();i++) html+='<div></div>';
  for(let d=1;d<=days;d++){ const iso=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; const has=byDay[iso]; const isToday=iso===todayStr(); html+=`<div class="${has?'has':''} ${isToday?'today':''}" style="cursor:${has?'pointer':''}" ${has?`onclick="renderMonthDetailDay('${iso}')"` :''}><strong>${d}</strong><br><small>${has?has+'x':''}</small></div>`; }
  cal.innerHTML=html;
}
window.renderMonthDetailDay=(iso)=>{
  const acts=records.activities.filter(a=>dayStr(a.logged_at)===iso);
  const el=$("#monthDetailList"); if(el) el.innerHTML=`<h4 style="margin:10px 0">${iso} • ${acts.length} activities • ${acts.reduce((s,a)=>s+Number(a.distance_km||0),0).toFixed(1)}km</h4>`+acts.map(a=>`<div class="row"><div><strong>${esc(a.activity_name)}</strong><br><small class="muted">${a.distance_km}km • ${a.duration_minutes}min</small></div><span>${a.calories_burned||0} kcal</span></div>`).join('');
};
window.handleQuickImport=async()=>{
  const file=document.getElementById("quickImportFile")?.files[0]; if(!file) return toast("Select file",true);
  if(file.name.toLowerCase().endsWith('.gpx')) return handleGpxImport(file);
  if(file.name.toLowerCase().endsWith('.fit')) return handleFitImport(file);
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
boot();