const firebaseConfig = {
    apiKey: "AIzaSyAs27oV6UfzQ6CjzBIM6pZ2Gwc1x1WdYg0",
    authDomain: "sheet-vtt.firebaseapp.com",
    databaseURL: "https://sheet-vtt-default-rtdb.firebaseio.com",
    projectId: "sheet-vtt",
    storageBucket: "sheet-vtt.firebasestorage.app",
    messagingSenderId: "875487470793",
    appId: "1:875487470793:web:48593f9b707d3e7899d918"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let globalMestreUID = null;
let localAgents = [];
let currentAgentIndex = 0;
let currentAgentId = null;
let pendingAgentData = null;
let ultimaFichaString = ""; 

let currentTabIndex = 0;
const tabsOrder = ['habilidades', 'rituais', 'inventario'];

let playerAudioNode = new Audio();
playerAudioNode.loop = true;

let somJogadorSalvo = localStorage.getItem('vtt-jogador-volume');
let volumeInicialJogador = somJogadorSalvo !== null ? parseInt(somJogadorSalvo) : 50;
playerAudioNode.volume = volumeInicialJogador / 100; 

let ytPlayer = null;
let isYtApiReady = false;
let isYouTube = false;
let currentYtId = null;

let jogadorUltimaUrl = "";
let jogadorUltimoStatus = "";

if(!document.getElementById('yt-player-container')) {
    let div = document.createElement('div');
    div.id = 'yt-player-container';
    div.style.display = 'none';
    document.body.appendChild(div);
}

const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

window.vttLoopAtivo = true;

window.onYouTubeIframeAPIReady = function() {
    isYtApiReady = true;
    ytPlayer = new YT.Player('yt-player-container', {
        height: '0', width: '0',
        playerVars: { 'autoplay': 0, 'controls': 0, 'playsinline': 1 },
        events: { 
            'onReady': () => { forcarVolumeJogador(); },
            'onStateChange': (event) => {
                if (event.data === 0 && window.vttLoopAtivo) {
                    ytPlayer.seekTo(0);
                    ytPlayer.playVideo();
                }
            }
        }
    });
};

function getYoutubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function convertDriveLink(url) {
    if(url.includes('drive.google.com') && url.includes('/d/')) {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if(match && match[1]) {
            return `https://drive.google.com/uc?export=open&id=${match[1]}`;
        }
    }
    return url;
}

function forcarVolumeJogador() {
    let volAtual = localStorage.getItem('vtt-jogador-volume');
    let volFinal = volAtual !== null ? parseInt(volAtual) : 50;
    playerAudioNode.volume = volFinal / 100;
    if (isYouTube && ytPlayer && typeof ytPlayer.setVolume === 'function') {
        ytPlayer.setVolume(volFinal);
    }
}

firebase.auth().signInAnonymously().catch(() => {});

firebase.auth().onAuthStateChanged((user) => {
    if (!user) return;

    db.ref('mestres').on('value', (snapshot) => {
        const mestresData = snapshot.val();
        const carouselBox = document.getElementById('carousel-box');

        if (!mestresData) {
            carouselBox.innerHTML = '<h1 style="color: #ff3333; text-align: center;">NENHUM MESTRE ENCONTRADO.</h1>';
            localAgents = [];
            return;
        }

        globalMestreUID = Object.keys(mestresData)[0];
        const agentesData = mestresData[globalMestreUID].agentes;

        if (!agentesData) {
            carouselBox.innerHTML = '<h1 style="color: #ffc107; text-align: center;">AGUARDANDO O MESTRE CRIAR AS FICHAS...</h1>';
            localAgents = [];
            return;
        }

        localAgents = Object.keys(agentesData).map(key => ({
            id: key,
            ...agentesData[key]
        }));

        if (!document.getElementById('selection-screen').classList.contains('hidden')) {
            updateCarousel();
        }

        const trackData = mestresData[globalMestreUID].trilhaAtiva || { url: '', status: 'paused', tempoAtual: 0 };
        if (!document.getElementById('sheet-screen').classList.contains('hidden')) {
            sincronizarAudioJogador(trackData);
        }

        if (currentAgentId && !document.getElementById('sheet-screen').classList.contains('hidden')) {
            const updatedData = localAgents.find(a => a.id === currentAgentId);
            if (updatedData) {
                const novaFichaString = JSON.stringify(updatedData);
                if (novaFichaString !== ultimaFichaString) {
                    renderSheet(updatedData);
                    ultimaFichaString = novaFichaString;
                }
            } else {
                backToSelection();
            }
        }
    });
});

function getVisibleAgents() {
    return localAgents.filter(a => !a.esconderDoCarrossel);
}

function updateCarousel() {
    const visibleAgents = getVisibleAgents();
    const carouselBox = document.getElementById('carousel-box');

    if (visibleAgents.length === 0) {
        carouselBox.innerHTML = '<h1 style="color: #ffc107; text-align: center;">NENHUM AGENTE DISPONÍVEL.</h1>';
        return;
    }

    if (currentAgentIndex >= visibleAgents.length) currentAgentIndex = 0;
    if (currentAgentIndex < 0) currentAgentIndex = visibleAgents.length - 1;

    const agent = visibleAgents[currentAgentIndex];

    const isVideoSilhueta = agent.fotoSilhueta && (agent.fotoSilhueta.includes('.mp4') || agent.fotoSilhueta.includes('.webm'));

    const isDespertada = agent.isDespertada === true;
    const classeDespertada = isDespertada ? 'silhueta-despertada' : '';

    const silhuetaHTML = isVideoSilhueta
        ? `<video id="agent-silhouette" class="${classeDespertada}" src="${agent.fotoSilhueta}" autoplay loop muted playsinline></video>`
        : `<img id="agent-silhouette" class="${classeDespertada}" src="${agent.fotoSilhueta || 'assets/img/Zerai.jpg'}" alt="Agente">`;

    carouselBox.innerHTML = `
        <style>
            #agent-silhouette.silhueta-despertada {
                transition: filter 0.3s ease;
            }
            .agent-display:hover #agent-silhouette.silhueta-despertada,
            #agent-silhouette.silhueta-despertada:hover {
                filter: drop-shadow(0 0 25px #ff0000) !important;
            }
        </style>
        <button class="arrow" onclick="changeAgent(-1)">&#10094;</button>
        <div class="agent-display" onclick="openSheet('${agent.id}')">
            ${silhuetaHTML}
        </div>
        <button class="arrow" onclick="changeAgent(1)">&#10095;</button>
    `;
}

window.changeAgent = function(direction) {
    const visibleAgents = getVisibleAgents();
    if (visibleAgents.length === 0) return;
    currentAgentIndex += direction;
    updateCarousel();
};

window.openSheet = function(id) {
    const data = localAgents.find(a => a.id === id);
    if (!data) return;

    if (data.senha && data.senha.trim() !== "") {
        pendingAgentData = data;
        document.getElementById('password-input').value = '';
        
        const msgEnigma = document.getElementById('enigma-message-text');
        msgEnigma.innerText = data.mensagemEnigma || "Insira a credencial para decodificar os arquivos confidenciais deste agente.";

        document.getElementById('password-modal').classList.add('active');
        document.getElementById('password-input').focus();
        return; 
    }

    proceedToSheet(data);
};

document.getElementById('password-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') submitPassword();
});

