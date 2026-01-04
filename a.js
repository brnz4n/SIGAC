const API_BASE_URL = "http://localhost:8080";

/* ==========================================================================
AUTENTICAÇÃO (ATUALIZADO)
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
            
            if (data.perfil === 'DISCENTE') {
                // AGORA SIM: Usamos o identificador (matrícula) que veio do backend!
                // O campo veio como "identificador" no seu print
                await buscarDadosDiscente(data.identificador, data.token);
            
            } else if (data.perfil === 'COORDENADOR') {
                localStorage.setItem('usuario', JSON.stringify({ nome: "Prof. Fernando", perfil: "COORDENADOR" }));
                window.location.href = 'dashboard_coordenador.html';
            
            } else if (data.perfil === 'ADMIN') {
                localStorage.setItem('usuario', JSON.stringify({ nome: "Admin", perfil: "ADMIN" }));
                window.location.href = 'dashboard_adm.html';
            }

        } else {
            // Se o login falhar (ex: erro 400 ou 403), mostramos erro
            alert("Login inválido! Verifique email e senha.");
        }
    } catch (error) {
        console.error("Erro:", error);
        alert("Erro de conexão com o servidor.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// Volta a função original que busca PELO ID (Muito melhor!)
async function buscarDadosDiscente(matricula, token) {
    try {
        const response = await fetch(`${API_BASE_URL}/discentes/${matricula}`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            const discente = await response.json();
            discente.perfil = 'DISCENTE';
            localStorage.setItem('usuario', JSON.stringify(discente));
            window.location.href = 'dashboard_aluno.html';
        } else {
            console.error("Erro ao buscar detalhes do aluno:", response.status);
            alert("Erro ao carregar seus dados.");
        }
    } catch (error) {
        console.error("Erro na requisição:", error);
        alert("Erro de conexão ao buscar perfil.");
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

    const endpoint = "/discentes";
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

// Variável global para guardar as atividades carregadas
let cacheSolicitacoesAluno = [];

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
            
            // GUARDAMOS NA VARIÁVEL GLOBAL PARA USAR DEPOIS
            cacheSolicitacoesAluno = solicitacoes; 

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
            // Botão vermelho de "ver motivo"
            btnJustificativa = `
                <button class="btn btn-sm btn-outline-danger me-1" 
                        onclick="mostrarJustificativa('${item.observacaoResponsavel || 'Sem detalhes.'}')"
                        title="Ver Motivo da Rejeição">
                    <i class='bx bx-message-rounded-dots'></i>
                </button>`;
        }

        const linha = `
            <tr>
                <td class="ps-4 fw-semibold">
                    <div class="text-truncate" style="max-width: 200px;" title="${item.observacao || 'Sem título'}">
                        ${item.subtipoAtividade || 'Atividade'}
                    </div>
                </td>
                <td>${item.cargaHorariaTotal}h</td>
                <td>${item.dataSolicitacao ? new Date(item.dataSolicitacao).toLocaleDateString('pt-BR') : '-'}</td>
                <td><span class="badge ${badgeClass} rounded-pill px-3">${item.status}</span></td>
                <td class="pe-4 text-end">
                    ${btnJustificativa}
                    
                    <button class="btn btn-sm btn-outline-secondary" 
                            onclick="verDetalhesSolicitacao(${item.id})" 
                            title="Ver Detalhes e Comprovante">
                        <i class='bx bx-show'></i>
                    </button>
                </td>
            </tr>`;
        tbody.innerHTML += linha;
    });
}

// Variável para guardar o ID DO COMPROVANTE (não da solicitação)
let idComprovanteAtual = null;

function verDetalhesSolicitacao(id) {
    const item = cacheSolicitacoesAluno.find(s => s.id === id);
    if (!item) return;

    // 1. PREENCHE OS CAMPOS DE TEXTO (Que estavam faltando)
    document.getElementById('detalheId').innerText = `#${item.id}`;
    document.getElementById('detalheSubtipo').innerText = item.subtipoAtividade || 'Geral';
    document.getElementById('detalheObservacao').innerText = item.observacao || 'Sem descrição informada.';
    document.getElementById('detalheInicio').innerText = item.dataInicio ? new Date(item.dataInicio).toLocaleDateString('pt-BR') : '-';
    document.getElementById('detalheFim').innerText = item.dataFim ? new Date(item.dataFim).toLocaleDateString('pt-BR') : '-';
    document.getElementById('detalheHoras').innerText = `${item.cargaHorariaTotal} horas`;

    // 2. ATUALIZA O STATUS (Tira o "Carregando...")
    const statusEl = document.getElementById('detalheStatus');
    statusEl.innerText = item.status;
    statusEl.className = 'badge rounded-pill px-3 fs-6'; // Reseta as cores
    
    if(item.status === 'DEFERIDO' || item.status === 'APROVADO') {
        statusEl.classList.add('bg-success');
    } else if(item.status === 'INDEFERIDO' || item.status === 'REJEITADO') {
        statusEl.classList.add('bg-danger');
    } else {
        statusEl.classList.add('bg-warning', 'text-dark');
    }

    // 3. CONFIGURA O BOTÃO DE DOWNLOAD
    const btn = document.getElementById('btnDownload');

    if (item.comprovante && item.comprovante.id) {
        idComprovanteAtual = item.comprovante.id; // Salva o ID
        btn.innerHTML = "<i class='bx bx-file'></i> VISUALIZAR ARQUIVO";
        btn.classList.remove('disabled');
        btn.onclick = baixarComprovante; // Vincula a função
    } else {
        idComprovanteAtual = null;
        btn.innerHTML = "Sem comprovante";
        btn.classList.add('disabled');
        btn.onclick = null;
    }
    
    new bootstrap.Modal(document.getElementById('modalDetalhes')).show();
}

async function baixarComprovante() {
    if (!idComprovanteAtual) return;
    
    const btn = document.getElementById('btnDownload');
    const textoOriginal = btn.innerHTML;
    
    // Feedback visual no botão
    btn.innerHTML = "<span class='spinner-border spinner-border-sm'></span> Gerando visualização...";
    btn.disabled = true;

    // --- TRUQUE: Abre a aba IMEDIATAMENTE (antes do fetch) para não ser bloqueado ---
    // Isso cria uma aba em branco com uma mensagem de espera
    const novaAba = window.open('', '_blank');
    
    if (novaAba) {
        novaAba.document.write(`
            <html>
                <head><title>Carregando...</title></head>
                <body style="display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif; background:#f8f9fa;">
                    <div style="text-align:center;">
                        <h3>Buscando arquivo seguro...</h3>
                        <p>Aguarde um instante.</p>
                    </div>
                </body>
            </html>
        `);
    } else {
        alert("O navegador bloqueou a nova aba. Por favor, permita pop-ups para este site.");
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const url = `${API_BASE_URL}/comprovantes/${idComprovanteAtual}/download`;

        const response = await fetch(url, {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            const blob = await response.blob();
            const fileURL = window.URL.createObjectURL(blob);
            
            // --- SUCESSO: Redireciona a aba que já estava aberta para o arquivo ---
            novaAba.location.href = fileURL;
            
        } else {
            novaAba.close(); // Fecha a aba se der erro
            alert("Erro ao carregar o arquivo. Tente novamente.");
        }
    } catch (error) {
        if(novaAba) novaAba.close(); // Fecha a aba se der erro
        console.error(error);
        alert("Erro de conexão.");
    } finally {
        // Restaura o botão original
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
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
    if(document.getElementById('inputTelefone')) document.getElementById('inputTelefone').value = usuario.telefone || "";
    gerarAvatar(usuario.nome);
}

function gerarAvatar(nome) {
    if (!nome) return;
    
    // Pega as duas primeiras letras ou as iniciais do primeiro e último nome
    const partes = nome.trim().split(" ");
    let iniciais = "";
    
    if (partes.length === 1) {
        iniciais = partes[0].substring(0, 2).toUpperCase();
    } else {
        iniciais = (partes[0][0] + partes[1][0]).toUpperCase();
    }

    const elTexto = document.getElementById('avatarTexto');
    const elCirculo = document.getElementById('avatarCirculo');

    if (elTexto) elTexto.innerText = iniciais;
    
    // Bônus: Se quiser mudar a cor de fundo dinamicamente depois, pode mexer no elCirculo aqui
}
/* ==========================================================================
NOVA SOLICITAÇÃO (ALUNO)
   ========================================================================== */

