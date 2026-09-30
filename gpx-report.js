// GPX / FIT Deep Report v8.4.2 STABLE - Activities Full Details + Supabase Save
const GpxReport = {
  data:null, map:null, poly:null, markers:[], charts:{}, marker:null,
  SUPA_URL:"https://dxgzluurwsoytqlasuup.supabase.co",
  SUPA_KEY:"sb_publishable_RTeGJ9m_CL26fUMXwEGLJQ_JfGiLyit",
  getDb(){ try{ if(typeof db!=='undefined' && db) return db; if(window.db) return window.db; return window.supabase.createClient(this.SUPA_URL,this.SUPA_KEY,{auth:{persistSession:true}});}catch(e){return null;} },

  safeChart(id){
    let c=document.getElementById(id); if(!c) return null;
    let wrap=c.closest('.chart-wrap');
    if(!wrap){ const nw=document.createElement('div'); nw.className='chart-wrap'; c.parentNode.insertBefore(nw,c); nw.appendChild(c); wrap=nw; }
    c.removeAttribute('height');
    return c;
  },

  async loadFile(file){
    const container=document.getElementById('gpxReportContainer');
    if(container){ container.innerHTML=`<div class="card" style="padding:20px;display:flex;gap:14px;align-items:center"><div class="spinner"></div><div><strong>Loading ${file.name}...</strong><br><small class="muted">${(file.size/1024).toFixed(0)} KB</small></div></div>`; }
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
    let points=[]; let laps=parsed.lapsRaw||[], sessions=parsed.sessions||[];
    if(type==='GPX'){ points=parsed.tracks.flatMap(t=>t.points.map(p=>({...p, sport:t.sport, cumDist:p.cumDist||0}))); }
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

  buildFromTrackData(track){
    const points=(track.track_data||[]).map(p=>({lat:p.lat,lon:p.lon,ele:p.ele,altitude:p.ele,time:p.t||p.time,timestamp:p.t||p.time,hr:p.hr,cadence:p.cad,power:p.power,speed:p.speed,cumDist:p.dist||p.cumDist||0}));
    let dist=0; for(let i=1;i<points.length;i++){ if(points[i].lat&&points[i-1].lat){ dist+=this.haversine(points[i-1].lat,points[i-1].lon,points[i].lat,points[i].lon); } if(!points[i].cumDist) points[i].cumDist=dist; }
    this.data={
      fileName:track.file_name, type:'SAVED', sport:track.activity_type,
      points, laps:[], sessions:[], splits: this.makeSplits(points),
      stats:{totalDistKm:track.distance_km,totalDistM:track.distance_km*1000,totalTimeSec:track.duration_minutes*60,movingTimeSec:track.duration_minutes*60,elevGain:track.elevation_gain_m,elevLoss:track.elevation_loss_m||0,minEle:track.min_elevation_m||0,maxEle:track.max_elevation_m||0,avgSpeedKmh:track.avg_speed_kmh||0,maxSpeedKmh:track.max_speed_kmh||0,avgHr:track.avg_hr,maxHr:track.max_hr,avgCad:track.avg_cadence,maxCad:track.max_cadence,pointCount:points.length,lapCount:0,startTime:track.logged_at,endTime:track.logged_at}
    };
  },

  buildFromActivity(act){
    this.data={
      fileName:`${act.activity_name} - ${new Date(act.logged_at).toISOString().slice(0,10)}`, type:act.source||'ACTIVITY', sport:act.activity_name,
      points:[], laps:[], sessions:[{distanceM:(act.distance_km||0)*1000, elapsedSec:(act.duration_minutes||0)*60}],
      splits:[{km:1,dist:Number(act.distance_km||0),durationSec:Number(act.duration_minutes||0)*60,avgHr:act.avg_hr||null,elevGain:act.elevation_gain_m||0,startIdx:0,endIdx:0}],
      stats:{totalDistKm:Number(act.distance_km||0),totalDistM:Number(act.distance_km||0)*1000,totalTimeSec:Number(act.duration_minutes||0)*60,movingTimeSec:Number(act.duration_minutes||0)*60,elevGain:act.elevation_gain_m||0,elevLoss:0,minEle:0,maxEle:0,avgSpeedKmh:act.duration_minutes? (act.distance_km/(act.duration_minutes/60)):0,maxSpeedKmh:0,avgHr:act.avg_hr||null,maxHr:act.max_hr||null,pointCount:0,lapCount:0,startTime:act.logged_at,endTime:act.logged_at}
    };
  },

  makeSplits(points){
    const splits=[]; let last=0, t0=0; for(let i=0;i<points.length;i++){ const d=points[i].cumDist||0; if(d-last>=1000||i===points.length-1){ splits.push({km:splits.length+1,dist:(d-last)/1000,durationSec:60,avgHr:null,elevGain:0,startIdx:t0,endIdx:i}); last=d; t0=i; } } return splits;
  },

  async saveToSupabase(file){
    try{
      const dbc=this.getDb(); if(!dbc) return;
      const {data:{session}}=await dbc.auth.getSession(); const uid=session?.user?.id; if(!uid) return;
      const s=this.data.stats; const pts=this.data.points.slice(0,2000).map(p=>({lat:p.lat,lon:p.lon,ele:p.ele??p.altitude,hr:p.hr,cad:p.cadence,t:p.time||p.timestamp,dist:p.cumDist}));
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
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px"><div><h3>📂 ${d.fileName}</h3><small class="muted">${d.type} • ${d.sport} • ${new Date(s.startTime).toLocaleString()} • ${s.pointCount} pts • Saved ✓</small></div><div style="display:flex;gap:8px"><button class="btn small primary" id="gpxAiBtn">🤖 AI Coach</button><button class="btn small" id="gpxExportBtn">⬇️ JSON</button><button class="btn small" onclick="switchView('activitiesView')">← Activities</button></div></div>
        <div class="kpi4" style="margin-top:14px">
          <div class="kpi"><label>DISTANCE</label><b>${s.totalDistKm.toFixed(2)} km</b><small>${s.totalDistM.toFixed(0)} m</small></div>
          <div class="kpi"><label>DURATION</label><b>${Math.floor(s.totalTimeSec/60)}:${String(Math.round(s.totalTimeSec%60)).padStart(2,'0')}</b><small>${(s.movingTimeSec/60).toFixed(0)} min moving</small></div>
          <div class="kpi"><label>ELEV GAIN</label><b>+${Math.round(s.elevGain)} m</b><small>-${Math.round(s.elevLoss)} m</small></div>
          <div class="kpi"><label>HR AVG/MAX</label><b>${s.avgHr||'--'} / ${s.maxHr||'--'}</b><small>${s.avgSpeedKmh.toFixed(1)} km/h</small></div>
        </div>
        <div id="gpxAiResult" style="margin-top:12px;background:#0a0a0a;padding:14px;border-radius:10px;border:1px solid #242424;white-space:pre-wrap;min-height:50px;font-size:13px">Tap AI Coach for full analysis...</div>
        <div id="pointDetail" style="margin-top:10px;background:#111;padding:10px;border-radius:8px;border:1px solid #222;display:none"></div>
      </div>
      <div class="card"><div class="card-head"><h3>🗺 Map • tap polyline</h3><small class="muted">${s.pointCount} points</small></div><div id="gpxMap" style="height:380px;border-radius:12px;background:#0a0a0a;border:1px solid #242424"></div><div style="display:flex;gap:8px;margin-top:8px"><input type="range" id="animSlider" min="0" max="${Math.max(0,d.points.length-1)}" value="0" style="flex:1"><button class="btn small" id="btnPlay">▶</button><button class="btn small" id="btnPause">⏸</button></div></div>
      <div class="grid2-dreeve">
        <div class="card"><div class="card-head"><h3>⛰ Elevation • tap to drill</h3></div><div class="chart-wrap"><canvas id="eleChart"></canvas></div></div>
        <div class="card"><div class="card-head"><h3>❤ HR / Speed / Power</h3></div><div class="chart-wrap"><canvas id="hrSpeedChart"></canvas></div><div style="display:flex;gap:12px;margin-top:8px;font-size:11px"><span style="color:#ff7a86">● HR</span><span style="color:#58a9ff">● Speed</span><span style="color:#c6ff00">● Power</span></div></div>
      </div>
      <div class="card"><div class="card-head"><h3>🏁 Splits per 1KM • tap to zoom map</h3><small class="muted">${d.splits.length} splits</small></div><div id="splitsTable"></div></div>
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
    if(!pts.length){ el.innerHTML='<div style="padding:40px;text-align:center" class="muted">No GPS (indoor or activity log only) • '+this.data.stats.pointCount+' points<br>Stats report still available</div>'; return; }
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
    detail.innerHTML=`<div style="display:flex;justify-content:space-between"><strong>#${idx} • ${((p.cumDist||0)/1000).toFixed(3)} km</strong><button onclick="this.parentElement.parentElement.style.display='none'" style="background:transparent;border:0;color:#8a8a8a">×</button></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px;font-size:12px"><div>Ele: <b>${p.ele!=null?Math.round(p.ele)+'m':'--'}</b></div><div>HR: <b style="color:#ff7a86">${p.hr||'--'}</b></div><div>Spd: <b style="color:#58a9ff">${p.speed!=null?p.speed.toFixed(1):'--'}</b></div></div>`;
  },

  drawCharts(){
    if(typeof Chart==='undefined') return;
    const pts=this.data.points; if(!pts.length) return;
    const maxPts=400; const step=Math.max(1,Math.floor(pts.length/maxPts)); const sampled=pts.filter((_,i)=>i%step===0); const distLabels=sampled.map(p=>((p.cumDist||0)/1000).toFixed(2));
    let eleCanvas=this.safeChart('eleChart');
    if(eleCanvas){ if(this.charts.ele) try{ this.charts.ele.destroy(); }catch(e){} this.charts.ele=new Chart(eleCanvas,{type:'line',data:{labels:distLabels,datasets:[{label:'Ele m',data:sampled.map(p=>p.ele??p.altitude??null),borderColor:'#5de8b6',backgroundColor:'rgba(93,232,182,0.15)',fill:true,tension:0.3,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,animation:false,resizeDelay:250,interaction:{mode:'index',intersect:false},onClick:(e,els)=>{ if(els.length){ const realIdx=els[0].index*step; this.showPointDetail(realIdx); } },plugins:{legend:{display:false}},scales:{x:{grid:{color:'#1e1e1e'},ticks:{color:'#8a8a8a',maxTicksLimit:6},border:{display:false}},y:{grid:{color:'#1e1e1e'},ticks:{color:'#8a8a8a'},border:{display:false}}}}}); }
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
  haversine(lat1,lon1,lat2,lon2){ const R=6371e3; const φ1=lat1*Math.PI/180, φ2=lat2*Math.PI/180; const Δφ=(lat2-lat1)*Math.PI/180, Δλ=(lon2-lon1)*Math.PI/180; const a=Math.sin(Δφ/2)**2+Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2; return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)); }
};
window.GpxReport = GpxReport;