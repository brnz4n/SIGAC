document.addEventListener("DOMContentLoaded", () => {
    if (typeof verificarAutenticacao === 'function') verificarAutenticacao();
    
    carregarEstatisticasGerais();
    configurarBotoesExportacao();
});

let cacheRelatorio = {
    alunos: [],
    solicitacoes: []
};

async function carregarEstatisticasGerais() {
    const token = localStorage.getItem('token');
    
    try {
        const respAlunos = await fetch(`${API_BASE_URL}/discentes`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        const respSolicitacoes = await fetch(`${API_BASE_URL}/solicitacoes`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (respAlunos.ok && respSolicitacoes.ok) {
            const alunos = await respAlunos.json();
            const solicitacoes = await respSolicitacoes.json();

            cacheRelatorio.alunos = alunos.map(a => processarAluno(a));
            cacheRelatorio.solicitacoes = solicitacoes;

            atualizarGraficos(cacheRelatorio);
            preencherTabelaAuditoria(solicitacoes.slice(0, 5));
        }

    } catch (error) {
        console.error("Erro ao carregar dados do relatório:", error);
    }
}

function processarAluno(aluno) {
    const horas = aluno.horasCumpridas || 0;
    const meta = aluno.totalHorasComplementares || 200;
    
    const anoIngresso = new Date(aluno.ingressao).getFullYear();
    const anoAtual = new Date().getFullYear();
    const semestreEstimado = (anoAtual - anoIngresso) * 2; 

    let status = 'REGULAR';
    if (horas >= meta) status = 'CONCLUIDO';
    else if (semestreEstimado >= 9 && horas < 100) status = 'RISCO';

    return { ...aluno, statusCalculado: status, semestreEstimado };
}

function atualizarGraficos(dados) {
    const total = dados.solicitacoes.length;
    if (total > 0) {
        const deferidas = dados.solicitacoes.filter(s => s.status === 'DEFERIDA' || s.status === 'DEFERIDO').length;
        const indeferidas = dados.solicitacoes.filter(s => s.status === 'INDEFERIDA' || s.status === 'INDEFERIDO').length;
        const pendentes = dados.solicitacoes.filter(s => s.status === 'PENDENTE').length;

        document.querySelector('h4.fw-bold.mb-0').innerText = total;

        const pDef = Math.round((deferidas / total) * 100);
        const pInd = Math.round((indeferidas / total) * 100);
        const pPen = Math.round((pendentes / total) * 100);

        const spans = document.querySelectorAll('.flex-grow-1 .fw-bold');
        if(spans.length >= 3) {
            spans[0].innerText = `${pDef}%`; 
            spans[1].innerText = `${pInd}%`; 
            spans[2].innerText = `${pPen}%`; 
        }
    }

    let horasEnsino = 0;
    let horasPesquisa = 0;
    let horasExtensao = 0;

    dados.solicitacoes.forEach(s => {
        if (s.status === 'DEFERIDA' || s.status === 'DEFERIDO') {
            const h = s.cargaHorariaAproveitada || s.cargaHorariaSolicitada || 0;
            const nome = (s.nomeAtividade || "").toUpperCase();

            if (nome.includes("MONITORIA") || nome.includes("ENSINO") || nome.includes("CURSO")) horasEnsino += h;
            else if (nome.includes("PESQUISA") || nome.includes("ARTIGO") || nome.includes("INICIAÇÃO")) horasPesquisa += h;
            else horasExtensao += h;
        }
    });

    const maiorValor = Math.max(horasEnsino, horasPesquisa, horasExtensao) || 1;

    atualizarBarraGrupo(0, horasEnsino, maiorValor);
    atualizarBarraGrupo(1, horasPesquisa, maiorValor);
    atualizarBarraGrupo(2, horasExtensao, maiorValor);
}

function atualizarBarraGrupo(index, valor, maximo) {
    const containers = document.querySelectorAll('.card-body .mb-3, .card-body > div:last-child'); 
    
    if (containers[index]) {
        const textoValor = containers[index].querySelector('.fw-bold');
        const barra = containers[index].querySelector('.progress-bar');
        
        if (textoValor) textoValor.innerText = `${valor}h`;
        if (barra) barra.style.width = `${(valor / maximo) * 100}%`;
    }
}

function configurarBotoesExportacao() {
    const btnConcluintes = document.querySelectorAll('button.btn-outline-primary.w-100')[0];
    if (btnConcluintes) {
        btnConcluintes.onclick = () => exportarCSV(
            cacheRelatorio.alunos.filter(a => a.statusCalculado === 'CONCLUIDO'),
            "Relatorio_Concluintes.csv"
        );
    }

    const btnRisco = document.querySelector('button.btn-outline-danger.w-100');
    if (btnRisco) {
        btnRisco.onclick = () => exportarCSV(
            cacheRelatorio.alunos.filter(a => a.statusCalculado === 'RISCO'),
            "Relatorio_Alunos_Risco.csv"
        );
    }

    const btnGeral = document.querySelector('button.btn-outline-success.w-100');
    if (btnGeral) {
        btnGeral.onclick = () => exportarSolicitacoesCSV(cacheRelatorio.solicitacoes);
    }
}

function exportarCSV(listaAlunos, nomeArquivo) {
    if (!listaAlunos || listaAlunos.length === 0) {
        alert("Nenhum dado encontrado para este relatório.");
        return;
    }
    
    let csvContent = "MATRICULA;NOME;EMAIL;HORAS CUMPRIDAS;STATUS\n";
    
    listaAlunos.forEach(item => {
        const linha = [
            item.matricula,
            item.nome,
            item.email,
            (item.horasCumpridas || 0).toString().replace('.', ','),
            item.statusCalculado
        ];
        csvContent += linha.join(";") + "\n";
    });

    baixarArquivo(csvContent, nomeArquivo);
}

function exportarSolicitacoesCSV(lista) {
    if (!lista || lista.length === 0) {
        alert("Nenhuma solicitação encontrada.");
        return;
    }

    let csvContent = "DATA;ALUNO;ATIVIDADE;HORAS;STATUS;RESPONSAVEL\n";

    lista.forEach(item => {
        const data = item.dataSolicitacao ? new Date(item.dataSolicitacao).toLocaleDateString() : '-';
        const linha = [
            data,
            item.nomeDiscente || item.matriculaDiscente,
            item.nomeAtividade || "Geral",
            (item.cargaHorariaAproveitada || item.cargaHorariaSolicitada || 0).toString().replace('.', ','),
            item.status,
            item.nomeResponsavel || "Sistema"
        ];
        csvContent += linha.join(";") + "\n";
    });

    baixarArquivo(csvContent, "Extrato_Geral_Solicitacoes.csv");
}

function baixarArquivo(conteudo, nome) {
    const blob = new Blob(["\uFEFF" + conteudo], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", nome);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function preencherTabelaAuditoria(ultimasSolicitacoes) {
    const tbody = document.querySelector('table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    ultimasSolicitacoes.forEach(s => {
        let badge = '<span class="badge bg-secondary">Pendente</span>';
        if (s.status === 'DEFERIDA' || s.status === 'DEFERIDO') badge = '<span class="badge bg-success">Deferimento</span>';
        if (s.status === 'INDEFERIDA' || s.status === 'INDEFERIDO') badge = '<span class="badge bg-danger">Indeferimento</span>';

        const data = s.dataAnalise 
            ? new Date(s.dataAnalise).toLocaleString('pt-BR') 
            : (s.dataSolicitacao ? new Date(s.dataSolicitacao).toLocaleString('pt-BR') : '-');

        const linha = `
        <tr>
            <td class="ps-4 text-muted">${data}</td>
            <td class="fw-bold">${s.nomeResponsavel || "Sistema/Aguardando"}</td>
            <td>${badge}</td>
            <td>${s.nomeDiscente || s.matriculaDiscente}</td>
            <td class="small text-muted">${s.observacaoResponsavel || (s.nomeAtividade + " - " + s.cargaHorariaSolicitada + "h")}</td>
        </tr>
        `;
        tbody.innerHTML += linha;
    });
}