async function enviarSolicitacao(event) {
    event.preventDefault();
    const token = localStorage.getItem('token');
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    const btn = event.target.querySelector('button[type="submit"]');
    
    // Validações
    const subtipoSelect = document.getElementById('subtipoAtividade');
    const arquivoInput = document.getElementById('arquivo');

    if (!subtipoSelect || !subtipoSelect.value) {
        alert("Selecione o Tipo e Subtipo da atividade.");
        return;
    }
    if (arquivoInput.files.length === 0) {
        alert("Anexe o comprovante.");
        return;
    }

    btn.innerHTML = "Enviando...";
    btn.disabled = true;

    // --- PASSO 1: CRIAR A SOLICITAÇÃO (JSON) ---
    // Note que removemos o campo 'comprovante' daqui, pois ele vai separado
    const payload = {
        matriculaDiscente: usuario.matricula,
        idSubtipoAtividade: parseInt(subtipoSelect.value), 
        idInstituicao: 1, // Fixo por enquanto
        tipoParticipacao: "OUVINTE", 
        cargaHorariaTotal: parseInt(document.getElementById('cargaHoraria').value),
        horasAproveitadas: 0,
        dataInicio: document.getElementById('dataInicio').value,
        dataFim: document.getElementById('dataFim').value,
        observacao: document.getElementById('descricao').value
    };

    try {
        // 1. Envia os dados de texto
        const responseSolicitacao = await fetch(`${API_BASE_URL}/solicitacoes`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (responseSolicitacao.ok) {
            const solicitacaoCriada = await responseSolicitacao.json();
            const idSolicitacao = solicitacaoCriada.id;

            // --- PASSO 2: ENVIAR O ARQUIVO (UPLOAD) ---
            // Agora usamos FormData para enviar o arquivo físico
            const formData = new FormData();
            formData.append("file", arquivoInput.files[0]); // "file" deve bater com @RequestParam("file") no Java

            const responseUpload = await fetch(`${API_BASE_URL}/comprovantes/${idSolicitacao}`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                    // NÃO coloque Content-Type aqui! O navegador define automaticamente como multipart/form-data
                },
                body: formData
            });

            if (responseUpload.ok) {
                alert("Solicitação e Arquivo enviados com sucesso!");
                window.location.href = "dashboard_aluno.html";
            } else {
                alert("Solicitação criada, mas erro ao enviar arquivo. Tente editar depois.");
                window.location.href = "dashboard_aluno.html";
            }

        } else {
            const erro = await responseSolicitacao.text();
            alert("Erro ao criar solicitação: " + erro);
        }
    } catch (error) {
        console.error(error);
        alert("Erro de conexão.");
    } finally {
        btn.innerHTML = "ENVIAR PARA ANÁLISE";
        btn.disabled = false;
    }
}

