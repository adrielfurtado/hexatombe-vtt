const firebaseConfig = {
    apiKey: "AIzaSyAs27oV6UfzQ6CjzBIM6pZ2Gwc1x1WdYg0",
    authDomain: "sheet-vtt.firebaseapp.com",
    databaseURL: "https://sheet-vtt-default-rtdb.firebaseio.com",
    projectId: "sheet-vtt",
    storageBucket: "sheet-vtt.firebasestorage.app",
    messagingSenderId: "875487470793",
    appId: "1:875487470793:web:48593f9b707d3e7899d918"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }

const auth = firebase.auth();
const db = firebase.database();

let mestreUID = null;
let idAgenteAtivo = null;
let abaAtivaMestre = 'habilidades';

auth.onAuthStateChanged((user) => {
    const loginScreen = document.getElementById('login-screen');
    const dashboardScreen = document.getElementById('dashboard-screen');
    const sheetScreen = document.getElementById('sheet-screen');
    const mainWrap = document.getElementById('main-wrap');

    if (user) {
        mestreUID = user.uid;
        document.getElementById('mestre-nome').innerText = user.displayName;
        if(user.photoURL) document.getElementById('mestre-foto').src = user.photoURL;

        loginScreen.classList.add('hidden');
        dashboardScreen.classList.remove('hidden');
        mainWrap.style.display = 'block';
        
        db.ref(`mestres/${mestreUID}/agentes`).off();
        
        initSoundtrack(mestreUID);
        initRolagens(mestreUID);
        
        escutarAgentesDoMestre();
    } else {
        mestreUID = null;
        loginScreen.classList.remove('hidden');
        dashboardScreen.classList.add('hidden');
        sheetScreen.classList.add('hidden');
        mainWrap.style.display = 'block';
        document.getElementById('agents-list').innerHTML = '';
    }
});

function loginComGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch((error) => console.error(error));
}

window.logout = function() { auth.signOut(); };

function escutarAgentesDoMestre() {
    const listaHtml = document.getElementById('agents-list');
    if (!listaHtml) return;

    db.ref(`mestres/${mestreUID}/agentes`).on('value', (snapshot) => {
        if (idAgenteAtivo) return; 

        listaHtml.innerHTML = '';
        if (!snapshot.exists()) {
            listaHtml.innerHTML = '<p style="color: #777; text-align: center;">Nenhum agente encontrado.</p>';
            return;
        }

        snapshot.forEach((childSnapshot) => {
            const idAgente = childSnapshot.key;
            const agente = childSnapshot.val();
            
            const cardAgente = document.createElement('div');
            cardAgente.className = 'agent-item';
            cardAgente.innerHTML = `
                <div class="agent-info" style="display: flex; align-items: center; gap: 15px; width: 65%; overflow: hidden;">
                    <img src="${agente.fotoSilhueta || 'assets/img/Zerai.png'}" alt="Foto" class="agent-mini-foto" style="flex-shrink: 0;">
                    <div style="overflow: hidden; width: 100%;">
                        <div class="agent-nome" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${agente.nome || 'AGENTE DESCONHECIDO'}</div>
                        <div class="agent-detalhes">
                            VIDA: ${agente.pv}/${agente.maxPv} | PD: ${agente.pd}/${agente.maxPd} 
                            <span style="color:${agente.fichaLiberada ? '#00ff00' : '#ff3333'}; font-weight:bold; margin-left:10px;">
                                [${agente.fichaLiberada ? 'REVELADA' : 'OCULTA'}]
                            </span>
                        </div>
                    </div>
                </div>
                <div class="agent-actions" style="flex-shrink: 0;">
                    <button class="btn-action edit" onclick="abrirFichaDoMestre('${idAgente}')">EDITAR</button>
                    <button class="btn-action delete" onclick="deletarAgente('${idAgente}')">EXCLUIR</button>
                </div>
            `;
            listaHtml.appendChild(cardAgente);
        });
    });
}

