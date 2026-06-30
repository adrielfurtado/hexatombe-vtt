function initRolagens(uid) {
    const dbRolagens = firebase.database(); 
    const listaHtml = document.getElementById('dice-history-list');
    if (!listaHtml) return;

    dbRolagens.ref(`mestres/${uid}/rolagens`).on('value', (snapshot) => {
        listaHtml.innerHTML = '';
        if (!snapshot.exists()) {
            listaHtml.innerHTML = '<p style="text-align: center; color: #777; font-family: sans-serif; margin-top: 20px;">O silêncio precede a tempestade... Nenhuma rolagem registrada.</p>';
            return;
        }

        const rolagens = [];
        snapshot.forEach(child => { rolagens.push({ id: child.key, ...child.val() }); });

        rolagens.reverse().forEach(rolagem => {
            const item = document.createElement('div');
            
            item.style.cssText = "background: rgba(0,0,0,0.6); padding: 10px 15px; border-left: 4px solid var(--blood-red); margin-bottom: 10px; border-radius: 4px;";
            
            item.innerHTML = `
                <span style="color: #ffc107; font-weight: bold; font-family: 'Medieval', serif; font-size: 1.2rem; display: block; margin-bottom: 2px;">${rolagem.agente}</span>
                <span style="font-size: 1.2rem; font-weight: bold; color: #fff;">RESULTADO: ${rolagem.total}</span>
                <span style="font-size: 0.8rem; color: #888; display: block; margin-top: 5px; font-family: sans-serif;">(DADOS: <b style="color:#ccc;">${rolagem.d20}</b> | BÔNUS: <b style="color:#ccc;">${rolagem.bonus}</b>)</span>
            `;
            listaHtml.appendChild(item);
        });
    });

    const widget = document.getElementById('floating-history-widget');
    if(widget) tornarHistoricoArrastavel(widget);
}

function tornarHistoricoArrastavel(elmnt) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = document.getElementById(elmnt.id + "-header");
    if (header) { header.onmousedown = dragMouseDown; } else { elmnt.onmousedown = dragMouseDown; }

    function dragMouseDown(e) {
        e = e || window.event;
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
        elmnt.style.transform = "none";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

window.abrirHistoricoDados = function() {
    const widget = document.getElementById('floating-history-widget');
    if (widget) widget.style.display = 'flex';
};

window.fecharHistoricoDados = function() {
    const widget = document.getElementById('floating-history-widget');
    if (widget) widget.style.display = 'none';
};

window.limparHistorico = function() {
    if(confirm("Deseja apagar o histórico de dados de TODOS os jogadores?")) {
        const uid = firebase.auth().currentUser.uid;
        const dbRolagens = firebase.database();
        dbRolagens.ref(`mestres/${uid}/rolagens`).remove();
    }
};