/* ==========================================================================
   DASHBOARD COORDENADOR (Carregar Pendências)
   ========================================================================== */
let cacheSolicitacoesCoord = [];

async function carregarDashboardCoordenador() {
    const token = localStorage.getItem('token');
    if (!token) return;

    const filtroEl = document.getElementById('filtroStatus');
    const statusFiltro = filtroEl ? filtroEl.value : 'PENDENTE';
    const tbody = document.getElementById('tabelaAnalise');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5"><div class="spinner-border text-primary"></div></td></tr>';

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
            cacheSolicitacoesCoord = lista;
            tbody.innerHTML = '';

            if (lista.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">Nenhuma solicitação encontrada.</td></tr>';
                if(document.getElementById('countPendentes')) document.getElementById('countPendentes').innerText = "0";
                return;
            }

            // Atualiza contador de pendentes
            if(statusFiltro === 'PENDENTE' && document.getElementById('countPendentes')) {
                document.getElementById('countPendentes').innerText = lista.length;
            }

            lista.forEach(item => {
                const dataFormatada = item.dataSolicitacao ? new Date(item.dataSolicitacao).toLocaleDateString('pt-BR') : '-';
                
                const linha = `
                    <tr>
                        <td class="ps-4">
                            <div class="fw-bold text-dark">${item.nomeDiscente || 'Aluno'}</div>
                            <div class="text-muted small">Matrícula: ${item.matriculaDiscente || '---'}</div>
                        </td>
                        <td>
                            <span class="badge bg-primary bg-opacity-10 text-primary mb-1 border border-primary border-opacity-10">Atividade</span>
                            <div class="small fw-semibold text-truncate" style="max-width: 250px;">
                                ${item.subtipoAtividade || 'Geral'}
                            </div>
                        </td>
                        <td class="fw-bold text-dark">${item.cargaHorariaTotal}h</td>
                        <td class="text-muted small">${dataFormatada}</td>
                        <td class="text-center">
                            <button class="btn btn-primary btn-sm rounded-pill px-3 shadow-sm fw-bold"
                                onclick="abrirModalAnalise(${item.id})">
                                <i class='bx bx-search-alt'></i> Analisar
                            </button>
                        </td>
                    </tr>`;
                tbody.innerHTML += linha;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Erro ao carregar dados.</td></tr>';
        }
    } catch (error) {
        console.error("Erro coord:", error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Erro de conexão.</td></tr>';
    }
}

let idSolicitacaoAnaliseAtual = null;
let idComprovanteAnaliseAtual = null;

function abrirModalAnalise(id) {
    const item = cacheSolicitacoesCoord.find(s => s.id === id);
    if (!item) return;

    idSolicitacaoAnaliseAtual = item.id;
    
    // Preencher Modal
    document.getElementById('modalAlunoNome').innerText = item.nomeDiscente || "Aluno";
    document.getElementById('modalGrupo').innerText = "Atividade Complementar"; // Pode vir do back se tiver
    document.getElementById('modalTipo').innerText = item.subtipoAtividade || "Geral";
    document.getElementById('modalInstituicao').innerText = item.nomeInstituicao || "Não informada";
    document.getElementById('modalData').innerText = item.dataInicio ? new Date(item.dataInicio).toLocaleDateString('pt-BR') : "--/--/--";
    document.getElementById('modalHoras').innerText = `${item.cargaHorariaTotal}h`;
    
    // Limpa campo de obs
    const obsInput = document.getElementById('modalObservacao');
    if(obsInput) obsInput.value = item.observacaoResponsavel || ""; // Mostra se já tiver nota

    // Configurar botão de anexo
    const btnAnexo = document.getElementById('modalAnexo');
    
    // Verifica se tem comprovante (objeto ou ID)
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
        btnAnexo.innerHTML = "Sem anexo";
        btnAnexo.onclick = null;
    }

    // Abre o modal
    new bootstrap.Modal(document.getElementById('analiseModal')).show();
}

