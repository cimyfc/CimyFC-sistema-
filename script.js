const KEY="cimyfc_data_v1";
const initialPlayers=["Ícaro","Gustavo","Moisés","Iago","Caio","Yuri","Paulo Gabriel"];

let data=JSON.parse(localStorage.getItem(KEY)||"null")||{
  players: initialPlayers.map((name,i)=>({id: crypto.randomUUID(),name,createdAt:new Date().toISOString()})),
  records:[], warnings:[], videos:[]
};
save();

function save(){localStorage.setItem(KEY,JSON.stringify(data)); renderAll();}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function playerName(id){return data.players.find(p=>p.id===id)?.name||"Jogador removido";}
function fmtDate(d){if(!d)return "";return new Date(d+"T12:00:00").toLocaleDateString("pt-BR");}

document.querySelectorAll(".tab").forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll(".tab,.tab-content").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active"); document.getElementById(btn.dataset.tab).classList.add("active");
});

function modal(title,body){
 document.getElementById("modalContent").innerHTML=`<h2>${title}</h2>${body}`;
 document.getElementById("modal").classList.remove("hidden");
}
function closeModal(){document.getElementById("modal").classList.add("hidden");}
document.getElementById("modal").onclick=e=>{if(e.target.id==="modal")closeModal()};

function playerOptions(selected=""){return data.players.map(p=>`<option value="${p.id}" ${p.id===selected?"selected":""}>${esc(p.name)}</option>`).join("");}

function openPlayerModal(id=null){
 const p=id?data.players.find(x=>x.id===id):null;
 modal(id?"Editar jogador":"Adicionar jogador",`
 <label>Nome do jogador</label><input id="fName" value="${esc(p?.name||"")}" placeholder="Nome completo">
 <div class="form-actions"><button class="secondary" onclick="closeModal()">Cancelar</button><button class="primary" onclick="savePlayer('${id||""}')">Salvar</button></div>`);
}
function savePlayer(id){
 const name=document.getElementById("fName").value.trim();
 if(!name)return alert("Digite o nome do jogador.");
 if(id){data.players.find(p=>p.id===id).name=name;}
 else data.players.push({id:crypto.randomUUID(),name,createdAt:new Date().toISOString()});
 closeModal();save();
}
function removePlayer(id){
 const p=data.players.find(x=>x.id===id); if(!p)return;
 if(confirm(`Remover ${p.name}? Os registros históricos serão mantidos.`)){data.players=data.players.filter(x=>x.id!==id);save();}
}

function openRecordModal(){
 modal("Novo registro / ID",`
 <label>Jogador</label><select id="rPlayer">${playerOptions()}</select>
 <label>ID / código</label><input id="rId" placeholder="Ex.: ID-001 ou número">
 <label>Tipo</label><input id="rType" placeholder="Ex.: partida, ocorrência, documento...">
 <label>Descrição</label><textarea id="rDesc" placeholder="Detalhes do registro"></textarea>
 <div class="form-actions"><button class="secondary" onclick="closeModal()">Cancelar</button><button class="primary" onclick="saveRecord()">Registrar</button></div>`);
}
function saveRecord(){
 data.records.push({id:crypto.randomUUID(),playerId:rPlayer.value,code:rId.value.trim(),type:rType.value.trim(),desc:rDesc.value.trim(),date:new Date().toISOString()});
 closeModal();save();
}
function deleteRecord(id){if(confirm("Excluir este registro?")){data.records=data.records.filter(x=>x.id!==id);save();}}

function openWarningModal(playerId=""){
 modal("Nova advertência",`
 <label>Jogador</label><select id="wPlayer">${playerOptions(playerId)}</select>
 <label>Motivo</label><input id="wReason" placeholder="Motivo da advertência">
 <label>Data</label><input id="wDate" type="date" value="${new Date().toISOString().slice(0,10)}">
 <label>Observações</label><textarea id="wDesc" placeholder="O que aconteceu?"></textarea>
 <div class="form-actions"><button class="secondary" onclick="closeModal()">Cancelar</button><button class="primary" onclick="saveWarning()">Registrar</button></div>`);
}
function saveWarning(){
 data.warnings.push({id:crypto.randomUUID(),playerId:wPlayer.value,reason:wReason.value.trim(),date:wDate.value,desc:wDesc.value.trim()});
 closeModal();save();
}
function deleteWarning(id){if(confirm("Excluir esta advertência?")){data.warnings=data.warnings.filter(x=>x.id!==id);save();}}