window.submitPassword = function() {
    const pass = document.getElementById('password-input').value;
    if (pass === pendingAgentData.senha) {
        document.getElementById('password-modal').classList.remove('active');
        proceedToSheet(pendingAgentData);
    } else {
        document.getElementById('alert-modal').querySelector('.custom-modal-title').innerText = "ERRO CRÍTICO";
        document.getElementById('alert-message').innerHTML = "Credencial Inválida.<br>O acesso aos arquivos foi negado.";
        document.getElementById('alert-modal').classList.add('active');
    }
};

window.closePasswordModal = function() {
    document.getElementById('password-modal').classList.remove('active');
    pendingAgentData = null;
};

window.closeAlertModal = function() {
    document.getElementById('alert-modal').classList.remove('active');
    const passInput = document.getElementById('password-input');
    if(document.getElementById('password-modal').classList.contains('active')) {
        passInput.value = '';
        passInput.focus();
    }
};

function proceedToSheet(data) {
    currentAgentId = data.id;
    currentTabIndex = 0; 
    ultimaFichaString = ""; 
    document.getElementById('selection-screen').classList.add('hidden');
    document.getElementById('sheet-screen').classList.remove('hidden');
    renderSheet(data);
    ultimaFichaString = JSON.stringify(data);
}

function renderSheet(data) {
    let scrollCentro = 0;
    let scrollPericias = 0;
    const divCentro = document.querySelector('.center-square-carousel');
    const divPericias = document.querySelector('.pericias-box .pericias-scroll');
    if (divCentro) scrollCentro = divCentro.scrollTop;
    if (divPericias) scrollPericias = divPericias.scrollTop;

    const pvPercent = data.maxPv > 0 ? (data.pv / data.maxPv) * 100 : 0;
    const pdPercent = data.maxPd > 0 ? (data.pd / data.maxPd) * 100 : 0;
    const content = document.getElementById('sheet-content');

    const isLiberada = data.fichaLiberada === true;
    const classObfuscated = isLiberada ? 'revealed-area' : 'obfuscated-area';
    const classSecretText = isLiberada ? '' : 'secret-text';
    const classPortrait = isLiberada ? '' : 'portrait-oculto';
    const nomeExibido = isLiberada ? data.nome : '???';

    const isVideoPortrait = data.fotoPortrait && (data.fotoPortrait.includes('.mp4') || data.fotoPortrait.includes('.webm'));
    const portraitHTML = isVideoPortrait 
        ? `<video src="${data.fotoPortrait}" class="character-full-portrait ${classPortrait}" autoplay loop muted playsinline ondblclick="abrirModalDespertarJogador()"></video>`
        : `<img src="${data.fotoPortrait || 'assets/img/alan3x4.png'}" class="character-full-portrait ${classPortrait}" alt="${data.nome}" ondblclick="abrirModalDespertarJogador()">`;

    let pesoAtual = 0;
    if (data.inventario) {
        Object.values(data.inventario).forEach(item => {
            const match = String(item.custo).match(/\d+/);
            if (match) pesoAtual += parseInt(match[0]);
        });
    }

    const gerarCardsPlayer = (categoriaNome, categoriaData, bgColor) => {
        if (!categoriaData) return '<p style="text-align:center; color:#555; padding-top:20px;">Vazio.</p>';
        const label = categoriaNome === 'inventario' ? 'PESO' : 'PD';
        const textColor = bgColor === 'white-bg' ? '#666' : '#fff';

        return Object.keys(categoriaData).map(key => {
            const item = categoriaData[key];
        
            let numCusto = 0;
            if (item.custo) {
                const extraido = String(item.custo).replace(/\D/g, ''); 
                if (extraido !== '') {
                    numCusto = parseInt(extraido);
                }
            }

            return `
                <div class="skill-card-new ${bgColor}" style="padding-right: 20px;">
                    <img src="assets/img/trash.png" class="delete-card-btn" onclick="removeItem('${categoriaNome}', '${key}')" style="top: 15px; right: 15px;">
                
                    <div class="skill-header-new" style="padding-right: 35px;">
                        <span contenteditable="${isLiberada}" onblur="updateItem('${categoriaNome}', '${key}', 'nome', this.innerText)">${item.nome}</span>
                    
                        <span class="skill-cost-container" style="display:flex; align-items:center; gap:8px;">
                            <input type="number" class="line-input" value="${numCusto}" onchange="mudarCusto('${categoriaNome}', '${key}', this.value)" ${isLiberada ? '' : 'readonly'} style="color: ${textColor}; border-bottom-color: ${textColor}; width: 40px; text-align: center;">
                            <span style="font-size: 0.95rem; color: ${textColor}; font-weight: bold;">${label}</span>
                        </span>
                    </div>
                    <p class="skill-desc-new" contenteditable="${isLiberada}" onblur="updateItem('${categoriaNome}', '${key}', 'desc', this.innerText)">${item.desc}</p>
                </div>
            `;
        }).join('');
    };

    const htmlHabilidades = gerarCardsPlayer('habilidades', data.habilidades, 'white-bg');
    const htmlRituais = gerarCardsPlayer('rituais', data.rituais, 'red-bg');
    const htmlInventario = gerarCardsPlayer('inventario', data.inventario, 'white-bg');
    
    const volSalvo = localStorage.getItem('vtt-jogador-volume') !== null ? localStorage.getItem('vtt-jogador-volume') : 50;

    content.innerHTML = `
        <style>
            .pericias-scroll::-webkit-scrollbar { width: 6px; }
            .pericias-scroll::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.15); border-radius: 4px; }
            .pericias-scroll::-webkit-scrollbar-thumb { background: var(--blood-red); border-radius: 4px; border: 1px solid #000; }
            .pericias-scroll::-webkit-scrollbar-thumb:hover { background: var(--highlight-red); }
            
            .portrait-oculto {
                filter: brightness(0) drop-shadow(0 0 15px rgba(0,0,0,1));
                transition: filter 0.5s ease;
                pointer-events: none;
            }
            .character-full-portrait { cursor: pointer; }
        </style>

        <div class="new-sheet-layout">
            
            <div class="column-left">
                <div class="pericias-box" style="display: flex; flex-direction: column; height: 500px;">
                    <h3 class="box-title">PERICIAS</h3>
                    <div class="pericias-header" style="display: flex; align-items: center; border-bottom: 1px solid rgba(139, 0, 0, 0.4); padding-bottom: 5px; margin-bottom: 10px;">
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
                                    <span class="p-name" style="font-size: 0.75rem; flex: 1; white-space: normal; line-height: 1.2;">${p.nome}</span> 
                                    <div class="p-val-container" style="display: flex; gap: 10px; width: 100px; justify-content: flex-end; flex-shrink: 0;">
                                        <input type="text" class="p-val" value="${p.trn}" onchange="updatePericia('${key}', 'trn', this.value)" style="width: 45px; text-align: center;">
                                        <input type="text" class="p-val" value="${p.bon}" onchange="updatePericia('${key}', 'bon', this.value)" style="width: 45px; text-align: center;">
                                    </div>
                                </li>
                            `;
                        }).join('') : ''}
                    </ul>
                </div>

                <div class="attributes-pentagon">
                    <div class="attr agi"><input type="number" class="attr-input" value="${data.atributos.AGI}" onchange="updateAttribute('AGI', parseInt(this.value))"><span class="attr-label">AGI</span></div>
                    <div class="attr for"><input type="number" class="attr-input" value="${data.atributos.FOR}" onchange="updateAttribute('FOR', parseInt(this.value))"><span class="attr-label">FOR</span></div>
                    <div class="attr int"><input type="number" class="attr-input" value="${data.atributos.INT}" onchange="updateAttribute('INT', parseInt(this.value))"><span class="attr-label">INT</span></div>
                    <div class="attr vig"><input type="number" class="attr-input" value="${data.atributos.VIG}" onchange="updateAttribute('VIG', parseInt(this.value))"><span class="attr-label">VIG</span></div>
                    <div class="attr pre"><input type="number" class="attr-input" value="${data.atributos.PRE}" onchange="updateAttribute('PRE', parseInt(this.value))"><span class="attr-label">PRE</span></div>
                </div> 
            </div> 

            <div class="column-middle">
                <h1 class="character-name-center ${classSecretText}" style="color: #8b0000; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); font-size: 3rem; line-height: 0.9; margin-top: 20px; margin-bottom: 5px; width: 100%; text-align: right;">${nomeExibido}</h1>
                
                <div style="width: 100%; display: flex; flex-direction: column; align-items: flex-start; margin-top: 0;">
                    
                    <div class="${classObfuscated}" style="width: 100%; text-align: left; margin-bottom: 10px; font-family: 'Medieval', serif; font-size: 1.1rem; color: #ffc107; letter-spacing: 2px; padding-left: 5px;">
                        <div id="info-player-habilidades" style="display: none;">
                            LIMITE DE PD/TURNO: <span style="color: #fff; font-family: sans-serif;">${data.limitePD || 0}</span>
                        </div>
                        <div id="info-player-rituais" style="display: none;">
                            DT DOS RITUAIS: <span style="color: #fff; font-family: sans-serif;">${data.dtRituais || 0}</span>
                        </div>
                        <div id="info-player-inventario" style="display: none;">
                            PESO: <input type="number" value="${data.pesoAtual || 0}" onchange="salvarCampo('pesoAtual', parseInt(this.value))" ${isLiberada ? '' : 'readonly'} style="width: 45px; background: transparent; border: none; border-bottom: 1px solid #ffc107; color: #fff; text-align: center; font-size: 1.2rem; outline: none; font-family: sans-serif;"> / <span style="color: #fff; font-family: sans-serif;">${data.pesoMaximo || 10}</span>
                        </div>
                    </div>

                    <div class="center-square-carousel pericias-scroll ${classObfuscated}" style="width: 100%; height: 750px; overflow-y: auto; overflow-x: hidden; padding-bottom: 20px; padding-right: 5px;">
                        <div id="tab-habilidades" class="tab-content" style="display:none; position:relative;">
                            <div class="skills-stack">${htmlHabilidades}</div>
                            ${isLiberada ? `<div style="text-align: center; margin-top: 15px;"><img src="assets/img/mais.png" onclick="adicionarNovoCardPlayer('habilidades')" style="cursor:pointer; width:30px; filter: drop-shadow(0 0 5px rgba(0,0,0,0.5)); transition: 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"></div>` : ''}
                        </div>
                        <div id="tab-rituais" class="tab-content" style="display:none; position:relative;">
                            <div class="skills-stack">${htmlRituais}</div>
                            ${isLiberada ? `<div style="text-align: center; margin-top: 15px;"><img src="assets/img/mais.png" onclick="adicionarNovoCardPlayer('rituais')" style="cursor:pointer; width:30px; filter: drop-shadow(0 0 5px rgba(0,0,0,0.5)); transition: 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"></div>` : ''}
                        </div>
                        <div id="tab-inventario" class="tab-content" style="display:none; position:relative;">
                            <div class="skills-stack">${htmlInventario}</div>
                            ${isLiberada ? `<div style="text-align: center; margin-top: 15px;"><img src="assets/img/mais.png" onclick="adicionarNovoCardPlayer('inventario')" style="cursor:pointer; width:30px; filter: drop-shadow(0 0 5px rgba(0,0,0,0.5)); transition: 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"></div>` : ''}
                        </div>
                    </div>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 15px;">
                    
                    <div class="player-soundtrack-widget">
                        <span style="font-size:0.85rem; color:#ffc107; font-weight:bold; font-family: 'Medieval', serif; letter-spacing: 2px;">SOUNDTRACK</span>
                        <input type="range" min="0" max="100" value="${volSalvo}" class="volume-slider" oninput="ajustarVolumeLocalJogador(this.value)">
                    </div>

                    <div class="icons-wrapper ${classObfuscated}" style="display: flex; gap: 20px; cursor: pointer;">
                        <img src="assets/img/d20.png" alt="Rolar Dado" class="notes-icon" onclick="rolarDado('teste')" title="Rolar Dados">
                        <img src="assets/img/escrita.png" alt="Anotações" class="notes-icon" onclick="openNotes()" title="Anotações">
                    </div>
                </div>
            </div>

            <div class="column-right">
                <div class="portrait-container" title="Dois cliques para relembrar o passado...">
                    ${portraitHTML}
                </div>
                
                <div class="status-bars-container ${classObfuscated}">
                    <div class="resource-section">
                        <div class="resource-label">VIDA</div>
                        <div class="resource-bar-container">
                            <div class="resource-fill pv-fill" style="width: ${pvPercent}%;"></div>
                            <div class="resource-content">
                                <div class="controls-left"><span onclick="changeStatus('pv', -5)">&laquo;</span><span onclick="changeStatus('pv', -1)">&lsaquo;</span></div>
                                <div class="resource-text">
                                    ${isLiberada ? `<span contenteditable="true" onblur="salvarCampo('pv', parseInt(this.innerText) || 0)">${data.pv}</span> / <span contenteditable="true" onblur="salvarCampo('maxPv', parseInt(this.innerText) || 0)">${data.maxPv}</span>` : '?? / ??'}
                                </div>
                                <div class="controls-right"><span onclick="changeStatus('pv', 1)">&rsaquo;</span><span onclick="changeStatus('pv', 5)">&raquo;</span></div>
                            </div>
                        </div>
                    </div>

                    <div class="resource-section">
                        <div class="resource-label">DETERMINACAO</div>
                        <div class="resource-bar-container">
                            <div class="resource-fill pd-fill" style="width: ${pdPercent}%;"></div>
                            <div class="resource-content">
                                <div class="controls-left"><span onclick="changeStatus('pd', -5)">&laquo;</span><span onclick="changeStatus('pd', -1)">&lsaquo;</span></div>
                                <div class="resource-text">
                                    ${isLiberada ? `<span contenteditable="true" onblur="salvarCampo('pd', parseInt(this.innerText) || 0)">${data.pd}</span> / <span contenteditable="true" onblur="salvarCampo('maxPd', parseInt(this.innerText) || 0)">${data.maxPd}</span>` : '?? / ??'}
                                </div>
                                <div class="controls-right"><span onclick="changeStatus('pd', 1)">&rsaquo;</span><span onclick="changeStatus('pd', 5)">&raquo;</span></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="defense-box">
                        <img src="assets/img/escudo.png" alt="Defesa" class="defense-icon">
                        <span class="defense-value">${isLiberada ? data.defesa : '?'}</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    const jRelatos = document.getElementById('jogador-relatos-input');
    const jNotas = document.getElementById('jogador-notas-input');
    if (jRelatos && document.activeElement !== jRelatos) jRelatos.value = data.relatos || '';
    if (jNotas && document.activeElement !== jNotas) jNotas.value = data.notasMarginais || '';
    
    updateTabsUI();

    setTimeout(() => {
        const novoDivCentro = document.querySelector('.center-square-carousel');
        const novoDivPericias = document.querySelector('.pericias-box .pericias-scroll');
        if (novoDivCentro) novoDivCentro.scrollTop = scrollCentro;
        if (novoDivPericias) novoDivPericias.scrollTop = scrollPericias;
    }, 10);
}

