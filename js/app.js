const $=(s,e=document)=>e.querySelector(s),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num=v=>v===''||v==null?'':Number(v),PAGES=['Dashboard','Creators','Collection','Analysis','Patterns','Hooks','Strategy','Generator','Performance','Settings'];
let cur=localStorage.getItem('page')||'Dashboard',busy=false;
const toast=(m,e)=>{const t=$('#toast');t.textContent=m;t.className=e?'show err':'show';clearTimeout(toast.t);toast.t=setTimeout(()=>t.className='',3000)};
const eng=p=>(+p.likes||0)+2*(+p.comments||0)+3*(+p.shares||0),hasM=p=>p.likes!==''&&p.likes!=null;
const canon=u=>{try{const x=new URL(u);return x.hostname.replace(/^www\./,'')+x.pathname.replace(/\/+$/,'')}catch{return(u||'').trim().toLowerCase()}};
const med=a=>{a=[...a].sort((x,y)=>x-y);const n=a.length;return n?(n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2):0};
// metric sanitiser (blank/negative/NaN -> blank, else whole number) and text normaliser for duplicate detection
const nn=v=>{v=num(v);return v===''||!isFinite(v)||v<0?'':Math.round(v)},norm=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
const tbl=(h,r)=>r.length?`<table><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr>${r.map(x=>`<tr>${x.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</table>`:'<p class=mut>Nothing here yet.</p>';
const opts=(a,sel)=>a.map(x=>`<option value="${esc(x[0])}" ${x[0]===sel?'selected':''}>${esc(x[1])}</option>`).join('');
// engagement relative to the creator's own median (needs 3+ posts with metrics): a comparison, not a "viral" label
function ratios(posts){const g={},r={};posts.filter(hasM).forEach(p=>(g[p.creatorId||'-'+p.platform]??=[]).push(eng(p)));
 posts.filter(hasM).forEach(p=>{const k=p.creatorId||'-'+p.platform,m=med(g[k]);if(g[k].length>=3&&m>0)r[p.id]=eng(p)/m});return r}
function groupBy(items,kf,r){const g={};items.forEach(x=>{const k=kf(x);if(!k)return;const o=g[k]??={n:0,r:[]};o.n++;const v=r[x.postId||x.id];if(v!=null)o.r.push(v)});
 return Object.entries(g).map(([k,v])=>({k,n:v.n,m:v.r.length,avg:v.r.length?v.r.reduce((a,b)=>a+b,0)/v.r.length:null})).sort((a,b)=>(b.avg??-1)-(a.avg??-1)||b.n-a.n)}
const gRows=g=>g.map(x=>[esc(x.k),x.n,x.avg==null?'<span class=mut>not enough metrics</span>':x.avg.toFixed(2)+'× <span class=mut>(n='+x.m+(x.m<3?', low sample':'')+')</span>']);
async function analyse(p){const a=Analyzer.analyze(p);p.hashtags=a.hashtags;p.keywords=a.keywords;await DB.put('posts',p);
 const old=await DB.get('post_analyses',p.id);if(old?.ai)a.ai=old.ai;await DB.put('post_analyses',a);
 if(a.hook){const h=await DB.get('hooks',p.id)||{id:p.id,fav:false,notes:''};Object.assign(h,{text:a.hook,cat:a.hookCat,creatorId:p.creatorId,url:p.url,topic:a.keywords[0]||''});await DB.put('hooks',h)}}
const cname=(cs,id)=>esc(cs.find(c=>c.id===id)?.name||'—');
const aiOn=async()=>{const s=await AI.status();if(!s.connected){toast(s.reachable?'Connect Gemini in Settings first':'Server not reachable',1);return false}return true};
async function ai(btn,fn){if(busy)return;busy=true;const t=btn?.textContent;if(btn){btn.disabled=true;btn.textContent='Working…'}
 try{if(await aiOn())await fn()}catch(e){toast(e.message,1)}busy=false;if(btn){btn.disabled=false;btn.textContent=t}}
const sums=async()=>{const[P,A]=[await DB.all('posts'),await DB.all('post_analyses')],r=ratios(P);
 return{posts:P.length,hookCategories:groupBy(A,a=>a.hookCat,r),formats:groupBy(A,a=>a.format,r),topKeywords:Analyzer.top(A.flatMap(a=>a.keywords),15),topHashtags:Analyzer.top(A.flatMap(a=>a.hashtags),10),platforms:groupBy(P,p=>p.platform,r).map(x=>[x.k,x.n])}};

const pages={
async Dashboard(){const[c,p,a,h]=await Promise.all(['creators','posts','post_analyses','hooks'].map(s=>DB.all(s))),kw=Analyzer.top(a.flatMap(x=>x.keywords),12),s=await DB.all('strategies');
 return`<h1>Dashboard</h1><div class=grid>${[['Creators',c.length],['Posts',p.length],['Analysed',a.length],['Saved hooks',h.length]].map(x=>`<div class=card><div class=mut>${x[0]}</div><div class=stat>${x[1]}</div></div>`).join('')}</div>
 <div class=card><h3>Top keywords</h3>${kw.map(k=>`<span class=tag>${esc(k[0])} · ${k[1]}</span>`).join('')||'<span class=mut>Import posts to see keywords.</span>'}</div>
 <div class=card><h3>Hook categories</h3><canvas id=ch height=90></canvas></div>
 <div class=card><h3>Latest insight</h3>${s.length?`<div class=out>${esc(s.sort((x,y)=>y.at-x.at)[0].text.slice(0,600))}…</div>`:'<span class=mut>No strategy generated yet.</span>'}</div>`},
async Creators(){const c=await DB.all('creators');return`<h1>Reference Creators</h1><form class=card data-form=creator><input type=hidden name=id><input name=name placeholder="Creator name" required>
 <select name=platform><option>LinkedIn<option>Instagram</select><input name=url placeholder="Profile URL"><input name=handle placeholder="@handle"><input name=category placeholder="Content category"><textarea name=notes placeholder="Personal notes"></textarea><button>Save creator</button></form>
 <div class=card>${tbl(['Name','Platform','Handle','Category','Notes',''],c.map(x=>[esc(x.name),x.platform,esc(x.handle),esc(x.category),esc(x.notes),`<button class=s data-act=editCreator data-id=${x.id}>Edit</button> <button class=s data-act=delCreator data-id=${x.id}>Delete</button>`]))}</div>`},
async Collection(){const c=await DB.all('creators'),p=await DB.all('posts');return`<h1>Content Collection</h1><p class=mut>Paste content manually. Leave unknown metrics blank; nothing is invented. No scraping.</p>
 <form class=card data-form=post><select name=creatorId><option value="">— creator (optional) —${opts(c.map(x=>[x.id,x.name]))}</select><select name=platform><option>LinkedIn<option>Instagram</select><input name=url placeholder="Post URL"><input name=postDate type=date>
 <input name=likes type=number min=0 placeholder="Likes"><input name=comments type=number min=0 placeholder="Comments"><input name=shares type=number min=0 placeholder="Shares"><input name=views type=number min=0 placeholder="Views">
 <select name=mediaType><option>text<option>image<option>carousel<option>video/reel</select><input name=image type=file accept="image/*"><textarea name=caption placeholder="Caption / post text / transcript"></textarea><button>Save &amp; analyse</button></form>
 <div class=card>${tbl(['Creator','Platform','Hook','Likes','Comments',''],p.sort((a,b)=>b.imported-a.imported).map(x=>[cname(c,x.creatorId),x.platform,esc(Analyzer.hook(x.caption).slice(0,80)),x.likes,x.comments,`<button class=s data-act=delPost data-id=${x.id}>Delete</button>`]))}</div>`},
async Analysis(){const[c,p,a]=await Promise.all(['creators','posts','post_analyses'].map(s=>DB.all(s))),r=ratios(p);
 return`<h1>Content Analysis</h1><div class=card><button data-act=analyseAll>Analyse all (offline)</button> <span class=mut>"AI" adds tone/persuasion hypotheses via Gemini (cached).</span></div><div class=card>${tbl(['Post','Hook','Format','Tone / readability','Vs creator median','AI hypothesis',''],
 p.map(x=>{const y=a.find(z=>z.id===x.id);return y?[cname(c,x.creatorId)+'<br><span class=mut>'+x.platform+'</span>',esc(y.hook.slice(0,90))+'<br><span class=tag>'+y.hookCat+'</span>',y.format,y.tone+' / '+y.readability+'<br><span class=mut>'+y.avgSentence+' w/sentence</span>',r[x.id]?r[x.id].toFixed(2)+'×':'<span class=mut>n/a</span>',y.ai?`<span class=mut>AI:</span> ${esc(y.ai.tone)}; ${esc((y.ai.persuasion||[]).join(', '))}<br>${esc(y.ai.notes||'')}`:'',`<button class=s data-act=aiPost data-id=${x.id}>AI</button> <button class=s data-act=rePost data-id=${x.id}>Re-analyse</button>`]:[cname(c,x.creatorId),'not analysed','','','','',`<button class=s data-act=rePost data-id=${x.id}>Analyse</button>`]}))}</div>`},
async Patterns(){const[c,P,A]=await Promise.all(['creators','posts','post_analyses'].map(s=>DB.all(s))),f=JSON.parse(sessionStorage.pf||'{}');
 const keep=P.filter(p=>(!f.c||p.creatorId===f.c)&&(!f.p||p.platform===f.p)),ids=new Set(keep.map(p=>p.id)),an=A.filter(a=>ids.has(a.id)),r=ratios(P);
 const top=keep.filter(p=>r[p.id]).sort((a,b)=>r[b.id]-r[a.id]).slice(0,5);
 return`<h1>Viral Patterns</h1><form class=card data-form=pfilter><select name=c><option value="">All creators${opts(c.map(x=>[x.id,x.name]),f.c)}</select><select name=p><option value="">All platforms<option ${f.p=='LinkedIn'?'selected':''}>LinkedIn<option ${f.p=='Instagram'?'selected':''}>Instagram</select><button>Filter</button></form>
 <p class=mut>Measured findings: counts and average engagement relative to each creator's own median (needs 3+ posts with metrics per creator). Not a virality prediction.</p>
 <div class=card><h3>Hook categories</h3>${tbl(['Hook type','Posts','Avg vs median'],gRows(groupBy(an,a=>a.hookCat,r)))}</div><div class=card><h3>Formats</h3>${tbl(['Format','Posts','Avg vs median'],gRows(groupBy(an,a=>a.format,r)))}</div>
 <div class=card><h3>Repeated keywords</h3>${Analyzer.top(an.flatMap(a=>a.keywords),20).map(k=>`<span class=tag>${esc(k[0])} · ${k[1]}</span>`).join('')}<h3 style="margin-top:12px">Hashtags</h3>${Analyzer.top(an.flatMap(a=>a.hashtags),12).map(k=>`<span class=tag>${esc(k[0])} · ${k[1]}</span>`).join('')}</div>
 <div class=card><h3>Strongest relative performers</h3>${tbl(['Hook','Score','Source'],top.map(p=>[esc(Analyzer.hook(p.caption)),r[p.id].toFixed(2)+'×',p.url?`<a href="${esc(p.url)}" target=_blank rel=noopener>link</a>`:'—']))}</div>`},
async Hooks(){const[c,h]=await Promise.all([DB.all('creators'),DB.all('hooks')]),f=JSON.parse(sessionStorage.hf||'{}'),cats=[...new Set(h.map(x=>x.cat))];
 const L=h.filter(x=>(!f.q||(x.text+x.topic).toLowerCase().includes(f.q.toLowerCase()))&&(!f.k||x.cat===f.k)&&(!f.fav||x.fav));
 return`<h1>Hook Library</h1><form class=card data-form=hfilter><input name=q placeholder="Search hooks" value="${esc(f.q)}"><select name=k><option value="">All categories${opts(cats.map(x=>[x,x]),f.k)}</select><label><input type=checkbox name=fav style="width:auto" ${f.fav?'checked':''}> Favourites</label><button>Filter</button></form>
 <div class=card>${tbl(['Hook','Type','Topic','Source',''],L.map(x=>[(x.fav?'★ ':'')+esc(x.text)+(x.vars?'<br><span class=mut>'+x.vars.map(esc).join('<br>')+'</span>':''),x.cat,esc(x.topic),cname(c,x.creatorId)+(x.url?` <a href="${esc(x.url)}" target=_blank rel=noopener>↗</a>`:''),
 `<button class=s data-act=fav data-id=${x.id}>★</button> <button class=s data-act=copy data-id=${x.id}>Copy</button> <button class=s data-act=vary data-id=${x.id}>Variations</button>`]))}</div>`},
async Strategy(){const s=(await DB.all('strategies')).sort((a,b)=>b.at-a.at);return`<h1>Strategy Generator</h1><div class=card><p class=mut>Built only from your imported posts and their metrics.</p><button data-act=strategy>Generate strategy (Gemini)</button> <button class=s data-act=strategyLocal>Offline summary</button></div>
 ${s.map(x=>`<div class=card><span class=mut>${new Date(x.at).toLocaleString()} · ${x.src}</span> <button class=s data-act=delStrategy data-id=${x.id}>Delete</button><div class=out>${esc(x.text)}</div></div>`).join('')}`},
async Generator(){const g=(await DB.all('generated_content')).sort((a,b)=>b.at-a.at),hs=await DB.all('hooks');return`<h1>Post Generator</h1><form class=card data-form=gen><select name=platform><option>LinkedIn<option>Instagram</select><input name=topic placeholder="Topic" required><input name=category placeholder="Content category"><input name=tone placeholder="Tone (e.g. warm, direct)"><input name=audience placeholder="Target audience"><input name=keywords placeholder="Keywords (comma separated)">
 <select name=length><option>short<option selected>medium<option>long</select><select name=hook><option value="">Hook structure: let AI choose${opts(hs.filter(x=>x.fav).map(x=>[x.cat+': '+x.text,'★ '+x.text.slice(0,60)]))}</select><button class=full>Generate</button></form>
 ${g.map(x=>`<div class=card><span class=mut>${new Date(x.at).toLocaleString()} · ${esc(x.topic)}</span> <button class=s data-act=delGen data-id=${x.id}>Delete</button><div class=out>${esc(x.text)}</div></div>`).join('')}`},
async Performance(){const r=(await DB.all('performance_records')).sort((a,b)=>b.at-a.at);
 const grp=k=>{const g={};r.filter(x=>[x.likes,x.comments,x.shares].some(v=>v!==''&&v!=null)).forEach(x=>{(g[x[k]||'—']??=[]).push(eng(x))});return Object.entries(g).map(([a,v])=>[esc(a),v.length,Math.round(v.reduce((s,y)=>s+y,0)/v.length)]).sort((a,b)=>b[2]-a[2])};
 return`<h1>My Performance</h1><form class=card data-form=perf><select name=platform><option>LinkedIn<option>Instagram</select><input name=date type=date><input name=likes type=number min=0 placeholder="Likes"><input name=comments type=number min=0 placeholder="Comments"><input name=shares type=number min=0 placeholder="Shares"><input name=views type=number min=0 placeholder="Views"><input name=topic placeholder="Topic"><textarea name=caption placeholder="My published post text" required></textarea><button>Save</button></form>
 <div class=card><h3>Avg score by my hook type</h3>${tbl(['Hook','Posts','Avg score'],grp('hookCat'))}</div><div class=card><h3>By format</h3>${tbl(['Format','Posts','Avg score'],grp('format'))}</div><div class=card><h3>By topic</h3>${tbl(['Topic','Posts','Avg score'],grp('topic'))}</div>
 <div class=card>${tbl(['Date','Hook','Likes','Comments',''],r.map(x=>[x.date,esc(x.hook),x.likes,x.comments,`<button class=s data-act=delPerf data-id=${x.id}>Delete</button>`]))}</div><p class=mut>Score = likes + 2×comments + 3×shares. Small samples are anecdotes, not proof.</p>`},
async Settings(){const s=await AI.status(),st=(await DB.get('user_preferences','style'))?.text||'';return`<h1>Settings</h1>
 <div class=card><h3>AI connection: Gemini</h3><p>Server: <span class="${s.reachable?'ok':'bad'}">${s.reachable?'reachable':'not reachable'}</span> · Gemini key on server: <span class="${s.keySet?'ok':'bad'}">${s.keySet?'set':'missing'}</span> · Unlocked: <span class="${s.connected?'ok':'bad'}">${s.connected?'yes ('+esc(s.model)+')':'no'}</span></p>
 <form data-form=connect style="display:grid;gap:8px"><input name=key type=password placeholder="Your app password" autocomplete=current-password><div><button>Connect</button> <button type=button class=s data-act=disconnect>Disconnect</button></div></form>
 <p class=mut>Your Gemini key stays in Vercel's environment variables and never reaches the browser. This password only unlocks the AI features on this device.</p></div>
 <div class=card><h3>My writing style profile</h3><form data-form=style><textarea name=text style="width:100%;min-height:140px" placeholder="Paste 2–5 examples of your own writing. The generator will match this voice.">${esc(st)}</textarea><button>Save style</button></form></div>
 <div class=card><h3>Backup</h3><button data-act=export>Export JSON</button> <input type=file id=imp accept=.json style="width:auto"> <button class=s data-act=clear>Delete all data</button></div>`}};
const AFTER={Dashboard:async()=>{if(!window.Chart)return;const g=groupBy(await DB.all('post_analyses'),a=>a.hookCat,{});new Chart($('#ch'),{type:'bar',data:{labels:g.map(x=>x.k),datasets:[{label:'Posts',data:g.map(x=>x.n),backgroundColor:'#7c9cff'}]},options:{plugins:{legend:{display:false}},scales:{y:{ticks:{precision:0}}}}})}};
async function render(){$('#nav').innerHTML='<b>VIRALYTICS</b>'+PAGES.map(p=>`<a data-nav="${p}" class="${p==cur?'on':''}">${p}</a>`).join('');
 try{$('#main').innerHTML=await pages[cur]();await AFTER[cur]?.()}catch(e){$('#main').innerHTML='<p class=bad>Error: '+esc(e.message)+'</p>'}}
const dl=(n,t,m)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:m}));a.download=n;a.click()};
const readImg=f=>new Promise(r=>{const x=new FileReader();x.onload=()=>r(x.result);x.readAsDataURL(f)});

const FORM={
async creator(f){const d=Object.fromEntries(new FormData(f)),o=d.id?await DB.get('creators',d.id):{};await DB.put('creators',{...o,...d,id:d.id||undefined,added:o?.added||Date.now()});toast('Creator saved');render()},
async post(f){const d=Object.fromEntries(new FormData(f)),file=f.image.files[0];if(file&&file.size>1.5e6)return toast('Image over 1.5 MB',1);
 if(!d.caption.trim()&&!file&&!d.url)return toast('Add a caption, URL or image',1);const cn=d.url?canon(d.url):'';
 if(cn&&(await DB.all('posts')).some(p=>p.canon===cn))return toast('Duplicate: this URL is already imported',1);
 const cap=norm(d.caption);if(cap.length>20&&(await DB.all('posts')).some(q=>q.platform===d.platform&&norm(q.caption)===cap))return toast('Duplicate: this caption is already imported',1);
 const p={id:uid(),creatorId:d.creatorId,platform:d.platform,url:d.url,canon:cn,caption:d.caption,postDate:d.postDate,likes:nn(d.likes),comments:nn(d.comments),shares:nn(d.shares),views:nn(d.views),mediaType:d.mediaType,image:file?await readImg(file):'',imported:Date.now()};
 await analyse(p);toast('Saved & analysed');render()},
pfilter(f){sessionStorage.pf=JSON.stringify(Object.fromEntries(new FormData(f)));render()},hfilter(f){sessionStorage.hf=JSON.stringify(Object.fromEntries(new FormData(f)));render()},
async connect(f){const d=Object.fromEntries(new FormData(f));if(!d.key.trim())return toast('Enter your app password',1);const b=f.querySelector('button');b.disabled=true;b.textContent='Connecting…';
 try{await AI.connect(d.key.trim());toast('Gemini connected')}catch(e){toast(/fetch/i.test(e.message)?'Server not reachable':e.message,1)}render()},
async base(f){localStorage.apiBase=new FormData(f).get('base').replace(/\/$/,'');render()},
async style(f){await DB.put('user_preferences',{id:'style',text:new FormData(f).get('text')});toast('Style saved')},
async perf(f){const d=Object.fromEntries(new FormData(f)),a=Analyzer.analyze({caption:d.caption});await DB.put('performance_records',{platform:d.platform,date:d.date,likes:nn(d.likes),comments:nn(d.comments),shares:nn(d.shares),views:nn(d.views),topic:d.topic||a.keywords[0]||'',caption:d.caption,hook:a.hook,hookCat:a.hookCat,format:a.format,at:Date.now()});toast('Saved');render()},
async gen(f){const d=Object.fromEntries(new FormData(f)),b=f.querySelector('button');await ai(b,async()=>{
 const[A,st]=await Promise.all([sums(),DB.get('user_preferences','style')]);
 const prompt=`You are a ghostwriter. Write ORIGINAL ${d.platform} content. Never copy any creator's wording.
Topic: ${d.topic}\nCategory: ${d.category}\nTone: ${d.tone}\nAudience: ${d.audience}\nKeywords: ${d.keywords}\nLength: ${d.length}\nHook structure to follow: ${d.hook||'choose the best from the data'}
Research data (measured from the user's collection): ${JSON.stringify({hookCategories:A.hookCategories.slice(0,4),formats:A.formats.slice(0,4),keywords:A.topKeywords.slice(0,10)})}
User's own writing style (match it): ${st?.text||'none provided; write naturally, human, no cliches'}
Output exactly: 1) THREE ALTERNATIVE HOOKS 2) MAIN POST 3) SUGGESTED KEYWORDS 4) HASHTAGS 5) CTA 6) WRITING STRATEGY EXPLANATION. Plain text, no markdown symbols.`;
 const text=await AI.ask(prompt);await DB.put('generated_content',{topic:d.topic,platform:d.platform,text,at:Date.now()});render()})}};
const ACT={
async editCreator({id}){const c=await DB.get('creators',id),f=$('form[data-form=creator]');for(const k of['id','name','platform','url','handle','category','notes'])f[k].value=c[k]||'';f.scrollIntoView()},
async delCreator({id}){if(confirm('Delete creator? Their posts are kept.')){await DB.del('creators',id);render()}},
async delPost({id}){await DB.del('posts',id);await DB.del('post_analyses',id);await DB.del('hooks',id);render()},
async analyseAll(){for(const p of await DB.all('posts'))await analyse(p);toast('Analysed');render()},
async rePost({id}){await analyse(await DB.get('posts',id));render()},
async aiPost({id},b){await ai(b,async()=>{const p=await DB.get('posts',id),a=await DB.get('post_analyses',id)||Analyzer.analyze(p);
 a.ai=await AI.ask(`Analyse this ${p.platform} post. Return JSON {"tone":string,"persuasion":[string],"notes":string (max 40 words on structure/storytelling)}. These are hypotheses, not facts.\n\n${p.caption.slice(0,3000)}`,true);await DB.put('post_analyses',a);render()})},
async fav({id}){const h=await DB.get('hooks',id);h.fav=!h.fav;await DB.put('hooks',h);render()},
async copy({id}){await navigator.clipboard.writeText((await DB.get('hooks',id)).text);toast('Copied')},
async vary({id},b){await ai(b,async()=>{const h=await DB.get('hooks',id);h.vars=(await AI.ask(`Write 3 ORIGINAL opening hooks using the same structure (${h.cat}) as this one, but a different topic and fresh wording. Return JSON array of 3 strings. Hook: ${h.text}`,true)).slice(0,3);await DB.put('hooks',h);render()})},
async strategy(_,b){await ai(b,async()=>{const s=await sums();if(!s.posts)return toast('Import posts first',1);
 const text=await AI.ask(`Create a content strategy for the user from THIS DATA ONLY (measured from their reference posts; "avg" is engagement relative to each creator's median, null = insufficient metrics):\n${JSON.stringify(s)}\nInclude: content pillars, topics, formats, hook recommendations, keyword opportunities, writing-style notes, posting themes, suggested frequency, and LinkedIn vs Instagram specifics. Cite the numbers you rely on. Mark anything not supported by the data as "hypothesis". No generic motivational advice. Plain text.`);
 await DB.put('strategies',{text,src:'Gemini',at:Date.now()});render()})},
