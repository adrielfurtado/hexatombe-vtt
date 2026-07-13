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

    if (user && !user.isAnonymous) {
        mestreUID = user.uid;
        document.getElementById('mestre-nome').innerText = user.displayName || 'Mestre';
        if(user.photoURL) document.getElementById('mestre-foto').src = user.photoURL;

        loginScreen.classList.add('hidden');
        dashboardScreen.classList.remove('hidden');
        mainWrap.style.display = 'block';
        
        db.ref(`mestres/${mestreUID}/agentes`).off();
        
        initSoundtrack(mestreUID);
        initRolagens(mestreUID);
        
        escutarAgentesDoMestre();

        db.ref(`mestres/${mestreUID}/notasGerais`).on('value', (snap) => {
            const notas = snap.val() || "";
            const textarea = document.getElementById('gm-global-notes-input');
            if (textarea && document.activeElement !== textarea) {
                textarea.value = notas;
            }
        });

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
            const pvPercent = agente.maxPv > 0 ? (agente.pv / agente.maxPv) * 100 : 0;
            const pdPercent = agente.maxPd > 0 ? (agente.pd / agente.maxPd) * 100 : 0;

            cardAgente.innerHTML = `
                <div class="agent-info" style="display: flex; align-items: center; gap: 15px; width: 65%; overflow: hidden;">
                    <img src="${agente.fotoSilhueta || 'assets/img/Zerai.png'}" alt="Foto" class="agent-mini-foto" style="flex-shrink: 0;">
                    <div style="overflow: hidden; width: 100%;">
                        <div class="agent-nome" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${agente.nome || 'AGENTE DESCONHECIDO'}</div>
                        
                        <div class="agent-detalhes" style="display: flex; gap: 10px; margin-top: 5px; align-items: center; flex-wrap: wrap;">
                            <div style="background: rgba(0,0,0,0.8); border: 1px solid #4a0000; border-radius: 4px; padding: 2px 8px; width: 140px; position: relative; overflow: hidden;">
                                <div style="position: absolute; top: 0; left: 0; height: 100%; width: ${pvPercent}%; background: #b02323; z-index: 1; transition: width 0.3s;"></div>
                                <span style="position: relative; z-index: 2; color: #fff; font-weight: bold; font-size: 0.85rem; text-shadow: 1px 1px 2px #000;">PV: ${agente.pv} / ${agente.maxPv}</span>
                            </div>
                            <div style="background: rgba(0,0,0,0.8); border: 1px solid #00364d; border-radius: 4px; padding: 2px 8px; width: 140px; position: relative; overflow: hidden;">
                                <div style="position: absolute; top: 0; left: 0; height: 100%; width: ${pdPercent}%; background: #0b7a94; z-index: 1; transition: width 0.3s;"></div>
                                <span style="position: relative; z-index: 2; color: #fff; font-weight: bold; font-size: 0.85rem; text-shadow: 1px 1px 2px #000;">PD: ${agente.pd} / ${agente.maxPd}</span>
                            </div>
                            <span style="color:${agente.fichaLiberada ? '#00ff00' : '#ff3333'}; font-weight:bold; font-size: 0.8rem; margin-left: 5px;">
                                [${agente.fichaLiberada ? 'REVELADA' : 'OCULTA'}]
                            </span>
                        </div>
                    </div>
                </div>
                <div class="agent-actions" style="flex-shrink: 0;">
                    <button class="btn-action edit" onclick="abrirFichaDoMestre('${idAgente}')">VER FICHA</button>
                    <button class="btn-action delete" onclick="deletarAgente('${idAgente}')">X</button>
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
        
        const isVideoPortrait = data.fotoPortrait && (data.fotoPortrait.includes('.mp4') || data.fotoPortrait.includes('.webm'));
        const portraitHTML = isVideoPortrait 
            ? `<video src="${data.fotoPortrait}" class="character-full-portrait" autoplay loop muted playsinline></video>`
            : `<img src="${data.fotoPortrait || 'assets/img/alan3x4.png'}" class="character-full-portrait" alt="${data.nome}">`;

        const gerarCards = (categoria, bgColor) => {
            if (!data[categoria]) return '';
            const label = categoria === 'inventario' ? 'PESO' : 'PD';
            const textColor = bgColor === 'white-bg' ? '#666' : '#fff';

            return Object.keys(data[categoria]).map(key => {
                const item = data[categoria][key];

                let numCusto = 0;
                if (item.custo) {
                    const extraido = String(item.custo).replace(/\D/g, ''); 
                    if (extraido !== '') {
                        numCusto = parseInt(extraido);
                    }
                }

                return `
                    <div class="skill-card-new ${bgColor}">
                        <img src="assets/img/trash.png" class="delete-card-btn" onclick="removerItemCard('${categoria}', '${key}')" style="top: 15px; right: 15px;">
                
                        <div class="skill-header-new" style="padding-right: 35px;">
                            <span contenteditable="true" onblur="salvarItemCard('${categoria}', '${key}', 'nome', this.innerText)">${item.nome}</span>
                    
                            <span class="skill-cost-container" style="display:flex; align-items:center; gap:8px;">
                                <input type="number" class="line-input" value="${numCusto}" onchange="mudarCustoMestre('${categoria}', '${key}', this.value)" style="color: ${textColor}; border-bottom-color: ${textColor}; width: 40px; text-align: center;">
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
                    
                    <div class="icons-wrapper" style="align-self: flex-end; margin-top: 10px; display: flex; gap: 20px; cursor: pointer; padding-right: 5px;">
                        <img src="assets/img/escrita.png" alt="Anotações" class="notes-icon" onclick="abrirNotasMestre()" title="Visualizar Anotações">
                    </div>

                </div>

                <div class="column-right">
                    <div class="portrait-container">
                        <div style="position: absolute; top: 10px; right: 10px; display: flex; flex-direction: column; gap: 5px; z-index: 10; pointer-events: auto;">
                            <button onclick="abrirMediaModal('fotoSilhueta')" style="background: rgba(0,0,0,0.8); color: #ccc; border: 1px solid #555; padding: 5px 10px; cursor: pointer; font-family: inherit; font-size: 0.8rem; transition: 0.3s;">SILHUETA</button>
                            <button onclick="abrirMediaModal('fotoPortrait')" style="background: rgba(0,0,0,0.8); color: #ffc107; border: 1px solid #ffc107; padding: 5px 10px; cursor: pointer; font-family: inherit; font-size: 0.8rem; transition: 0.3s;">PORTRAIT</button>
                        </div>
                        ${portraitHTML}
                    </div>
                    
                    <div class="status-bars-container">
                        <div class="resource-section">
                            <div class="resource-label">VIDA</div>
                            <div class="resource-bar-container">
                                <div class="resource-fill pv-fill" style="width: ${pvPercent}%;"></div>
                                <div class="resource-content">
                                    <div class="controls-left"><span onclick="alterarStatus('pv', -5)">&laquo;</span><span onclick="alterarStatus('pv', -1)">&lsaquo;</span></div>
                                    <div class="resource-text">
                                        <span contenteditable="true" onblur="salvarCampo('pv', parseInt(this.innerText) || 0)">${data.pv}</span> / 
                                        <span contenteditable="true" onblur="salvarCampo('maxPv', parseInt(this.innerText) || 0)">${data.maxPv}</span>
                                    </div>
                                    <div class="controls-right"><span onclick="alterarStatus('pv', 1)">&rsaquo;</span><span onclick="alterarStatus('pv', 5)">&raquo;</span></div>
                                </div>
                            </div>
                        </div>

                        <div class="resource-section">
                            <div class="resource-label">DETERMINACAO</div>
                            <div class="resource-bar-container">
                                <div class="resource-fill pd-fill" style="width: ${pdPercent}%;"></div>
                                <div class="resource-content">
                                    <div class="controls-left"><span onclick="alterarStatus('pd', -5)">&laquo;</span><span onclick="alterarStatus('pd', -1)">&lsaquo;</span></div>
                                    <div class="resource-text">
                                        <span contenteditable="true" onblur="salvarCampo('pd', parseInt(this.innerText) || 0)">${data.pd}</span> / 
                                        <span contenteditable="true" onblur="salvarCampo('maxPd', parseInt(this.innerText) || 0)">${data.maxPd}</span>
                                    </div>
                                    <div class="controls-right"><span onclick="alterarStatus('pd', 1)">&rsaquo;</span><span onclick="alterarStatus('pd', 5)">&raquo;</span></div>
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

let tipoMediaAtiva = null;

window.abrirMediaModal = function(tipo) {
    if (!idAgenteAtivo) return;
    tipoMediaAtiva = tipo;
    document.getElementById('media-buttons-view').style.display = 'block';
    document.getElementById('media-link-view').style.display = 'none';
    document.getElementById('media-link-input').value = '';
    document.getElementById('media-modal').classList.add('active');
};

window.fecharMediaModal = function() {
    document.getElementById('media-modal').classList.remove('active');
    tipoMediaAtiva = null;
};

window.uploadMediaPC = function() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/png, image/jpeg, image/jpg, image/gif';

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
                db.ref(`mestres/${mestreUID}/agentes/${idAgenteAtivo}/${tipoMediaAtiva}`).set(base64String);
                fecharMediaModal();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };
    fileInput.click(); 
};

