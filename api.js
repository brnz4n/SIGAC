// URL base do seu Backend
const API_BASE_URL = "http://localhost:8080"; 

/* ==========================================================================
   AUTENTICAÇÃO
   ========================================================================== */

async function login(event) {
    event.preventDefault();

    const loginInput = document.getElementById('matricula').value; 
    const senhaInput = document.getElementById('senha').value;
    const btn = event.target.querySelector('button');
    const originalText = btn.innerText;
    
    btn.innerText = "Autenticando...";
    btn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: loginInput, senha: senhaInput })
        });

        if (response.ok) {
            const data = await response.json(); 
            localStorage.setItem('token', data.token);
            
            // Redirecionamento baseado no perfil retornado pelo Java
            if (data.perfil === 'DISCENTE') {
                // MUDANÇA: O back não retorna matrícula no login, então buscamos os dados pelo e-mail
                await buscarDiscentePorEmail(data.email, data.token); 
            
            } else if (data.perfil === 'COORDENADOR') {
                localStorage.setItem('usuario', JSON.stringify({ nome: "Prof. Fernando", perfil: "COORDENADOR" }));
                window.location.href = 'dashboard_coordenador.html';
            
            } else if (data.perfil === 'ADMIN') {
                localStorage.setItem('usuario', JSON.stringify({ nome: "Admin", perfil: "ADMIN" }));
                window.location.href = 'dashboard_adm.html'; 
            }

        } else {
            alert("Login inválido! Verifique suas credenciais.");
        }
    } catch (error) {
        console.error("Erro:", error);
        alert("Erro de conexão com o servidor.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// --- NOVA FUNÇÃO ---
// Busca todos os alunos e filtra aquele que tem o e-mail do login
async function buscarDiscentePorEmail(email, token) {
    try {
        // 1. Pede a lista de todos os alunos
        const response = await fetch(`${API_BASE_URL}/discentes`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            const lista = await response.json();
            
            // 2. Procura na lista o aluno com este e-mail
            const discente = lista.find(aluno => aluno.email === email);

            if (discente) {
                // 3. Achou! Salva os dados completos (incluindo a matrícula correta)
                discente.perfil = 'DISCENTE'; 
                localStorage.setItem('usuario', JSON.stringify(discente));
                window.location.href = 'dashboard_aluno.html';
            } else {
                alert("Erro crítico: Login funcionou, mas seus dados de aluno não foram encontrados no banco.");
            }
        }
    } catch (error) {
        console.error("Erro ao buscar dados do discente:", error);
        alert("Erro ao carregar seu perfil.");
    }
}

async function cadastrar(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    if (data.senha !== data.confirmarSenha) {
        alert("As senhas não coincidem!");
        return;
    }

    const perfilSelecionado = document.getElementById('tipoUsuario').value;
    const endpoint = (perfilSelecionado === 'DISCENTE') ? "/discentes" : "/responsaveis";

    // Objeto conforme DTO Java
    const payload = {
        matricula: data.matricula,
        nome: data.nome,
        email: data.email, 
        senha: data.senha,
        idCurso: 1, // Fixo (Eng. Comp)
        horasCumpridas: 0,
        ingressao: new Date().toISOString().split('T')[0]
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("Cadastro realizado! Faça login.");
            window.location.href = "index.html";
        } else {
            alert("Erro no cadastro. Verifique os dados.");
        }
    } catch (error) {
        console.error(error);
        alert("Erro de conexão.");
    }
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

function verificarAutenticacao() {
    const token = localStorage.getItem('token');
    const paginasPublicas = ['index.html', 'pag01.html', 'pag02.html', 'hero_section.html', 'sobre.html', 'recursos.html', 'plataforma.html', 'cadastro.html', 'login.html', 'recuperacao.html'];
    const paginaAtual = window.location.pathname.split("/").pop();

    if (!token && !paginasPublicas.includes(paginaAtual) && paginaAtual !== '') {
        // window.location.href = 'index.html'; // Descomente para produção
    }
}

/* ==========================================================================
   DASHBOARD ALUNO
   ========================================================================== */

async function carregarDashboardAluno() {
    const token = localStorage.getItem('token');
    const usuario = JSON.parse(localStorage.getItem('usuario'));

    if (!token || !usuario) return;

    try {
        const response = await fetch(`${API_BASE_URL}/solicitacoes/discente/${usuario.matricula}`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            const solicitacoes = await response.json();
            preencherTabelaAtividades(solicitacoes);
            atualizarResumoDashboard(solicitacoes, usuario);
        }
    } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
    }
}

function preencherTabelaAtividades(lista) {
    const tbody = document.querySelector('table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Nenhuma atividade encontrada.</td></tr>';
        return;
    }

    lista.forEach(item => {
        let badgeClass = 'bg-secondary';
        let btnJustificativa = '';

        if (item.status === 'DEFERIDO' || item.status === 'APROVADO') badgeClass = 'bg-success';
        else if (item.status === 'PENDENTE') badgeClass = 'bg-warning text-dark';
        else if (item.status === 'INDEFERIDO' || item.status === 'REJEITADO') {
            badgeClass = 'bg-danger';
            btnJustificativa = `
                <button class="btn btn-sm btn-outline-danger me-1" 
                        onclick="mostrarJustificativa('${item.observacaoResponsavel || 'Sem detalhes.'}')"
                        title="Ver Motivo">
                    <i class='bx bx-message-rounded-dots'></i>
                </button>`;
        }

        const linha = `
            <tr>
                <td class="ps-4 fw-semibold">${item.subtipoAtividade || 'Atividade'}</td>
                <td>${item.cargaHorariaTotal}h</td>
                <td>${item.dataSolicitacao ? new Date(item.dataSolicitacao).toLocaleDateString('pt-BR') : '-'}</td>
                <td><span class="badge ${badgeClass} rounded-pill px-3">${item.status}</span></td>
                <td class="pe-4 text-end">
                    ${btnJustificativa}
                    <button class="btn btn-sm btn-outline-secondary"><i class='bx bx-show'></i></button>
                </td>
            </tr>`;
        tbody.innerHTML += linha;
    });
}

function atualizarResumoDashboard(lista, usuario) {
    const totalAprovadas = lista
        .filter(i => i.status === 'DEFERIDO' || i.status === 'APROVADO')
        .reduce((acc, curr) => acc + (curr.horasAproveitadas || 0), 0);
    
    const totalPendentes = lista.filter(i => i.status === 'PENDENTE').length;

    if(document.getElementById('totalHoras')) document.getElementById('totalHoras').innerText = `${totalAprovadas} h`;
    if(document.getElementById('totalPendentes')) document.getElementById('totalPendentes').innerText = totalPendentes;

    const meta = usuario.totalHorasComplementares || 200;
    const porcentagem = Math.min((totalAprovadas / meta) * 100, 100);
    const barra = document.getElementById('barraProgresso');
    if(barra) {
        barra.style.width = `${porcentagem}%`;
        barra.innerText = `${Math.floor(porcentagem)}%`;
    }
}

function mostrarJustificativa(texto) {
    const modalEl = document.getElementById('modalJustificativa');
    if(modalEl) {
        modalEl.querySelector('.modal-body .alert').innerText = texto;
        new bootstrap.Modal(modalEl).show();
    }
}

/* ==========================================================================
   PERFIL ALUNO
   ========================================================================== */

async function carregarPerfil() {
    let usuario = JSON.parse(localStorage.getItem('usuario'));
    if (!usuario) return;

    if(document.getElementById('cardNome')) document.getElementById('cardNome').innerText = usuario.nome;
    if(document.getElementById('cardMatricula')) document.getElementById('cardMatricula').innerText = usuario.matricula;
    if(document.getElementById('inputNome')) document.getElementById('inputNome').value = usuario.nome;
    if(document.getElementById('inputEmail')) document.getElementById('inputEmail').value = usuario.email;
    if(document.getElementById('inputCpf')) document.getElementById('inputCpf').value = "Não informado";
}

/* ==========================================================================
   NOVA SOLICITAÇÃO (ALUNO)
   ========================================================================== */

async function enviarSolicitacao(event) {
    event.preventDefault();
    const token = localStorage.getItem('token');
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    const btn = event.target.querySelector('button[type="submit"]');
    
    btn.innerHTML = "Enviando...";
    btn.disabled = true;

    const arquivoInput = document.getElementById('arquivo');
    const file = arquivoInput.files[0];
    const reader = new FileReader();

    reader.readAsDataURL(file);
    reader.onload = async function () {
        const base64File = reader.result.split(',')[1];
        
        // DTO SolicitacaoRequest
        const payload = {
            matriculaDiscente: usuario.matricula,
            idSubtipoAtividade: 1, // Temporário: Pegar do <select value="id">
            idInstituicao: 1,      // Temporário: Pegar do backend ou criar
            tipoParticipacao: "OUVINTE", 
            cargaHorariaTotal: parseInt(document.getElementById('cargaHoraria').value),
            horasAproveitadas: 0,
            dataInicio: document.getElementById('dataInicio').value,
            dataFim: document.getElementById('dataFim').value,
            observacao: document.getElementById('descricao').value, // Usando descrição como obs
            comprovantePath: base64File 
        };

        try {
            const response = await fetch(`${API_BASE_URL}/solicitacoes`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                alert("Solicitação enviada com sucesso!");
                window.location.href = "dashboard_aluno.html";
            } else {
                alert("Erro ao enviar. Verifique os dados.");
            }
        } catch (error) {
            console.error(error);
            alert("Erro de conexão.");
        } finally {
            btn.innerHTML = "ENVIAR PARA ANÁLISE";
            btn.disabled = false;
        }
    };
}

/* ==========================================================================
   DASHBOARD COORDENADOR (Carregar Pendências)
   ========================================================================== */

async function carregarDashboardCoordenador() {
    const token = localStorage.getItem('token');
    if (!token) return;

    const statusFiltro = document.getElementById('filtroStatus') ? document.getElementById('filtroStatus').value : 'PENDENTE';

    try {
        const response = await fetch(`${API_BASE_URL}/solicitacoes/status?status=${statusFiltro}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (response.ok) {
            const lista = await response.json();
            const tbody = document.getElementById('tabelaAnalise');
            tbody.innerHTML = '';

            if (lista.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">Nenhuma solicitação encontrada.</td></tr>';
                return;
            }

            // Atualiza contador de pendentes
            if(statusFiltro === 'PENDENTE' && document.getElementById('countPendentes')) {
                document.getElementById('countPendentes').innerText = lista.length;
            }

            lista.forEach(item => {
                const linha = `
                    <tr>
                        <td class="ps-4">
                            <div class="fw-bold text-dark">${item.nomeDiscente || 'Aluno'}</div>
                            <div class="text-muted small">ID: ${item.id}</div>
                        </td>
                        <td>
                            <span class="badge bg-info text-dark bg-opacity-25 border border-info border-opacity-25 mb-1">Atividade</span>
                            <div class="small fw-semibold">${item.subtipoAtividade || 'Geral'}</div>
                        </td>
                        <td class="fw-bold text-primary">${item.cargaHorariaTotal}h</td>
                        <td class="text-muted small">${item.dataSolicitacao ? new Date(item.dataSolicitacao).toLocaleDateString('pt-BR') : '-'}</td>
                        <td class="text-center">
                            <button class="btn btn-primary btn-sm rounded-pill px-3 shadow-sm" 
                                data-bs-toggle="modal" 
                                data-bs-target="#analiseModal"
                                data-id="${item.id}"
                                data-aluno="${item.nomeDiscente}"
                                data-tipo="${item.subtipoAtividade}"
                                data-instituicao="${item.nomeInstituicao}"
                                data-horas="${item.cargaHorariaTotal}"
                                data-data="${item.dataSolicitacao}"
                                data-anexo="${item.comprovantePath}">
                                <i class='bx bx-search-alt'></i> Analisar
                            </button>
                        </td>
                    </tr>`;
                tbody.innerHTML += linha;
            });
        }
    } catch (error) {
        console.error("Erro coord:", error);
    }
}

// Função para Deferir/Indeferir
async function avaliarSolicitacao(novoStatus) {
    const id = document.getElementById('modalSolicitacaoId').value;
    const obs = document.getElementById('modalObservacao').value;
    const token = localStorage.getItem('token');

    if (!id) return;
    if (novoStatus === 'INDEFERIDO' && !obs.trim()) {
        alert("Justificativa obrigatória para indeferimento.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/solicitacoes/${id}/status`, {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ status: novoStatus, observacaoResponsavel: obs })
        });

        if (response.ok) {
            alert(`Solicitação ${novoStatus} com sucesso!`);
            bootstrap.Modal.getInstance(document.getElementById('analiseModal')).hide();
            carregarDashboardCoordenador(); // Atualiza a lista
        }
    } catch (error) {
        console.error(error);
        alert("Erro de conexão.");
    }
}

