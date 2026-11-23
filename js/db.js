const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const DB={db:null,stores:['creators','posts','post_analyses','hooks','keywords','strategies','generated_content','performance_records','user_preferences'],
open(){return new Promise((ok,no)=>{const r=indexedDB.open('viralytics',1);
 r.onupgradeneeded=()=>{this.stores.forEach(s=>{if(!r.result.objectStoreNames.contains(s))r.result.createObjectStore(s,{keyPath:'id'})})}; // to migrate: add stores/indexes here and bump the version
 r.onsuccess=()=>{this.db=r.result;this.db.onversionchange=()=>this.db.close();Promise.resolve(navigator.storage?.persist?.()).catch(()=>{});ok()};r.onerror=()=>no(r.error);r.onblocked=()=>no(Error('Close other VIRALYTICS tabs and reload'))})},
tx(s,m,f){return new Promise((ok,no)=>{const t=this.db.transaction(s,m);const q=f(t.objectStore(s));t.oncomplete=()=>ok(q&&q.result);t.onerror=()=>no(t.error);t.onabort=()=>no(t.error||Error('Database transaction aborted'))})},
all(s){return this.tx(s,'readonly',o=>o.getAll())},get(s,id){return this.tx(s,'readonly',o=>o.get(id))},
put(s,v){v.id=v.id||uid();return this.tx(s,'readwrite',o=>o.put(v)).then(()=>v)},del(s,id){return this.tx(s,'readwrite',o=>o.delete(id))},
async exportAll(){const d={app:'viralytics',version:1,at:new Date().toISOString()};for(const s of this.stores)d[s]=await this.all(s);return d},
async importAll(d){if(!d||d.app!=='viralytics')throw Error('Not a VIRALYTICS backup');const n=this.stores.filter(s=>Array.isArray(d[s])&&d[s].length);if(!n.length)return;
 // one all-or-nothing transaction: a bad file can no longer leave a half-restored database
 await new Promise((ok,no)=>{const t=this.db.transaction(n,'readwrite');n.forEach(s=>{const o=t.objectStore(s);d[s].forEach(v=>{if(v&&typeof v==='object'&&!Array.isArray(v)){v.id=v.id||uid();o.put(v)}})});t.oncomplete=ok;t.onerror=()=>no(t.error);t.onabort=()=>no(t.error||Error('Import aborted, nothing was changed'))})},
async clearAll(){for(const s of this.stores)await this.tx(s,'readwrite',o=>o.clear())}};
