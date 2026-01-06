// Mapeamento de Atividades
const dadosAtividades = {
    "ENSINO": {
        "Monitoria": [ { id: 1, nome: "Monitoria Voluntária ou Remunerada" } ],
        "Cursos":    [ { id: 2, nome: "Curso de Língua Estrangeira" } ]
    },
    "PESQUISA": {
        "Iniciação Científica": [ { id: 4, nome: "PIBIC (Bolsista)" }, { id: 5, nome: "IC Voluntária" } ],
        "Publicações":          [ { id: 6, nome: "Publicação de Artigo" } ]
    },
    "EXTENSAO": {
        "Eventos":          [ { id: 8, nome: "Organização de Eventos" } ],
        "Projetos Sociais": [ { id: 11, nome: "Participação em Projeto Social" } ]
    }
};

let cacheAlunos = [];

document.addEventListener("DOMContentLoaded", () => {
    if (typeof verificarAutenticacao === 'function') verificarAutenticacao();
    carregarListaAlunosAutocomplete();

    const params = new URLSearchParams(window.location.search);
    const matriculaUrl = params.get('id');
    if (matriculaUrl) {
        document.getElementById('buscaAluno').value = matriculaUrl;
    }
});

async function carregarListaAlunosAutocomplete() {
    const token = localStorage.getItem('token');
    const datalist = document.getElementById('alunosList');
    
    try {
        const response = await fetch(`${API_BASE_URL}/discentes`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            const alunos = await response.json();
            cacheAlunos = alunos;
            datalist.innerHTML = '';
            alunos.forEach(aluno => {
                const option = document.createElement('option');
                option.value = `${aluno.matricula} - ${aluno.nome}`;
                datalist.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Erro ao carregar alunos:", error);
    }
}

function buscarAlunoDetalhes() {
    const inputVal = document.getElementById('buscaAluno').value;
    const matricula = inputVal.split(' - ')[0].trim();
    const aluno = cacheAlunos.find(a => a.matricula === matricula);
    
    if (aluno) {
        alert(`Aluno: ${aluno.nome}\nCurso: ${aluno.cursoNome || 'Engenharia'}`);
        document.getElementById('buscaAluno').classList.add('is-valid');
    } else {
        alert("Aluno não encontrado.");
        document.getElementById('buscaAluno').classList.add('is-invalid');
    }
}

function atualizarTipos() {
    const grupo = document.getElementById('grupoAtividade').value;
    const tipoSelect = document.getElementById('tipoAtividade');
    const subtipoSelect = document.getElementById('subtipoAtividade');
    
    tipoSelect.innerHTML = '<option value="" selected disabled>Selecione...</option>';
    subtipoSelect.innerHTML = '<option value="" selected disabled>--</option>';
    subtipoSelect.disabled = true;
    tipoSelect.disabled = false;

    if (dadosAtividades[grupo]) {
        Object.keys(dadosAtividades[grupo]).forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo;
            option.textContent = tipo;
            tipoSelect.appendChild(option);
        });
    }
}

function atualizarSubtipos() {
    const grupo = document.getElementById('grupoAtividade').value;
    const tipo = document.getElementById('tipoAtividade').value;
    const subtipoSelect = document.getElementById('subtipoAtividade');
    
    subtipoSelect.innerHTML = '<option value="" selected disabled>Selecione...</option>';
    subtipoSelect.disabled = false;

    if (dadosAtividades[grupo] && dadosAtividades[grupo][tipo]) {
        dadosAtividades[grupo][tipo].forEach(sub => {
            const option = document.createElement('option');
            option.value = sub.id;
            option.textContent = sub.nome;
            subtipoSelect.appendChild(option);
        });
    }
}

async function lancamentoManual(event) {
    event.preventDefault();

    const token = localStorage.getItem('token');
    const btn = event.target.querySelector('button[type="submit"]');
    const inputAluno = document.getElementById('buscaAluno').value;
    const matricula = inputAluno.split(' - ')[0].trim();
    const subtipoId = document.getElementById('subtipoAtividade').value;

    if (!matricula || matricula.length < 3) { alert("Selecione um aluno válido."); return; }
    if (!subtipoId) { alert("Selecione o tipo e subtipo."); return; }

    const textoOriginal = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Processando...`;
    btn.disabled = true;

    // --- CORREÇÃO AQUI: ADICIONADOS OS CAMPOS QUE O JAVA EXIGE ---
    const payload = {
        matriculaDiscente: matricula,
        subtipoId: parseInt(subtipoId),
        instituicaoId: 1,
        
        nomeAtividade: document.getElementById('descricaoAtividade').value,
        nomeInstituicao: document.getElementById('nomeInstituicao').value,
        dataInicio: document.getElementById('dataInicio').value,
        dataFim: document.getElementById('dataFim').value,
        
        cargaHorariaSolicitada: parseInt(document.getElementById('cargaHoraria').value),
        cargaHorariaAproveitada: parseInt(document.getElementById('cargaHoraria').value), // Já aprova
        
        observacaoResponsavel: document.getElementById('justificativa').value + " (Lançamento Manual)",
        status: "DEFERIDA",

        // CAMPOS FANTASMA (Para passar na validação do Java)
        participacao: "OUVINTE", // Valor padrão obrigatório
        observacaoDiscente: "Lançamento administrativo realizado pela coordenação." // Texto padrão obrigatório
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
            alert("Horas lançadas com sucesso!");
            window.location.href = "coordenador_alunos.html";
        } else {
            const erro = await response.text();
            try {
                const erroObj = JSON.parse(erro);
                if(erroObj.errors) {
                    alert("Erro de validação:\n" + erroObj.errors.map(e => "- " + e.defaultMessage).join("\n"));
                } else {
                    alert("Erro: " + (erroObj.message || erro));
                }
            } catch {
                alert("Erro ao lançar: " + erro);
            }
        }

    } catch (error) {
        console.error(error);
        alert("Erro de conexão.");
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
}