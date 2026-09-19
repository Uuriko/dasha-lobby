/**
 * /compute/finetune - fine-tune job UI for Dasha Compute (Phase 8).
 * Single page, hash-routed: #/ (overview), #/new (submit), #/jobs (list),
 * #/jobs/{id} (detail + eval + deploy), #/datasets (list + build),
 * #/adapters (registry + deploy). All data from the live
 * /compute/api/finetune/* endpoints; cookie session auth.
 * No wrangler. No plugin.jup.ag. No people-data.
 */
export const COMPUTE_FINETUNE_PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fine-tune - Dasha Compute</title>
<meta name="description" content="Train small LoRA adapters on the Dasha Compute network: pick a base model, bring a dataset, track training, review the eval gate, deploy your adapter.">
<link rel="canonical" href="https://www.getdasha.com/compute/finetune">
<meta property="og:type" content="website">
<meta property="og:url" content="https://www.getdasha.com/compute/finetune">
<meta property="og:title" content="Fine-tune - Dasha Compute">
<meta property="og:description" content="Declarative LoRA fine-tuning on provider Macs and GPUs. Track training, read the eval gate, deploy your adapter.">
<style>
:root{color-scheme:dark}
body{margin:0;background:#0b0b10;color:#e8e8ef;font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
main{max-width:880px;margin:0 auto;padding:28px 20px 80px}
h1{font-size:26px;margin:18px 0 4px}
h2{font-size:18px;margin:32px 0 8px;padding-top:14px;border-top:1px solid #26262f}
h3{font-size:15px;margin:20px 0 6px;color:#cfcfe0}
.lede{color:#9a9aa8;margin:0 0 12px}
.fine{color:#8a8a96;font-size:13px;margin:6px 0}
a{color:#9ec1ff}
code,pre{font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
pre{background:#121218;border:1px solid #26262f;border-radius:8px;padding:12px;overflow-x:auto;white-space:pre-wrap;word-break:break-all}
.card{background:#121218;border:1px solid #26262f;border-radius:10px;padding:14px 16px;margin:10px 0}
.pill{display:inline-block;border:1px solid #26262f;border-radius:999px;padding:2px 10px;font-size:12px;color:#9a9aa8;margin:2px 4px 2px 0}
.pill.ok{color:#9dffab;border-color:#2f6f4f}
.pill.warn{color:#ffcf8a;border-color:#6f5a2f}
.pill.bad{color:#ff9d9d;border-color:#6f2f35}
.pill.info{color:#9ec1ff;border-color:#2f4a6f}
nav.tabs{display:flex;gap:4px;flex-wrap:wrap;margin:16px 0 4px;border-bottom:1px solid #26262f;padding-bottom:10px}
nav.tabs a{color:#9a9aa8;text-decoration:none;font-size:14px;padding:6px 12px;border-radius:8px}
nav.tabs a:hover{color:#e8e8ef;background:#16161d}
nav.tabs a.active{color:#e8e8ef;background:#1c1c24}
label.field{display:block;margin:12px 0}
label.field>span{display:block;font-size:13px;color:#9a9aa8;margin-bottom:4px}
input[type=text],input[type=number],select,textarea{width:100%;box-sizing:border-box;background:#0e0e14;border:1px solid #2c2c38;color:#e8e8ef;border-radius:8px;padding:9px 11px;font-size:14px}
input[type=number]{width:170px}
select{width:auto;min-width:170px}
textarea{min-height:130px;font:13px/1.5 ui-monospace,Menlo,Consolas,monospace}
input:focus,select:focus,textarea:focus{outline:none;border-color:#4a6f9e}
input[type=range]{width:100%;accent-color:#6f9ecf}
button.primary{background:#2f6f4f;border:1px solid #3a8a62;color:#eafff2;border-radius:8px;padding:10px 18px;font-size:14px;cursor:pointer}
button.primary:disabled{opacity:.45;cursor:default}
button.quiet{background:transparent;border:1px solid #2c2c38;color:#9a9aa8;border-radius:8px;padding:8px 14px;font-size:13px;cursor:pointer}
button.quiet:hover{color:#e8e8ef;border-color:#4a4a58}
button.danger{border-color:#6f2f35;color:#ff9d9d}
.row{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}
@media(max-width:640px){.row{grid-template-columns:1fr}}
.hint{font-size:12px;color:#77778a;margin-top:3px}
.err{color:#ff9d9d;font-size:13px;margin:8px 0}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #22222b;color:#c9c9d4;vertical-align:top}
th{color:#8a8a96;font-weight:600}
.spark{display:block;margin:8px 0 2px}
.radio-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}
.radio-card{border:1px solid #2c2c38;border-radius:8px;padding:8px 12px;font-size:13px;cursor:pointer;color:#9a9aa8}
.radio-card.sel{border-color:#4a6f9e;color:#e8e8ef;background:#14141c}
.radio-card small{display:block;font-size:11px;color:#77778a;margin-top:2px}
.radio-card.dis{opacity:.45;cursor:default}
.back{display:inline-block;font-size:13px;color:#8a8a96;text-decoration:none;margin-bottom:6px}
.back:hover{color:#e8e8ef}
.reason{border-left:3px solid #2c2c38;padding:4px 10px;margin:6px 0;font-size:13px;color:#c9c9d4}
.reason.pass{border-color:#2f6f4f}
.reason.review{border-color:#6f5a2f}
.reason.fail{border-color:#6f2f35}
</style>
</head>
<body>
<main>
<a class="back" href="/compute">&larr; Dasha Compute</a>
<h1>Fine-tune</h1>
<p class="lede">Declarative LoRA jobs on the provider network. You pick a base model, a dataset, and bounded settings &mdash; a provider machine trains it, the eval gate checks it, you keep the adapter.</p>
<nav class="tabs" id="tabs">
<a href="#/" data-tab="home">Overview</a>
<a href="#/new" data-tab="new">New job</a>
<a href="#/jobs" data-tab="jobs">My jobs</a>
<a href="#/datasets" data-tab="datasets">Datasets</a>
<a href="#/adapters" data-tab="adapters">Adapters</a>
</nav>
<div id="view" aria-live="polite"></div>
</main>
<script>
"use strict";
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const view=$("#view");
let MODELS=[],ENGINES=["mlx"];
const PRIVACY_COPY={
 network:["Network","Any eligible provider machine on the network can pick up this job. <b>Your dataset is visible to whichever provider trains it.</b>"],
 trusted:["Trusted","Only providers in the trusted tier &mdash; machines whose operators opted in and hold reputation. Your dataset is still visible to the training provider."],
 local:["Local","Only a provider you own. Use this for sensitive data &mdash; nothing leaves your own machines."]
};
async function api(path,opts={}){
 const r=await fetch(path,{credentials:"same-origin",headers:{"Content-Type":"application/json"},...opts});
 if(r.status===401){location.href="/login?return="+encodeURIComponent("/compute/finetune"+location.hash);throw new Error("login");}
 let data=null;try{data=await r.json();}catch{}
 if(!r.ok)throw new Error((data&&data.error)||("HTTP "+r.status));
 return data;
}
function loginGate(){view.innerHTML='<div class="card"><h3>Sign in required</h3><p class="fine">Fine-tuning needs an account so jobs, datasets, and adapters stay yours.</p><a class="pill info" href="/login?return='+encodeURIComponent("/compute/finetune"+location.hash)+'">Sign in</a></div>';}
function statusPill(s){
 const m={queued:"info",leased:"info",complete:"ok",failed:"bad",expired:"warn"};
 return '<span class="pill '+(m[s]||"")+'">'+esc(s)+"</span>";
}
function verdictPill(v){
 const m={pass:"ok",needs_review:"warn",fail:"bad"};
 const label={pass:"pass",needs_review:"needs review",fail:"fail"}[v]||esc(v||"pending");
 return '<span class="pill '+(m[v]||"")+'">eval: '+label+"</span>";
}
function timeAgo(ts){
 if(!ts)return"&mdash;";const s=Math.floor((Date.now()-ts)/1000);
 if(s<60)return s+"s ago";if(s<3600)return Math.floor(s/60)+"m ago";
 if(s<86400)return Math.floor(s/3600)+"h ago";return Math.floor(s/86400)+"d ago";
}
function sparkline(losses){
 if(!Array.isArray(losses)||!losses.length)return '<p class="fine">No loss telemetry yet.</p>';
 const nums=losses.map(Number).filter(Number.isFinite);
 if(nums.length<2)return '<p class="fine">Loss: '+nums.map(n=>n.toFixed(3)).join(", ")+"</p>";
 const w=560,h=90,pad=8,min=Math.min(...nums),max=Math.max(...nums),span=(max-min)||1;
 const pts=nums.map((n,i)=>[pad+i*(w-2*pad)/(nums.length-1),h-pad-((n-min)/span)*(h-2*pad)]);
 const line=pts.map(p=>p[0].toFixed(1)+","+p[1].toFixed(1)).join(" ");
 return '<svg class="spark" viewBox="0 0 '+w+" "+h+'" width="100%" role="img" aria-label="train loss curve">'+
  '<polyline points="'+line+'" fill="none" stroke="#6f9ecf" stroke-width="1.6"/>'+
  '<text x="'+(w-4)+'" y="'+(h-6)+'" text-anchor="end" fill="#77778a" font-size="10">'+nums[nums.length-1].toFixed(3)+"</text></svg>"+
  '<p class="fine">train loss &middot; '+nums.length+" reports &middot; first "+nums[0].toFixed(3)+" &rarr; last "+nums[nums.length-1].toFixed(3)+"</p>";
}
async function loadModels(){
 if(MODELS.length)return;
 try{const d=await api("/compute/api/finetune/models");MODELS=d.models||[];ENGINES=d.engines||["mlx"];}
 catch(e){MODELS=[];}
}
function rateFor(sizeB){return sizeB<=8?25:sizeB<=13?40:75;}
</script>

<script>
"use strict";
/* ---- overview ---- */
function vHome(){
 view.innerHTML=
 '<div class="card"><h3>How it works</h3>'+
 '<p class="fine">1. <b>Build a dataset</b> from room sessions &mdash; quality-filtered, deduplicated, PII-scrubbed, split into train/eval by the coordinator.</p>'+
 '<p class="fine">2. <b>Submit a job</b> &mdash; pick a base model and bounded settings. No code, no YAML, nothing to upload to a stranger&rsquo;s machine.</p>'+
 '<p class="fine">3. <b>A provider trains it</b> &mdash; one Mac (MLX) or GPU runs the fixed trainer and streams loss telemetry.</p>'+
 '<p class="fine">4. <b>The eval gate decides</b> &mdash; task A/B first, then retention probes, then a perplexity guardrail. Deployment requires the eval report, not just completion.</p>'+
 '<p class="fine">5. <b>Deploy your adapter</b> &mdash; private by default. Publish only if you choose.</p></div>'+
 '<div class="card"><h3>Honest constraints</h3>'+
 '<p class="fine">&middot; Providers can see your training data. Use the <b>local</b> privacy tier (your own machine) for anything sensitive.</p>'+
 '<p class="fine">&middot; Same settings do not imply identical adapters across engines &mdash; evals are always base-vs-tuned <b>within one engine</b>.</p>'+
 '<p class="fine">&middot; Quantized adapters only work against the exact base + quantization + engine they trained on.</p>'+
 '<p class="fine">&middot; Typical small LoRA jobs take minutes to about an hour. Jobs expire from the queue after 24h.</p></div>'+
 '<p><a class="pill info" href="#/new">Start a job &rarr;</a> <a class="pill" href="#/datasets">Datasets</a> <a class="pill" href="#/adapters">Adapters</a></p>';
}
/* ---- datasets ---- */
async function vDatasets(){
 view.innerHTML='<h2>Datasets</h2><p class="fine">Loading&hellip;</p>';
 let sets=[];
 try{sets=(await api("/compute/api/finetune/datasets")).datasets||[];}
 catch(e){if(String(e.message)==="login")return loginGate();view.innerHTML='<p class="err">'+esc(e.message)+"</p>";return;}
 let h='<h2>Datasets</h2>';
 if(!sets.length)h+='<p class="fine">No datasets yet. Build one below &mdash; paste room sessions as JSONL.</p>';
 else h+='<table><tr><th>ref</th><th>examples</th><th>eval split</th><th>created</th></tr>'+sets.map(d=>{
  const m=d.manifest||{};
  return "<tr><td><code>"+esc(d.dataset_ref)+"</code>"+(d.shared?' <span class="pill">shared</span>':"")+"</td>"+
   "<td>"+esc(m.train_examples??"&mdash;")+" train / "+esc(m.eval_examples??"&mdash;")+" eval</td>"+
   "<td>"+esc(m.eval_split??"&mdash;")+"</td><td>"+timeAgo(d.created_at)+"</td></tr>";
 }).join("")+"</table>";
 h+='<div class="card"><h3>Build a dataset</h3>'+
  '<p class="fine">One JSON object per line: <code>{"session_id":"s1","messages":[{"role":"user","content":"&hellip;"},{"role":"assistant","content":"&hellip;"}]}</code></p>'+
  '<label class="field"><span>Sessions JSONL (50&nbsp;MB max)</span><textarea id="ds-jsonl" placeholder=\\\'{"session_id":"s1","messages":[{"role":"user","content":"hi"},{"role":"assistant","content":"hello"}]}\\\'></textarea></label>'+
  '<div class="row"><label class="field"><span>Seed</span><input type="number" id="ds-seed" value="0"></label>'+
  '<label class="field"><span>Eval split</span><select id="ds-eval"><option>0.05</option><option selected>0.1</option><option>0.15</option><option>0.2</option></select></label></div>'+
  '<div class="row"><label class="field"><span>Replay mix ratio</span><select id="ds-replay"><option>0</option><option>0.1</option><option selected>0.2</option><option>0.3</option><option>0.5</option></select></label>'+
  '<label class="field"><span>Privacy</span><select id="ds-privacy"><option value="network">network</option><option value="trusted">trusted</option><option value="local">local</option></select></label></div>'+
  '<p><button class="primary" id="ds-build">Build dataset</button></p><p class="err" id="ds-err" hidden></p><div id="ds-out"></div></div>';
 view.innerHTML=h;
 $("#ds-build").onclick=async()=>{
  const err=$("#ds-err");err.hidden=true;
  const body={sessions_jsonl:$("#ds-jsonl").value,params:{seed:Number($("#ds-seed").value||0),eval_split:Number($("#ds-eval").value),replay_mix_ratio:Number($("#ds-replay").value)},privacy:$("#ds-privacy").value};
  if(!body.sessions_jsonl.trim()){err.textContent="Paste at least one session.";err.hidden=false;return;}
  $("#ds-build").disabled=true;
  try{
   const d=await api("/compute/api/finetune/datasets",{method:"POST",body:JSON.stringify(body)});
   const m=d.manifest||{};
   $("#ds-out").innerHTML='<div class="card"><h3>Built <code>'+esc(d.dataset_ref)+'</code></h3>'+
    '<p class="fine">parsed '+(m.parsed_sessions??"?")+" sessions &rarr; "+(m.kept_examples??"?")+" kept examples ("+(m.train_examples??"?")+" train / "+(m.eval_examples??"?")+") &middot; deduped "+(m.deduped??0)+" &middot; PII-scrubbed "+(m.pii_scrubbed??0)+"</p>"+
    '<p><a class="pill info" href="#/new">Use it in a job &rarr;</a></p></div>';
   vDatasetsSoon();
  }catch(e){err.textContent=e.message;err.hidden=false;}
  $("#ds-build").disabled=false;
 };
}
let dsTimer=null;
function vDatasetsSoon(){clearTimeout(dsTimer);dsTimer=setTimeout(()=>{if(location.hash.startsWith("#/datasets"))vDatasets();},1200);}
</script>

<script>
"use strict";
/* ---- new job ---- */
const CLAMPS={
 lora_rank:[4,8,16],lora_layers:[4,8,16],batch_size:[1,2,4],max_seq_length:[512,1024,2048,4096],
 iters:[50,5000],grad_accumulation_steps:[1,32],save_every:[50,1000]
};
const DEFAULTS={finetune_type:"lora",lora_rank:8,lora_layers:16,iters:750,learning_rate:1e-5,batch_size:4,max_seq_length:2048,grad_accumulation_steps:8,eval_split:0.1,replay_mix_ratio:0.2,seed:0,save_every:100,privacy:"network",engine_preference:"any"};
function sel(id,opts,def){return '<select id="'+id+'">'+opts.map(o=>'<option value="'+o+'"'+(String(o)===String(def)?" selected":"")+">"+o+"</option>").join("")+"</select>";}
async function vNew(){
 view.innerHTML='<h2>New fine-tune job</h2><p class="fine">Loading models&hellip;</p>';
 await loadModels();
 let sets=[];
 try{sets=(await api("/compute/api/finetune/datasets")).datasets||[];}
 catch(e){if(String(e.message)==="login")return loginGate();view.innerHTML='<p class="err">'+esc(e.message)+"</p>";return;}
 const cudaSoon=!ENGINES.includes("cuda");
 let h='<h2>New fine-tune job</h2>';
 h+='<label class="field"><span>Base model (allowlisted)</span><select id="f-model">'+
  MODELS.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.id)+" &middot; "+m.size_b+"B &middot; "+esc(m.license||"")+"</option>").join("")+"</select>"+
  '<div class="hint" id="f-model-hint"></div></label>';
 h+='<label class="field"><span>Dataset (coordinator-built)</span><select id="f-dataset">'+
  (sets.length?sets.map(d=>'<option value="'+esc(d.dataset_ref)+'">'+esc(d.dataset_ref)+" ("+esc((d.manifest&&d.manifest.train_examples)??"?")+" train)</option>").join(""):'<option value="">No datasets yet</option>')+"</select> "+
  '<div class="hint"><a href="#/datasets">Build one</a> from room sessions.</div></label>';
 h+='<label class="field"><span>Method</span><div class="radio-row" id="f-type">'+
  '<div class="radio-card sel" data-v="lora">LoRA<small>low-rank adapter on a frozen base</small></div>'+
  '<div class="radio-card" data-v="dora">DoRA<small>weight-decomposed LoRA</small></div></div>'+
  '<div class="hint">4-bit bases train QLoRA automatically &mdash; same form, quantized base.</div></label>';
 h+='<div class="row">';
 h+='<label class="field"><span>LoRA rank</span>'+sel("f-rank",CLAMPS.lora_rank,8)+'<div class="hint">Higher rank = more capacity, more memory.</div></label>';
 h+='<label class="field"><span>LoRA layers</span>'+sel("f-layers",CLAMPS.lora_layers,16)+'<div class="hint">Targeted transformer layers (4/8/16).</div></label></div>';
 h+='<div class="row"><label class="field"><span>Iterations</span><input type="range" id="f-iters" min="50" max="5000" step="50" value="750"><div class="hint"><span id="f-iters-v">750</span> training steps</div></label>'+
  '<label class="field"><span>Learning rate</span><input type="number" id="f-lr" value="0.00001" step="0.000001" min="0.000001" max="0.0001"><div class="hint">1e-6 to 1e-4</div></label></div>';
 h+='<div class="row"><label class="field"><span>Batch size</span>'+sel("f-batch",CLAMPS.batch_size,4)+'</label>'+
  '<label class="field"><span>Max seq length</span>'+sel("f-seq",CLAMPS.max_seq_length,2048)+'</label></div>';
 h+='<div class="row"><label class="field"><span>Grad accumulation</span><input type="number" id="f-accum" value="8" min="1" max="32" step="1"><div class="hint">1&ndash;32</div></label>'+
  '<label class="field"><span>Checkpoint every</span><input type="number" id="f-save" value="100" min="50" max="1000" step="10"><div class="hint">50&ndash;1000 steps; enables resume</div></label></div>';
 h+='<div class="row"><label class="field"><span>Eval split</span><input type="number" id="f-evalsplit" value="0.1" min="0.05" max="0.2" step="0.01"><div class="hint">Held-out fraction, pinned to the job</div></label>'+
  '<label class="field"><span>Replay mix</span><input type="number" id="f-replay" value="0.2" min="0" max="0.5" step="0.05"><div class="hint">General-data blend against forgetting</div></label></div>';
 h+='<label class="field"><span>Seed</span><input type="number" id="f-seed" value="0" step="1"><div class="hint">Reproducibility pin</div></label>';
 h+='<label class="field"><span>Training engine</span><div class="radio-row" id="f-engine">'+
  '<div class="radio-card sel" data-v="any">Any<small>match whichever is available</small></div>'+
  '<div class="radio-card" data-v="mlx">Apple Silicon<small>MLX trainer</small></div>'+
  '<div class="radio-card dis" data-v="cuda" title="Coming soon">Nvidia CUDA<small>coming soon &mdash; no providers yet</small></div></div></label>';
 h+='<label class="field"><span>Who can train this</span><div class="radio-row" id="f-privacy">'+
  Object.entries(PRIVACY_COPY).map(([k,[t,d]])=>'<div class="radio-card'+(k==="network"?" sel":"")+'" data-v="'+k+'">'+t+"<small>"+d+"</small></div>").join("")+"</div></label>";
 h+='<div class="card" id="f-estimate"><h3>Estimate</h3><div id="f-est-body"><p class="fine">Pick a model&hellip;</p></div></div>';
 h+='<p><button class="primary" id="f-submit">Submit job</button></p><p class="err" id="f-err" hidden></p>';
 view.innerHTML=h;
 const radio=(id,cb)=>{const el=$("#"+id);el.addEventListener("click",e=>{const c=e.target.closest(".radio-card");if(!c||c.classList.contains("dis"))return;[...el.children].forEach(x=>x.classList.remove("sel"));c.classList.add("sel");cb&&cb(c.dataset.v);});return()=>{const s=el.querySelector(".sel");return s?s.dataset.v:null;};};
 const getType=radio("f-type"),getEngine=radio("f-engine"),getPrivacy=radio("f-privacy");
 $("#f-iters").oninput=e=>{$("#f-iters-v").textContent=e.target.value;};
 function estimate(){
  const m=MODELS.find(x=>x.id===$("#f-model").value);
  if(!m)return;
  const eng=getEngine()==="any"?m.engines[0]:getEngine();
  const floor=m.memory_floors_gb[eng];
  $("#f-model-hint").textContent=m.size_b+"B params · license "+(m.license||"n/a");
  $("#f-est-body").innerHTML='<p class="fine">Needs a provider with <b>'+floor+' GB</b> '+(eng==="mlx"?"unified memory (Apple Silicon)":"VRAM (Nvidia)")+' visible to the trainer.</p>'+
   '<p class="fine">Provider earns <b>'+rateFor(m.size_b)+'&cent;/min</b> of training while your job runs &mdash; local-privacy jobs earn nothing (your own Mac).</p>'+
   '<p class="fine">QLoRA is automatic on 4-bit bases; the adapter stays valid only against this exact base + quantization + engine.</p>';
 }
 $("#f-model").onchange=estimate;estimate();
 $("#f-submit").onclick=async()=>{
  const err=$("#f-err");err.hidden=true;
  const spec={
   base_model:$("#f-model").value,
   dataset_ref:$("#f-dataset").value,
   finetune_type:getType(),lora_rank:Number($("#f-rank").value),lora_layers:Number($("#f-layers").value),
   iters:Number($("#f-iters").value),learning_rate:Number($("#f-lr").value),batch_size:Number($("#f-batch").value),
   max_seq_length:Number($("#f-seq").value),grad_accumulation_steps:Number($("#f-accum").value),
   eval_split:Number($("#f-evalsplit").value),replay_mix_ratio:Number($("#f-replay").value),
   seed:Number($("#f-seed").value),save_every:Number($("#f-save").value),
   privacy:getPrivacy(),engine_preference:getEngine()
  };
  const bad=[];
  if(!/^ds_[A-Za-z0-9_-]{1,100}$/.test(spec.dataset_ref))bad.push("pick a dataset first (Datasets tab)");
  if(!CLAMPS.lora_rank.includes(spec.lora_rank))bad.push("rank must be 4, 8, or 16");
  if(!CLAMPS.lora_layers.includes(spec.lora_layers))bad.push("layers must be 4, 8, or 16");
  if(!(Number.isInteger(spec.iters)&&spec.iters>=50&&spec.iters<=5000))bad.push("iters must be 50–5000");
  if(!(spec.learning_rate>=1e-6&&spec.learning_rate<=1e-4))bad.push("learning rate must be 1e-6–1e-4");
  if(!CLAMPS.batch_size.includes(spec.batch_size))bad.push("batch must be 1, 2, or 4");
  if(!CLAMPS.max_seq_length.includes(spec.max_seq_length))bad.push("seq length must be 512/1024/2048/4096");
  if(!(Number.isInteger(spec.grad_accumulation_steps)&&spec.grad_accumulation_steps>=1&&spec.grad_accumulation_steps<=32))bad.push("grad accumulation must be 1–32");
  if(!(spec.eval_split>=0.05&&spec.eval_split<=0.2))bad.push("eval split must be 0.05–0.2");
  if(!(spec.replay_mix_ratio>=0&&spec.replay_mix_ratio<=0.5))bad.push("replay mix must be 0–0.5");
  if(!Number.isInteger(spec.seed))bad.push("seed must be an integer");
  if(!(Number.isInteger(spec.save_every)&&spec.save_every>=50&&spec.save_every<=1000))bad.push("checkpoint cadence must be 50–1000");
  if(bad.length){err.innerHTML=bad.map(esc).join("<br>");err.hidden=false;return;}
  $("#f-submit").disabled=true;
  try{
   const d=await api("/compute/api/finetune",{method:"POST",body:JSON.stringify(spec)});
   location.hash="#/jobs/"+d.task.id;
  }catch(e){err.textContent=e.message;err.hidden=false;}
  $("#f-submit").disabled=false;
 };
}
</script>

<script>
"use strict";
/* ---- jobs ---- */
async function vJobs(){
 view.innerHTML='<h2>My fine-tune jobs</h2><p class="fine">Loading&hellip;</p>';
 let tasks=[];
 try{tasks=(await api("/compute/api/finetune")).tasks||[];}
 catch(e){if(String(e.message)==="login")return loginGate();view.innerHTML='<p class="err">'+esc(e.message)+"</p>";return;}
 let h='<h2>My fine-tune jobs</h2>';
 if(!tasks.length)h+='<p class="fine">No jobs yet. <a href="#/new">Start one</a>.</p>';
 else h+='<table><tr><th>job</th><th>model</th><th>status</th><th>eval</th><th>submitted</th></tr>'+tasks.map(t=>
  '<tr><td><a href="#/jobs/'+esc(t.id)+'"><code>'+esc(t.id)+"</code></a></td><td>"+esc(t.base_model)+"</td><td>"+statusPill(t.status)+"</td><td>"+verdictPill(t.gate_verdict)+"</td><td>"+timeAgo(t.created_at)+"</td></tr>"
 ).join("")+"</table>";
 view.innerHTML=h;
}
function reasonHtml(r){
 const cls=r.verdict==="pass"?"pass":r.verdict==="needs_review"?"review":"fail";
 return '<div class="reason '+cls+'"><b>'+esc(r.check)+"</b> &mdash; "+esc(r.note)+"</div>";
}
function evalHtml(t){
 const rep=(t.tune_result&&t.tune_result.eval_report)||{};
 const delta=t.eval_delta||{};
 let h='<div class="card"><h3>Eval gate '+verdictPill(t.gate_verdict)+"</h3>";
 h+='<p class="fine">Authority order: task A/B &gt; retention probes &gt; perplexity guardrail &gt; LLM judge (advisory).</p>';
 if(!t.evaluated)h+='<p class="fine">Not evaluated yet. Results land here after training.</p>';
 else{
  const reasons=t.gate_reasons||[];
  h+=reasons.length?reasons.map(reasonHtml).join(""):'<p class="fine">No gate notes.</p>';
  const ab=delta.task_ab||{};
  if(ab.baseline_accuracy!=null||ab.tuned_accuracy!=null)
   h+='<p class="fine"><b>Task A/B</b> &middot; baseline '+fmt(ab.baseline_accuracy)+" &rarr; tuned "+fmt(ab.tuned_accuracy)+" (delta "+fmtSigned(ab.accuracy_delta)+")</p>";
  if(delta.retention_tax!=null)
   h+='<p class="fine"><b>Retention tax</b> &middot; '+fmtSigned(delta.retention_tax)+" points on "+esc(rep.retention&&rep.retention.questions!=null?rep.retention.questions+" general questions":"general questions")+"</p>";
  if(delta.baseline_perplexity!=null||delta.tuned_perplexity!=null)
   h+='<p class="fine"><b>Perplexity (guardrail only)</b> &middot; baseline '+fmt(delta.baseline_perplexity)+" &rarr; tuned "+fmt(delta.tuned_perplexity)+(t.gate_verdict==="pass"?" — held within tolerance":" — no quality claim is made from this number")+"</p>";
  const j=rep.judge||{};
  if(j.win_rate!=null)h+='<p class="fine"><b>Judge (advisory)</b> &middot; win rate '+fmt(j.win_rate)+" &middot; "+esc(j.note||"")+"</p>";
  if(rep.eval_split_hash)h+='<p class="fine">eval split <code>'+esc(rep.eval_split_hash.slice(0,16))+'&hellip;</code> &mdash; pinned to this job, reusable for re-runs</p>';
 }
 h+="</div>";
 return h;
}
function fmt(n){return (n==null||!Number.isFinite(Number(n)))?"&mdash;":Number(n).toFixed(3);}
function fmtSigned(n){return (n==null||!Number.isFinite(Number(n)))?"&mdash;":(Number(n)>=0?"+":"")+Number(n).toFixed(3);}
async function vJobDetail(id){
 view.innerHTML='<h2>Job <code>'+esc(id)+"</code></h2><p class=\\\"fine\\\">Loading&hellip;</p>";
 let t=null;
 try{t=(await api("/compute/api/finetune/"+id)).task;}
 catch(e){if(String(e.message)==="login")return loginGate();view.innerHTML='<p class="err">'+esc(e.message)+"</p>";return;}
 if(!t){view.innerHTML='<p class="err">Job not found.</p>';return;}
 const spec=t.spec||{};
 const res=t.tune_result||{};
 let h='<h2>Job <code>'+esc(t.id)+'</code></h2>';
 h+='<p>'+statusPill(t.status)+' '+verdictPill(t.gate_verdict)+
  ' <span class="pill">'+esc(t.base_model)+'</span> <span class="pill">'+esc(t.engine||"?")+'</span> <span class="pill">'+esc(t.privacy)+'</span></p>';
 h+='<p class="fine">submitted '+timeAgo(t.created_at)+(t.expires_at?" &middot; queue entry expires "+timeAgo(t.expires_at):"")+"</p>";
 if(t.status==="leased"&&t.lease)
  h+='<div class="card"><h3>Training now</h3><p class="fine">A provider is training this job. Lease '+(t.lease.expires_at?"renews "+timeAgo(t.lease.expires_at):"active")+". Refresh for the latest loss telemetry.</p></div>";
 if(res.train_loss&&res.train_loss.length)
  h+='<div class="card"><h3>Training loss</h3>'+sparkline(res.train_loss)+'</div>';
 else if(t.status==="leased"||t.status==="queued")
  h+='<div class="card"><h3>Training loss</h3><p class="fine">Waiting on the first loss report&hellip;</p></div>';
 if(t.status==="failed"&&t.error)h+='<div class="card"><h3>Failed</h3><p class="err">'+esc(t.error)+'</p></div>';
 h+=evalHtml(t);
 if(t.adapter_ref)
  h+='<div class="card"><h3>Adapter</h3><p><code>'+esc(t.adapter_ref)+'</code></p><p><a class="pill info" href="#/adapters">Open in adapters &rarr;</a></p></div>';
 if(t.attempts&&t.attempts.length)
  h+='<div class="card"><h3>Attempts</h3><table><tr><th>provider</th><th>outcome</th><th>when</th></tr>'+t.attempts.map(a=>
   "<tr><td><code>"+esc(a.provider_id||"?")+"</code></td><td>"+esc(a.outcome||"?")+"</td><td>"+timeAgo(a.leased_at)+"</td></tr>"
  ).join("")+"</table></div>";
 h+='<div class="card"><h3>Settings</h3><table><tr><th>field</th><th>value</th></tr>'+
  Object.entries(spec).map(([k,v])=>"<tr><td><code>"+esc(k)+"</code></td><td>"+esc(Array.isArray(v)?v.join(", "):v)+"</td></tr>").join("")+
  "</table><p class=\\\"fine\\\">spec hash <code>"+esc(t.spec_hash||"")+"</code></p></div>";
 view.innerHTML=h;
}
</script>

<script>
"use strict";
/* ---- adapters ---- */
async function vAdapters(){
 view.innerHTML='<h2>Adapters</h2><p class="fine">Loading&hellip;</p>';
 let adapters=[];
 try{adapters=(await api("/compute/api/finetune/adapters")).adapters||[];}
 catch(e){if(String(e.message)==="login")return loginGate();view.innerHTML='<p class="err">'+esc(e.message)+"</p>";return;}
 let h='<h2>Adapters</h2><p class="fine">Adapters are <b>private by default</b>. Publishing is an explicit, reversible step &mdash; and only offered for network-privacy adapters that passed the eval gate.</p>';
 if(!adapters.length)h+='<p class="fine">No adapters yet. Adapters appear when a job completes and the eval gate runs.</p>';
 else for(const a of adapters){
  const canPublish=!a.published&&a.privacy==="network"&&a.gate_verdict==="pass";
  h+='<div class="card" id="ad-'+esc(a.ref)+'"><h3><code>'+esc(a.ref)+"</code> "+verdictPill(a.gate_verdict)+
   (a.published?' <span class="pill ok">published</span>':' <span class="pill">private</span>')+"</h3>"+
   '<p class="fine">base <code>'+esc(a.base_model)+'</code> &middot; '+(a.quantization==="4bit"?"4-bit QLoRA":"float")+' &middot; engine <b>'+esc(a.engine)+'</b> &middot; dataset <code>'+esc(a.dataset_ref)+"</code></p>"+
   (a.gate_reasons&&a.gate_reasons.length?'<p class="fine">'+a.gate_reasons.map(r=>esc(r.check)+": "+esc(r.note)).join("<br>")+"</p>":"")+
   '<div class="serve" data-ref="'+esc(a.ref)+'"><p class="fine">Checking serving readiness&hellip;</p></div>'+
   '<p><button class="quiet" data-act="dl" data-ref="'+esc(a.ref)+'">Download .tar.gz</button> '+
   (canPublish?'<button class="primary" data-act="pub" data-ref="'+esc(a.ref)+'">Publish adapter</button> ':"")+
   (a.privacy==="network"&&a.gate_verdict==="fail"?'<span class="pill bad">quarantined &mdash; eval failed</span>':"")+"</p></div>";
 }
 view.innerHTML=h;
 view.onclick=async e=>{
  const b=e.target.closest("button[data-act]");if(!b)return;
  const ref=b.dataset.ref,act=b.dataset.act;
  b.disabled=true;
  try{
   if(act==="dl"){
    const r=await fetch("/compute/api/finetune/adapters/"+ref+"/download",{credentials:"same-origin"});
    if(!r.ok)throw new Error("HTTP "+r.status);
    const blob=await r.blob();
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=ref+".tar.gz";a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),4000);
   }else if(act==="pub"){
    if(!confirm("Publish "+ref+"? It becomes reusable by anyone on the network and appears in the shared adapter list."))return;
    await api("/compute/api/finetune/adapters/"+ref+"/publish",{method:"POST"});
    vAdapters();
   }
  }catch(err){alert(err.message);}
  b.disabled=false;
 };
 for(const el of view.querySelectorAll(".serve")){
  const ref=el.dataset.ref;
  try{
   const d=await api("/compute/api/finetune/adapters/"+ref+"/serve");
   const rows=Object.entries(d.serve||{}).map(([eng,s])=>{
    s=s||{status:"unknown",note:"no data"};
    if(s.status==="servable")
     return '<p class="fine"><b>'+eng+'</b> &mdash; <span class="pill ok">native PEFT</span> '+esc(s.note||"")+' (format <code>'+esc(s.format||"peft")+"</code>)</p>";
    if(s.status==="needs_conversion")
     return '<p class="fine"><b>'+eng+'</b> &mdash; <span class="pill warn">needs conversion</span> '+esc(s.note||"")+'</p>'+
      '<p class="fine">artifact <code>'+esc(s.adapter_ref||s.artifact||ref)+'</code> &middot; download the .tar.gz below, convert at the MLX boundary, then serve with mlx-lm.</p>';
    return '<p class="fine"><b>'+eng+'</b> &mdash; <span class="pill bad">'+esc(s.status)+"</span> "+esc(s.note||"")+"</p>";
   }).join("");
   el.innerHTML='<h3>Deploy</h3>'+rows+
    '<p class="fine">Serving is same-engine only &mdash; an MLX adapter cannot serve on CUDA and vice versa. Local-lane users: download the .tar.gz, then convert or load natively.</p>';
  }catch(err){el.innerHTML='<p class="err">Could not load serving info.</p>';}
 }
}
</script>

<script>
"use strict";
/* ---- router ---- */
function route(){
 const hash=location.hash||"#/";
 const m=hash.match(/^#\\/jobs\\/(tune_[A-Za-z0-9_-]+)$/);
 const tabs=document.querySelectorAll("#tabs a");
 tabs.forEach(a=>a.classList.remove("active"));
 const setActive=t=>{tabs.forEach(a=>{if(a.dataset.tab===t)a.classList.add("active");});};
 if(hash.startsWith("#/new")){setActive("new");vNew();}
 else if(m){setActive("jobs");vJobDetail(m[1]);}
 else if(hash.startsWith("#/jobs")){setActive("jobs");vJobs();}
 else if(hash.startsWith("#/datasets")){setActive("datasets");vDatasets();}
 else if(hash.startsWith("#/adapters")){setActive("adapters");vAdapters();}
 else{setActive("home");vHome();}
}
window.addEventListener("hashchange",route);
route();
</script>
</body>
</html>`;
