const REG={
  det_10g:{file:"det_10g.onnx",size:16923827},
  w600k_r50:{file:"w600k_r50.onnx",size:174383860},
  inswapper:{file:"inswapper_128_fp16.onnx",size:277288649},
  bisenet:{file:"bisenet_resnet_34.onnx",size:93632546},
  emap:{file:"emap.bin",size:1048576}
};
let base="/models-cdn/";
let lastSessionBackend="unknown";
export function getLastSessionBackend(){return lastSessionBackend;}
export const MODEL_BASE_URL=base;
export function setModelBaseUrl(v){if(!v||typeof v!=="string")throw new Error("Invalid model base URL");base=v.endsWith("/")?v:v+"/";}
export function modelRegistry(){return Object.entries(REG).map(([key,m])=>({key,...m}));}
export function totalModelSize(){return Object.values(REG).reduce((a,x)=>a+x.size,0);}
export async function fetchModelBytes(name,cb){
 const m=REG[name];if(!m)throw new Error(`Unknown model ${name}`);
 const url=base+m.file;let r;
 try{r=await fetch(url,{cache:"no-store",credentials:"same-origin"});}catch(e){throw new Error(`Could not reach online model ${m.file}. Check your internet connection and model hosting URL.`);}
 if(!r.ok)throw new Error(`Online model request failed (${r.status}) for ${url}. Check the GitHub Release asset name and Netlify model-proxy settings.`);
 if(!r.body){const b=await r.arrayBuffer();cb?.(name,b.byteLength,m.size);return b;}
 const reader=r.body.getReader(),chunks=[];let loaded=0;
 while(true){const x=await reader.read();if(x.done)break;chunks.push(x.value);loaded+=x.value.byteLength;cb?.(name,loaded,Number(r.headers.get("Content-Length"))||m.size);}
 const out=new Uint8Array(loaded);let off=0;for(const c of chunks){out.set(c,off);off+=c.byteLength;}return out.buffer;
}
export async function loadSessionWasm(name,cb){
 const bytes=await fetchModelBytes(name,cb);
 try{const session=await ort.InferenceSession.create(bytes,{executionProviders:["wasm"],graphOptimizationLevel:"all",enableCpuMemArena:true,enableMemPattern:true,logSeverityLevel:3});lastSessionBackend="WASM CPU";return session;}
 catch(e){throw new Error(`${name} could not initialize with the browser WASM CPU backend. This model may require operators or FP16 support not available in this browser runtime. Details: ${e.message||e}`);}
}
export async function loadSession(name,cb){
 const bytes=await fetchModelBytes(name,cb);const errors=[];
 if(navigator.gpu){try{const s=await ort.InferenceSession.create(bytes,{executionProviders:["webgpu"],preferredOutputLocation:"cpu",graphOptimizationLevel:"all",enableCpuMemArena:true,enableMemPattern:true,logSeverityLevel:3});lastSessionBackend="WebGPU";return s;}catch(e){errors.push(`WebGPU: ${e.message||e}`);}}
 try{const session=await ort.InferenceSession.create(bytes,{executionProviders:["wasm"],graphOptimizationLevel:"all",enableCpuMemArena:true,enableMemPattern:true,logSeverityLevel:3});lastSessionBackend="WASM CPU";return session;}
 catch(e){errors.push(`WASM CPU: ${e.message||e}`);throw new Error(`${name} could not run in this browser. ${errors.join(" | ")} The FP16 InSwapper model may not be compatible with every browser backend.`);}
}
export async function loadEmap(cb){const b=await fetchModelBytes("emap",cb);if(b.byteLength%4!==0)throw new Error("emap.bin has an invalid byte length.");return new Float32Array(b);}
export async function checkCache(){return{cached:[],missing:Object.keys(REG),persistentCache:false};}
