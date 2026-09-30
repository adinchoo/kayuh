
const Health = {
  recoveryScore({sleepHours=0, restingHR=60, avgHR=0, stepsYesterday=0, workoutCount=0}){
    let score=50;
    if(sleepHours>=7.5) score+=20; else if(sleepHours>=6) score+=10; else if(sleepHours<5) score-=15;
    if(restingHR && avgHR){ const diff = avgHR - restingHR; if(diff<10) score+=10; else if(diff>30) score-=10; }
    if(stepsYesterday>10000) score+=10;
    if(workoutCount>1) score-=10;
    return Math.max(10, Math.min(95, Math.round(score)));
  },
  readiness({sleepHours=0, sleepScore=0, recovery=50}){
    const total = (sleepHours*10) + (sleepScore*0.3) + (recovery*0.4);
    if(total>80) return {label:"Ready to smash", color:"#5de8b6"};
    if(total>60) return {label:"Good to go", color:"#58a9ff"};
    if(total>40) return {label:"Take it easy", color:"#ffcc66"};
    return {label:"Rest needed", color:"#ff7a86"};
  },
  estimateVO2Max(restingHR, age, sex){
    if(!restingHR) return "--";
    const factor = sex==="Female"? 15.3* (208 - 0.7*age)/restingHR : 15.3* (208 - 0.7*age)/restingHR;
    return Math.round(factor*10)/10;
  },
  weeklyTrend(weights){
    if(weights.length<3) return 0;
    const first=weights.slice(0,3).reduce((a,b)=>a+b,0)/3; const last=weights.slice(-3).reduce((a,b)=>a+b,0)/3;
    return Number((last-first).toFixed(2));
  }
};