function openVideoModal(id=null){
 const v=id?data.videos.find(x=>x.id===id):null;
 modal(id?"Editar vídeo":"Agendar vídeo",`
 <label>Ideia / título</label><input id="vTitle" value="${esc(v?.title||"")}" placeholder="Ex.: Desafio do elenco">
 <label>Data</label><input id="vDate" type="date" value="${v?.date||new Date().toISOString().slice(0,10)}">
 <label>Hora (opcional)</label><input id="vTime" type="time" value="${v?.time||""}">
 <label>Status</label><select id="vStatus">
   <option ${v?.status==="Planejado"?"selected":""}>Planejado</option>
   <option ${v?.status==="Gravado"?"selected":""}>Gravado</option>
   <option ${v?.status==="Publicado"?"selected":""}>Publicado</option>
 </select>
 <label>Observações</label><textarea id="vDesc" placeholder="Detalhes do vídeo">${esc(v?.desc||"")}</textarea>
 <div class="form-actions"><button class="secondary" onclick="closeModal()">Cancelar</button><button class="primary" onclick="saveVideo('${id||""}')">Salvar</button></div>`);
}
function saveVideo(id){
 const obj={title:vTitle.value.trim(),date:vDate.value,time:vTime.value,status:vStatus.value,desc:vDesc.value.trim()};
 if(!obj.title)return alert("Digite a ideia/título do vídeo.");
 if(id)Object.assign(data.videos.find(v=>v.id===id),obj);
 else data.videos.push({id:crypto.randomUUID(),...obj});
 closeModal();save();
}
function deleteVideo(id){if(confirm("Excluir este vídeo?")){data.videos=data.videos.filter(x=>x.id!==id);save();}}

function renderAll(){
 document.getElementById("countPlayers").textContent=data.players.length;
 document.getElementById("countIds").textContent=data.records.length;
 document.getElementById("countWarnings").textContent=data.warnings.length;
 document.getElementById("countVideos").textContent=data.videos.length;

 document.getElementById("playersList").innerHTML=data.players.length?data.players.map(p=>{
   const ws=data.warnings.filter(w=>w.playerId===p.id).length;
   return `<div class="item"><div><h3>${esc(p.name)}</h3><span class="tag">${ws} advertência(s)</span></div>
   <div class="actions"><button onclick="openWarningModal('${p.id}')">+ Advertência</button><button onclick="openPlayerModal('${p.id}')">Editar</button><button class="danger" onclick="removePlayer('${p.id}')">Remover</button></div></div>`;
 }).join(""):`<div class="empty">Nenhum jogador cadastrado.</div>`;

 document.getElementById("recordsList").innerHTML=data.records.length?[...data.records].reverse().map(r=>
 `<div class="item"><div><h3>${esc(r.code||"Sem ID")} — ${esc(playerName(r.playerId))}</h3><span class="tag">${esc(r.type||"Registro")}</span><p>${esc(r.desc)}</p><small class="muted">${new Date(r.date).toLocaleString("pt-BR")}</small></div><div class="actions"><button class="danger" onclick="deleteRecord('${r.id}')">Excluir</button></div></div>`
 ).join(""):`<div class="empty">Nenhum registro ainda.</div>`;

 document.getElementById("warningsList").innerHTML=data.warnings.length?[...data.warnings].reverse().map(w=>
 `<div class="item warning"><div><h3>${esc(playerName(w.playerId))}</h3><strong>${esc(w.reason||"Advertência")}</strong><p>${esc(w.desc)}</p><small class="muted">${fmtDate(w.date)}</small></div><div class="actions"><button class="danger" onclick="deleteWarning('${w.id}')">Excluir</button></div></div>`
 ).join(""):`<div class="empty">Nenhuma advertência registrada.</div>`;

 document.getElementById("videosList").innerHTML=data.videos.length?[...data.videos].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).map(v=>{
   const past=v.status!=="Publicado" && new Date(v.date+"T"+(v.time||"23:59"))<new Date();
   return `<div class="item ${past?"overdue":""} ${v.status==="Publicado"?"done":""}"><div><h3>${esc(v.title)}</h3><span class="tag">${esc(v.status)}</span><p>${fmtDate(v.date)} ${v.time?"às "+v.time:""}</p><p>${esc(v.desc)}</p></div><div class="actions"><button onclick="openVideoModal('${v.id}')">Editar</button><button class="danger" onclick="deleteVideo('${v.id}')">Excluir</button></div></div>`
 }).join(""):`<div class="empty">Nenhum vídeo agendado.</div>`;
}

document.getElementById("exportBtn").onclick=()=>{
 const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="cimyfc-backup.json";a.click();URL.revokeObjectURL(a.href);
};
renderAll();