async function visualizarComprovanteCoordenador(idComprovante) {
    if (!idComprovante) return;
    
    const btn = document.getElementById('modalAnexo');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = "<span class='spinner-border spinner-border-sm'></span> Carregando...";
    
    const novaAba = window.open('', '_blank');
    if(novaAba) {
        novaAba.document.write('<html><body><h3 style="font-family:sans-serif;text-align:center;margin-top:50px;">Carregando documento do aluno...</h3></body></html>');
    }

    try {
        const token = localStorage.getItem('token');
        const url = `${API_BASE_URL}/comprovantes/${idComprovante}/download`; // Usa mesma rota de download

        const response = await fetch(url, {
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
        console.error(e);
        alert("Erro de conexão.");
    } finally {
        btn.innerHTML = txtOriginal;
    }
}

// Função para Deferir/Indeferir
async function avaliarSolicitacao(novoStatus) {
    const obs = document.getElementById('modalObservacao').value;
    const token = localStorage.getItem('token');

    if (!idSolicitacaoAnaliseAtual) return;

    if (novoStatus === 'INDEFERIDO' && !obs.trim()) {
        alert("Para INDEFERIR, você deve escrever uma justificativa no campo 'Parecer da Coordenação'.");
        document.getElementById('modalObservacao').focus();
        return;
    }

    if(!confirm(`Tem certeza que deseja ${novoStatus} esta solicitação?`)) return;

    try {
        const response = await fetch(`${API_BASE_URL}/solicitacoes/${idSolicitacaoAnaliseAtual}/status`, {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                status: novoStatus,
                observacaoResponsavel: obs
            })
        });

        if (response.ok) {
            alert(`Solicitação ${novoStatus} com sucesso!`);
            
            // Fecha modal
            const modalEl = document.getElementById('analiseModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();

            // Recarrega lista
            carregarDashboardCoordenador();
        } else {
            alert("Erro ao atualizar status.");
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

async function salvarPerfilBackend() {
    const btn = document.getElementById('btnEditarPerfil');
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    
    // Inputs
    const novoNome = document.getElementById('inputNome').value;
    const novoEmail = document.getElementById('inputEmail').value;
    const novoTelefone = document.getElementById('inputTelefone').value;

    btn.innerHTML = "<span class='spinner-border spinner-border-sm'></span> Salvando...";
    btn.disabled = true;

    try {
        const token = localStorage.getItem('token');
        const url = `${API_BASE_URL}/discentes/${usuario.matricula}/perfil`;

        const response = await fetch(url, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                nome: novoNome,
                email: novoEmail,
                telefone: novoTelefone
            })
        });

        // CORREÇÃO AQUI: Lemos a resposta uma única vez como texto
        const responseData = await response.text();

        if (response.ok) {
            // Se deu certo, convertemos o texto para JSON
            const discenteAtualizado = JSON.parse(responseData);
            
            alert("Perfil atualizado com sucesso!");

            usuario.nome = discenteAtualizado.nome;
            usuario.email = discenteAtualizado.email;
            if(discenteAtualizado.telefone) usuario.telefone = discenteAtualizado.telefone;
            localStorage.setItem('usuario', JSON.stringify(usuario));

            carregarPerfil();
            finalizarModoEdicao();

        } else {
            // Se deu erro, tentamos extrair a mensagem do JSON ou usamos o texto puro
            try {
                const erroJson = JSON.parse(responseData);
                alert("Erro: " + (erroJson.message || erroJson.error || "Não foi possível atualizar."));
            } catch (e) {
                // Se não for JSON, mostra o erro genérico ou o status
                console.warn("Erro não-JSON:", responseData);
                alert(`Erro ${response.status}: Falha ao atualizar perfil.`);
            }
        }
    } catch (error) {
        console.error(error);
        alert("Erro de conexão com o servidor.");
    } finally {
        if(btn.disabled) {
            btn.innerHTML = "<i class='bx bx-check'></i> Salvar";
            btn.disabled = false;
        }
    }
}

function finalizarModoEdicao() {
    const inputs = ['inputNome', 'inputEmail', 'inputTelefone'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.disabled = true;
            el.classList.remove('bg-white');
        }
    });
    
    const btn = document.getElementById('btnEditarPerfil');
    const btnCancelar = document.getElementById('btnCancelarEdicao');
    
    editandoPerfil = false;

    btn.innerHTML = "<i class='bx bx-edit-alt'></i> Editar";
    btn.classList.add('btn-outline-primary');
    btn.classList.remove('btn-success');
    btn.disabled = false;
    
    if(btnCancelar) btnCancelar.remove();
}

