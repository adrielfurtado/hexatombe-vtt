let mestreAudioNode = new Audio();
mestreAudioNode.loop = true;

let somMestreSalvo = localStorage.getItem('vtt-mestre-volume');
let volumeInicialMestre = somMestreSalvo !== null ? parseInt(somMestreSalvo) : 50;
mestreAudioNode.volume = volumeInicialMestre / 100;

let ytPlayer = null;
let isYtApiReady = false;
let isYouTube = false;
let currentYtId = null;

let mestreUltimaUrl = "";
let mestreUltimoStatus = "";

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

window.onYouTubeIframeAPIReady = function() {
    isYtApiReady = true;
    ytPlayer = new YT.Player('yt-player-container', {
        height: '0', width: '0',
        playerVars: { 'autoplay': 0, 'controls': 0, 'loop': 1 },
        events: {
            'onReady': () => { forcarVolumeMestre(); }
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

function forcarVolumeMestre() {
    let volAtual = localStorage.getItem('vtt-mestre-volume');
    let volFinal = volAtual !== null ? parseInt(volAtual) : 50;
    mestreAudioNode.volume = volFinal / 100;
    if (isYouTube && ytPlayer && typeof ytPlayer.setVolume === 'function') {
        ytPlayer.setVolume(volFinal);
    }
}

let draggingSlider = false;
document.getElementById('mestre-progress-bar')?.addEventListener('mousedown', () => draggingSlider = true);
document.getElementById('mestre-progress-bar')?.addEventListener('mouseup', () => draggingSlider = false);

function initSoundtrack(uid) {
    const dbAudio = firebase.database();
    let volSalvo = localStorage.getItem('vtt-mestre-volume');
    const volSlider = document.querySelector('.volume-slider');
    if (volSlider && volSalvo !== null) volSlider.value = parseInt(volSalvo);

    dbAudio.ref(`mestres/${uid}/trilhaAtiva`).on('value', (trackSnapshot) => {
        const track = trackSnapshot.val() || { url: '', status: 'paused', tempoAtual: 0, titulo: '', loop: true };
        
        const btnPlayPause = document.getElementById('mestre-btn-play');
        const btnLoop = document.getElementById('mestre-btn-loop');
        const inputUrl = document.getElementById('mestre-audio-url');
        const inputTitulo = document.getElementById('mestre-audio-titulo');

        if(btnPlayPause) btnPlayPause.innerText = track.status === 'playing' ? 'PAUSAR' : 'PLAY';
        if(inputUrl && document.activeElement !== inputUrl) inputUrl.value = track.url || '';
        if(inputTitulo && document.activeElement !== inputTitulo) inputTitulo.value = track.titulo || '';

        let isLoop = track.loop !== false;
        if(btnLoop) {
            btnLoop.innerText = isLoop ? 'LOOP: ON' : 'LOOP: OFF';
            btnLoop.style.background = isLoop ? '#004d40' : '#444';
            btnLoop.style.borderColor = isLoop ? '#00796b' : '#777';
        }
        mestreAudioNode.loop = isLoop;
        if (isYouTube && ytPlayer && typeof ytPlayer.setLoop === 'function') ytPlayer.setLoop(isLoop);
        
        let urlMudou = track.url !== mestreUltimaUrl;
        let statusMudou = track.status !== mestreUltimoStatus;

        if (track.url) {
            let ytId = getYoutubeId(track.url);
            if (ytId) {
                isYouTube = true;
                mestreAudioNode.pause(); 
                
                if (isYtApiReady && ytPlayer && ytPlayer.cueVideoById) {
                    if (urlMudou) {
                        ytPlayer.loadVideoById(ytId, track.tempoAtual);
                        currentYtId = ytId;
                    }
                    if (statusMudou || urlMudou) {
                        if (track.status === 'playing') {
                            forcarVolumeMestre();
                            ytPlayer.playVideo();
                        } else {
                            ytPlayer.pauseVideo();
                        }
                    }
                }
            } else {
                isYouTube = false;
                if (ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
                
                let finalUrl = convertDriveLink(track.url);
                if (urlMudou) {
                    mestreAudioNode.src = finalUrl;
                    mestreAudioNode.currentTime = track.tempoAtual;
                }
                if (statusMudou || urlMudou) {
                    if (track.status === 'playing') {
                        forcarVolumeMestre();
                        mestreAudioNode.play().catch(()=>{});
                    } else {
                        mestreAudioNode.pause();
                    }
                }
            }
        } else {
            mestreAudioNode.pause();
            if(ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
        }

        mestreUltimaUrl = track.url;
        mestreUltimoStatus = track.status;
    });

    dbAudio.ref(`mestres/${uid}/trilhaPresets`).on('value', (presetsSnapshot) => {
        const presetsDiv = document.getElementById('mestre-audio-presets-list');
        if(!presetsDiv) return;
        presetsDiv.innerHTML = '';

        if(presetsSnapshot.exists()) {
            presetsSnapshot.forEach(child => {
                const key = child.key;
                const preset = child.val();
                const chip = document.createElement('div');
                chip.className = 'preset-chip';
                chip.innerHTML = `
                    <span onclick="carregarPresetTrilha('${preset.url}', '${preset.titulo}')">${preset.titulo}</span>
                    <span onclick="deletarPresetTrilha('${key}')" style="color: #ff3333; margin-left: 8px; font-weight: bold; padding: 0 5px;">X</span>
                `;
                presetsDiv.appendChild(chip);
            });
        } else {
            presetsDiv.innerHTML = '<span style="color:#555; font-size:0.85rem;">Nenhum preset salvo.</span>';
        }
    });

    setInterval(() => {
        if (!mestreAudioNode.paused || (isYouTube && ytPlayer && ytPlayer.getPlayerState && ytPlayer.getPlayerState() === 1)) {
            let t = isYouTube ? ytPlayer.getCurrentTime() : mestreAudioNode.currentTime;
            dbAudio.ref(`mestres/${uid}/trilhaAtiva/tempoAtual`).set(Math.floor(t));
        }
    }, 3000);

    setInterval(() => {
        if(draggingSlider) return;
        let current = 0; let duration = 0;
        
        if(isYouTube && ytPlayer && ytPlayer.getCurrentTime) {
            current = ytPlayer.getCurrentTime();
            duration = ytPlayer.getDuration();
        } else {
            current = mestreAudioNode.currentTime;
            duration = mestreAudioNode.duration || 0;
        }
        
        const display = document.getElementById('mestre-audio-time-display');
        const displayDur = document.getElementById('mestre-audio-duration-display');
        const slider = document.getElementById('mestre-progress-bar');
        
        if(display) display.innerText = formatarTempoAudio(current);
        if(displayDur && duration > 0) displayDur.innerText = formatarTempoAudio(duration);
        if(slider && duration > 0) { slider.value = (current / duration) * 100; }
    }, 1000);
}

window.controlarTrilhaStatus = function() {
    const uid = firebase.auth().currentUser.uid;
    const dbAudio = firebase.database();
    const url = document.getElementById('mestre-audio-url').value.trim();
    const titulo = document.getElementById('mestre-audio-titulo').value.trim() || "Nova Faixa";

    if(!url) { alert("Insira uma URL válida primeiro!"); return; }

    dbAudio.ref(`mestres/${uid}/trilhaAtiva`).once('value', (snap) => {
        const atual = snap.val() || {};
        const novoStatus = atual.status === 'playing' ? 'paused' : 'playing';
        let tempo = isYouTube ? (ytPlayer && ytPlayer.getCurrentTime ? ytPlayer.getCurrentTime() : 0) : mestreAudioNode.currentTime;
        let currentLoop = atual.loop !== false;

        dbAudio.ref(`mestres/${uid}/trilhaAtiva`).set({
            url: url, titulo: titulo, status: novoStatus, tempoAtual: Math.floor(tempo), loop: currentLoop
        });
    });
};

window.seekTrilha = function(percent) {
    const uid = firebase.auth().currentUser.uid;
    const dbAudio = firebase.database();
    let duration = isYouTube ? (ytPlayer ? ytPlayer.getDuration() : 0) : mestreAudioNode.duration;
    if(!duration) return;
    let newTime = (percent / 100) * duration;
    
    if(isYouTube && ytPlayer) ytPlayer.seekTo(newTime);
    else mestreAudioNode.currentTime = newTime;

    dbAudio.ref(`mestres/${uid}/trilhaAtiva/tempoAtual`).set(Math.floor(newTime));
};

window.salvarPresetTrilha = function() {
    const uid = firebase.auth().currentUser.uid;
    const dbAudio = firebase.database();
    const url = document.getElementById('mestre-audio-url').value.trim();
    const titulo = document.getElementById('mestre-audio-titulo').value.trim();

    if(!url || !titulo) { alert("Preencha o Nome e a URL para salvar o Preset!"); return; }
    dbAudio.ref(`mestres/${uid}/trilhaPresets`).push({ url, titulo });
};

window.carregarPresetTrilha = function(url, titulo) {
    const uid = firebase.auth().currentUser.uid;
    const dbAudio = firebase.database();
    document.getElementById('mestre-audio-url').value = url;
    document.getElementById('mestre-audio-titulo').value = titulo;
    
    dbAudio.ref(`mestres/${uid}/trilhaAtiva`).set({ url: url, titulo: titulo, status: 'playing', tempoAtual: 0 });
};

window.deletarPresetTrilha = function(key) {
    if(confirm("Deseja apagar esta música da sua coleção?")) {
        const uid = firebase.auth().currentUser.uid;
        const dbAudio = firebase.database();
        dbAudio.ref(`mestres/${uid}/trilhaPresets/${key}`).remove();
    }
};

window.ajustarVolumeLocalMestre = function(val) { 
    mestreAudioNode.volume = val / 100;
    if(isYouTube && ytPlayer && typeof ytPlayer.setVolume === 'function') ytPlayer.setVolume(val);
    localStorage.setItem('vtt-mestre-volume', val);
};

function formatarTempoAudio(segundos) {
    if(isNaN(segundos)) return "00:00";
    const m = Math.floor(segundos / 60).toString().padStart(2, '0');
    const s = Math.floor(segundos % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

mestreAudioNode.addEventListener('timeupdate', () => {
    const display = document.getElementById('mestre-audio-time-display');
    if(display && !mestreAudioNode.paused) { display.innerText = formatarTempoAudio(mestreAudioNode.currentTime); }
});

window.toggleLoopTrilha = function() {
    const uid = firebase.auth().currentUser.uid;
    const dbAudio = firebase.database();
    dbAudio.ref(`mestres/${uid}/trilhaAtiva/loop`).once('value', (snap) => {
        let estadoAtual = snap.val();
        if (estadoAtual === null) estadoAtual = true;
        dbAudio.ref(`mestres/${uid}/trilhaAtiva/loop`).set(!estadoAtual);
    });
};