let cacheSolicitacoesAluno = [];
let idComprovanteAtual = null;
let editandoPerfil = false;
let dadosOriginais = {};

async function carregarDashboardAluno() {
    const token = localStorage.getItem('token');
    const usuarioString = localStorage.getItem('usuario');
    
    if (!token || !usuarioString) {
        console.warn("Token ou usuário não encontrados no localStorage.");
        return;
    }

    const usuario = JSON.parse(usuarioString);

    if (!usuario.matricula) {
        console.error("Erro CRÍTICO: Usuário logado não tem matrícula salva no localStorage!");
        console.log("Objeto usuário atual:", usuario);
        return;
    }

    try {
        console.log(`Buscando dados para matrícula: ${usuario.matricula}`);

        const response = await fetch(`${API_BASE_URL}/solicitacoes/discente/${usuario.matricula}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!response.ok) {
            const textoErro = await response.text();
            console.error(`Erro do Backend (${response.status}):`, textoErro);
            return;
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const texto = await response.text();
            console.error("O backend não retornou JSON! Resposta recebida:", texto);
            return;
        }

        const solicitacoes = await response.json();
        cacheSolicitacoesAluno = solicitacoes;
        preencherTabelaAtividades(solicitacoes);
        atualizarResumoDashboard(solicitacoes, usuario);

    } catch (error) {
        console.error("Erro de rede ou processamento:", error);
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
        const status = item.status ? item.status.toUpperCase() : 'DESCONHECIDO';

        if (status === 'DEFERIDO' || status === 'APROVADO' || status === 'DEFERIDA') badgeClass = 'bg-success';
        else if (status === 'PENDENTE' || status === 'EM ANÁLISE') badgeClass = 'bg-warning text-dark';
        else if (status === 'INDEFERIDO' || status === 'REJEITADO' || status === 'REJEITADA' || status === 'INDEFERIDA') badgeClass = 'bg-danger';

        const nomeSubtipo = item.nomeSubtipo || item.subtipoAtividade || 'Atividade';
        const cargaHoraria = item.cargaHorariaSolicitada || item.cargaHorariaTotal || 0;

        const linha = `
            <tr>
                <td class="ps-4 fw-semibold">${nomeSubtipo}</td>
                <td>${cargaHoraria}h</td>
                <td>${formatarData(item.dataSolicitacao)}</td>
                <td><span class="badge ${badgeClass} rounded-pill px-3">${item.status}</span></td>
                <td class="pe-4 text-end">
                    <button class="btn btn-sm btn-outline-secondary" onclick="verDetalhesSolicitacao(${item.id})">
                        <i class='bx bx-show'></i>
                    </button>
                </td>
            </tr>`;

        tbody.innerHTML += linha;
    });
}

function verDetalhesSolicitacao(id) {
    const item = cacheSolicitacoesAluno.find(s => s.id === id);
    if (!item) return;

    const nomeSubtipo = item.nomeSubtipo || item.subtipoAtividade || 'Não informado';

    const textoObservacao = item.nomeAtividade
                    ? `${item.nomeAtividade} - ${item.participacao || ''}`
                    : (item.observacaoDiscente || item.observacao || '---');

    const dataRef = item.dataSolicitacao ? formatarData(item.dataSolicitacao) : '-';
    const textoHoras = item.cargaHorariaSolicitada || item.cargaHorariaTotal || 0;
    const idArquivo = item.comprovanteId || (item.comprovante ? item.comprovante.id : null);


    document.getElementById('detalheId').innerText = `#${item.id}`;
    document.getElementById('detalheSubtipo').innerText = nomeSubtipo;
    document.getElementById('detalheObservacao').innerText = textoObservacao;

    if(document.getElementById('detalheInicio')) document.getElementById('detalheInicio').innerText = dataRef;
    if(document.getElementById('detalheFim')) document.getElementById('detalheFim').innerText = '-'; 
    
    if(document.getElementById('detalheHoras')) document.getElementById('detalheHoras').innerText = `${textoHoras} horas`;

    const statusEl = document.getElementById('detalheStatus');
    if (statusEl) {
        statusEl.innerText = item.status;
        statusEl.className = 'badge rounded-pill px-3 fs-6';
        
        if (['DEFERIDO', 'APROVADO'].includes(item.status)) {
            statusEl.classList.add('bg-success');
        } else if (['INDEFERIDO', 'REJEITADO', 'REPROVADO'].includes(item.status)) {
            statusEl.classList.add('bg-danger');
        } else {
            statusEl.classList.add('bg-warning', 'text-dark');
        }
    }

    const btn = document.getElementById('btnDownload');
    
    if (idArquivo) {
        idComprovanteAtual = idArquivo;
        btn.innerHTML = "<i class='bx bx-file'></i> VISUALIZAR ARQUIVO";
        btn.classList.remove('disabled');
        btn.onclick = baixarComprovante;
    } else {
        idComprovanteAtual = null;
        btn.classList.add('disabled');
        btn.innerHTML = "Sem comprovante";
        btn.onclick = null;
    }

    new bootstrap.Modal(document.getElementById('modalDetalhes')).show();
}

async function baixarComprovante() {
    if (!idComprovanteAtual) return;
    
    const btn = document.getElementById('btnDownload');
    const textoOriginal = btn.innerHTML;
    
    btn.innerHTML = "<span class='spinner-border spinner-border-sm'></span> Baixando...";
    btn.disabled = true;

    const novaAba = window.open('', '_blank');
    if (novaAba) {
        novaAba.document.write(`
            <html>
                <head><title>Carregando Documento...</title></head>
                <body style="display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif; background:#f8f9fa;">
                    <div style="text-align:center">
                        <h3>Buscando arquivo seguro...</h3>
                        <p>Aguarde um instante.</p>
                    </div>
                </body>
            </html>
        `);
    }

    try {
        const token = localStorage.getItem('token');
        
        const response = await fetch(`${API_BASE_URL}/comprovantes/${idComprovanteAtual}/download`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.ok) {
            const blob = await response.blob();
            const fileURL = window.URL.createObjectURL(blob);
            
            if (novaAba) {
                novaAba.location.href = fileURL;
            }
        } else {
            if (novaAba) novaAba.close();
            alert("Erro ao baixar o arquivo. Verifique se ele existe.");
        }

    } catch (error) {
        console.error(error);
        if (novaAba) novaAba.close();
        alert("Erro de conexão ao tentar baixar o arquivo.");

    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
}

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

function habilitarEdicaoPerfil() {
    const btn = document.getElementById('btnEditarPerfil');
    const inputs = ['inputNome', 'inputEmail', 'inputTelefone'];

    if (!editandoPerfil) {
        editandoPerfil = true;

        inputs.forEach(id => {
            const el = document.getElementById(id);
            if(el) dadosOriginais[id] = el.value;
        });

        inputs.forEach(id => {
            const el = document.getElementById(id);
            if(el) {
                el.disabled = false;
                el.classList.add('bg-white');
            }

        });

        btn.innerHTML = "<i class='bx bx-check'></i> Salvar";
        btn.classList.remove('btn-outline-primary');
        btn.classList.add('btn-success');
        const btnCancelar = document.createElement('button');
        btnCancelar.id = 'btnCancelarEdicao';
        btnCancelar.className = 'btn btn-sm btn-outline-secondary rounded-pill px-3 ms-2';
        btnCancelar.innerHTML = "<i class='bx bx-x'></i> Cancelar";
        btnCancelar.onclick = cancelarEdicaoPerfil;
        btn.parentNode.insertBefore(btnCancelar, btn.nextSibling);

    } else {
        salvarPerfilBackend();
    }
}

async function salvarPerfilBackend() {
    const btn = document.getElementById('btnEditarPerfil');
    const usuario = JSON.parse(localStorage.getItem('usuario'));
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

        if (response.ok) {

            const discenteAtualizado = await response.json();
            alert("Perfil atualizado com sucesso!");

            usuario.nome = discenteAtualizado.nome;
            usuario.email = discenteAtualizado.email;
            if(discenteAtualizado.telefone) usuario.telefone = discenteAtualizado.telefone;

            localStorage.setItem('usuario', JSON.stringify(usuario));

            carregarPerfil();

            finalizarModoEdicao();

        } else {

            try {
                const erroJson = await response.json();
                alert("Erro: " + (erroJson.message || "Erro desconhecido."));

            } catch (e) {
                const erroTexto = await response.text();
                alert("Erro ao atualizar: " + erroTexto);
            }

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

function gerarAvatar(nome) {

    if (!nome) return;
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

}

function abrirModalSenha() {

    if(document.getElementById('inputSenhaAtual')) document.getElementById('inputSenhaAtual').value = '';
    if(document.getElementById('inputNovaSenha')) document.getElementById('inputNovaSenha').value = '';
    if(document.getElementById('inputConfirmarSenha')) document.getElementById('inputConfirmarSenha').value = '';
    const modal = new bootstrap.Modal(document.getElementById('modalAlterarSenha'));
    modal.show();
}

async function confirmarAlteracaoSenha(btn) {

    const senhaAtual = document.getElementById('inputSenhaAtual').value;
    const novaSenha = document.getElementById('inputNovaSenha').value;
    const confirmarSenha = document.getElementById('inputConfirmarSenha').value;

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

    const textoOriginal = btn.innerHTML;
    btn.innerHTML = "<span class='spinner-border spinner-border-sm'></span> Processando...";
    btn.disabled = true;

    try {

        const usuario = JSON.parse(localStorage.getItem('usuario'));
        const token = localStorage.getItem('token');
        const url = `${API_BASE_URL}/discentes/${usuario.matricula}/senha`;
        const response = await fetch(url, {

            method: "POST",

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

            const modalEl = document.getElementById('modalAlterarSenha');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            modalInstance.hide();

            alert("Senha alterada com sucesso! Por segurança, faça login novamente.");
            logout();

        } else {
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

async function enviarSolicitacao(event) {
    event.preventDefault();

    const token = localStorage.getItem('token');
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    const btn = event.target.querySelector('button[type="submit"]');
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

    const textoOriginal = btn.innerHTML;
    btn.innerHTML = "<span class='spinner-border spinner-border-sm'></span> Enviando...";
    btn.disabled = true;

    const payload = {
        matriculaDiscente: usuario.matricula, 
        subtipoId: parseInt(subtipoSelect.value), 
        instituicaoId: 1, 
        participacao: "OUVINTE", 
        cargaHorariaSolicitada: parseInt(document.getElementById('cargaHoraria').value), 
        dataInicio: document.getElementById('dataInicio').value,
        dataFim: document.getElementById('dataFim').value,
        observacaoDiscente: document.getElementById('descricao').value 
    };

    try {
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

            const formData = new FormData();
            formData.append("file", arquivoInput.files[0]);
            
            const responseUpload = await fetch(`${API_BASE_URL}/comprovantes/${idSolicitacao}`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData
            });

            if (responseUpload.ok) {
                alert("Solicitação enviada com sucesso!");
                window.location.href = "dashboard_aluno.html";
            } else {
                alert("Solicitação criada, mas houve erro ao enviar o arquivo.");
                window.location.href = "dashboard_aluno.html";
            }

        } else {
            const textoResposta = await responseSolicitacao.text();
            
            try {
                const erroJson = JSON.parse(textoResposta);
                
                if (erroJson.errors) {
                    const listaErros = erroJson.errors.map(e => `- ${e.field}: ${e.defaultMessage}`).join("\n");
                    alert("Corrija os seguintes erros:\n" + listaErros);
                } else {
                    alert("Erro: " + (erroJson.message || textoResposta));
                }
            } catch (e) {
                alert("Erro ao criar solicitação: " + textoResposta);
            }
        }

    } catch (error) {
        console.error(error);
        alert("Erro de conexão.");

    } finally {
        btn.innerHTML = textoOriginal || "<i class='bx bx-send'></i> ENVIAR PARA ANÁLISE";
        btn.disabled = false;
    }
}

function atualizarResumoDashboard(lista, usuario) {
    
    const atividadesAprovadas = lista.filter(i => {
        const s = i.status ? i.status.toUpperCase() : '';
        return s === 'DEFERIDO' || s === 'DEFERIDA' || s === 'APROVADO';
    });

    const totalAprovadas = atividadesAprovadas.reduce((acc, curr) => {
        const horas = curr.cargaHorariaAproveitada || curr.horasAproveitadas || curr.cargaHorariaSolicitada || 0;
        
        return acc + parseInt(horas);
    }, 0);

    const totalPendentes = lista.filter(i => {
        const s = i.status ? i.status.toUpperCase() : '';
        return s === 'PENDENTE' || s === 'EM ANÁLISE';
    }).length;

    if(document.getElementById('totalHoras')) {
        document.getElementById('totalHoras').innerText = `${totalAprovadas} h`;
    }

    if(document.getElementById('totalPendentes')) {
        document.getElementById('totalPendentes').innerText = totalPendentes;
    }

    const meta = usuario.totalHorasComplementares || 200;
    let porcentagem = (totalAprovadas / meta) * 100;
    
    if (porcentagem > 100) porcentagem = 100;

    const barra = document.getElementById('barraProgresso');
    if(barra) {
        barra.style.width = `${porcentagem}%`;
        barra.innerText = `${Math.floor(porcentagem)}%`;
        
        if(porcentagem >= 100) {
            barra.classList.remove('bg-primary');
            barra.classList.add('bg-success');
        } else {
            barra.classList.add('bg-primary');
            barra.classList.remove('bg-success');
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {

    if (document.getElementById('tabela-corpo') || document.querySelector('table tbody')) {
        carregarDashboardAluno();
    }

    if (document.getElementById('cardNome') || document.getElementById('inputNome')) {
        carregarPerfil();
    }
    
    if (typeof verificarAutenticacao === 'function') {
        verificarAutenticacao();
    }
});

const dadosAtividades = {
    "ENSINO": {
        "Monitoria": [
            { id: 1, nome: "Monitoria Voluntária ou Remunerada" }
        ],
        "Cursos de Língua": [
            { id: 2, nome: "Curso de Língua Estrangeira" }
        ],
        "Outros": [
            { id: 3, nome: "Participação em PET (Programa de Educação Tutorial)" }
        ]
    },
    "PESQUISA": {
        "Iniciação Científica": [
            { id: 4, nome: "PIBIC (Bolsista)" },
            { id: 5, nome: "IC Voluntária" }
        ],
        "Publicações": [
            { id: 6, nome: "Publicação de Artigo em Congresso" },
            { id: 7, nome: "Publicação em Revista (Periódico)" }
        ]
    },
    "EXTENSAO": {
        "Eventos": [
            { id: 8, nome: "Organização de Eventos" },
            { id: 9, nome: "Ouvinte em Palestras/Seminários" }
        ],
        "Cursos": [
            { id: 10, nome: "Curso de Extensão ou Minicurso" }
        ],
        "Projetos Sociais": [
            { id: 11, nome: "Participação em Projeto Social" },
            { id: 12, nome: "Prestação de Serviço à Comunidade" }
        ]
    }
};

function atualizarTipos() {
    const grupoSelect = document.getElementById('grupoAtividade');
    const tipoSelect = document.getElementById('tipoAtividade');
    const subtipoSelect = document.getElementById('subtipoAtividade');

    tipoSelect.innerHTML = '<option value="" selected disabled>Selecione...</option>';
    subtipoSelect.innerHTML = '<option value="" selected disabled>--</option>';
    subtipoSelect.disabled = true;

    const grupoSelecionado = grupoSelect.value;

    if (grupoSelecionado && dadosAtividades[grupoSelecionado]) {
        const tipos = Object.keys(dadosAtividades[grupoSelecionado]);

        tipos.forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo;
            option.textContent = tipo;
            tipoSelect.appendChild(option);
        });

        tipoSelect.disabled = false;
    } else {
        tipoSelect.disabled = true;
    }
}

function atualizarSubtipos() {
    const grupoSelect = document.getElementById('grupoAtividade');
    const tipoSelect = document.getElementById('tipoAtividade');
    const subtipoSelect = document.getElementById('subtipoAtividade');

    subtipoSelect.innerHTML = '<option value="" selected disabled>Selecione...</option>';

    const grupo = grupoSelect.value;
    const tipo = tipoSelect.value;

    if (grupo && tipo && dadosAtividades[grupo][tipo]) {
        const listaSubtipos = dadosAtividades[grupo][tipo];

        listaSubtipos.forEach(sub => {
            const option = document.createElement('option');
            option.value = sub.id;
            option.textContent = sub.nome;
            subtipoSelect.appendChild(option);
        });

        subtipoSelect.disabled = false;
    } else {
        subtipoSelect.disabled = true;
    }
}

function cancelarEdicaoPerfil() {
    const inputs = ['inputNome', 'inputEmail', 'inputTelefone'];

    inputs.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = dadosOriginais[id] || "";
    });

    finalizarModoEdicao();
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
    
    if (btn) {
        btn.innerHTML = "<i class='bx bx-edit-alt'></i> Editar";
        btn.classList.add('btn-outline-primary');
        btn.classList.remove('btn-success');
        btn.disabled = false;
    }

    if(btnCancelar) btnCancelar.remove();
}

function mostrarJustificativa(id) {
    const lista = (typeof listaAtual !== 'undefined') ? listaAtual : (typeof cacheSolicitacoesAluno !== 'undefined' ? cacheSolicitacoesAluno : []);
    
    const item = lista.find(s => s.id === id);
    
    if (item) {
        const justificativa = item.observacaoResponsavel || "Nenhuma justificativa informada.";
        
        const modalBody = document.querySelector('#modalJustificativa .modal-body .alert');
        if (modalBody) {
            modalBody.innerText = justificativa;
        }

        const modalEl = document.getElementById('modalJustificativa');
        if(modalEl) {
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        }
    }
}
