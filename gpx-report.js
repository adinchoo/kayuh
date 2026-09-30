// GPX / FIT Deep Report v8.4.1 STABLE - No Flow + Supabase Save
const GpxReport = {
  data:null, map:null, poly:null, markers:[], charts:{},
  SUPA_URL:"https://dxgzluurwsoytqlasuup.supabase.co",
  SUPA_KEY:"sb_publishable_RTeGJ9m_CL26fUMXwEGLJQ_JfGiLyit",
  getDb(){ try{ if(typeof db!=='undefined' && db) return db; if(window.db) return window.db; return window.supabase.createClient(this.SUPA_URL,this.SUPA_KEY,{auth:{persistSession:true}});}catch(e){return null;} },

  safeChart(id){
    let c=document.getElementById(id); if(!c) return null;
    let wrap=c.closest('.chart-wrap');
    if(!wrap){
      const nw=document.createElement('div'); nw.className='chart-wrap';
      c.parentNode.insertBefore(nw,c); nw.appendChild(c); wrap=nw;
    }
    c.removeAttribute('height'); // critical fix - remove height attr
    return c;
  },

  async loadFile(file){
    const container=document.getElementById('gpxReportContainer');
    if(container){
      container.innerHTML=`<div class="card" style="padding:20px;display:flex;gap:14px;align-items:center"><div class="spinner"></div><div><strong>Loading ${file.name}...</strong><br><small class="muted">${(file.size/1024).toFixed(0)} KB</small></div></div>`;
    }
    const ext=file.name.toLowerCase().split('.').pop();
    let parsed,type;
    if(ext==='gpx'){ const text=await file.text(); parsed=Integrations.parseGpx(text); type='GPX'; this._rawText=text; }
    else if(ext==='fit'){ const buf=await file.arrayBuffer(); parsed=Integrations.parseFit(buf); type='FIT'; this._rawText=null; }
    else throw new Error('Only.gpx and.fit');
    this.buildData(file.name,type,parsed,file);
    this.render();
    window._lastGpxReport=this.data;
    await this.saveToSupabase(file);
  },

  buildData(fileName,type,parsed,file){
    let points=[];
    let laps=parsed.lapsRaw||[], sessions=parsed.sessions||[];
    if(type==='GPX'){ points=parsed.tracks.flatMap(t=>t.points.map(p=>({...p, sport:t.sport, cumDist:p.cumDist||0 }))); }
    else { points=parsed.recordsDetailed.map(r=>({lat:r.lat, lon:r.lon, ele:r.altitude, altitude:r.altitude, time:r.timestamp, timestamp:r.timestamp, hr:r.hr, cadence:r.cadence, speed:r.speed_kmh||(r.speed?r.speed*3.6:null), speed_ms:r.speed, power:r.power, temp:r.temperature, distance:r.distance, cumDist:r.distance||0, raw:r.raw})); }
    if(type==='FIT'){ let lastValid=0; for(let i=0;i<points.length;i++){ if(points[i].distance!=null){ lastValid=points[i].distance; points[i].cumDist=lastValid; } else points[i].cumDist=lastValid; } }
    let totalDist=0,elevGain=0,elevLoss=0,minEle=Infinity,maxEle=-Infinity; let speeds=[],hrs=[],cads=[],powers=[];
    for(let i=0;i<points.length;i++){
      const p=points[i]; const eleVal=p.ele??p.altitude;
      if(eleVal!=null&&!isNaN(eleVal)){ minEle=Math.min(minEle,eleVal); maxEle=Math.max(maxEle,eleVal); if(i>0){ const prev=points[i-1].ele??points[i-1].altitude; if(prev!=null){ const d=eleVal-prev; if(d>0) elevGain+=d; else elevLoss+=Math.abs(d); } } }
      if(p.speed!=null&&!isNaN(p.speed)) speeds.push(p.speed);
      if(p.hr!=null) hrs.push(p.hr); if(p.cadence!=null) cads.push(p.cadence); if(p.power!=null) powers.push(p.power);
    }
    if(points.length){ if(type==='GPX') totalDist=points[points.length-1].cumDist||0; else totalDist=points.filter(p=>p.distance!=null).pop()?.distance||sessions[0]?.distanceM||0; }
    const firstTime=points.find(p=>p.time)?.time||points.find(p=>p.timestamp)?.timestamp||sessions[0]?.start||new Date();
    const lastPointTime=[...points].reverse().find(p=>p.time||p.timestamp);
    const lastTime=(lastPointTime?.time||lastPointTime?.timestamp)||new Date(new Date(firstTime).getTime()+(sessions[0]?.elapsedSec||0)*1000);
    const totalTimeSec=Math.max(1,(new Date(lastTime)-new Date(firstTime))/1000||sessions[0]?.elapsedSec||0);
    const avgSpeedKmh=totalTimeSec>0? (totalDist/1000)/(totalTimeSec/3600):0;
    const maxSpeedKmh=speeds.length?Math.max(...speeds):0;
    const splits=[]; let lastSplitDist=0,lastSplitTime=new Date(firstTime),splitHr=[],splitEleGain=0,lastEle=points[0]?.ele??points[0]?.altitude;
    for(let i=1;i<points.length;i++){
      const curDist=points[i].cumDist||0; const curTime=points[i].time||points[i].timestamp||lastTime;
      if(points[i].hr) splitHr.push(points[i].hr);
      const curEle=points[i].ele??points[i].altitude;
      if(curEle!=null&&lastEle!=null&&curEle>lastEle) splitEleGain+=curEle-lastEle;
      lastEle=curEle??lastEle;
      if(curDist-lastSplitDist>=1000||i===points.length-1){
        const segTime=(new Date(curTime)-new Date(lastSplitTime))/1000;
        splits.push({km:splits.length+1,dist:(curDist-lastSplitDist)/1000,durationSec:segTime>0?segTime:0,avgHr:splitHr.length?Math.round(splitHr.reduce((a,b)=>a+b,0)/splitHr.length):null,elevGain:splitEleGain,startIdx:points.findIndex(p=>(p.cumDist||0)>=lastSplitDist),endIdx:i});
        lastSplitDist=curDist; lastSplitTime=new Date(curTime); splitHr=[]; splitEleGain=0;
      }
    }
    this.data={fileName,type,sport:sessions[0]?.sport||points[0]?.sport||'Workout',points,laps,sessions,splits,stats:{totalDistKm:totalDist/1000,totalDistM:totalDist,totalTimeSec,movingTimeSec:sessions[0]?.movingTimeSec||totalTimeSec,elevGain,elevLoss,minEle:isFinite(minEle)?minEle:0,maxEle:isFinite(maxEle)?maxEle:0,avgSpeedKmh,maxSpeedKmh,avgHr:hrs.length?Math.round(hrs.reduce((a,b)=>a+b,0)/hrs.length):null,maxHr:hrs.length?Math.max(...hrs):null,avgCad:cads.length?Math.round(cads.reduce((a,b)=>a+b,0)/cads.length):null,maxCad:cads.length?Math.max(...cads):null,avgPower:powers.length?Math.round(powers.reduce((a,b)=>a+b,0)/powers.length):null,maxPower:powers.length?Math.max(...powers):null,pointCount:points.length,lapCount:laps.length,startTime:firstTime,endTime:lastTime}, fileObj:file};
  },

  async saveToSupabase(file){
    try{
      const dbc=this.getDb(); if(!dbc) return;
      const {data:{session}}=await dbc.auth.getSession(); const uid=session?.user?.id; if(!uid) return;
      const s=this.data.stats; const pts=this.data.points.slice(0,2000).map(p=>({lat:p.lat,lon:p.lon,ele:p.ele??p.altitude,hr:p.hr,cad:p.cadence,t:p.time||p.timestamp}));
      const hrZones=this.calcZones(this.data.points.map(p=>p.hr).filter(Boolean));
      await dbc.from("gpx_tracks").insert({user_id:uid,file_name:file.name,activity_type:this.data.sport,distance_km:Number(s.totalDistKm.toFixed(3)),duration_minutes:Math.round(s.totalTimeSec/60),elevation_gain_m:Math.round(s.elevGain),elevation_loss_m:Math.round(s.elevLoss),max_elevation_m:Math.round(s.maxEle),min_elevation_m:Math.round(s.minEle),avg_speed_kmh:Number(s.avgSpeedKmh.toFixed(2)),max_speed_kmh:Number(s.maxSpeedKmh.toFixed(2)),avg_hr:s.avgHr,max_hr:s.maxHr,avg_cadence:s.avgCad,max_cadence:s.maxCad,hr_zones:hrZones,calories_est:Math.round(s.totalDistKm*70),points_count:s.pointCount,gpx_raw:this._rawText?this._rawText.slice(0,400000):null,track_data:pts,logged_at:new Date(s.startTime).toISOString()});
    }catch(e){ console.log("gpx save skip",e.message); }
  },
  calcZones(hrs){ if(!hrs.length) return []; const max=Math.max(...hrs); const zones=[{name:'Z1',min:0,max:max*0.6,count:0},{name:'Z2',min:max*0.6,max:max*0.7,count:0},{name:'Z3',min:max*0.7,max:max*0.8,count:0},{name:'Z4',min:max*0.8,max:max*0.9,count:0},{name:'Z5',min:max*0.9,max:300,count:0}]; hrs.forEach(h=>{ const z=zones.find(z=>h>=z.min&&h<z.max); if(z) z.count++; }); const tot=zones.reduce((a,b)=>a+b.count,0)||1; zones.forEach(z=>z.pct=Math.round(z.count/tot*100)); return zones; },

  render(){
    const c=document.getElementById('gpxReportContainer'); if(!c||!this.data) return;
    const s=this.data.stats,d=this.data;
    c.innerHTML=`
      <div class="card" style="border:1px solid #c6ff00">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px"><div><h3>📂 ${d.fileName}</h3><small class="muted">${d.type} • ${d.sport} • ${new Date(s.startTime).toLocaleString()} • ${s.pointCount} pts • Saved to DB ✓</small></div><div style="display:flex;gap:8px"><button class="btn small primary" id="gpxAiBtn">🤖 AI Coach</button><button class="btn small" id="gpxExportBtn">⬇️ JSON</button></div></div>
        <div class="kpi4" style="margin-top:14px">
          <div class="kpi"><label>DISTANCE</label><b>${s.totalDistKm.toFixed(2)} km</b><small>${s.totalDistM.toFixed(0)} m</small></div>
          <div class="kpi"><label>DURATION</label><b>${Math.floor(s.totalTimeSec/60)}:${String(Math.round(s.totalTimeSec%60)).padStart(2,'0')}</b><small>${(s.movingTimeSec/60).toFixed(0)} min moving</small></div>
          <div class="kpi"><label>ELEV GAIN</label><b>+${Math.round(s.elevGain)} m</b><small>-${Math.round(s.elevLoss)} m</small></div>
          <div class="kpi"><label>HR AVG/MAX</label><b>${s.avgHr||'--'} / ${s.maxHr||'--'}</b><small>${s.avgSpeedKmh.toFixed(1)} km/h</small></div>
        </div>
        <div id="gpxAiResult" style="margin-top:12px;background:#0a0a0a;padding:14px;border-radius:10px;border:1px solid #242424;white-space:pre-wrap;min-height:50px;font-size:13px">Tap AI Coach...</div>
        <div id="pointDetail" style="margin-top:10px;background:#111;padding:10px;border-radius:8px;border:1px solid #222;display:none"></div>
      </div>
      <div class="card"><div class="card-head"><h3>🗺 Map</h3><small class="muted">${s.pointCount} points</small></div><div id="gpxMap"></div><div style="display:flex;gap:8px;margin-top:8px"><input type="range" id="animSlider" min="0" max="${d.points.length-1}" value="0" style="flex:1"><button class="btn small" id="btnPlay">▶</button><button class="btn small" id="btnPause">⏸</button></div></div>
      <div class="grid2-dreeve">
        <div class="card"><div class="card-head"><h3>⛰ Elevation</h3><small class="muted">Tap to drill</small></div><div class="chart-wrap"><canvas id="eleChart"></canvas></div></div>
        <div class="card"><div class="card-head"><h3>❤ HR / Speed / Power</h3></div><div class="chart-wrap"><canvas id="hrSpeedChart"></canvas></div><div style="display:flex;gap:12px;margin-top:8px;font-size:11px"><span style="color:#ff7a86">● HR</span><span style="color:#58a9ff">● Speed</span><span style="color:#c6ff00">● Power</span></div></div>
      </div>
      <div class="card"><div class="card-head"><h3>🏁 Splits per 1KM</h3><small class="muted">${d.splits.length} splits</small></div><div id="splitsTable"></div></div>
      <div class="card"><div class="card-head"><h3>📋 Data Points • 300</h3></div><div style="max-height:360px;overflow:auto;border:1px solid #242424;border-radius:8px"><table id="pointsTable" style="width:100%;border-collapse:collapse;font-size:11px;font-family:monospace"></table></div></div>
    `;
    document.getElementById('gpxAiBtn').onclick=()=>this.runAi();
    document.getElementById('gpxExportBtn').onclick=()=>this.exportJson();
    document.getElementById('btnPlay')?.addEventListener('click',()=>this.startAnim());
    document.getElementById('btnPause')?.addEventListener('click',()=>this.stopAnim());
    setTimeout(()=>{ this.drawMap(); this.drawCharts(); this.drawTables(); }, 150);
  },

  drawMap(){
    const el=document.getElementById('gpxMap'); if(!el||!this.data) return;
    const pts=this.data.points.filter(p=>p.lat!=null&&p.lon!=null&&!isNaN(p.lat));
    if(!pts.length){ el.innerHTML='<div style="padding:40px;text-align:center" class="muted">No GPS (indoor)</div>'; return; }
    if(typeof L==='undefined'){ el.innerHTML='<div style="padding:20px">Leaflet offline</div>'; return; }
    if(this.map){ this.map.remove(); this.map=null; }
    this.map=L.map(el,{tap:true,touchZoom:true,dragging:true}).setView([pts[0].lat,pts[0].lon],13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(this.map);
    const latlngs=pts.map(p=>[p.lat,p.lon]);
    this.poly=L.polyline(latlngs,{color:'#c6ff00',weight:4,opacity:.9}).addTo(this.map);
    this.poly.on('click',e=>{ let minIdx=0,minDist=Infinity; pts.forEach((p,i)=>{ const d=Math.hypot(p.lat-e.latlng.lat,p.lon-e.latlng.lng); if(d<minDist){ minDist=d; minIdx=i; } }); this.showPointDetail(minIdx); });
    this.marker=L.circleMarker(latlngs[0],{radius:10,color:'#000',fillColor:'#c6ff00',fillOpacity:1,weight:3}).addTo(this.map);
    L.circleMarker(latlngs[0],{radius:8,color:'#5de8b6',fillColor:'#5de8b6',fillOpacity:1}).addTo(this.map).bindPopup('START');
    L.circleMarker(latlngs[latlngs.length-1],{radius:8,color:'#ff7a86',fillColor:'#ff7a86',fillOpacity:1}).addTo(this.map).bindPopup('FINISH');
    this.map.fitBounds(this.poly.getBounds(),{padding:[30,30]}); setTimeout(()=>this.map.invalidateSize(),300);
    const slider=document.getElementById('animSlider'); if(slider){ slider.addEventListener('input',e=>{ this.stopAnim(); const idx=+e.target.value; const p=pts[idx]; if(p&&this.marker){ this.marker.setLatLng([p.lat,p.lon]); this.showPointDetail(idx); } }); }
  },
  animTimer:null, playing:false, animIdx:0,
  startAnim(){ if(this.playing) return; this.playing=true; const pts=this.data.points.filter(p=>p.lat!=null); const speed=100; this.animTimer=setInterval(()=>{ this.animIdx++; if(this.animIdx>=pts.length){ this.stopAnim(); return; } const p=pts[this.animIdx]; if(this.marker) this.marker.setLatLng([p.lat,p.lon]); const s=document.getElementById('animSlider'); if(s) s.value=this.animIdx; },speed); },
  stopAnim(){ this.playing=false; if(this.animTimer) clearInterval(this.animTimer); this.animTimer=null; },

  showPointDetail(idx){
    const p=this.data.points[idx]; if(!p) return;
    const detail=document.getElementById('pointDetail'); if(!detail) return;
    detail.style.display='block';
    detail.innerHTML=`<div style="display:flex;justify-content:space-between"><strong>#${idx} • ${((p.cumDist||0)/1000).toFixed(3)} km</strong><button onclick="this.parentElement.parentElement.style.display='none'" style="background:transparent;border:0;color:#8a8a8a">×</button></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px;font-size:12px"><div>Ele: <b>${p.ele!=null?Math.round(p.ele)+'m':'--'}</b></div><div>HR: <b style="color:#ff7a86">${p.hr||'--'}</b></div><div>Spd: <b style="color:#58a9ff">${p.speed!=null?p.speed.toFixed(1):'--'}</b></div><div>Pow: <b>${p.power||'--'}</b></div><div>Cad: <b>${p.cadence||'--'}</b></div><div>Time: <b>${p.time?new Date(p.time).toLocaleTimeString():''}</b></div></div>`;
    Object.values(this.charts).forEach(ch=>{ try{ ch.setActiveElements([{datasetIndex:0,index:Math.floor(idx/(this.data.points.length/400))}]); ch.update(); }catch(e){} });
  },

  drawCharts(){
    if(typeof Chart==='undefined') return;
    const pts=this.data.points; const maxPts=400; const step=Math.max(1,Math.floor(pts.length/maxPts)); const sampled=pts.filter((_,i)=>i%step===0); const distLabels=sampled.map(p=>((p.cumDist||0)/1000).toFixed(2));
    let eleCanvas=this.safeChart('eleChart');
    if(eleCanvas){ if(this.charts.ele) try{ this.charts.ele.destroy(); }catch(e){} this.charts.ele=new Chart(eleCanvas,{type:'line',data:{labels:distLabels,datasets:[{label:'Elevation m',data:sampled.map(p=>p.ele??p.altitude??null),borderColor:'#5de8b6',backgroundColor:'rgba(93,232,182,0.15)',fill:true,tension:0.3,pointRadius:0,pointHoverRadius:6}]},options:{responsive:true,maintainAspectRatio:false,animation:false,resizeDelay:250,interaction:{mode:'index',intersect:false},onClick:(e,els)=>{ if(els.length){ const realIdx=els[0].index*step; this.showPointDetail(realIdx); } },plugins:{legend:{display:false}},scales:{x:{grid:{color:'#1e1e1e'},ticks:{color:'#8a8a8a',maxTicksLimit:6},border:{display:false}},y:{grid:{color:'#1e1e1e'},ticks:{color:'#8a8a8a'},border:{display:false}}}}}); }
    let hrCanvas=this.safeChart('hrSpeedChart');
    if(hrCanvas){ if(this.charts.hr) try{ this.charts.hr.destroy(); }catch(e){} this.charts.hr=new Chart(hrCanvas,{type:'line',data:{labels:distLabels,datasets:[{label:'HR bpm',data:sampled.map(p=>p.hr||null),borderColor:'#ff7a86',backgroundColor:'transparent',tension:0.3,pointRadius:0,yAxisID:'y'},{label:'Speed km/h',data:sampled.map(p=>p.speed||null),borderColor:'#58a9ff',backgroundColor:'transparent',tension:0.3,pointRadius:0,yAxisID:'y1'},{label:'Power W',data:sampled.map(p=>p.power||null),borderColor:'#c6ff00',backgroundColor:'transparent',tension:0.3,pointRadius:0,yAxisID:'y1',hidden:true}]},options:{responsive:true,maintainAspectRatio:false,animation:false,resizeDelay:250,interaction:{mode:'index',intersect:false},onClick:(e,els)=>{ if(els.length){ const realIdx=els[0].index*step; this.showPointDetail(realIdx); } },plugins:{legend:{labels:{color:'#8a8a8a',boxWidth:12}}},scales:{x:{grid:{color:'#1e1e1e'},ticks:{color:'#8a8a8a',maxTicksLimit:6},border:{display:false}},y:{position:'left',grid:{color:'#1e1e1e'},ticks:{color:'#ff7a86'},border:{display:false}},y1:{position:'right',grid:{display:false},ticks:{color:'#58a9ff'},border:{display:false}}}}}); }
  },

  drawTables(){
    const splitsEl=document.getElementById('splitsTable');
    if(splitsEl){ splitsEl.innerHTML=`<div class="row" style="font-weight:800;font-size:11px;color:#8a8a8a"><div>KM</div><span>Time</span><span>HR</span><span>Elev</span><span>Pace</span></div>`+this.data.splits.map(s=>{ const paceSec=s.dist>0?s.durationSec/s.dist:0; const pace=`${Math.floor(paceSec/60)}:${String(Math.round(paceSec%60)).padStart(2,'0')}/km`; return `<div class="row" style="cursor:pointer" onclick="GpxReport.zoomToSplit(${s.km})"><div><strong>${s.km}</strong></div><span>${Math.floor(s.durationSec/60)}:${String(Math.round(s.durationSec%60)).padStart(2,'0')}</span><span style="color:#ff7a86">${s.avgHr||'--'}</span><span>+${Math.round(s.elevGain)}m</span><span>${pace}</span></div>`; }).join('')||'<div class="muted">No splits</div>'; }
    const ptTable=document.getElementById('pointsTable');
    if(ptTable){ ptTable.innerHTML=`<tr style="position:sticky;top:0;background:#161616"><th>#</th><th>Dist</th><th>Ele</th><th>HR</th><th>Spd</th><th>Pow</th><th>Lat</th><th>Lon</th></tr>`+this.data.points.slice(0,300).map((p,i)=>`<tr style="border-bottom:1px solid #222;cursor:pointer" onclick="GpxReport.showPointDetail(${i})"><td>${i}</td><td>${((p.cumDist||0)/1000).toFixed(3)}</td><td>${p.ele!=null?Math.round(p.ele):''}</td><td style="color:#ff7a86">${p.hr||''}</td><td style="color:#58a9ff">${p.speed!=null?p.speed.toFixed(1):''}</td><td>${p.power||''}</td><td>${p.lat?p.lat.toFixed(4):''}</td><td>${p.lon?p.lon.toFixed(4):''}</td></tr>`).join(''); }
  },
  zoomToSplit(km){ const split=this.data.splits.find(s=>s.km===km); if(!split) return; const pts=this.data.points.slice(split.startIdx,split.endIdx+1).filter(p=>p.lat); if(!pts.length||!this.map) return; const bounds=L.latLngBounds(pts.map(p=>[p.lat,p.lon])); this.map.fitBounds(bounds,{padding:[40,40]}); this.showPointDetail(split.startIdx); },
  async runAi(){ const el=document.getElementById('gpxAiResult'); if(!el) return; const btn=document.getElementById('gpxAiBtn'); if(btn){ btn.disabled=true; btn.textContent='Analyzing...'; } el.innerHTML=`<div style="display:flex;gap:10px;align-items:center"><div class="spinner"></div><div><strong>🤖 AI Analyzing ${this.data.stats.pointCount} points...</strong></div></div>`; try{ const prof=typeof profile!=='undefined'&&profile?profile:{full_name:'Athlete'}; const txt=await AI.analyzeGpxFitReport(prof,this.data); el.textContent=txt; }catch(e){ el.innerHTML=`<span style="color:#ff7a86">❌ ${e.message}</span>`; } finally{ if(btn){ btn.disabled=false; btn.textContent='🤖 AI Coach'; } } },
  exportJson(){ const blob=new Blob([JSON.stringify(this.data,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`${this.data.fileName}-${new Date().toISOString().slice(0,10)}.json`; a.click(); },
  drawMap(){}, // placeholder - actual drawMap above
  // for backward compat
  get mapObj(){ return this.map; }
};
// Alias for old code
window.GpxReport = GpxReport;