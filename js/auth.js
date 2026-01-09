async function login(event) {
    event.preventDefault();
    const loginInput = document.getElementById('email').value;
    const senhaInput = document.getElementById('senha').value;
    const btn = event.target.querySelector('button');
    const originalText = btn.innerText;
    
    btn.innerText = "Autenticando...";
    btn.disabled = true;

    const payload = {
        email: loginInput,
        senha: senhaInput
    };

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('token', data.token);
            
            if (data.perfil === 'DISCENTE') {
                await buscarDadosDiscente(data.identificador, data.token);
            } else if (data.perfil === 'COORDENADOR') {
                localStorage.setItem('usuario', JSON.stringify({
                    nome: data.nome || "Coordenador",
                    email: data.email || loginInput,
                    perfil: "COORDENADOR"
                }));
                window.location.href = 'dashboard_coordenador.html';
            } else if (data.perfil === 'ADMIN') {
                localStorage.setItem('usuario', JSON.stringify({
                    nome: data.nome || "Administrador",
                    perfil: "ADMIN"
                }));
                window.location.href = 'dashboard_adm.html';
            }
        } else {
            try {
                const erroData = await response.json();
                alert("Erro: " + (erroData.message || "Login inválido!"));
            } catch {
                alert("Login inválido! Verifique email e senha.");
            }
        }
    } catch (error) {
        console.error("Erro:", error);
        alert("Erro de conexão.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

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
        }
    } catch (error) {
        console.error(error);
    }
}

async function cadastrar(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());

    if (data.senha !== data.confirmarSenha) {
        alert("As senhas não coincidem!");
        return;
    }

    const payload = {
        matricula: data.matricula,
        nome: data.nome,
        email: data.email,
        senha: data.senha,
        telefone: data.telefone,
        idCurso: 1,
        horasCumpridas: 0,
        ingressao: new Date().toISOString().split('T')[0]
    };

    try {
        const response = await fetch(`${API_BASE_URL}/discentes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("Cadastro realizado! Faça login.");
            window.location.href = "index.html";
        } else {
            const textoErro = await response.text();
            try {
                const jsonErro = JSON.parse(textoErro);
                if (jsonErro.errors) {
                    const mensagens = jsonErro.errors.map(e => e.defaultMessage).join("\n");
                    alert("Erro de validação:\n" + mensagens);
                } else {
                    alert("Erro: " + (jsonErro.message || textoErro));
                }
            } catch (e) {
                alert("Erro no cadastro: " + textoErro);
            }
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
    const paginasPublicas = ['index.html', 'cadastro.html', 'login.html', 'recuperacao.html'];
    const paginaAtual = window.location.pathname.split("/").pop();

    if (!token && !paginasPublicas.includes(paginaAtual) && paginaAtual !== '') {
        // window.location.href = 'index.html'; // Descomente para ativar proteção
    }
}