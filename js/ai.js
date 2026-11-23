// Talks to /api/* on the same site. The Gemini key lives only in Vercel's environment; the browser holds just your app password.
const AI={base(){return localStorage.getItem('apiBase')||''},pw(){return localStorage.getItem('appPw')||''},
async j(path,body){const r=await fetch(this.base()+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','x-app-password':this.pw()},body:body?JSON.stringify(body):undefined});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Request failed ('+r.status+')');return d},
async status(){try{const d=await this.j('/api/status');return{reachable:true,...d,connected:!!(d.keySet&&d.authed)}}catch{return{reachable:false,connected:false}}},
async connect(pw){localStorage.setItem('appPw',pw);try{return await this.j('/api/connect',{})}catch(e){localStorage.removeItem('appPw');throw e}},
disconnect(){localStorage.removeItem('appPw')},
async ask(prompt,json=false){const d=await this.j('/api/generate',{prompt,json});if(!json)return d.text;try{return JSON.parse(d.text.replace(/```json|```/g,'').trim())}catch{throw Error('AI returned invalid JSON, try again')}}};
