// Offline heuristics: work with no API. They label patterns; they do not predict virality.
const STOP=new Set('the a an and or but of to in on for with is are was were be this that it as at by from you your i we they my our not have has had will can just so if do does about into more than then them their what which who how when why all any out up me he she his her its been very really also get got like one'.split(' '));
const Analyzer={
hook(t){const l=(t||'').trim().split(/\n/)[0]||'';const m=l.match(/^.+?[.!?](\s|$)/);return(m?m[0]:l).trim().slice(0,220)},
hookCat(h){if(!h)return'';h=h.replace(/[\u2018\u2019]/g,"'");if(/\?$/.test(h))return'question';if(/^\d+\b|\b\d+ (ways|tips|things|lessons|mistakes|steps|rules)/i.test(h))return'number/list';
 if(/\b(stop|never|myth|wrong|unpopular|overrated|nobody)\b|don't/i.test(h))return'contrarian';
 if(/\b(i|my|we)\b.*\b(was|got|lost|quit|failed|learned|learnt|years?|ago)\b/i.test(h))return'story';
 if(/struggl|problem|mistake|tired|fail|hard|pain/i.test(h))return'problem';return'statement'},
format(t){t=t||'';if(/\b(api|code|function|database|python|javascript|framework|deploy)\b/i.test(t))return'technical';
 if(/\b(buy|discount|launch|join|sign up|link in bio|offer|hiring)\b/i.test(t))return'promotional';
 if(/\b(how to|steps?|tips?|learn|guide|lessons?)\b/i.test(t))return'educational';
 if(/\b(i think|unpopular|opinion|i believe)\b/i.test(t))return'opinion';
 if(/\b(dream|never give up|hustle|success|grind)\b/i.test(t))return'motivational';
 if(/\b(i|my)\b.*\b(was|got|lost|quit|failed|learned)\b/i.test(t))return'personal story';return'informational'},
tags(t){const m=new Map();((t||'').match(/#[\p{L}\p{M}\p{N}_]+/gu)||[]).forEach(h=>{const k=h.toLowerCase();if(!m.has(k))m.set(k,k)});return[...m.values()]},
words(t){return((t||'').toLowerCase().replace(/https?:\/\/\S+|www\.\S+/g,' ').replace(/[#@][\p{L}\p{M}\p{N}_]+/gu,' ').match(/\p{L}[\p{L}\p{M}'\u2019-]{2,}/gu)||[]).filter(w=>!STOP.has(w))},
top(arr,n){const c={};arr.forEach(w=>c[w]=(c[w]||0)+1);return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,n)},
analyze(p){const t=p.caption||'',s=t.split(/[.!?]+\s/).filter(x=>x.trim()),w=t.split(/\s+/).filter(Boolean).length,paras=t.split(/\n+/).filter(x=>x.trim()).length||1;
 const asl=s.length?w/s.length:0,hook=this.hook(t),cta=(t.match(/(comment|follow|share|repost|dm me|link in|subscribe|save this|what do you think|let me know)[^.!?\n]*/i)||[''])[0];
 return{id:p.id,postId:p.id,hook,hookCat:this.hookCat(hook),format:this.format(t),cta,hashtags:this.tags(t),
  keywords:this.top(this.words(t),8).map(x=>x[0]),avgSentence:+asl.toFixed(1),avgParagraph:+(w/paras).toFixed(1),
  readability:asl<=14?'easy':asl<=22?'moderate':'dense',tone:/!/.test(t)?'energetic':/\?/.test(t)?'conversational':'neutral',ai:null,at:Date.now()}}};
