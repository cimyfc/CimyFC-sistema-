/* Cimy FC — versão compartilhada com Supabase
   1) Coloque a URL e a chave pública (anon/publishable) do seu projeto no bloco abaixo.
   2) Nunca coloque a service_role/secret key aqui.
*/
const SUPABASE_URL = "https://zhnqnpbeftdmukirljfd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jlHoedzUoJvOSW66S6vSDA_-8DFBECO";

const initialPlayers=["Ícaro","Gustavo","Moisés","Iago","Caio","Yuri","Paulo Gabriel"];
let client=null;
let data={players:[],records:[],warnings:[],videos:[]};
let realtimeChannel=null;

function configured(){
  return SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("COLE_AQUI") &&
         SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes("COLE_AQUI");
}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function playerName(id){return data.players.find(p=>p.id===id)?.name||"Jogador removido";}
function fmtDate(d){if(!d)return "";return new Date(d+"T12:00:00").toLocaleDateString("pt-BR");}
function setStatus(msg,ok=false){
  const el=document.getElementById("cloudStatus");
  if(!el)return;
  el.textContent=msg;
  el.className=ok?"cloud-status ok":"cloud-status";
}

async function boot(){
  if(!configured()){
    setStatus("Banco online ainda não configurado. Abra o README para concluir a configuração.");
    data=loadLocalFallback();
    renderAll();
    return;
  }
  try{
    const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm");
    client=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
    const {data:sessionData}=await client.auth.getSession();
    if(!sessionData.session){showLogin();return;}
    hideLogin();
    await loadCloud();
    subscribeRealtime();
  }catch(err){
    console.error(err);
    setStatus("Não foi possível conectar ao banco. Confira a configuração.");
    data=loadLocalFallback();
    renderAll();
  }
}

function loadLocalFallback(){
  try{
    return JSON.parse(localStorage.getItem("cimyfc_data_v1")||"null")||{
      players:initialPlayers.map(name=>({id:crypto.randomUUID(),name,createdAt:new Date().toISOString()})),records:[],warnings:[],videos:[]
    };
  }catch{return {players:[],records:[],warnings:[],videos:[]};}
}

function showLogin(){
  document.getElementById("loginPanel").classList.remove("hidden");
  document.getElementById("appContent").classList.add("hidden");
  setStatus("Faça login para acessar os dados compartilhados.");
}
function hideLogin(){
  document.getElementById("loginPanel").classList.add("hidden");
  document.getElementById("appContent").classList.remove("hidden");
  setStatus("Conectado ao banco online",true);
}

async function login(){
  const email=document.getElementById("loginEmail").value.trim();
  const password=document.getElementById("loginPassword").value;
  if(!email||!password)return alert("Digite e-mail e senha.");
  const {error}=await client.auth.signInWithPassword({email,password});
  if(error)return alert("Login não realizado: "+error.message);
  hideLogin(); await loadCloud(); subscribeRealtime();
}
async function signup(){
  const email=document.getElementById("loginEmail").value.trim();
  const password=document.getElementById("loginPassword").value;
  if(!email||password.length<6)return alert("Digite um e-mail e uma senha com pelo menos 6 caracteres.");
  const {data:result,error}=await client.auth.signUp({email,password});
  if(error)return alert("Não foi possível criar a conta: "+error.message);
  if(!result.session) alert("Conta criada. Confira o e-mail de confirmação e depois faça login.");
  else {hideLogin();await loadCloud();subscribeRealtime();}
}
async function logout(){
  if(client)await client.auth.signOut();
  if(realtimeChannel)await client.removeChannel(realtimeChannel);
  showLogin();
}

async function loadCloud(){
  const [p,r,w,v]=await Promise.all([
    client.from("players").select("*").order("created_at"),
    client.from("records").select("*").order("created_at"),
    client.from("warnings").select("*").order("date",{ascending:true}),
    client.from("videos").select("*").order("date",{ascending:true})
  ]);
  const firstError=[p,r,w,v].find(x=>x.error);
  if(firstError)throw firstError.error;
  data={players:(p.data||[]).map(normalizePlayer),records:(r.data||[]).map(normalizeRecord),warnings:(w.data||[]).map(normalizeWarning),videos:(v.data||[]).map(normalizeVideo)};
  if(data.players.length===0){
    const rows=initialPlayers.map(name=>({name}));
    const {data:inserted,error}=await client.from("players").insert(rows).select("*");
    if(error)throw error;
    data.players=(inserted||[]).map(normalizePlayer);
  }
  renderAll();
}
function normalizePlayer(x){return {id:x.id,name:x.name,createdAt:x.created_at};}
function normalizeRecord(x){return {id:x.id,playerId:x.player_id,code:x.code||"",type:x.type||"",desc:x.description||"",date:x.created_at};}
function normalizeWarning(x){return {id:x.id,playerId:x.player_id,reason:x.reason||"",date:x.date,desc:x.description||""};}
function normalizeVideo(x){return {id:x.id,title:x.title,date:x.date,time:x.time||"",status:x.status,desc:x.description||""};}