window.abrirModalDespertarJogador = function() {
    if (!currentAgentId) return;
    const data = localAgents.find(a => a.id === currentAgentId);
    if (!data || !data.despertarSenha || !data.despertarTargetId) return; 

    document.getElementById('despertar-enigma-text').innerText = data.despertarEnigma || "O verdadeiro poder aguarda...";
    document.getElementById('despertar-senha-input').value = "";
    document.getElementById('modal-despertar-jogador').classList.add('active');
    document.getElementById('despertar-senha-input').focus();
};

window.fecharModalDespertarJogador = function() {
    document.getElementById('modal-despertar-jogador').classList.remove('active');
};

window.tentarDespertar = function() {
    const data = localAgents.find(a => a.id === currentAgentId);
    const senhaDigitada = document.getElementById('despertar-senha-input').value;
    
    if (senhaDigitada.toLowerCase().trim() === data.despertarSenha.toLowerCase().trim()) {
        fecharModalDespertarJogador();
        db.ref(`mestres/${globalMestreUID}/agentes/${currentAgentId}/esconderDoCarrossel`).set(true);
        db.ref(`mestres/${globalMestreUID}/agentes/${data.despertarTargetId}/esconderDoCarrossel`).set(false);
        
        setTimeout(() => {
            const targetData = localAgents.find(a => a.id === data.despertarTargetId);
            if(targetData) proceedToSheet(targetData);
        }, 500);
        
    } else {
        document.getElementById('alert-modal').querySelector('.custom-modal-title').innerText = "FALHA NO DESPERTAR";
        document.getElementById('alert-message').innerHTML = "A lembrança está distorcida... Tente novamente.";
        document.getElementById('alert-modal').classList.add('active');
    }
};