/* ==========================================================================
   LANÇAMENTO MANUAL (COORDENADOR)
   ========================================================================== */

// 1. Carrega lista de alunos para o <datalist>
async function carregarListaAlunos() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_BASE_URL}/discentes`, { // Endpoint GET /discentes
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            const alunos = await response.json();
            const datalist = document.getElementById('alunosList');
            datalist.innerHTML = '';
            alunos.forEach(aluno => {
                const option = document.createElement('option');
                // Formato: "123456 - Nome do Aluno"
                option.value = `${aluno.matricula} - ${aluno.nome}`;
                datalist.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Erro ao listar alunos:", error);
    }
}

// 2. Processa o lançamento manual
async function lancamentoManual(event) {
    event.preventDefault();
    const token = localStorage.getItem('token');
    const btn = event.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = "Processando...";
    btn.disabled = true;

    // Extrai matrícula do input
    const alunoInput = document.getElementById('buscaAluno').value;
    const matricula = alunoInput.split(' - ')[0].trim();

    if (!matricula) {
        alert("Selecione um aluno válido.");
        btn.innerHTML = originalText;
        btn.disabled = false;
        return;
    }

    // Cria Payload de Solicitação
    const payload = {
        matriculaDiscente: matricula,
        idSubtipoAtividade: 1, // Fixo para teste
        idInstituicao: 1,
        tipoParticipacao: "OUVINTE",
        cargaHorariaTotal: parseInt(document.getElementById('cargaHoraria').value),
        horasAproveitadas: parseInt(document.getElementById('cargaHoraria').value), // Lançamento manual aproveita tudo
        dataInicio: document.getElementById('dataInicio').value,
        dataFim: document.getElementById('dataFim').value,
        observacao: document.getElementById('justificativa').value,
        comprovantePath: "LANCAMENTO_MANUAL"
    };

    try {
        // Passo 1: Criar Solicitação
        const response = await fetch(`${API_BASE_URL}/solicitacoes`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const solicitacaoCriada = await response.json();
            
            // Passo 2: Aprovar Imediatamente (Deferir)
            await fetch(`${API_BASE_URL}/solicitacoes/${solicitacaoCriada.id}/status`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    status: "DEFERIDO",
                    observacaoResponsavel: "Lançamento Administrativo: " + payload.observacao
                })
            });

            alert("Lançamento efetuado com sucesso!");
            window.location.href = "dashboard_coordenador.html";
        } else {
            alert("Erro ao criar lançamento.");
        }
    } catch (error) {
        console.error(error);
        alert("Erro de conexão.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// 3. Função auxiliar para buscar detalhes no botão "Verificar"
function buscarAlunoDetalhes() {
    const inputVal = document.getElementById('buscaAluno').value;
    if(!inputVal) return;
    
    const card = document.getElementById('cardAlunoEncontrado');
    card.classList.remove('d-none');
    card.classList.add('d-flex');
    
    // Parseia "123456 - Nome"
    const partes = inputVal.split(' - ');
    if (partes.length > 1) {
        const nome = partes[1];
        document.getElementById('nomeAlunoCompleto').innerText = nome;
        // Iniciais
        const iniciais = nome.trim().split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
        document.getElementById('siglaAluno').innerText = iniciais;
    }
}