function subscribeRealtime(){
  if(realtimeChannel)client.removeChannel(realtimeChannel);
  realtimeChannel=client.channel("cimyfc-data")
    .on("postgres_changes",{event:"*",schema:"public",table:"players"},loadCloud)
    .on("postgres_changes",{event:"*",schema:"public",table:"records"},loadCloud)
    .on("postgres_changes",{event:"*",schema:"public",table:"warnings"},loadCloud)
    .on("postgres_changes",{event:"*",schema:"public",table:"videos"},loadCloud)
    .subscribe();
}

async function savePlayer(id){
  const name=document.getElementById("fName").value.trim();
  if(!name)return alert("Digite o nome do jogador.");
  const result=id
    ? await client.from("players").update({name}).eq("id",id)
    : await client.from("players").insert({name});
  if(result.error)return alert("Erro ao salvar: "+result.error.message);
  closeModal();await loadCloud();
}
async function removePlayer(id){
  const p=data.players.find(x=>x.id===id); if(!p)return;
  if(confirm(`Remover ${p.name}? Os registros históricos serão mantidos.`)){
    const {error}=await client.from("players").delete().eq("id",id);
    if(error)alert("Erro ao remover: "+error.message); else await loadCloud();
  }
}
async function saveRecord(){
  const row={player_id:document.getElementById("rPlayer").value,code:document.getElementById("rId").value.trim(),type:document.getElementById("rType").value.trim(),description:document.getElementById("rDesc").value.trim()};
  const {error}=await client.from("records").insert(row);
  if(error)return alert("Erro ao registrar: "+error.message);
  closeModal();await loadCloud();
}
async function deleteRecord(id){if(confirm("Excluir este registro?")){const {error}=await client.from("records").delete().eq("id",id);if(error)alert(error.message);else await loadCloud();}}
async function saveWarning(){
  const row={player_id:document.getElementById("wPlayer").value,reason:document.getElementById("wReason").value.trim(),date:document.getElementById("wDate").value,description:document.getElementById("wDesc").value.trim()};
  const {error}=await client.from("warnings").insert(row);
  if(error)return alert("Erro ao registrar: "+error.message);
  closeModal();await loadCloud();
}
async function deleteWarning(id){if(confirm("Excluir esta advertência?")){const {error}=await client.from("warnings").delete().eq("id",id);if(error)alert(error.message);else await loadCloud();}}
async function saveVideo(id){
  const obj={title:document.getElementById("vTitle").value.trim(),date:document.getElementById("vDate").value,time:document.getElementById("vTime").value,status:document.getElementById("vStatus").value,description:document.getElementById("vDesc").value.trim()};
  if(!obj.title)return alert("Digite a ideia/título do vídeo.");
  const result=id?await client.from("videos").update(obj).eq("id",id):await client.from("videos").insert(obj);
  if(result.error)return alert("Erro ao salvar: "+result.error.message);
  closeModal();await loadCloud();
}
async function deleteVideo(id){if(confirm("Excluir este vídeo?")){const {error}=await client.from("videos").delete().eq("id",id);if(error)alert(error.message);else await loadCloud();}}

function playerOptions(selected=""){return data.players.map(p=>`<option value="${p.id}" ${p.id===selected?"selected":""}>${esc(p.name)}</option>`).join("");}
function modal(title,body){document.getElementById("modalContent").innerHTML=`<h2>${title}</h2>${body}`;document.getElementById("modal").classList.remove("hidden");}
function closeModal(){document.getElementById("modal").classList.add("hidden");}
function openPlayerModal(id=null){const p=id?data.players.find(x=>x.id===id):null;modal(id?"Editar jogador":"Adicionar jogador",`<label>Nome do jogador</label><input id="fName" value="${esc(p?.name||"")}" placeholder="Nome completo"><div class="form-actions"><button class="secondary" onclick="closeModal()">Cancelar</button><button class="primary" onclick="savePlayer('${id||""}')">Salvar</button></div>`);}
function openRecordModal(){modal("Novo registro / ID",`<label>Jogador</label><select id="rPlayer">${playerOptions()}</select><label>ID / código</label><input id="rId" placeholder="Ex.: ID-001 ou número"><label>Tipo</label><input id="rType" placeholder="Ex.: partida, ocorrência, documento..."><label>Descrição</label><textarea id="rDesc" placeholder="Detalhes do registro"></textarea><div class="form-actions"><button class="secondary" onclick="closeModal()">Cancelar</button><button class="primary" onclick="saveRecord()">Registrar</button></div>`);}
function openWarningModal(playerId=""){modal("Nova advertência",`<label>Jogador</label><select id="wPlayer">${playerOptions(playerId)}</select><label>Motivo</label><input id="wReason" placeholder="Motivo da advertência"><label>Data</label><input id="wDate" type="date" value="${new Date().toISOString().slice(0,10)}"><label>Observações</label><textarea id="wDesc" placeholder="O que aconteceu?"></textarea><div class="form-actions"><button class="secondary" onclick="closeModal()">Cancelar</button><button class="primary" onclick="saveWarning()">Registrar</button></div>`);}
function openVideoModal(id=null){const v=id?data.videos.find(x=>x.id===id):null;modal(id?"Editar vídeo":"Agendar vídeo",`<label>Ideia / título</label><input id="vTitle" value="${esc(v?.title||"")}" placeholder="Ex.: Desafio do elenco"><label>Data</label><input id="vDate" type="date" value="${v?.date||new Date().toISOString().slice(0,10)}"><label>Hora (opcional)</label><input id="vTime" type="time" value="${v?.time||""}"><label>Status</label><select id="vStatus"><option ${v?.status==="Planejado"?"selected":""}>Planejado</option><option ${v?.status==="Gravado"?"selected":""}>Gravado</option><option ${v?.status==="Publicado"?"selected":""}>Publicado</option></select><label>Observações</label><textarea id="vDesc" placeholder="Detalhes do vídeo">${esc(v?.desc||"")}</textarea><div class="form-actions"><button class="secondary" onclick="closeModal()">Cancelar</button><button class="primary" onclick="saveVideo('${id||""}')">Salvar</button></div>`);}

