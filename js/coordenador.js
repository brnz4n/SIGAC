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
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            const listaCompleta = await response.json();
            listaGlobalCache = listaCompleta;

            calcularEstatisticasGerais(listaCompleta);

            let listaParaTabela = listaCompleta;
            
            if (statusFiltro && statusFiltro !== 'TODOS') {
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
                if (item.dataSolicitacao) {
                    dataFormatada = new Date(item.dataSolicitacao).toLocaleDateString('pt-BR', {timeZone: 'UTC'});
                }

                let badgeClass = 'bg-light text-secondary border';
                const status = item.status ? item.status.toUpperCase() : 'DESCONHECIDO';
                
                if(status === 'DEFERIDO' || status === 'APROVADO') badgeClass = 'bg-success text-white';
                if(status === 'INDEFERIDO' || status === 'REJEITADO') badgeClass = 'bg-danger text-white';
                if(status === 'PENDENTE') badgeClass = 'bg-warning text-dark';

                const cargaHoraria = item.cargaHorariaSolicitada || item.cargaHorariaTotal || 0;
                const nomeAtividade = item.nomeAtividade || 'Atividade Geral';
                const nomeSubtipo = item.nomeSubtipo || item.subtipoAtividade || '---';
                const participacao = item.participacao ? `(${item.participacao})` : '';

                const linha = `
                    <tr>
                        <td class="ps-4">
                            <div class="fw-bold text-dark">${item.nomeDiscente || 'Aluno'}</div>
                            <div class="small text-muted">${item.matriculaDiscente || ''}</div>
                        </td>
                        <td>
                            <div class="fw-semibold text-dark">${nomeAtividade}</div>
                            <div class="small text-muted">${nomeSubtipo} ${participacao}</div>
                        </td>
                        <td class="fw-bold text-primary">${cargaHoraria}h</td>
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
        if (i.status !== 'DEFERIDO' && i.status !== 'APROVADO') return false;
        const dataRef = i.dataSolicitacao ? new Date(i.dataSolicitacao) : new Date();
        return dataRef.getMonth() === hoje.getMonth() && dataRef.getFullYear() === hoje.getFullYear();
    }).length;

    const rejeitados = lista.filter(i => i.status === 'INDEFERIDO' || i.status === 'REJEITADO').length;

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
    
    const atividade = item.nomeAtividade || "Geral";
    const subtipo = item.nomeSubtipo || item.subtipoAtividade || "---";
    document.getElementById('modalGrupo').innerText = atividade;
    document.getElementById('modalTipo').innerText = subtipo;
    
    const instituicao = item.nomeInstituicao || "Universidade Federal do Ceará"; 
    const participacao = item.participacao ? ` - ${item.participacao}` : "";
    document.getElementById('modalInstituicao').innerText = instituicao + participacao;
    
    const horas = item.cargaHorariaSolicitada || item.cargaHorariaTotal || 0;
    document.getElementById('modalHoras').innerText = `${horas}h`;
    
    let textoData = '---';
    if(item.dataInicio && item.dataFim) {
        const inicio = new Date(item.dataInicio).toLocaleDateString('pt-BR', {timeZone: 'UTC'});
        const fim = new Date(item.dataFim).toLocaleDateString('pt-BR', {timeZone: 'UTC'});
        textoData = `${inicio} até ${fim}`;
    } else if(item.dataSolicitacao) {
        textoData = "Submetido em: " + new Date(item.dataSolicitacao).toLocaleDateString('pt-BR', {timeZone: 'UTC'});
    }
    document.getElementById('modalData').innerText = textoData;

    const btnAnexo = document.getElementById('modalAnexo');
    const idAnexo = item.comprovanteId || (item.comprovante ? item.comprovante.id : null);

    if (idAnexo) {
        idComprovanteAnaliseAtual = idAnexo;
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

async function visualizarComprovanteCoordenador(id) {
    const btn = document.getElementById('modalAnexo');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = "Carregando...";
    
    const novaAba = window.open('', '_blank');
    if(novaAba) novaAba.document.write('<html><body><h3>Carregando documento...</h3></body></html>');

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

    const itemAtual = listaGlobalCache.find(i => i.id === idSolicitacaoAnaliseAtual);
    const horasSolicitadas = itemAtual ? (itemAtual.cargaHorariaSolicitada || itemAtual.cargaHorariaTotal || 0) : 0;

    let statusBackend = novoStatus;
    if (novoStatus === 'DEFERIDO') statusBackend = 'DEFERIDA';
    if (novoStatus === 'INDEFERIDO') statusBackend = 'INDEFERIDA';

    if (statusBackend === 'INDEFERIDA' && !obs.trim()) {
        alert("É obrigatório escrever uma justificativa para indeferir.");
        document.getElementById('modalObservacao').focus();
        return;
    }

    if(!confirm(`Confirma a atualização da solicitação para ${novoStatus}?`)) return;

    const horasAproveitadas = (statusBackend === 'DEFERIDA') ? horasSolicitadas : 0;

    try {
        const response = await fetch(`${API_BASE_URL}/solicitacoes/${idSolicitacaoAnaliseAtual}/status`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ 
                status: statusBackend, 
                observacaoResponsavel: obs,
                cargaHorariaAproveitada: horasAproveitadas
            })
        });

        if (response.ok) {
            const modalEl = document.getElementById('analiseModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();

            alert(`Solicitação atualizada com sucesso! (${horasAproveitadas}h creditadas)`);
            carregarDashboardCoordenador();
        } else {
            const erroTexto = await response.text();
            console.error("Erro Backend:", erroTexto);
            alert("Erro ao atualizar status: " + erroTexto);
        }
    } catch (error) {
        console.error(error);
        alert("Erro de conexão.");
    }
}