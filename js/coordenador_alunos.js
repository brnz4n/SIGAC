let cacheAlunos = []; 
let listaAtual = []; 

document.addEventListener("DOMContentLoaded", () => {
    if (typeof verificarAutenticacao === 'function') verificarAutenticacao();
    carregarListaAlunos();

    const btnFiltrar = document.querySelector('.btn-primary.w-100');
    if (btnFiltrar) btnFiltrar.onclick = aplicarFiltros;

    const btnExportar = document.querySelector('button.btn-outline-primary.rounded-pill');
    if (btnExportar) {
        btnExportar.onclick = exportarRelatorio;
    }
});

async function carregarListaAlunos() {
    const token = localStorage.getItem('token');
    const tbody = document.querySelector('table tbody');

    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2 text-muted">Carregando discentes...</p></td></tr>`;

    try {
        const response = await fetch(`${API_BASE_URL}/discentes`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            const alunos = await response.json();
            
            cacheAlunos = alunos.map(aluno => processarDadosAluno(aluno));

            listaAtual = cacheAlunos;
            
            renderizarTabela(listaAtual);
        } else {
            console.error("Erro status:", response.status);
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Erro ao carregar lista (Status ${response.status}). Verifique se você tem permissão.</td></tr>`;
        }
    } catch (error) {
        console.error(error);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Erro de conexão com o servidor.</td></tr>`;
    }
}

function processarDadosAluno(aluno) {
    const horasFeitas = aluno.horasCumpridas || 0;
    const meta = aluno.totalHorasComplementares || 200; 

    const semestreCalculado = calcularSemestreAtual(aluno.ingressao);

    let status = 'REGULAR';

    if (horasFeitas >= meta) {
        status = 'CONCLUIDO';
    } else if (semestreCalculado >= 9 && horasFeitas < (meta * 0.5)) {
        status = 'RISCO';
    }

    return { 
        ...aluno, 
        horasFeitas: horasFeitas,
        meta: meta,
        semestreAtual: semestreCalculado,
        statusCalculado: status, 
        porcentagem: (horasFeitas / meta) * 100 
    };
}

function calcularSemestreAtual(dataIngressao) {
    if (!dataIngressao) return 1;

    const agora = new Date();
    const ingresso = new Date(dataIngressao); 

    let diffAnos = agora.getFullYear() - ingresso.getFullYear();
    
    let semAgora = agora.getMonth() < 6 ? 1 : 2;
    let semIngresso = ingresso.getMonth() < 6 ? 1 : 2;

    let total = (diffAnos * 2) + (semAgora - semIngresso) + 1;

    return total > 0 ? total : 1;
}

function renderizarTabela(lista) {
    const tbody = document.querySelector('table tbody');
    tbody.innerHTML = '';

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Nenhum aluno encontrado.</td></tr>`;
        return;
    }

    lista.forEach(aluno => {
        const iniciais = gerarIniciais(aluno.nome);
        
        let corTema = 'primary'; 
        let corBadge = 'bg-light text-dark border';
        let textoBadge = 'Regular';
        let rowClass = '';
        let avisoRisco = '';

        if (aluno.statusCalculado === 'CONCLUIDO') {
            corTema = 'success';
            corBadge = 'bg-success bg-opacity-10 text-success border border-success border-opacity-25';
            textoBadge = 'Concluído';
        } else if (aluno.statusCalculado === 'RISCO') {
            corTema = 'danger';
            corBadge = 'bg-danger text-white';
            textoBadge = 'Crítico';
            rowClass = 'table-danger bg-opacity-10';
            avisoRisco = `<small class="text-danger fw-bold d-block mt-1" style="font-size: 0.7rem;"><i class='bx bx-error'></i> Risco de não colação</small>`;
        }

        let widthBarra = aluno.porcentagem > 100 ? 100 : aluno.porcentagem;

        const linha = `
        <tr class="${rowClass}">
            <td class="ps-4">
                <div class="d-flex align-items-center">
                    <div class="bg-${corTema} text-white rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px; font-size: 0.9rem;">
                        ${iniciais}
                    </div>
                    <div>
                        <h6 class="mb-0 fw-bold ${aluno.statusCalculado === 'RISCO' ? 'text-danger' : 'text-dark'}">${aluno.nome}</h6>
                        <small class="${aluno.statusCalculado === 'RISCO' ? 'text-danger opacity-75' : 'text-muted'}">${aluno.matricula}</small>
                    </div>
                </div>
            </td>
            <td class="${aluno.statusCalculado === 'RISCO' ? 'text-danger fw-bold' : ''}">${aluno.semestreAtual}º Semestre</td>
            <td>
                <div class="d-flex justify-content-between small mb-1">
                    <span class="fw-bold text-${corTema}">${aluno.horasFeitas}h</span>
                    <span class="text-muted">Meta: ${aluno.meta}h</span>
                </div>
                <div class="progress bg-secondary bg-opacity-10" style="height: 6px;">
                    <div class="progress-bar bg-${corTema}" role="progressbar" style="width: ${widthBarra}%;"></div>
                </div>
                ${avisoRisco}
            </td>
            <td class="text-center">
                <span class="badge rounded-pill px-3 ${corBadge}">${textoBadge}</span>
            </td>
            <td class="pe-4 text-end">
                <a href="lancamento_manual.html?id=${aluno.matricula}" class="btn btn-sm btn-outline-${corTema === 'white' ? 'secondary' : corTema}" title="Lançar Horas">
                    <i class='bx bx-plus'></i>
                </a>
                <button onclick="verHistoricoAluno('${aluno.matricula}')" class="btn btn-sm btn-outline-primary" title="Ver Histórico Completo">
                    <i class='bx bx-id-card'></i>
                </button>
            </td>
        </tr>
        `;
        tbody.innerHTML += linha;
    });
}

function aplicarFiltros() {
    const termoBusca = document.querySelector('input[type="text"]').value.toLowerCase();
    const selects = document.querySelectorAll('select');
    const filtroSituacao = selects[0].value; 
    const filtroSemestre = selects[1].value;

    const listaFiltrada = cacheAlunos.filter(aluno => {
        const matchTexto = aluno.nome.toLowerCase().includes(termoBusca) || 
                           aluno.matricula.toString().includes(termoBusca);

        let matchSituacao = true;
        if (filtroSituacao === 'risco') matchSituacao = (aluno.statusCalculado === 'RISCO');
        if (filtroSituacao === 'concluido') matchSituacao = (aluno.statusCalculado === 'CONCLUIDO');
        if (filtroSituacao === 'regular') matchSituacao = (aluno.statusCalculado === 'REGULAR');

        let matchSemestre = true;
        if (filtroSemestre !== 'Semestre: Todos') {
            matchSemestre = (aluno.semestreAtual == filtroSemestre);
        }

        return matchTexto && matchSituacao && matchSemestre;
    });

    listaAtual = listaFiltrada;

    renderizarTabela(listaFiltrada);
}

function exportarRelatorio() {
    if (!listaAtual || listaAtual.length === 0) {
        alert("Não há dados na tabela para exportar.");
        return;
    }

    let csvContent = "MATRICULA;NOME;SEMESTRE;HORAS CUMPRIDAS;META;STATUS\n";

    listaAtual.forEach(item => {
        const linha = [
            item.matricula,
            item.nome,
            item.semestreAtual + "º Semestre",
            item.horasFeitas.toString().replace('.', ','), 
            item.meta,
            item.statusCalculado
        ];
        csvContent += linha.join(";") + "\n";
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "Relatorio_Alunos_SIGAC.csv"); 
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function gerarIniciais(nome) {
    if (!nome) return "??";
    const partes = nome.trim().split(" ");
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[1][0]).toUpperCase();
}

function verHistoricoAluno(matricula) {
    localStorage.setItem('matriculaDetalhe', matricula);
    alert("Redirecionando para detalhes do aluno: " + matricula);
    // window.location.href = 'coordenador_historico_aluno.html';
}