function renderAll(){
 document.getElementById("countPlayers").textContent=data.players.length;document.getElementById("countIds").textContent=data.records.length;document.getElementById("countWarnings").textContent=data.warnings.length;document.getElementById("countVideos").textContent=data.videos.length;
 document.getElementById("playersList").innerHTML=data.players.length?data.players.map(p=>{const ws=data.warnings.filter(w=>w.playerId===p.id).length;return `<div class="item"><div><h3>${esc(p.name)}</h3><span class="tag">${ws} advertência(s)</span></div><div class="actions"><button onclick="openWarningModal('${p.id}')">+ Advertência</button><button onclick="openPlayerModal('${p.id}')">Editar</button><button class="danger" onclick="removePlayer('${p.id}')">Remover</button></div></div>`;}).join(""):`<div class="empty">Nenhum jogador cadastrado.</div>`;
 document.getElementById("recordsList").innerHTML=data.records.length?[...data.records].reverse().map(r=>`<div class="item"><div><h3>${esc(r.code||"Sem ID")} — ${esc(playerName(r.playerId))}</h3><span class="tag">${esc(r.type||"Registro")}</span><p>${esc(r.desc)}</p><small class="muted">${new Date(r.date).toLocaleString("pt-BR")}</small></div><div class="actions"><button class="danger" onclick="deleteRecord('${r.id}')">Excluir</button></div></div>`).join(""):`<div class="empty">Nenhum registro ainda.</div>`;
 document.getElementById("warningsList").innerHTML=data.warnings.length?[...data.warnings].reverse().map(w=>`<div class="item warning"><div><h3>${esc(playerName(w.playerId))}</h3><strong>${esc(w.reason||"Advertência")}</strong><p>${esc(w.desc)}</p><small class="muted">${fmtDate(w.date)}</small></div><div class="actions"><button class="danger" onclick="deleteWarning('${w.id}')">Excluir</button></div></div>`).join(""):`<div class="empty">Nenhuma advertência registrada.</div>`;
 document.getElementById("videosList").innerHTML=data.videos.length?[...data.videos].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).map(v=>{const past=v.status!=="Publicado"&&new Date(v.date+"T"+(v.time||"23:59"))<new Date();return `<div class="item ${past?"overdue":""} ${v.status==="Publicado"?"done":""}"><div><h3>${esc(v.title)}</h3><span class="tag">${esc(v.status)}</span><p>${fmtDate(v.date)} ${v.time?"às "+v.time:""}</p><p>${esc(v.desc)}</p></div><div class="actions"><button onclick="openVideoModal('${v.id}')">Editar</button><button class="danger" onclick="deleteVideo('${v.id}')">Excluir</button></div></div>`;}).join(""):`<div class="empty">Nenhum vídeo agendado.</div>`;
}

document.querySelectorAll(".tab").forEach(btn=>btn.onclick=()=>{document.querySelectorAll(".tab,.tab-content").forEach(x=>x.classList.remove("active"));btn.classList.add("active");document.getElementById(btn.dataset.tab).classList.add("active");});
document.getElementById("modal").onclick=e=>{if(e.target.id==="modal")closeModal()};
document.getElementById("loginBtn").onclick=login;
document.getElementById("signupBtn").onclick=signup;
document.getElementById("logoutBtn").onclick=logout;
document.getElementById("exportBtn").onclick=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="cimyfc-backup.json";a.click();URL.revokeObjectURL(a.href);};
boot();