function sincronizarAudioJogador(track) {
    let isLoop = track.loop !== false;
    window.vttLoopAtivo = isLoop;
    playerAudioNode.loop = isLoop;

    if (!track || !track.url) {
        playerAudioNode.pause();
        if(ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
        return;
    }

    let urlMudou = track.url !== jogadorUltimaUrl;
    let statusMudou = track.status !== jogadorUltimoStatus;

    let ytId = getYoutubeId(track.url);
    if (ytId) {
        isYouTube = true;
        playerAudioNode.pause();
        if (isYtApiReady && ytPlayer && ytPlayer.cueVideoById) {
            if (urlMudou) {
                ytPlayer.loadVideoById(ytId, track.tempoAtual);
                currentYtId = ytId;
            }
            if (statusMudou || urlMudou) {
                if (track.status === 'playing') {
                    forcarVolumeJogador(); 
                    ytPlayer.playVideo();
                } else {
                    ytPlayer.pauseVideo();
                }
            }
        }
    } else {
        isYouTube = false;
        if(ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
        
        let finalUrl = convertDriveLink(track.url);
        if (urlMudou) {
            playerAudioNode.src = finalUrl;
            playerAudioNode.currentTime = track.tempoAtual;
        }
        if (statusMudou || urlMudou) {
            if (track.status === 'playing') {
                forcarVolumeJogador(); 
                playerAudioNode.play().catch(()=>{});
            } else {
                playerAudioNode.pause();
            }
        }
    }

    jogadorUltimaUrl = track.url;
    jogadorUltimoStatus = track.status;
}

window.ajustarVolumeLocalJogador = function(val) {
    playerAudioNode.volume = val / 100;
    if(isYouTube && ytPlayer && typeof ytPlayer.setVolume === 'function') {
        ytPlayer.setVolume(val);
    }
    localStorage.setItem('vtt-jogador-volume', val); 
};

window.mudarAbaPlayer = function(aba) {
    currentTabIndex = tabsOrder.indexOf(aba);
    updateTabsUI();
};

function updateTabsUI() {
    tabsOrder.forEach((aba, index) => {
        const tab = document.getElementById('tab-' + aba);
        const info = document.getElementById('info-player-' + aba); 

        if (tab) tab.style.display = (index === currentTabIndex) ? 'block' : 'none';
        if (info) info.style.display = (index === currentTabIndex) ? 'block' : 'none';
    });
}

window.addEventListener('wheel', function(event) {
    if (document.getElementById('sheet-screen').classList.contains('hidden')) return;
    if (event.target.closest('.center-square-carousel') || event.target.closest('.pericias-box')) return; 

    if (event.deltaY > 0) {
        if (currentTabIndex < tabsOrder.length - 1) { currentTabIndex++; updateTabsUI(); }
    } else {
        if (currentTabIndex > 0) { currentTabIndex--; updateTabsUI(); }
    }
});

window.addEventListener('keydown', function(event) {
    if (document.getElementById('sheet-screen').classList.contains('hidden')) return;
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable) return;

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        if (currentTabIndex < tabsOrder.length - 1) { currentTabIndex++; updateTabsUI(); }
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        if (currentTabIndex > 0) { currentTabIndex--; updateTabsUI(); }
    }
});

