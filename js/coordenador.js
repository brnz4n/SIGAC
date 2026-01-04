const LIMITES_POR_TIPO = {
    "Monitoria": 96,
    "Curso de Extensão ou Minicurso": 16,
    "Pesquisa": 96,
    "Organização de Eventos": 32,
    "Ouvinte em Palestras/Seminários": 8,
    "Publicação de Artigo": 96,
    "Estágio": 32,
    "Desenvolvimento de Hardware/Software": 96,
    "Esportes": 80
};

// Variáveis Globais
let listaGlobalCache = [];
let cacheSolicitacoesCoord = [];
let idSolicitacaoAnaliseAtual = null;
let idComprovanteAnaliseAtual = null;

async function carregarDashboardCoordenador() {
    const token = localStorage.getItem('token');
    if (!token) return;

    const filtroEl = document.getElementById('filtroStatus');
    const statusFiltro = filtroEl ? filtroEl.value : 'PENDENTE';
    const tbody = document.getElementById('tabelaAnalise');
    if(!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-5"><div class="spinner-border text-primary"></div></td></tr>`;

    try {
        const response = await fetch(`${API_BASE_URL}/solicitacoes`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.ok) {
            const listaCompleta = await response.json();
            
            listaGlobalCache = listaCompleta;

            calcularEstatisticasGerais(listaCompleta);

            let listaParaTabela = listaCompleta;
            if (statusFiltro !== 'TODOS') {
                listaParaTabela = listaCompleta.filter(item => item.status === statusFiltro);
            }
            
            cacheSolicitacoesCoord = listaParaTabela;
            tbody.innerHTML = '';

            if (listaParaTabela.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">Nenhuma solicitação encontrada.</td></tr>';
                return;
            }

            if (statusFiltro === 'PENDENTE') atualizarContadores(listaParaTabela.length);

            listaParaTabela.forEach(item => {
                let dataFormatada = '-';
                if (item.dataInicio) dataFormatada = new Date(item.dataInicio).toLocaleDateString('pt-BR');
                else if (item.dataSolicitacao) dataFormatada = new Date(item.dataSolicitacao).toLocaleDateString('pt-BR');

                let badgeClass = 'bg-light text-secondary border';
                if(item.status === 'DEFERIDO') badgeClass = 'bg-success text-white';
                if(item.status === 'INDEFERIDO') badgeClass = 'bg-danger text-white';
                if(item.status === 'PENDENTE') badgeClass = 'bg-warning text-dark';

                const linha = `
                    <tr>
                        <td class="ps-4">
                            <div class="fw-bold text-dark">${item.nomeDiscente || 'Aluno'}</div>
                            <div class="small text-muted">${item.matriculaDiscente || '---'}</div>
                        </td>
                        <td>
                            <span class="badge ${badgeClass} mb-1">${item.subtipoAtividade || 'Geral'}</span>
                        </td>
                        <td class="fw-bold text-primary">${item.cargaHorariaTotal}h</td>
                        <td>${dataFormatada}</td>
                        <td class="text-center">
                            <button class="btn btn-primary btn-sm rounded-pill px-3 shadow-sm" onclick="abrirModalAnalise(${item.id})">
                                <i class='bx bx-search-alt'></i> Analisar
                            </button>
                        </td>
                    </tr>`;
                tbody.innerHTML += linha;
            });

        } else {
            console.error("Erro API:", response.status);
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Erro ${response.status} ao carregar dados.</td></tr>`;
        }
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Erro de conexão.</td></tr>';
    }
}

function calcularEstatisticasGerais(lista) {
    const pendentes = lista.filter(i => i.status === 'PENDENTE').length;
    
    const hoje = new Date();
    const aprovadosMes = lista.filter(i => {
        if (i.status !== 'DEFERIDO') return false;
        const dataRef = i.dataSolicitacao ? new Date(i.dataSolicitacao) : new Date();
        return dataRef.getMonth() === hoje.getMonth() && dataRef.getFullYear() === hoje.getFullYear();
    }).length;

    const rejeitados = lista.filter(i => i.status === 'INDEFERIDO').length;

    if(document.getElementById('countPendentes')) document.getElementById('countPendentes').innerText = pendentes;
    if(document.getElementById('countAprovados')) document.getElementById('countAprovados').innerText = aprovadosMes;
    if(document.getElementById('countRisco')) document.getElementById('countRisco').innerText = rejeitados;
}

function atualizarContadores(qtd) {
    const el = document.getElementById('countPendentes');
    if (el) el.innerText = qtd;
}

function abrirModalAnalise(id) {
    const item = listaGlobalCache.find(s => s.id === id);
    if (!item) return;

    idSolicitacaoAnaliseAtual = item.id;
    
    document.getElementById('modalAlunoNome').innerText = item.nomeDiscente || "Aluno";
    document.getElementById('modalGrupo').innerText = "Atividade";
    document.getElementById('modalTipo').innerText = item.subtipoAtividade || "---";
    document.getElementById('modalInstituicao').innerText = item.nomeInstituicao || "---";
    document.getElementById('modalHoras').innerText = `${item.cargaHorariaTotal}h`;
    
    let dataRealizacao = '--/--/----';
    if(item.dataInicio) dataRealizacao = new Date(item.dataInicio).toLocaleDateString('pt-BR');
    else if(item.dataSolicitacao) dataRealizacao = new Date(item.dataSolicitacao).toLocaleDateString('pt-BR');
    document.getElementById('modalData').innerText = dataRealizacao;

    calcularProgressoAluno(item.matriculaDiscente, item.subtipoAtividade);

    const btnAnexo = document.getElementById('modalAnexo');
    if (item.comprovante && item.comprovante.id) {
        idComprovanteAnaliseAtual = item.comprovante.id;
        btnAnexo.classList.remove('disabled');
        btnAnexo.innerHTML = "<i class='bx bxs-file-pdf'></i> Visualizar Certificado (Anexo)";
        btnAnexo.onclick = (e) => {
            e.preventDefault();
            visualizarComprovanteCoordenador(idComprovanteAnaliseAtual);
        };
    } else {
        idComprovanteAnaliseAtual = null;
        btnAnexo.classList.add('disabled');
        btnAnexo.innerHTML = "Sem Anexo";
        btnAnexo.onclick = null;
    }

    document.getElementById('modalObservacao').value = "";

    new bootstrap.Modal(document.getElementById('analiseModal')).show();
}

function calcularProgressoAluno(matricula, subtipo) {

    const limiteHoras = LIMITES_POR_TIPO[subtipo] || 100;
    
    const solicitacoesDoAluno = listaGlobalCache.filter(req =>
        req.matriculaDiscente === matricula &&
        req.subtipoAtividade === subtipo &&
        req.status === 'DEFERIDO'
    );

    const horasAcumuladas = solicitacoesDoAluno.reduce((acc, curr) => acc + (curr.cargaHorariaTotal || 0), 0);

    const lblAcumulado = document.getElementById('lblAcumulado');
    const lblLimite = document.getElementById('lblLimite');
    const barra = document.getElementById('barraProgresso');

    if (lblAcumulado) lblAcumulado.innerText = `Acumulado: ${horasAcumuladas}h`;
    if (lblLimite) lblLimite.innerText = `Limite: ${limiteHoras}h`;
    
    if (barra) {
        const porcentagem = Math.min((horasAcumuladas / limiteHoras) * 100, 100);
        barra.style.width = `${porcentagem}%`;
        
        if (porcentagem >= 100) {
            barra.className = 'progress-bar bg-success';
        } else if (porcentagem > 80) {
            barra.className = 'progress-bar bg-warning';
        } else {
            barra.className = 'progress-bar bg-primary';
        }
    }
}

async function visualizarComprovanteCoordenador(id) {
    const btn = document.getElementById('modalAnexo');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = "Carregando...";
    
    const novaAba = window.open('', '_blank');
    if(novaAba) novaAba.document.write('Carregando...');

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/comprovantes/${id}/download`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            const blob = await response.blob();
            const fileURL = window.URL.createObjectURL(blob);
            if(novaAba) novaAba.location.href = fileURL;
        } else {
            if(novaAba) novaAba.close();
            alert("Erro ao baixar arquivo.");
        }
    } catch (e) {
        if(novaAba) novaAba.close();
        alert("Erro de conexão.");
    } finally {
        btn.innerHTML = txtOriginal;
    }
}

async function avaliarSolicitacao(novoStatus) {
    const obs = document.getElementById('modalObservacao').value;
    const token = localStorage.getItem('token');
    
    if (!idSolicitacaoAnaliseAtual) return;

    if (novoStatus === 'INDEFERIDO' && !obs.trim()) {
        alert("Justificativa obrigatória para indeferimento.");
        document.getElementById('modalObservacao').focus();
        return;
    }

    if(!confirm(`Confirma ${novoStatus} esta solicitação?`)) return;

    try {
        const response = await fetch(`${API_BASE_URL}/solicitacoes/${idSolicitacaoAnaliseAtual}/status`, {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ status: novoStatus, observacaoResponsavel: obs })
        });

        if (response.ok) {
            const modalEl = document.getElementById('analiseModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();

            alert(`Solicitação ${novoStatus} com sucesso!`);
            carregarDashboardCoordenador();
        } else {
            alert("Erro ao atualizar status.");
        }
    } catch (error) {
        console.error(error);
        alert("Erro de conexão.");
    }
}