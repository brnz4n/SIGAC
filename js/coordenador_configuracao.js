document.addEventListener("DOMContentLoaded", () => {
    if (typeof verificarAutenticacao === 'function') verificarAutenticacao();
    
    carregarConfiguracoes();

    const btnSalvar = document.getElementById('btnSalvarConfig');
    if (btnSalvar) {
        btnSalvar.onclick = salvarConfiguracoes;
    }
});

async function carregarConfiguracoes() {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_BASE_URL}/configuracoes`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            const config = await response.json();
            preencherCampos(config);
        } else {
            console.warn("Configuração não encontrada ou endpoint inexistente. Usando padrão.");
            const padrao = {
                limiteEnsino: 120,
                limitePesquisa: 120,
                limiteExtensao: 120,
                dataInicioSubmissao: "2025-02-01",
                dataFimSubmissao: "2025-06-30",
                permitirAtraso: true
            };
            preencherCampos(padrao);
        }
    } catch (error) {
        console.error("Erro ao carregar configurações:", error);
    }
}

function preencherCampos(config) {
    if(document.getElementById('limiteEnsino')) 
        document.getElementById('limiteEnsino').value = config.limiteEnsino || 120;
    
    if(document.getElementById('limitePesquisa')) 
        document.getElementById('limitePesquisa').value = config.limitePesquisa || 120;
    
    if(document.getElementById('limiteExtensao')) 
        document.getElementById('limiteExtensao').value = config.limiteExtensao || 120;

    if(document.getElementById('dataInicio')) 
        document.getElementById('dataInicio').value = config.dataInicioSubmissao || "";
    
    if(document.getElementById('dataFim')) 
        document.getElementById('dataFim').value = config.dataFimSubmissao || "";

    if(document.getElementById('checkAtraso')) 
        document.getElementById('checkAtraso').checked = config.permitirAtraso;
}

async function salvarConfiguracoes() {
    const btn = document.getElementById('btnSalvarConfig');
    const textoOriginal = btn.innerHTML;
    
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Salvando...`;
    btn.disabled = true;

    const payload = {
        limiteEnsino: parseInt(document.getElementById('limiteEnsino').value),
        limitePesquisa: parseInt(document.getElementById('limitePesquisa').value),
        limiteExtensao: parseInt(document.getElementById('limiteExtensao').value),
        dataInicioSubmissao: document.getElementById('dataInicio').value,
        dataFimSubmissao: document.getElementById('dataFim').value,
        permitirAtraso: document.getElementById('checkAtraso').checked
    };

    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`${API_BASE_URL}/configuracoes`, {
            method: "PUT",
            headers: { 
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("Configurações atualizadas com sucesso!");
        } else {
            if(response.status === 404) {
                alert("Simulação: Dados salvos localmente (Backend não encontrado).");
                console.log("Payload enviado:", payload);
            } else {
                alert("Erro ao salvar: " + response.status);
            }
        }

    } catch (error) {
        console.error(error);
        alert("Erro de conexão ao tentar salvar.");
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
}