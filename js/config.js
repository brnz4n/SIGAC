const API_BASE_URL = "http://localhost:8080";

function formatarData(dataISO) {
    if (!dataISO) return '-';
    return new Date(dataISO).toLocaleDateString('pt-BR');
}