window.abrirFichaDoMestre = function(idAgente) {
    idAgenteAtivo = idAgente;
    document.getElementById('main-wrap').style.display = 'none'; 
    
    const sheetScreen = document.getElementById('sheet-screen');
    sheetScreen.classList.remove('hidden'); 

    db.ref(`mestres/${mestreUID}/agentes/${idAgente}`).on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const modalSenha = document.getElementById('mestre-senha-input');
        const modalEnigma = document.getElementById('mestre-enigma-input');
        const mRelatos = document.getElementById('mestre-relatos-input');
        const mNotas = document.getElementById('mestre-notas-input');
        const btnToggleTop = document.getElementById('btn-toggle-top');

        if (modalSenha && document.activeElement !== modalSenha) modalSenha.value = data.senha || '';
        if (modalEnigma && document.activeElement !== modalEnigma) modalEnigma.value = data.mensagemEnigma || '';
        if (mRelatos && document.activeElement !== mRelatos) mRelatos.value = data.relatos || '';
        if (mNotas && document.activeElement !== mNotas) mNotas.value = data.notasMarginais || '';

        if (btnToggleTop) {
            btnToggleTop.innerText = data.fichaLiberada ? 'FICHA REVELADA' : 'FICHA OCULTA';
            btnToggleTop.style.background = data.fichaLiberada ? '#00796b' : '#5a0000';
            btnToggleTop.style.borderColor = data.fichaLiberada ? '#00ff00' : '#ff0000';
            btnToggleTop.dataset.liberada = data.fichaLiberada;
        }

        const pvPercent = (data.pv / data.maxPv) * 100;
        const pdPercent = (data.pd / data.maxPd) * 100;
        const content = document.getElementById('sheet-content');

        const gerarCards = (categoria, bgColor) => {
            if (!data[categoria]) return '';
            const label = categoria === 'inventario' ? 'PESO' : 'PD';
            const textColor = bgColor === 'white-bg' ? '#666' : '#fff';

        return Object.keys(data[categoria]).map(key => {
            const item = data[categoria][key];
            const matchCusto = String(item.custo).match(/\d+/);
            const numCusto = matchCusto ? parseInt(matchCusto[0]) : 0;

                return `
                    <div class="skill-card-new ${bgColor}">
                        <img src="assets/img/trash.png" class="delete-card-btn" onclick="removerItemCard('${categoria}', '${key}')" style="top: 15px; right: 15px;">
                        
                        <div class="skill-header-new" style="padding-right: 35px;">
                            <span contenteditable="true" onblur="salvarItemCard('${categoria}', '${key}', 'nome', this.innerText)">${item.nome}</span>
                            
                            <span class="skill-cost-container" style="display:flex; align-items:center; gap:8px;">
                                <input type="number" class="line-input" value="${numCusto}" onchange="mudarCustoMestre('${categoria}', '${key}', this.value)" style="color: ${textColor}; border-bottom-color: ${textColor}; width: 40px;">
                                <span style="font-size: 0.95rem; color: ${textColor}; font-weight: bold;">${label}</span>
                            </span>
                        </div>
                        <p class="skill-desc-new" contenteditable="true" onblur="salvarItemCard('${categoria}', '${key}', 'desc', this.innerText)">${item.desc}</p>
                    </div>
                `;
            }).join('');
        };

        const htmlHabilidades = gerarCards('habilidades', 'white-bg');
        const htmlRituais = gerarCards('rituais', 'red-bg');
        const htmlInventario = gerarCards('inventario', 'white-bg');

        content.innerHTML = `
            <style>
                .pericias-scroll::-webkit-scrollbar { width: 6px; }
                .pericias-scroll::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.15); border-radius: 4px; }
                .pericias-scroll::-webkit-scrollbar-thumb { background: var(--blood-red); border-radius: 4px; border: 1px solid #000; }
                .pericias-scroll::-webkit-scrollbar-thumb:hover { background: var(--highlight-red); }
            </style>

            <div class="new-sheet-layout master-layout">
                <div class="column-left">
                    <!-- MARGEM AJUSTADA PARA DESCER AS PERÍCIAS (margin-top: 60px) -->
                    <div class="pericias-box" style="display: flex; flex-direction: column; flex-grow: 1; max-height: 48vh; margin-top: 60px;">
                        <h3 class="box-title" style="position: relative;">
                            PERICIAS
                            <img src="assets/img/mais.png" class="add-icon" onclick="adicionarPericia()" style="position: absolute; right: 0px; top: 50%; transform: translateY(-50%); width: 24px; cursor: pointer;">
                        </h3>
                        
                        <div class="pericias-header" style="display: flex; align-items: center; border-bottom: 1px solid rgba(139, 0, 0, 0.4); padding-bottom: 5px; margin-bottom: 10px;">
                            <span style="width: 25px; flex-shrink: 0;"></span>
                            <span class="p-head-name" style="flex: 1; text-align: left; font-weight: bold; color: #8b0000; font-size: 0.9rem;">NOME</span>
                            <div class="p-head-vals" style="display: flex; gap: 10px; width: 100px; justify-content: flex-end;">
                                <span class="p-head-val" style="width: 45px; text-align: center; font-weight: bold; color: #8b0000; font-size: 0.9rem;">TRN</span>
                                <span class="p-head-val" style="width: 45px; text-align: center; font-weight: bold; color: #8b0000; font-size: 0.9rem;">BÔN</span>
                            </div>
                        </div>
                        
                        <ul class="pericias-list pericias-scroll" style="flex-grow: 1; overflow-y: auto; overflow-x: hidden; padding-right: 5px; margin: 0; list-style: none;">
                            ${data.pericias ? Object.keys(data.pericias).map(key => {
                                const p = data.pericias[key];
                                return `
                                    <li style="display: flex; align-items: center; margin-bottom: 8px; border-bottom: 1px dashed rgba(255, 255, 255, 0.1); padding-bottom: 4px;">
                                        <span style="color:#ff3333; cursor:pointer; font-weight:bold; font-size:1.3rem; width: 25px; text-align: left; flex-shrink: 0;" onclick="removerPericia('${key}')">×</span>
                                        <span class="p-name" contenteditable="true" onblur="salvarPericia('${key}', 'nome', this.innerText)" style="font-size: 0.75rem; flex: 1;">${p.nome}</span> 
                                        <div class="p-val-container" style="display: flex; gap: 10px; width: 100px; justify-content: flex-end;">
                                            <input type="text" class="p-val" value="${p.trn}" onchange="salvarPericia('${key}', 'trn', this.value)">
                                            <input type="text" class="p-val" value="${p.bon}" onchange="salvarPericia('${key}', 'bon', this.value)">
                                        </div>
                                    </li>
                                `;
                            }).join('') : ''}
                        </ul>
                    </div>

                    <div class="attributes-pentagon">
                        <div class="attr agi"><input type="number" class="attr-input" value="${data.atributos.AGI}" onchange="salvarCampo('atributos/AGI', parseInt(this.value))"><span class="attr-label">AGI</span></div>
                        <div class="attr for"><input type="number" class="attr-input" value="${data.atributos.FOR}" onchange="salvarCampo('atributos/FOR', parseInt(this.value))"><span class="attr-label">FOR</span></div>
                        <div class="attr int"><input type="number" class="attr-input" value="${data.atributos.INT}" onchange="salvarCampo('atributos/INT', parseInt(this.value))"><span class="attr-label">INT</span></div>
                        <div class="attr vig"><input type="number" class="attr-input" value="${data.atributos.VIG}" onchange="salvarCampo('atributos/VIG', parseInt(this.value))"><span class="attr-label">VIG</span></div>
                        <div class="attr pre"><input type="number" class="attr-input" value="${data.atributos.PRE}" onchange="salvarCampo('atributos/PRE', parseInt(this.value))"><span class="attr-label">PRE</span></div>
                    </div> 
                </div> 

                <div class="column-middle">
                    
                    <h1 class="character-name-center" style="color: #8b0000; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); font-size: 3rem; line-height: 0.9; margin-top: 0px; margin-bottom: 10px; width: 100%; text-align: right; padding-right: 20px;" contenteditable="true" onblur="salvarCampo('nome', this.innerText)">${data.nome}</h1>
                    
                    <div style="width: 100%; display: flex; flex-direction: column; align-items: flex-start; margin-top: 0;">
                        
                        <div style="width: 100%; text-align: left; margin-bottom: 5px; font-family: 'Medieval', serif; font-size: 1.1rem; color: #ffc107; letter-spacing: 2px; padding-left: 5px;">
                            <div id="info-mestre-habilidades" style="display: none;">
                                LIMITE DE PD/TURNO: <input type="number" class="line-input" value="${data.limitePD || 0}" onchange="salvarCampo('limitePD', parseInt(this.value))" style="color:#fff; border-bottom-color:#ffc107;">
                            </div>
                            <div id="info-mestre-rituais" style="display: none;">
                                DT DOS RITUAIS: <input type="number" class="line-input" value="${data.dtRituais || 0}" onchange="salvarCampo('dtRituais', parseInt(this.value))" style="color:#fff; border-bottom-color:#ffc107;">
                            </div>
                            <div id="info-mestre-inventario" style="display: none;">
                                PESO: <input type="number" class="line-input" value="${data.pesoAtual || 0}" onchange="salvarCampo('pesoAtual', parseInt(this.value))" style="color:#fff; border-bottom-color:#ffc107;"> / MÁX: <input type="number" class="line-input" value="${data.pesoMaximo || 10}" onchange="salvarCampo('pesoMaximo', parseInt(this.value))" style="color:#fff; border-bottom-color:#ffc107;">
                            </div>
                        </div>

                        <div style="display:flex; gap:20px; margin-bottom:5px; font-weight:bold; font-size:1.1rem; padding-left: 5px;">
                            <span id="nav-habilidades" onclick="mudarAbaMestre('habilidades')" style="cursor:pointer; color:#888;">HABILIDADES</span>
                            <span id="nav-rituais" onclick="mudarAbaMestre('rituais')" style="cursor:pointer; color:#888;">RITUAIS</span>
                            <span id="nav-inventario" onclick="mudarAbaMestre('inventario')" style="cursor:pointer; color:#888;">INVENTÁRIO</span>
                        </div>

                        <div class="center-square-carousel pericias-scroll" style="width: 100%; height: 62vh; min-height: 450px; overflow-y: auto; overflow-x: hidden; padding-bottom: 20px; padding-right: 5px;">
                            <div id="tab-mestre-habilidades" class="tab-content" style="display:none; position:relative;">
                                <div class="skills-stack">${htmlHabilidades}</div>
                                <div class="add-btn-container"><img src="assets/img/mais.png" class="add-icon" onclick="adicionarNovoCard('habilidades')"></div>
                            </div>

                            <div id="tab-mestre-rituais" class="tab-content" style="display:none; position:relative;">
                                <div class="skills-stack">${htmlRituais}</div>
                                <div class="add-btn-container"><img src="assets/img/mais.png" class="add-icon" onclick="adicionarNovoCard('rituais')"></div>
                            </div>

                            <div id="tab-mestre-inventario" class="tab-content" style="display:none; position:relative;">
                                <div class="skills-stack">${htmlInventario}</div>
                                <div class="add-btn-container"><img src="assets/img/mais.png" class="add-icon" onclick="adicionarNovoCard('inventario')"></div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- ÍCONE DE ANOTAÇÕES MESTRE AQUI NO RODAPÉ CENTRAL -->
                    <div class="icons-wrapper" style="align-self: flex-end; margin-top: 10px; display: flex; gap: 20px; cursor: pointer; padding-right: 5px;">
                        <img src="assets/img/escrita.png" alt="Anotações" class="notes-icon" onclick="abrirNotasMestre()" title="Visualizar Anotações">
                    </div>

                </div>

                <div class="column-right">
                    <div class="portrait-container">
                        <div style="position: absolute; top: 10px; right: 10px; display: flex; flex-direction: column; gap: 5px; z-index: 10; pointer-events: auto;">
                            <button onclick="alterarImagem('fotoSilhueta')" style="background: rgba(0,0,0,0.8); color: #ccc; border: 1px solid #555; padding: 5px 10px; cursor: pointer; font-family: inherit; font-size: 0.8rem; transition: 0.3s;">SILHUETA</button>
                            <button onclick="alterarImagem('fotoPortrait')" style="background: rgba(0,0,0,0.8); color: #ffc107; border: 1px solid #ffc107; padding: 5px 10px; cursor: pointer; font-family: inherit; font-size: 0.8rem; transition: 0.3s;">PORTRAIT</button>
                        </div>
                        <img src="${data.fotoPortrait || 'assets/img/alan3x4.png'}" class="character-full-portrait" alt="${data.nome}">
                    </div>
                    
                    <div class="status-bars-container">
                        <div class="resource-section">
                            <div class="resource-label">VIDA</div>
                            <div class="resource-bar-container">
                                <div class="resource-fill pv-fill" style="width: ${pvPercent}%;"></div>
                                <div class="resource-content">
                                    <div class="controls-left"><span onclick="alterarStatus('pv', -10)">&laquo;</span><span onclick="alterarStatus('pv', -1)">&lsaquo;</span></div>
                                    <!-- Para a Vida (PV) -->
                                    <div class="resource-text">
                                        <span contenteditable="true" onblur="salvarCampo('pv', parseInt(this.innerText) || 0)">${data.pv}</span> / 
                                        <span contenteditable="true" onblur="salvarCampo('maxPv', parseInt(this.innerText) || 0)">${data.maxPv}</span>
                                    </div>
                                    <div class="controls-right"><span onclick="alterarStatus('pv', 1)">&rsaquo;</span><span onclick="alterarStatus('pv', 10)">&raquo;</span></div>
                                </div>
                            </div>
                        </div>

                        <div class="resource-section">
                            <div class="resource-label">DETERMINACAO</div>
                            <div class="resource-bar-container">
                                <div class="resource-fill pd-fill" style="width: ${pdPercent}%;"></div>
                                <div class="resource-content">
                                    <div class="controls-left"><span onclick="alterarStatus('pd', -10)">&laquo;</span><span onclick="alterarStatus('pd', -1)">&lsaquo;</span></div>
                                    <!-- Para a Determinação (PD) -->
                                    <div class="resource-text">
                                        <span contenteditable="true" onblur="salvarCampo('pd', parseInt(this.innerText) || 0)">${data.pd}</span> / 
                                        <span contenteditable="true" onblur="salvarCampo('maxPd', parseInt(this.innerText) || 0)">${data.maxPd}</span>
                                    </div>
                                    <div class="controls-right"><span onclick="alterarStatus('pd', 1)">&rsaquo;</span><span onclick="alterarStatus('pd', 10)">&raquo;</span></div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="defense-box">
                            <img src="assets/img/escudo.png" alt="Defesa" class="defense-icon">
                            <span class="defense-value" contenteditable="true" onblur="salvarCampo('defesa', parseInt(this.innerText))">${data.defesa}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        mudarAbaMestre(abaAtivaMestre);
    });
};

window.fecharFichaDoMestre = function() {
    if (idAgenteAtivo) {
        db.ref(`mestres/${mestreUID}/agentes/${idAgenteAtivo}`).off();
        idAgenteAtivo = null;
    }
    
    document.getElementById('sheet-screen').classList.add('hidden');
    document.getElementById('main-wrap').style.display = 'block'; 
    escutarAgentesDoMestre();
};

window.abrirModalEnigma = function() {
    if (!idAgenteAtivo) return;
    document.getElementById('enigma-modal').classList.add('active');
};

window.fecharModalEnigma = function() {
    document.getElementById('enigma-modal').classList.remove('active');
};

window.abrirNotasMestre = function() {
    if(!idAgenteAtivo) return;
    document.getElementById('notes-modal').classList.remove('modal-hidden');
};
window.closeNotes = function() {
    document.getElementById('notes-modal').classList.add('modal-hidden');
};

window.salvarCampoModal = function(campo, valor) {
    if (!idAgenteAtivo) return;
    db.ref(`mestres/${mestreUID}/agentes/${idAgenteAtivo}/${campo}`).set(valor);
};

window.toggleFichaLiberada = function() {
    if (!idAgenteAtivo) return;
    const btn = document.getElementById('btn-toggle-top');
    const estadoAtual = btn.dataset.liberada === 'true';
    db.ref(`mestres/${mestreUID}/agentes/${idAgenteAtivo}/fichaLiberada`).set(!estadoAtual);
};

window.salvarCampo = function(caminho, valor) {
    if (!idAgenteAtivo) return;
    db.ref(`mestres/${mestreUID}/agentes/${idAgenteAtivo}/${caminho}`).set(valor);
};

window.mudarCustoMestre = function(categoria, key, valor) {
    if (!idAgenteAtivo) return;
    const formato = categoria === 'inventario' ? `PESO: ${valor}` : `${valor} PD`;
    db.ref(`mestres/${mestreUID}/agentes/${idAgenteAtivo}/${categoria}/${key}/custo`).set(formato);
};

window.alterarImagem = function(tipo) {
    if (!idAgenteAtivo) return;
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/png, image/jpeg, image/jpg';

    fileInput.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = event => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 800; 
                let width = img.width;
                let height = img.height;

                if (width > height && width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                } else if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const base64String = canvas.toDataURL('image/png');
                db.ref(`mestres/${mestreUID}/agentes/${idAgenteAtivo}/${tipo}`).set(base64String);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    fileInput.click(); 
};

window.salvarPericia = function(key, subcampo, valor) {
    if (!idAgenteAtivo) return;
    db.ref(`mestres/${mestreUID}/agentes/${idAgenteAtivo}/pericias/${key}/${subcampo}`).set(valor);
};

window.adicionarPericia = function() {
    if (!idAgenteAtivo) return;
    db.ref(`mestres/${mestreUID}/agentes/${idAgenteAtivo}/pericias`).push().set({
        nome: "NOVA PERÍCIA",
        trn: "+0",
        bon: "+0"
    });
};

window.removerPericia = function(key) {
    if (!idAgenteAtivo) return;
    db.ref(`mestres/${mestreUID}/agentes/${idAgenteAtivo}/pericias/${key}`).remove();
};

window.alterarStatus = function(tipo, quantidade) {
    if (!idAgenteAtivo) return;
    const nodeRef = db.ref(`mestres/${mestreUID}/agentes/${idAgenteAtivo}`);
    nodeRef.once('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        let atual = data[tipo] + quantidade;
        let max = tipo === 'pv' ? data.maxPv : data.maxPd;
        if (atual > max) atual = max;
        if (atual < 0) atual = 0;
        nodeRef.child(tipo).set(atual);
    });
};

window.mudarAbaMestre = function(aba) {
    abaAtivaMestre = aba;
    const abas = ['habilidades', 'rituais', 'inventario'];
    abas.forEach(a => {
        const nav = document.getElementById('nav-' + a);
        const tab = document.getElementById('tab-mestre-' + a);
        const info = document.getElementById('info-mestre-' + a);

        if(nav && tab && info) {
            if(a === aba) {
                nav.style.color = '#ffc107';
                nav.style.borderBottom = '2px solid #ffc107';
                tab.style.display = 'block';
                info.style.display = 'block';
            } else {
                nav.style.color = '#888';
                nav.style.borderBottom = 'none';
                tab.style.display = 'none';
                info.style.display = 'none';
            }
        }
    });
};

window.adicionarNovoCard = function(categoria) {
    if (!idAgenteAtivo) return;
    const novoItem = {
        nome: "NOVO ITEM",
        custo: categoria === 'inventario' ? "PESO: 0" : "0 PD", 
        desc: "Clique aqui para editar a descricao..."
    };
    db.ref(`mestres/${mestreUID}/agentes/${idAgenteAtivo}/${categoria}`).push().set(novoItem);
};

window.salvarItemCard = function(categoria, key, campo, valor) {
    if (!idAgenteAtivo) return;
    db.ref(`mestres/${mestreUID}/agentes/${idAgenteAtivo}/${categoria}/${key}/${campo}`).set(valor);
};

window.removerItemCard = function(categoria, key) {
    if (!idAgenteAtivo) return;
    db.ref(`mestres/${mestreUID}/agentes/${idAgenteAtivo}/${categoria}/${key}`).remove();
};

window.gerarFichaEmBranco = function() {
    if (!mestreUID) return;
    const statusMsg = document.getElementById('status-msg');
    statusMsg.innerText = "Criando agente na nuvem...";

    const novaFicha = {
        nome: "AGENTE DESCONHECIDO",
        fotoSilhueta: "assets/img/Zerai.png", 
        fotoPortrait: "assets/img/alan3x4.png", 
        senha: "", 
        mensagemEnigma: "Insira a credencial para decodificar os arquivos confidenciais deste agente.",
        fichaLiberada: false, 
        pv: 20, maxPv: 20,
        pd: 20, maxPd: 20,
        defesa: 10,
        limitePD: 0,
        dtRituais: 0,
        pesoAtual: 0,
        pesoMaximo: 10,
        atributos: { FOR: 1, AGI: 1, INT: 1, VIG: 1, PRE: 1 },
        pericias: [
            { nome: "Luta (FOR)", trn: "+0", bon: "+0" },
            { nome: "Investigacao (INT)", trn: "+0", bon: "+0" },
            { nome: "Percepao (PRE)", trn: "+0", bon: "+0" }
        ]
    };

    db.ref(`mestres/${mestreUID}/agentes`).push().set(novaFicha)
        .then(() => {
            statusMsg.style.color = "#00ff00";
            statusMsg.innerText = "Ficha vazia criada com sucesso!";
            setTimeout(() => { statusMsg.innerText = ""; }, 2000);
        });
};

window.deletarAgente = function(idAgente) {
    if (confirm("Deseja deletar permanentemente este agente da nuvem?")) {
        db.ref(`mestres/${mestreUID}/agentes/${idAgente}`).remove();
    }
};