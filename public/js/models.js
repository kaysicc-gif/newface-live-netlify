const REG={
  det_10g:{file:"det_10g.onnx",size:16923827},
  w600k_r50:{file:"w600k_r50.onnx",size:174383860},
  inswapper:{file:"inswapper_128_fp16.onnx",size:277288649},
  bisenet:{file:"bisenet_resnet_34.onnx",size:93632546},
  emap:{file:"emap.bin",size:1048576}
};
let base="/models-cdn/";
let lastSessionBackend="unknown";

// Increment this value whenever the hosted model files change without changing their URLs.
const CACHE_DB="newface-live-models";
const CACHE_STORE="model-bytes";
const CACHE_VERSION="models-v1-fp16-1";

export function getLastSessionBackend(){return lastSessionBackend;}
export const MODEL_BASE_URL=base;
export function setModelBaseUrl(v){if(!v||typeof v!=="string")throw new Error("Invalid model base URL");base=v.endsWith("/")?v:v+"/";}
export function modelRegistry(){return Object.entries(REG).map(([key,m])=>({key,...m}));}
export function totalModelSize(){return Object.values(REG).reduce((a,x)=>a+x.size,0);}

function openModelDB(){
  if(!globalThis.indexedDB) return Promise.reject(new Error("IndexedDB is unavailable in this browser."));
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(CACHE_DB,1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(CACHE_STORE))db.createObjectStore(CACHE_STORE);};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error("Could not open browser model storage."));
    req.onblocked=()=>reject(new Error("Browser model storage upgrade is blocked by another tab."));
  });
}
function cacheKey(name,url){return `${CACHE_VERSION}|${name}|${url}`;}
async function readCachedModel(name,url){
  const db=await openModelDB();
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction(CACHE_STORE,"readonly");
    const req=tx.objectStore(CACHE_STORE).get(cacheKey(name,url));
    req.onsuccess=()=>resolve(req.result||null);
    req.onerror=()=>reject(req.error||new Error("Could not read cached model."));
  });}finally{db.close();}
}
async function saveCachedModel(name,url,bytes){
  // Ask the browser for persistent storage where supported. This may be denied by browser policy.
  try{if(navigator.storage?.persist) await navigator.storage.persist();}catch{}
  const db=await openModelDB();
  try{await new Promise((resolve,reject)=>{
    const tx=db.transaction(CACHE_STORE,"readwrite");
    tx.objectStore(CACHE_STORE).put(bytes,cacheKey(name,url));
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error||new Error("Could not save model to browser storage."));
    tx.onabort=()=>reject(tx.error||new Error("Saving model to browser storage was aborted."));
  });}finally{db.close();}
}
async function deleteCachedModel(name,url){
  try{const db=await openModelDB();try{await new Promise((resolve,reject)=>{const tx=db.transaction(CACHE_STORE,"readwrite");tx.objectStore(CACHE_STORE).delete(cacheKey(name,url));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}}catch{}
}
function asArrayBuffer(value){
  if(value instanceof ArrayBuffer)return value;
  if(ArrayBuffer.isView(value))return value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength);
  return null;
}

export async function fetchModelBytes(name,cb){
  const m=REG[name];if(!m)throw new Error(`Unknown model ${name}`);
  const url=base+m.file;
  try{
    const cached=asArrayBuffer(await readCachedModel(name,url));
    if(cached&&cached.byteLength===m.size){
      cb?.(name,cached.byteLength,cached.byteLength);
      console.info(`Loaded ${name} from browser storage cache.`);
      return cached;
    }
    if(cached){console.warn(`Discarding incomplete cached model ${name}: expected ${m.size} bytes, found ${cached.byteLength}.`);await deleteCachedModel(name,url);}
  }catch(e){console.warn(`Browser model cache read failed for ${name}; downloading instead.`,e);}

  let r;
  try{r=await fetch(url,{cache:"no-store",credentials:"same-origin"});}
  catch(e){throw new Error(`Could not reach online model ${m.file}. Check your internet connection and model hosting URL. ${e?.message||e}`);}
  if(!r.ok)throw new Error(`Online model request failed (${r.status}) for ${url}. Check the GitHub Release asset name and Netlify model-proxy settings.`);

  let bytes;
  if(!r.body){bytes=await r.arrayBuffer();cb?.(name,bytes.byteLength,Number(r.headers.get("Content-Length"))||m.size);}
  else{
    const reader=r.body.getReader(),chunks=[];let loaded=0;
    while(true){const x=await reader.read();if(x.done)break;chunks.push(x.value);loaded+=x.value.byteLength;cb?.(name,loaded,Number(r.headers.get("Content-Length"))||m.size);}
    const out=new Uint8Array(loaded);let off=0;for(const c of chunks){out.set(c,off);off+=c.byteLength;}bytes=out.buffer;
  }
  if(!bytes||!bytes.byteLength)throw new Error(`The downloaded model ${name} is empty.`);
  if(bytes.byteLength!==m.size)throw new Error(`The downloaded model ${name} is incomplete: expected ${m.size} bytes, received ${bytes.byteLength}. Please retry the download.`);
  try{await saveCachedModel(name,url,bytes);console.info(`Saved ${name} (${bytes.byteLength} bytes) in browser storage.`);}
  catch(e){console.warn(`Could not persist ${name} in browser storage. The model can still run for this session.`,e);}
  cb?.(name,bytes.byteLength,bytes.byteLength);
  return bytes;
}

export async function loadSessionWasm(name,cb){
  const bytes=await fetchModelBytes(name,cb);
  try{const session=await ort.InferenceSession.create(bytes,{executionProviders:["wasm"],graphOptimizationLevel:"all",enableCpuMemArena:true,enableMemPattern:true,logSeverityLevel:3});lastSessionBackend="WASM CPU";return session;}
  catch(e){
    const diagnostics=[
      `Browser: ${navigator.userAgent||"unknown"}`,
      `Device memory: ${navigator.deviceMemory??"not reported"} GiB`,
      `CPU threads: ${navigator.hardwareConcurrency??"not reported"}`,
      `ONNX Runtime: ${ort.version??"unknown"}`,
      `WASM SIMD: ${ort.env?.wasm?.simd??"not reported"}`,
      `Cross-origin isolated: ${globalThis.crossOriginIsolated??"not reported"}`,
      `Model bytes: ${bytes.byteLength}`,
      `Original error: ${e?.stack||e?.message||String(e)}`
    ].join("\\n");
    throw new Error(`${name} could not initialize with the browser WASM CPU backend.\\n\\nDevice diagnostics:\\n${diagnostics}`);
  }
}
export async function loadSession(name,cb){
  const bytes=await fetchModelBytes(name,cb);const errors=[];
  if(navigator.gpu){try{const s=await ort.InferenceSession.create(bytes,{executionProviders:["webgpu"],preferredOutputLocation:"cpu",graphOptimizationLevel:"all",enableCpuMemArena:true,enableMemPattern:true,logSeverityLevel:3});lastSessionBackend="WebGPU";return s;}catch(e){errors.push(`WebGPU: ${e.message||e}`);}}
  try{const session=await ort.InferenceSession.create(bytes,{executionProviders:["wasm"],graphOptimizationLevel:"all",enableCpuMemArena:true,enableMemPattern:true,logSeverityLevel:3});lastSessionBackend="WASM CPU";return session;}
  catch(e){errors.push(`WASM CPU: ${e.message||e}`);throw new Error(`${name} could not run in this browser. ${errors.join(" | ")} The FP16 InSwapper model may not be compatible with every browser backend.`);}
}
export async function loadEmap(cb){const b=await fetchModelBytes("emap",cb);if(b.byteLength%4!==0)throw new Error("emap.bin has an invalid byte length.");return new Float32Array(b);}
export async function checkCache(){
  const cached=[],missing=[];let persistentCache=false;
  for(const [name,m] of Object.entries(REG)){
    try{const value=asArrayBuffer(await readCachedModel(name,base+m.file));if(value&&value.byteLength>0)cached.push(name);else missing.push(name);}
    catch{missing.push(name);}
  }
  try{persistentCache=!!(await indexedDB.databases()).some(db=>db.name===CACHE_DB);}catch{persistentCache=cached.length>0;}
  let estimate=null;try{estimate=await navigator.storage?.estimate?.();}catch{}
  return{cached,missing,persistentCache,cacheBytes:cached.reduce((n,k)=>n+(REG[k]?.size||0),0),totalBytes:totalModelSize(),usage:estimate?.usage??null,quota:estimate?.quota??null};
}
export async function clearModelCache(){
  const db=await openModelDB();
  try{await new Promise((resolve,reject)=>{const tx=db.transaction(CACHE_STORE,"readwrite");tx.objectStore(CACHE_STORE).clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
  finally{db.close();}
}