/* ==========================================================================
   ALTERAÇÃO DE SENHA (MODAL)
   ========================================================================== */

// 1. Abre o Modal e limpa os campos antigos
function abrirModalSenha() {
    // Limpa os campos para não ficar sujeira da tentativa anterior
    if(document.getElementById('inputSenhaAtual')) document.getElementById('inputSenhaAtual').value = '';
    if(document.getElementById('inputNovaSenha')) document.getElementById('inputNovaSenha').value = '';
    if(document.getElementById('inputConfirmarSenha')) document.getElementById('inputConfirmarSenha').value = '';
    
    // Abre o modal
    const modal = new bootstrap.Modal(document.getElementById('modalAlterarSenha'));
    modal.show();
}

// 2. Envia para o Backend
async function confirmarAlteracaoSenha(btn) {
    const senhaAtual = document.getElementById('inputSenhaAtual').value;
    const novaSenha = document.getElementById('inputNovaSenha').value;
    const confirmarSenha = document.getElementById('inputConfirmarSenha').value;

    // --- VALIDAÇÕES BÁSICAS ---
    if (!senhaAtual || !novaSenha || !confirmarSenha) {
        alert("Preencha todos os campos.");
        return;
    }

    if (novaSenha.length < 6) {
        alert("A nova senha deve ter no mínimo 6 caracteres.");
        return;
    }

    if (novaSenha !== confirmarSenha) {
        alert("A nova senha e a confirmação não coincidem.");
        return;
    }

    if (senhaAtual === novaSenha) {
        alert("A nova senha não pode ser igual à atual.");
        return;
    }

    // --- ENVIO ---
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = "<span class='spinner-border spinner-border-sm'></span> Processando...";
    btn.disabled = true;

    try {
        const usuario = JSON.parse(localStorage.getItem('usuario'));
        const token = localStorage.getItem('token');
        
        const url = `${API_BASE_URL}/discentes/${usuario.matricula}/senha`;

        const response = await fetch(url, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                senhaAtual: senhaAtual,
                novaSenha: novaSenha
            })
        });

        if (response.ok) {
            // Fecha o modal
            const modalEl = document.getElementById('modalAlterarSenha');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            modalInstance.hide();

            alert("Senha alterada com sucesso! Por segurança, faça login novamente.");
            logout(); // Desloga o usuário

        } else {
            // Tenta pegar o erro do JSON
            try {
                const erroData = await response.json();
                alert("Erro: " + (erroData.message || "Senha atual incorreta ou erro no servidor."));
            } catch {
                alert("Erro: Verifique se a senha atual está correta.");
            }
        }
    } catch (e) {
        console.error(e);
        alert("Erro de conexão.");
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
}