window.showMediaLinkInput = function() {
    document.getElementById('media-buttons-view').style.display = 'none';
    document.getElementById('media-link-view').style.display = 'block';
};

window.salvarMediaLink = function() {
    const urlAnimada = document.getElementById('media-link-input').value;
    if (urlAnimada && urlAnimada.trim() !== "") {
        db.ref(`mestres/${mestreUID}/agentes/${idAgenteAtivo}/${tipoMediaAtiva}`).set(urlAnimada.trim());
        fecharMediaModal();
    } else {
        alert("Insira um link válido.");
    }
};

window.abrirConfigDespertar = function() {
    if (!idAgenteAtivo) return;
    
    db.ref(`mestres/${mestreUID}/agentes`).once('value', snapshot => {
        const data = snapshot.val();
        if(!data) return;
        
        const select = document.getElementById('mestre-despertar-target');
        select.innerHTML = '<option value="">-- Selecione a Ficha Despertada --</option>';
        
        Object.keys(data).forEach(key => {
            if (key !== idAgenteAtivo) {
                select.innerHTML += `<option value="${key}">${data[key].nome} ${data[key].esconderDoCarrossel ? '(Oculta)' : ''}</option>`;
            }
        });

        const currentData = data[idAgenteAtivo];
        document.getElementById('mestre-despertar-enigma').value = currentData.despertarEnigma || '';
        document.getElementById('mestre-despertar-senha').value = currentData.despertarSenha || '';
        document.getElementById('mestre-despertar-target').value = currentData.despertarTargetId || '';
        
        document.getElementById('modal-despertar-mestre').classList.add('active');
    });
};

