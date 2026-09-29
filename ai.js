// AI Engine v7.4 - GPX FULL + Puter
const AI = {
  MODELS: {
    text: 'gemini-2.0-flash-lite',
    text_backup: 'gemini-2.0-flash',
    vision: 'gemini-2.0-flash',
    vision_backup: 'gemini-2.5-flash',
    report: 'gemini-2.0-flash-lite',
    report_backup: 'gemini-2.5-flash-lite'
  },
  isPuterReady(){ return typeof puter!== 'undefined' && puter.ai && puter.ai.chat; },
  extractText(response){
    if(typeof response === 'string') return response;
    if(response?.message?.content){
      if(typeof response.message.content === 'string') return response.message.content;
      if(Array.isArray(response.message.content)) return response.message.content.map(c=>c.text||c.content||'').join('');
    }
    if(response?.text) return response.text;
    if(response?.content) return response.content;
    if(response?.result) return response.result;
    return String(response);
  },
  async generateCheckin(profile, yesterday){
    if(this.isPuterReady()){
      try{ return await this.puterCheckin(profile, yesterday); }catch(e){ console.warn("Puter checkin failed", e.message); }
    }
    return this.localCheckin(profile, yesterday);
  },
  localCheckin(profile, y){
    const name = profile.full_name?.split(' ')[0] || 'there';
    return `Hey ${name}: ${y.workoutCount} workouts, ${y.steps||0} steps, ${y.sleepHours||0}h sleep. Keep going!`;
  },
  async puterCheckin(profile, y){
    const prompt = `You are an English fitness coach for ${profile.full_name}, goal ${profile.primary_goal}. Yesterday: calories ${y.calories}/${y.targetCal}, protein ${y.protein}/${y.targetPro}g, steps ${y.steps||0}/${profile.target_steps||10000}, sleep ${y.sleepHours||0}h, workouts ${y.workoutCount}. Write short check-in under 60 words English with emoji.`;
    try{
      const r = await puter.ai.chat(prompt, { model: this.MODELS.text });
      return this.extractText(r);
    }catch(e){
      const r = await puter.ai.chat(prompt, { model: this.MODELS.text_backup });
      return this.extractText(r);
    }
  },
  async generateWeeklyReport(profile, last7){
    if(this.isPuterReady()){
      try{ return await this.puterWeekly(profile, last7); }catch(e){ console.warn("Puter weekly failed", e.message); }
    }
    return `Weekly: ${last7.totalCal} kcal, ${last7.workoutCount} workouts`;
  },
  async puterWeekly(profile, last7){
    const prompt = `Premium English fitness coach. ${profile.full_name}, goal ${profile.primary_goal}, target ${profile.target_weight_kg}kg. Last 7d cal ${last7.totalCal}, protein ${last7.totalPro}g, workouts ${last7.workoutCount}, steps ${last7.steps.reduce((s,x)=>s+x.steps,0)}, weight change ${last7.weightChange}kg. Write 5 sections: Weight, Nutrition, Activity, Sleep, HR & VO2max, Improve. Max 250 words English with emoji.`;
    try{
      const r = await puter.ai.chat(prompt, { model: this.MODELS.report });
      return this.extractText(r);
    }catch{
      const r = await puter.ai.chat(prompt, { model: this.MODELS.report_backup });
      return this.extractText(r);
    }
  },
  extractJson(text){
    if(!text) return null;
    try{ return JSON.parse(text); }catch{}
    let clean = text.replace(/```json/gi,'').replace(/```/g,'').trim();
    const matches = clean.match(/\{[\s\S]*?\}/g);
    if(matches){ for(let m of matches.reverse()){ try{ return JSON.parse(m); }catch{} } }
    return null;
  },
  async analyzeFoodPhoto(file){
    if(!this.isPuterReady()) return {error: "Puter not loaded. Refresh page and allow https://js.puter.com/v2/"};
    const dataUrl = await new Promise((res, rej)=>{ const r = new FileReader(); r.onload = ()=> res(r.result); r.onerror = rej; r.readAsDataURL(file); });
    const prompt = `Nutrition expert. Analyze this food photo. Estimate dish name (English), calories, protein_g, carbs_g, fat_g. Return ONLY valid JSON: {"name":"Dish Name","calories":123,"protein_g":12,"carbs_g":20,"fat_g":10} If not food, return {"error":"not_food"}`;
    const tryModels = [this.MODELS.vision, this.MODELS.vision_backup, 'gemini-2.5-flash-lite', 'gemini-3.1-flash-lite'];
    let lastErr="";
    for(let model of tryModels){
      try{
        const response = await puter.ai.chat(prompt, dataUrl, { model });
        let text = this.extractText(response);
        const json = this.extractJson(text);
        if(json && json.calories) return json;
        if(json && json.error) return json;
        lastErr = text.slice(0,200);
      }catch(e){ lastErr = e.message; if(e.message && e.message.includes("not found")) continue; }
    }
    return {error: "Food photo failed, last: " + lastErr};
  },
  // NEW: GPX / FIT DEEP ANALYSIS
  async analyzeGpxFitReport(profile, data){
    if(!this.isPuterReady()) return "❌ Puter not loaded. Open via https and allow https://js.puter.com/v2/ script";
    const s=data.stats;
    const samplePoints = data.points.slice(0,30).map((p,i)=>({i, d:((p.cumDist||p.distance||0)/1000).toFixed(2)+'km', ele:Math.round(p.ele||p.altitude||0), hr:p.hr||0, spd:(p.speed||0).toFixed(1), pow:p.power||0, cad:p.cadence||0})).slice(0,20);
    const splitsStr = data.splits.slice(0,12).map(sp=>`KM${sp.km}: ${Math.floor(sp.durationSec/60)}:${String(Math.round(sp.durationSec%60)).padStart(2,'0')} HR${sp.avgHr||'--'} +${Math.round(sp.elevGain)}m`).join(' | ');
    const prompt = `You are elite endurance coach & sports scientist for ${profile.full_name||'athlete'}, goal ${profile.primary_goal||'improve_fitness'}.
Analyze this ${data.type} file in extreme detail:

File: ${data.fileName}
Sport: ${data.sport} | Distance: ${s.totalDistKm.toFixed(3)}km (${s.totalDistM.toFixed(0)}m) | Duration: ${Math.floor(s.totalTimeSec/60)}m ${Math.round(s.totalTimeSec%60)}s | Elev Gain ${Math.round(s.elevGain)}m Loss ${Math.round(s.elevLoss)}m (min ${Math.round(s.minEle)} max ${Math.round(s.maxEle)})
Speed: avg ${s.avgSpeedKmh.toFixed(1)}km/h max ${s.maxSpeedKmh.toFixed(1)} | HR avg ${s.avgHr||0} max ${s.maxHr||0} | Power avg ${s.avgPower||0}W max ${s.maxPower||0}W | Cad avg ${s.avgCad||0} max ${s.maxCad||0} | Points ${s.pointCount} Laps ${s.lapCount}
Splits: ${splitsStr}
Sample trackpoints: ${JSON.stringify(samplePoints)}

Provide 6 sections with emoji, English, max 350 words:
1. Overview & Effort Score
2. Pace / Speed Analysis & Variability
3. Heart Rate Zones & Cardiovascular Load
4. Elevation / Terrain Impact
5. Efficiency: Cadence, Power, Form
6. 3 Actionable Improvements for next same route

Be specific to numbers, no generic advice.`;

    const tryModels=[this.MODELS.report, this.MODELS.report_backup, 'gemini-2.0-flash', 'gemini-2.5-flash'];
    let lastErr='';
    for(let m of tryModels){
      try{
        const r=await puter.ai.chat(prompt,{model:m});
        const txt=this.extractText(r);
        if(txt && txt.length>20) return txt;
        lastErr=txt.slice(0,100);
      }catch(e){ lastErr=e.message; console.warn('AI gpx model',m,'failed',e.message); }
    }
    return "AI failed: "+lastErr;
  },
  async testPuter(){
    if(!this.isPuterReady()) throw new Error("Puter not ready - check internet and https://js.puter.com/v2/ loaded");
    const modelsToTry = [this.MODELS.text, 'gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    let lastErr="";
    for(let m of modelsToTry){
      try{
        const response = await puter.ai.chat("Say OK if you work", { model: m });
        return `✅ ${m} works:\n${this.extractText(response)}`;
      }catch(e){ lastErr = e.message; }
    }
    throw new Error("All models failed. Last: " + lastErr);
  }
};