async strategyLocal(){const s=await sums();if(!s.posts)return toast('Import posts first',1);const l=g=>g.slice(0,3).map(x=>x.k+' ('+x.n+' posts'+(x.avg?', '+x.avg.toFixed(2)+'× median':'')+')').join('; ')||'n/a';
 await DB.put('strategies',{src:'offline',at:Date.now(),text:`Based on ${s.posts} imported posts (measured):\n• Most frequent / strongest hook types: ${l(s.hookCategories)}\n• Formats: ${l(s.formats)}\n• Recurring keywords (pillar candidates): ${s.topKeywords.slice(0,8).map(k=>k[0]).join(', ')}\n• Hashtags: ${s.topHashtags.slice(0,6).map(k=>k[0]).join(', ')}\n\nConnect Gemini for a full strategy with pillars, frequency and platform tactics.`});render()},
async delStrategy({id}){await DB.del('strategies',id);render()},async delGen({id}){await DB.del('generated_content',id);render()},async delPerf({id}){await DB.del('performance_records',id);render()},
async disconnect(){try{await AI.disconnect();toast('Disconnected')}catch(e){toast(e.message,1)}render()},
async export(){dl(`viralytics-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(await DB.exportAll(),null,1),'application/json')},
async clear(){if(confirm('Delete ALL local data? Export a backup first.')){await DB.clearAll();render()}}};

document.addEventListener('click',e=>{const n=e.target.closest('[data-nav]');if(n){cur=n.dataset.nav;localStorage.setItem('page',cur);return render()}
 const a=e.target.closest('[data-act]');if(a)ACT[a.dataset.act]?.(a.dataset,a)});
document.addEventListener('submit',e=>{const f=e.target.closest('form[data-form]');if(f){e.preventDefault();FORM[f.dataset.form](f)}});
document.addEventListener('change',async e=>{if(e.target.id==='imp'){try{await DB.importAll(JSON.parse(await e.target.files[0].text()));toast('Backup restored');render()}catch(x){toast(x.message,1)}}});
typeof VX!=='undefined'&&VX.install();DB.open().then(render).catch(e=>$('#main').textContent='Database error: '+e.message);