window.fecharConfigDespertar = function() {
    document.getElementById('modal-despertar-mestre').classList.remove('active');
};

window.salvarConfigDespertar = function() {
    const enigma = document.getElementById('mestre-despertar-enigma').value;
    const senha = document.getElementById('mestre-despertar-senha').value;
    const targetId = document.getElementById('mestre-despertar-target').value;
    
    if (!targetId || !senha) {
        alert("Você precisa selecionar uma ficha alvo e definir uma senha!");
        return;
    }

    db.ref(`mestres/${mestreUID}/agentes/${idAgenteAtivo}`).update({
        despertarEnigma: enigma,
        despertarSenha: senha,
        despertarTargetId: targetId
    });

    db.ref(`mestres/${mestreUID}/agentes/${targetId}`).update({
        esconderDoCarrossel: true,
        isDespertada: true 
    });
    
    alert("Mecânica de Despertar ativada! A ficha verdadeira foi escondida dos jogadores até que a senha seja descoberta.");
    fecharConfigDespertar();
};

window.reverterDespertar = function() {
    if (!idAgenteAtivo) return;
    
    if (confirm("Tem certeza que deseja remover as tags de Despertar e revelar esta ficha (e seu alvo) novamente no carrossel?")) {
        db.ref(`mestres/${mestreUID}/agentes/${idAgenteAtivo}`).once('value', snap => {
            const data = snap.val();

            if (data.despertarTargetId) {
                db.ref(`mestres/${mestreUID}/agentes/${data.despertarTargetId}`).update({
                    esconderDoCarrossel: false,
                    isDespertada: null
                });
            }

            db.ref(`mestres/${mestreUID}/agentes/${idAgenteAtivo}`).update({
                despertarEnigma: null,
                despertarSenha: null,
                despertarTargetId: null,
                esconderDoCarrossel: false,
                isDespertada: null
            });
            
            alert("Feitiço quebrado! A ficha voltou ao normal e está visível no carrossel.");
            fecharConfigDespertar();
        });
    }
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
    const numero = parseInt(valor) || 0;
    const formato = categoria === 'inventario' ? `PESO: ${numero}` : `${numero} PD`;
    db.ref(`mestres/${mestreUID}/agentes/${idAgenteAtivo}/${categoria}/${key}/custo`).set(formato);
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
        desc: "CLIQUE AQUI PARA EDITAR A DESCRICAO..."
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
            { nome: "Luta (FOR)", trn: "+0", bon: "+0" }
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

window.abrirMenuDadosMestre = function(aba = 'teste') {
    const widget = document.getElementById('floating-gm-dice-widget');
    const content = document.getElementById('floating-gm-dice-content');

    if (!document.getElementById('gm-dice-styles')) {
        let style = document.createElement('style');
        style.id = 'gm-dice-styles';
        style.innerHTML = `
            .mod-btn { background: #222; border: 1px solid #444; color: white; padding: 5px 12px; font-size: 1.2rem; border-radius: 4px; cursor: pointer; transition: 0.2s; font-weight: bold; }
            .mod-btn:hover { background: var(--blood-red); border-color: var(--highlight-red); }
            .mod-input::-webkit-outer-spin-button, .mod-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
            .mod-input { -moz-appearance: textfield; background: #000; border: 2px solid var(--highlight-red); color: white; font-size: 1.2rem; width: 45px; text-align: center; border-radius: 5px; outline: none; font-weight: bold; font-family: 'Medieval', serif; }
            .btn-lancar { margin-top: 15px; background: var(--blood-red); border: 1px solid var(--highlight-red); color: white; font-family: 'Medieval', serif; font-size: 1.2rem; padding: 12px; cursor: pointer; border-radius: 4px; transition: 0.3s; width: 100%; letter-spacing: 1px; }
            .btn-lancar:hover { box-shadow: 0 0 15px var(--highlight-red); background: #a00000; }
            .setup-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; background: rgba(0,0,0,0.5); padding: 10px; border-radius: 6px; border: 1px solid #333; }
            .setup-label { color: #ccc; font-size: 0.9rem; font-family: sans-serif; text-align: left; font-weight: bold; }
            .tab-btn-dice { flex: 1; padding: 10px; font-family: 'Medieval', serif; font-size: 1.1rem; border: none; cursor: pointer; transition: 0.3s; }
            @keyframes rollDiceMini { 0% { transform: scale(0.2) rotate(0deg); opacity: 0; } 50% { transform: scale(1.1) rotate(180deg); opacity: 1; } 100% { transform: scale(0.8) rotate(360deg); opacity: 1; } }
            @keyframes popUpMini { 0% { transform: translateY(15px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        `;
        document.head.appendChild(style);
    }
    
    let htmlAba = '';
    if (aba === 'teste') {
        htmlAba = `
            <div class="setup-row">
                <div class="setup-label">DADOS (D20)</div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="mod-btn" onclick="let v=parseInt(document.getElementById('gm-qtd-dados').value||1); if(v>0) document.getElementById('gm-qtd-dados').value = v-1">-</button>
                    <input type="number" id="gm-qtd-dados" value="1" min="0" class="mod-input">
                    <button class="mod-btn" onclick="document.getElementById('gm-qtd-dados').value = parseInt(document.getElementById('gm-qtd-dados').value||1) + 1">+</button>
                </div>
            </div>
            <div class="setup-row">
                <div class="setup-label">BÔNUS</div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="mod-btn" onclick="document.getElementById('gm-bonus-teste').value = parseInt(document.getElementById('gm-bonus-teste').value||0) - 1">-</button>
                    <input type="number" id="gm-bonus-teste" value="0" class="mod-input">
                    <button class="mod-btn" onclick="document.getElementById('gm-bonus-teste').value = parseInt(document.getElementById('gm-bonus-teste').value||0) + 1">+</button>
                </div>
            </div>
            <button class="btn-lancar" onclick="iniciarAnimacaoDadoMestre('teste')">ROLAR DADOS</button>
        `;
    } else {
        htmlAba = `
            <div class="setup-row">
                <div class="setup-label">QTD. DADOS</div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="mod-btn" onclick="let v=parseInt(document.getElementById('gm-qtd-dano').value||1); if(v>1) document.getElementById('gm-qtd-dano').value = v-1">-</button>
                    <input type="number" id="gm-qtd-dano" value="1" min="1" class="mod-input">
                    <button class="mod-btn" onclick="document.getElementById('gm-qtd-dano').value = parseInt(document.getElementById('gm-qtd-dano').value||1) + 1">+</button>
                </div>
            </div>
            <div class="setup-row">
                <div class="setup-label">FACES</div>
                <select id="gm-tipo-dano" class="mod-input" style="width: 65px; padding: 5px; cursor: pointer; text-align-last: center; -webkit-appearance: none; -moz-appearance: none; appearance: none;">
                    <option value="4">D4</option>
                    <option value="6" selected>D6</option>
                    <option value="8">D8</option>
                    <option value="10">D10</option>
                    <option value="12">D12</option>
                    <option value="20">D20</option>
                    <option value="100">D100</option>
                </select>
            </div>
            <div class="setup-row">
                <div class="setup-label">BÔNUS</div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="mod-btn" onclick="document.getElementById('gm-bonus-dano').value = parseInt(document.getElementById('gm-bonus-dano').value||0) - 1">-</button>
                    <input type="number" id="gm-bonus-dano" value="0" class="mod-input">
                    <button class="mod-btn" onclick="document.getElementById('gm-bonus-dano').value = parseInt(document.getElementById('gm-bonus-dano').value||0) + 1">+</button>
                </div>
            </div>
            <button class="btn-lancar" onclick="iniciarAnimacaoDadoMestre('dano')">ROLAR DANO</button>
        `;
    }

    content.innerHTML = `
        <div style="display: flex; margin-bottom: 15px; border-radius: 6px; overflow: hidden; border: 1px solid #444;">
            <button class="tab-btn-dice" onclick="abrirMenuDadosMestre('teste')" style="background: ${aba === 'teste' ? '#5a0000' : '#222'}; color: ${aba === 'teste' ? '#ffc107' : '#888'};">TESTE</button>
            <button class="tab-btn-dice" onclick="abrirMenuDadosMestre('dano')" style="background: ${aba === 'dano' ? '#5a0000' : '#222'}; color: ${aba === 'dano' ? '#ffc107' : '#888'};">ROLAR DANO</button>
        </div>
        <div style="text-align: center;">
            ${htmlAba}
        </div>
    `;
    widget.style.display = 'flex';
    if(typeof tornarHistoricoArrastavel === "function") tornarHistoricoArrastavel(widget);
};

window.fecharJanelaDadosMestre = function() {
    document.getElementById('floating-gm-dice-widget').style.display = 'none';
};

window.iniciarAnimacaoDadoMestre = function(tipo) {
    let qtd = 1, bonus = 0, faces = 20, rolandoZero = false;
    
    if (tipo === 'teste') {
        let qtdOriginal = parseInt(document.getElementById('gm-qtd-dados').value) || 0;
        bonus = parseInt(document.getElementById('gm-bonus-teste').value) || 0;
        if (qtdOriginal <= 0) { rolandoZero = true; qtd = 2; } else { qtd = qtdOriginal; }
    } else {
        qtd = parseInt(document.getElementById('gm-qtd-dano').value) || 1;
        if(qtd <= 0) qtd = 1; 
        faces = parseInt(document.getElementById('gm-tipo-dano').value) || 6;
        bonus = parseInt(document.getElementById('gm-bonus-dano').value) || 0;
    }

    let diceSound = new Audio('assets/audio/dice.mp3');
    diceSound.volume = 0.2;
    diceSound.play().catch(e => console.log("Erro no audio: ", e));

    const content = document.getElementById('floating-gm-dice-content');
    let visualDiceCount = qtd > 8 ? 8 : qtd; 
    let redFilter = "filter: invert(16%) sepia(80%) saturate(7000%) hue-rotate(350deg) drop-shadow(0 0 10px rgba(255,0,0,0.8));";

    let diceHtml = '';
    for(let i=0; i<visualDiceCount; i++) {
        let delay = Math.random() * 0.2;
        diceHtml += `<img src="assets/img/d20.png" style="width: 50px; height: 50px; animation: rollDiceMini 1.2s ease-in-out forwards; animation-delay: ${delay}s; opacity: 0; margin: 5px; ${redFilter}">`;
    }
    
    content.innerHTML = `<div style="height: 200px; display: flex; justify-content: center; align-items: center; flex-wrap: wrap;">${diceHtml}</div>`;

    setTimeout(() => { mostrarResultadoMestre({ tipo, qtd, bonus, faces, rolandoZero }); }, 1300); 
};

function mostrarResultadoMestre(config) {
    let rolagens = [];
    let total = 0;
    let d20ResultForDB = 0; 

    for (let i = 0; i < config.qtd; i++) { 
        rolagens.push(Math.floor(Math.random() * config.faces) + 1); 
    }

    if (config.tipo === 'teste') {
        let dadoEscolhido = config.rolandoZero ? Math.min(...rolagens) : Math.max(...rolagens);
        total = dadoEscolhido + config.bonus;
        d20ResultForDB = dadoEscolhido;
    } else {
        let soma = rolagens.reduce((a, b) => a + b, 0);
        total = soma + config.bonus;
        d20ResultForDB = `[${rolagens.join(',')}] (D${config.faces})`; 
    }

    db.ref(`mestres/${mestreUID}/rolagens`).push({
        agente: "MESTRE",
        d20: d20ResultForDB,
        bonus: config.bonus,
        total: total,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });

    let color = "#fff"; let shadow = "var(--highlight-red)"; let critMsg = "";
    if (config.tipo === 'teste') {
        if (d20ResultForDB === 20 && !config.rolandoZero) { 
            color = "#ffc107"; shadow = "#ffc107"; 
            critMsg = "<div style='color:#ffc107; font-weight:bold; letter-spacing:2px; font-family:\"Medieval\", serif; font-size:1rem; margin-top:5px; animation: popUpMini 0.3s forwards;'>SUCESSO EXTREMO</div>";
        } else if (d20ResultForDB === 1) { 
            color = "#ff3333"; shadow = "#ff0000"; 
            critMsg = "<div style='color:#ff3333; font-weight:bold; letter-spacing:2px; font-family:\"Medieval\", serif; font-size:1rem; margin-top:5px; animation: popUpMini 0.3s forwards;'>FALHA DESASTROSA</div>";
        }
    } else {
        color = "#ff5555"; 
        critMsg = "<div style='color:#aaa; font-weight:bold; letter-spacing:2px; font-family:\"Medieval\", serif; font-size:1rem; margin-top:5px; animation: popUpMini 0.3s forwards;'>DANO CAUSADO</div>";
    }

    let htmlDadosRolados = rolagens.map(d => {
        if (config.tipo === 'teste') {
            let opac = (d === d20ResultForDB) ? '1' : '0.4';
            let tam = (d === d20ResultForDB) ? '1.2rem' : '0.9rem';
            let cor = (d === 20) ? '#ffc107' : (d === 1) ? '#ff3333' : '#aaa';
            return `<span style="opacity:${opac}; font-size:${tam}; color:${cor}; font-weight:bold; margin:0 4px;">[${d}]</span>`;
        } else {
            return `<span style="opacity:1; font-size:1rem; color:#ff9999; font-weight:bold; margin:0 4px;">[${d}]</span>`;
        }
    }).join('');

    let textDest = (config.tipo === 'teste') ? (config.rolandoZero ? "ATRIBUTO 0" : "DADOS ROLADOS") : `${config.qtd}D${config.faces} ROLADOS`;
    let labelEsq = (config.tipo === 'teste') ? "DADO VÁLIDO" : "SOMA DADOS";
    let valorEsq = (config.tipo === 'teste') ? d20ResultForDB : rolagens.reduce((a, b) => a + b, 0);

    const content = document.getElementById('floating-gm-dice-content');
    content.innerHTML = `
        <div style="text-align: center;">
            <img src="assets/img/d20.png" style="width: 50px; margin-bottom: 0px; filter: drop-shadow(0 0 5px ${shadow});">
            ${critMsg}
            <div style="font-size: 4.5rem; color: ${color}; font-family: 'Medieval', serif; text-shadow: 0 0 15px ${shadow}; margin: 5px 0; line-height: 1; opacity: 0; animation: popUpMini 0.4s ease-out forwards 0.1s;">${total}</div>
            
            <div style="background: rgba(10,10,10,0.8); border: 1px solid #333; border-radius: 8px; padding: 10px; margin-top: 10px; box-shadow: inset 0 0 10px rgba(0,0,0,0.8); opacity: 0; animation: popUpMini 0.4s ease-out forwards 0.2s;">
                <div style="font-size: 0.7rem; color: #888; font-weight: bold; letter-spacing: 1px; margin-bottom: 5px;">${textDest}</div>
                <div style="font-family: 'Medieval', serif; display: flex; justify-content: center; align-items: baseline; flex-wrap: wrap; margin-bottom: 5px;">
                    ${htmlDadosRolados}
                </div>
                <div style="width: 100%; height: 1px; background: #444; margin: 8px 0;"></div>
                <div style="display: flex; justify-content: space-around;">
                    <div style="text-align: center; width: 45%;">
                        <div style="font-size: 0.7rem; color: #888; font-weight: bold; font-family: sans-serif;">${labelEsq}</div>
                        <div style="font-size: 1.5rem; color: ${color}; font-weight: bold; font-family: 'Medieval', serif;">${valorEsq}</div>
                    </div>
                    <div style="width: 1px; background: #444;"></div>
                    <div style="text-align: center; width: 45%;">
                        <div style="font-size: 0.7rem; color: #888; font-weight: bold; font-family: sans-serif;">BÔNUS</div>
                        <div style="font-size: 1.5rem; color: #fff; font-weight: bold; font-family: 'Medieval', serif;">${config.bonus >= 0 ? '+'+config.bonus : config.bonus}</div>
                    </div>
                </div>
            </div>
            <button onclick="abrirMenuDadosMestre('${config.tipo}')" style="background: #222; border: 1px solid #555; color: #ccc; margin-top: 15px; padding: 8px 15px; cursor: pointer; border-radius: 4px; width: 100%; font-weight: bold;">NOVA ROLAGEM</button>
        </div>
    `;
}

window.abrirBlocoNotasMestre = function() {
    const widget = document.getElementById('floating-gm-notes-widget');
    if (widget) {
        widget.style.display = 'flex';
        if(typeof tornarHistoricoArrastavel === "function") {
            tornarHistoricoArrastavel(widget);
        }
    }
};

window.fecharBlocoNotasMestre = function() {
    const widget = document.getElementById('floating-gm-notes-widget');
    if (widget) widget.style.display = 'none';
};

window.salvarNotasGeraisMestre = function(valor) {
    if (!mestreUID) return;
    db.ref(`mestres/${mestreUID}/notasGerais`).set(valor);
};