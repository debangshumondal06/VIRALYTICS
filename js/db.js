const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const DB={db:null,stores:['creators','posts','post_analyses','hooks','keywords','strategies','generated_content','performance_records','user_preferences'],
open(){return new Promise((ok,no)=>{const r=indexedDB.open('viralytics',1);
 r.onupgradeneeded=()=>{this.stores.forEach(s=>{if(!r.result.objectStoreNames.contains(s))r.result.createObjectStore(s,{keyPath:'id'})})}; // to migrate: add stores/indexes here and bump the version
 r.onsuccess=()=>{this.db=r.result;ok()};r.onerror=()=>no(r.error)})},
tx(s,m,f){return new Promise((ok,no)=>{const t=this.db.transaction(s,m);const q=f(t.objectStore(s));t.oncomplete=()=>ok(q&&q.result);t.onerror=()=>no(t.error)})},
all(s){return this.tx(s,'readonly',o=>o.getAll())},get(s,id){return this.tx(s,'readonly',o=>o.get(id))},
put(s,v){v.id=v.id||uid();return this.tx(s,'readwrite',o=>o.put(v)).then(()=>v)},del(s,id){return this.tx(s,'readwrite',o=>o.delete(id))},
async exportAll(){const d={app:'viralytics',version:1,at:new Date().toISOString()};for(const s of this.stores)d[s]=await this.all(s);return d},
async importAll(d){if(d.app!=='viralytics')throw Error('Not a VIRALYTICS backup');for(const s of this.stores)for(const v of d[s]||[])await this.put(s,v)},
async clearAll(){for(const s of this.stores)await this.tx(s,'readwrite',o=>o.clear())}};