function criarJanelaDados() {
    if (document.getElementById('floating-dice-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'floating-dice-widget';
    widget.style.cssText = `
        position: fixed; top: 25%; left: 50%; transform: translateX(-50%);
        width: 350px; background: rgba(15, 15, 15, 0.95); border: 2px solid var(--blood-red);
        border-radius: 8px; box-shadow: 0 0 25px rgba(0,0,0,0.9); z-index: 100000;
        display: none; flex-direction: column; overflow: hidden;
    `;

    widget.innerHTML = `
        <div id="floating-dice-header" style="background: #5a0000; color: #ffc107; padding: 10px 15px; font-family: 'Medieval', serif; font-size: 1.2rem; cursor: move; display: flex; justify-content: space-between; align-items: center; user-select: none; border-bottom: 2px solid var(--blood-red);">
            <span style="display:flex; align-items:center; gap:8px;"><img src="assets/img/d20.png" style="width:20px;"> ROLAGEM DE DADOS</span>
            <span onclick="fecharJanelaDados()" style="color: #fff; cursor: pointer; font-family: sans-serif; font-weight: bold; font-size: 1.2rem; padding: 0 5px;">X</span>
        </div>
        <div id="floating-dice-content" style="padding: 15px;"></div>
    `;

    document.body.appendChild(widget);
    tornarArrastavel(widget);
    
    let style = document.createElement('style');
    style.innerHTML = `
        @keyframes rollDiceMini { 0% { transform: scale(0.2) rotate(0deg); opacity: 0; } 50% { transform: scale(1.1) rotate(180deg); opacity: 1; } 100% { transform: scale(0.8) rotate(360deg); opacity: 1; } }
        @keyframes popUpMini { 0% { transform: translateY(15px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        .tab-btn-dice { flex: 1; padding: 10px; font-family: 'Medieval', serif; font-size: 1.1rem; border: none; cursor: pointer; transition: 0.3s; }
    `;
    document.head.appendChild(style);
}

function tornarArrastavel(elmnt) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = document.getElementById(elmnt.id + "-header");
    if (header) { header.onmousedown = dragMouseDown; } else { elmnt.onmousedown = dragMouseDown; }

    function dragMouseDown(e) {
        e = e || window.event;
        pos3 = e.clientX; pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event; e.preventDefault();
        pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY;
        pos3 = e.clientX; pos4 = e.clientY;
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
        elmnt.style.transform = "none"; 
    }

    function closeDragElement() { document.onmouseup = null; document.onmousemove = null; }
}

window.fecharJanelaDados = function() {
    document.getElementById('floating-dice-widget').style.display = 'none';
};

window.adicionarNovoCardPlayer = function(categoria) {
    if (!currentAgentId || !globalMestreUID) return;
    const novoItem = {
        nome: "NOVO ITEM",
        custo: categoria === 'inventario' ? "PESO: 0" : "0 PD",
        desc: "CLIQUE AQUI PARA EDITAR..."
    };
    db.ref(`mestres/${globalMestreUID}/agentes/${currentAgentId}/${categoria}`).push().set(novoItem);
};

window.rolarDado = function(aba = 'teste') {
    if (!currentAgentId || !globalMestreUID) return;
    const data = localAgents.find(a => a.id === currentAgentId);
    if (!data) return;

    criarJanelaDados(); 
    const widget = document.getElementById('floating-dice-widget');
    const content = document.getElementById('floating-dice-content');

    let htmlAba = '';

    if (aba === 'teste') {
        htmlAba = `
            <div class="setup-row">
                <div class="setup-label">ATRIBUTO<br><span style="font-size: 0.7rem; color: #888; font-weight: normal;"></span></div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="mod-btn" onclick="let v=parseInt(document.getElementById('qtd-dados-input').value||1); if(v>0) document.getElementById('qtd-dados-input').value = v-1">-</button>
                    <input type="number" id="qtd-dados-input" value="1" min="0" class="mod-input">
                    <button class="mod-btn" onclick="document.getElementById('qtd-dados-input').value = parseInt(document.getElementById('qtd-dados-input').value||1) + 1">+</button>
                </div>
            </div>
            <div class="setup-row">
                <div class="setup-label">PERÍCIA<br><span style="font-size: 0.7rem; color: #888; font-weight: normal;"></span></div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="mod-btn" onclick="document.getElementById('bonus-pericia-input').value = parseInt(document.getElementById('bonus-pericia-input').value||0) - 1">-</button>
                    <input type="number" id="bonus-pericia-input" value="0" class="mod-input">
                    <button class="mod-btn" onclick="document.getElementById('bonus-pericia-input').value = parseInt(document.getElementById('bonus-pericia-input').value||0) + 1">+</button>
                </div>
            </div>
            <button class="btn-lancar" onclick="iniciarAnimacaoDado('${data.nome}', 'teste')">ROLAR DADOS</button>
        `;
    } else {
        htmlAba = `
            <div class="setup-row">
                <div class="setup-label">QTD. DADOS<br><span style="font-size: 0.7rem; color: #888; font-weight: normal;"></span></div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="mod-btn" onclick="let v=parseInt(document.getElementById('qtd-dano-input').value||1); if(v>1) document.getElementById('qtd-dano-input').value = v-1">-</button>
                    <input type="number" id="qtd-dano-input" value="1" min="1" class="mod-input">
                    <button class="mod-btn" onclick="document.getElementById('qtd-dano-input').value = parseInt(document.getElementById('qtd-dano-input').value||1) + 1">+</button>
                </div>
            </div>
            <div class="setup-row">
                <div class="setup-label">FACES</div>
                <select id="tipo-dano-input" class="mod-input" style="width: 65px; padding: 5px; cursor: pointer; text-align-last: center; -webkit-appearance: none; -moz-appearance: none; appearance: none;">
                    <option value="4">D4</option>
                    <option value="6" selected>D6</option>
                    <option value="8">D8</option>
                    <option value="10">D10</option>
                    <option value="12">D12</option>
                    <option value="20">D20</option>
                </select>
            </div>
            <div class="setup-row">
                <div class="setup-label">BÔNUS<br><span style="font-size: 0.7rem; color: #888; font-weight: normal;"></span></div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="mod-btn" onclick="document.getElementById('bonus-dano-input').value = parseInt(document.getElementById('bonus-dano-input').value||0) - 1">-</button>
                    <input type="number" id="bonus-dano-input" value="0" class="mod-input">
                    <button class="mod-btn" onclick="document.getElementById('bonus-dano-input').value = parseInt(document.getElementById('bonus-dano-input').value||0) + 1">+</button>
                </div>
            </div>
            <button class="btn-lancar" onclick="iniciarAnimacaoDado('${data.nome}', 'dano')">Rolar Dados</button>
        `;
    }

    content.innerHTML = `
        <style>
            .mod-btn { background: #222; border: 1px solid #444; color: white; padding: 5px 12px; font-size: 1.2rem; border-radius: 4px; cursor: pointer; transition: 0.2s; font-weight: bold; }
            .mod-btn:hover { background: var(--blood-red); border-color: var(--highlight-red); }
            .mod-input::-webkit-outer-spin-button, .mod-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
            .mod-input { -moz-appearance: textfield; background: #000; border: 2px solid var(--highlight-red); color: white; font-size: 1.2rem; width: 45px; text-align: center; border-radius: 5px; outline: none; font-weight: bold; font-family: 'Medieval', serif; }
            .btn-lancar { margin-top: 15px; background: var(--blood-red); border: 1px solid var(--highlight-red); color: white; font-family: 'Medieval', serif; font-size: 1.2rem; padding: 12px; cursor: pointer; border-radius: 4px; transition: 0.3s; width: 100%; letter-spacing: 1px; }
            .btn-lancar:hover { box-shadow: 0 0 15px var(--highlight-red); background: #a00000; }
            .setup-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; background: rgba(0,0,0,0.5); padding: 10px; border-radius: 6px; border: 1px solid #333; }
            .setup-label { color: #ccc; font-size: 0.9rem; font-family: sans-serif; text-align: left; font-weight: bold; }
        </style>
        
        <div style="display: flex; margin-bottom: 15px; border-radius: 6px; overflow: hidden; border: 1px solid #444;">
            <button class="tab-btn-dice" onclick="rolarDado('teste')" style="background: ${aba === 'teste' ? '#5a0000' : '#222'}; color: ${aba === 'teste' ? '#ffc107' : '#888'};">TESTE DE PERICIA</button>
            <button class="tab-btn-dice" onclick="rolarDado('dano')" style="background: ${aba === 'dano' ? '#5a0000' : '#222'}; color: ${aba === 'dano' ? '#ffc107' : '#888'};">ROLAR DANO</button>
        </div>

        <div style="text-align: center;">
            ${htmlAba}
        </div>
    `;
    widget.style.display = 'flex';
};

window.iniciarAnimacaoDado = function(nomeAgente, tipo) {
    let qtd = 1, bonus = 0, faces = 20, rolandoZero = false;
    
    if (tipo === 'teste') {
        let qtdOriginal = parseInt(document.getElementById('qtd-dados-input').value) || 0;
        bonus = parseInt(document.getElementById('bonus-pericia-input').value) || 0;
        if (qtdOriginal <= 0) { rolandoZero = true; qtd = 2; } else { qtd = qtdOriginal; }
    } else {
        qtd = parseInt(document.getElementById('qtd-dano-input').value) || 1;
        if(qtd <= 0) qtd = 1; 
        faces = parseInt(document.getElementById('tipo-dano-input').value) || 6;
        bonus = parseInt(document.getElementById('bonus-dano-input').value) || 0;
    }

    let diceSound = new Audio('assets/audio/dice.mp3');
    diceSound.volume = 0.2;
    diceSound.play().catch(e => console.log("Erro no audio: ", e));

    const content = document.getElementById('floating-dice-content');
    let visualDiceCount = qtd > 8 ? 8 : qtd; 
    
    let redFilter = "filter: invert(16%) sepia(80%) saturate(7000%) hue-rotate(350deg) drop-shadow(0 0 10px rgba(255,0,0,0.8));";

    let diceHtml = '';
    for(let i=0; i<visualDiceCount; i++) {
        let delay = Math.random() * 0.2;
        diceHtml += `<img src="assets/img/d20.png" style="width: 50px; height: 50px; animation: rollDiceMini 1.2s ease-in-out forwards; animation-delay: ${delay}s; opacity: 0; margin: 5px; ${redFilter}">`;
    }
    
    content.innerHTML = `
        <div style="height: 200px; display: flex; justify-content: center; align-items: center; flex-wrap: wrap;">
            ${diceHtml}
        </div>
    `;

    setTimeout(() => { mostrarResultadoFinal(nomeAgente, { tipo, qtd, bonus, faces, rolandoZero }); }, 1300); 
};

function mostrarResultadoFinal(nomeAgente, config) {
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

    db.ref(`mestres/${globalMestreUID}/rolagens`).push({
        agente: nomeAgente || "DESCONHECIDO",
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

    const content = document.getElementById('floating-dice-content');
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
            <button onclick="rolarDado('${config.tipo}')" style="background: #222; border: 1px solid #555; color: #ccc; margin-top: 15px; padding: 8px 15px; cursor: pointer; border-radius: 4px; width: 100%; font-weight: bold;">NOVA ROLAGEM</button>
        </div>
    `;
}

window.updatePericia = function(key, subcampo, valor) {
    if (!currentAgentId || !globalMestreUID) return;
    db.ref(`mestres/${globalMestreUID}/agentes/${currentAgentId}/pericias/${key}/${subcampo}`).set(valor);
};

window.updateAttribute = function(attr, valor) {
    if (!currentAgentId || !globalMestreUID) return;
    db.ref(`mestres/${globalMestreUID}/agentes/${currentAgentId}/atributos/${attr}`).set(valor);
};

window.updateItem = function(categoria, key, campo, valor) {
    if (!currentAgentId || !globalMestreUID) return;
    db.ref(`mestres/${globalMestreUID}/agentes/${currentAgentId}/${categoria}/${key}/${campo}`).set(valor);
};

window.removeItem = function(categoria, key) {
    if (!currentAgentId || !globalMestreUID) return;
    if (confirm("Deseja mesmo remover este item da sua ficha?")) {
        db.ref(`mestres/${globalMestreUID}/agentes/${currentAgentId}/${categoria}/${key}`).remove();
    }
};

window.changeStatus = function(tipo, quantidade) {
    if (!currentAgentId || !globalMestreUID) return;
    const nodeRef = db.ref(`mestres/${globalMestreUID}/agentes/${currentAgentId}`);
    nodeRef.once('value', (snapshot) => {
        const data = snapshot.val();
        if (!data || !data.fichaLiberada) return; 
        let atual = data[tipo] + quantidade;
        let max = tipo === 'pv' ? data.maxPv : data.maxPd;
        if (atual > max) atual = max;
        if (atual < 0) atual = 0;
        nodeRef.child(tipo).set(atual);
    });
};

window.salvarCampo = function(caminho, valor) {
    if (!currentAgentId || !globalMestreUID) return;
    db.ref(`mestres/${globalMestreUID}/agentes/${currentAgentId}/${caminho}`).set(valor);
};

window.mudarCusto = function(categoria, key, valor) {
    if (!currentAgentId || !globalMestreUID) return;
    const numero = parseInt(valor) || 0;
    const formato = categoria === 'inventario' ? `PESO: ${numero}` : `${numero} PD`;
    db.ref(`mestres/${globalMestreUID}/agentes/${currentAgentId}/${categoria}/${key}/custo`).set(formato);
};

window.backToSelection = function() {
    playerAudioNode.pause();
    if(ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
    currentAgentId = null;
    document.getElementById('sheet-screen').classList.add('hidden');
    document.getElementById('selection-screen').classList.remove('hidden');
    updateCarousel();
};

window.openNotes = function() {
    document.getElementById('notes-modal').classList.remove('modal-hidden');
};

window.closeNotes = function() {
    document.getElementById('notes-modal').classList.add('modal-hidden');
};