/* ==========================================================================
PERFIL ALUNO (COM INTEGRAÇÃO AO BACKEND)
   ========================================================================== */

let editandoPerfil = false;
let dadosOriginais = {}; // Para cancelar a edição se precisar

// 1. Botão "Editar" (Controla a tela)
function habilitarEdicaoPerfil() {
    const btn = document.getElementById('btnEditarPerfil');
    const inputs = ['inputNome', 'inputEmail', 'inputTelefone']; 

    if (!editandoPerfil) {
        // --- ENTRAR NO MODO EDIÇÃO ---
        editandoPerfil = true;
        
        // Salva dados originais para caso de cancelamento
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if(el) dadosOriginais[id] = el.value;
        });

        // Destrava os campos para digitar
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if(el) {
                el.disabled = false;
                el.classList.add('bg-white'); // Destaque visual
            }
        });

        // Muda o botão para "Salvar" (Verde)
        btn.innerHTML = "<i class='bx bx-check'></i> Salvar";
        btn.classList.remove('btn-outline-primary');
        btn.classList.add('btn-success');
        
        // Cria o botão "Cancelar" ao lado
        const btnCancelar = document.createElement('button');
        btnCancelar.id = 'btnCancelarEdicao';
        btnCancelar.className = 'btn btn-sm btn-outline-secondary rounded-pill px-3 ms-2';
        btnCancelar.innerHTML = "<i class='bx bx-x'></i> Cancelar";
        btnCancelar.onclick = cancelarEdicaoPerfil;
        btn.parentNode.insertBefore(btnCancelar, btn.nextSibling);

    } else {
        // --- JÁ ESTÁ EDITANDO -> SALVAR ---
        salvarPerfilBackend();
    }
}

