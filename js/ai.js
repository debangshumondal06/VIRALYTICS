// Talks only to the local proxy. The API key lives in the proxy's memory, never in the browser.
const AI={base(){const s=localStorage.getItem('apiBase');if(s)return s;return location.protocol.startsWith('http')&&['8000',''].includes(location.port)?location.origin:'http://localhost:8000'},
async j(path,body){const r=await fetch(this.base()+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.detail||'Request failed ('+r.status+')');return d},
async status(){try{return{reachable:true,...await this.j('/api/status')}}catch{return{reachable:false,connected:false}}},
connect(key,model,provider='gemini'){return this.j('/api/connect',{provider,key,model})},disconnect(){return this.j('/api/disconnect',{})},
async ask(prompt,json=false){const d=await this.j('/api/generate',{prompt,json});if(!json)return d.text;try{return JSON.parse(d.text.replace(/```json|```/g,'').trim())}catch{throw Error('AI returned invalid JSON — try again')}}};