// 2. Botão "Cancelar"
function cancelarEdicaoPerfil() {
    const inputs = ['inputNome', 'inputEmail', 'inputTelefone'];

    // Restaura os valores antigos
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.value = dadosOriginais[id] || ""; // Restaura ou deixa vazio
        }
    });

    finalizarModoEdicao();
}

// 3. Função Auxiliar para travar os campos de novo
function finalizarModoEdicao() {
    const inputs = ['inputNome', 'inputEmail', 'inputTelefone'];
    
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.disabled = true;
            el.classList.remove('bg-white');
        }
    });

    const btn = document.getElementById('btnEditarPerfil');
    const btnCancelar = document.getElementById('btnCancelarEdicao');

    editandoPerfil = false;
    
    // Volta o botão para "Editar" (Azul)
    btn.innerHTML = "<i class='bx bx-edit-alt'></i> Editar";
    btn.classList.add('btn-outline-primary');
    btn.classList.remove('btn-success');
    btn.disabled = false;

    if(btnCancelar) btnCancelar.remove();
}

// 4. ENVIA PARA O JAVA
async function salvarPerfilBackend() {
    const btn = document.getElementById('btnEditarPerfil');
    const usuario = JSON.parse(localStorage.getItem('usuario')); // Pega matrícula daqui
    
    // Pega o que o aluno digitou
    const novoNome = document.getElementById('inputNome').value;
    const novoEmail = document.getElementById('inputEmail').value;
    const novoTelefone = document.getElementById('inputTelefone').value;

    // Feedback visual ("Salvando...")
    btn.innerHTML = "<span class='spinner-border spinner-border-sm'></span> Salvando...";
    btn.disabled = true;

    try {
        const token = localStorage.getItem('token');
        
        // ROTA CERTA: PUT /discentes/{matricula}/perfil
        const url = `${API_BASE_URL}/discentes/${usuario.matricula}/perfil`;

        const response = await fetch(url, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                nome: novoNome,
                email: novoEmail,
                telefone: novoTelefone
            })
        });

        if (response.ok) {
            const discenteAtualizado = await response.json();
            
            alert("Perfil atualizado com sucesso!");

            // Atualiza o LocalStorage com os dados novos que voltaram do servidor
            // Assim a tela não mostra dados velhos se der F5
            usuario.nome = discenteAtualizado.nome;
            usuario.email = discenteAtualizado.email;
            if(discenteAtualizado.telefone) usuario.telefone = discenteAtualizado.telefone;
            
            localStorage.setItem('usuario', JSON.stringify(usuario));

            // Atualiza o card lateral e trava os campos
            carregarPerfil();
            finalizarModoEdicao();

        } else {
            // Tratamento de erro
            try {
                const erroJson = await response.json(); // Tenta ler erro JSON do Spring
                alert("Erro: " + (erroJson.message || "Erro desconhecido."));
            } catch (e) {
                const erroTexto = await response.text();
                alert("Erro ao atualizar: " + erroTexto);
            }
            // Se deu erro, destrava o botão para tentar de novo
            btn.innerHTML = "<i class='bx bx-check'></i> Salvar";
            btn.disabled = false;
        }
    } catch (error) {
        console.error(error);
        alert("Erro de conexão com o servidor.");
        btn.innerHTML = "<i class='bx bx-check'></i> Salvar";
        btn.disabled = false;
    }
}