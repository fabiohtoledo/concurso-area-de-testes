import { supabase } from './getdumb.js'

// Defina aqui quantas questões você quer puxar por lote (fácil de alterar!)
const QUANTIDADE_QUESTOES_LOTE = 2;

const nomesMaterias = {
    'portugues': 'Língua Portuguesa e Interpretação de Texto',
    'matematica': 'Matemática',
    'gerais': 'Conhecimentos Gerais',
    'informatica': 'Noções Básicas de Informática',
    'administracao': 'Noções de Administração Pública'
};

const teoriasTemas = {
    'Crase': 'A crase é a fusão da preposição "a" com o artigo definido feminino "a"...',
    'Porcentagem': 'A porcentagem representa uma razão com base 100...',
    'Geografia': 'Estudo do espaço geográfico e organização territorial...',
    'História': 'Estudo dos fatos e processos históricos que moldaram a sociedade...',
    'Atalhos': 'Combinações de teclas para otimizar operações no sistema...',
    'Hardware': 'Componentes físicos e arquitetura de computadores...',
    'Internet': 'Protocolos, redes de computadores e segurança da informação...',
    'Direito Constitucional': 'Estudo das normas fundamentais e princípios da organização do Estado...',
    'Ética': 'Padrões de conduta e moralidade aplicados à administração pública...',
    'Organização Administrativa': 'Estrutura, poderes e divisão funcional da administração.'
};

// Variável para armazenar as questões carregadas da sessão atual
let questoesAtuais = [];
let indiceQuestaoAtual = 0;

async function inicializarPaginaQuestoes() {
    const queryParams = decodeURIComponent(window.location.search.substring(1).trim().toLowerCase());
    const materiaAtual = queryParams || 'portugues';

    const tituloEl = document.getElementById('materiaTitulo');
    tituloEl.textContent = nomesMaterias[materiaAtual] || 'Questões de Concurso';

    await carregarTemas(materiaAtual);
}

async function carregarTemas(materia) {
    const { data, error } = await supabase
        .from('questoes')
        .select('tema, materia')
        .ilike('materia', materia);

    if (error) {
        console.error("Erro ao carregar temas:", error);
        return;
    }

    const container = document.getElementById('themeListContainer');
    container.innerHTML = ''; 

    if (!data || data.length === 0) {
        container.innerHTML = `<li class="theme-item" style="padding: 10px; color: #666;">Nenhum tema encontrado.</li>`;
        return;
    }

    const temasUnicos = [...new Set(data.map(item => item.tema))];

    temasUnicos.forEach((tema, index) => {
        const li = document.createElement('li');
        li.className = 'theme-item';
        
        // Menu lateral limpo, sem input de quantidade para o usuário
        li.innerHTML = `
            <button class="${index === 0 ? 'active' : ''}" data-tema="${tema}">${tema}</button>
            <div class="difficulty-box" style="display: ${index === 0 ? 'block' : 'none'}; padding-left: 15px; margin-top: 8px;">
                <div style="display: flex; gap: 5px;">
                    <button class="btn-diff" data-materia="${materia}" data-tema="${tema}" data-diff="facil" style="font-size:0.75rem; padding:4px 8px;">Fácil</button>
                    <button class="btn-diff" data-materia="${materia}" data-tema="${tema}" data-diff="medio" style="font-size:0.75rem; padding:4px 8px;">Médio</button>
                    <button class="btn-diff" data-materia="${materia}" data-tema="${tema}" data-diff="dificil" style="font-size:0.75rem; padding:4px 8px;">Difícil</button>
                </div>
            </div>
        `;

        container.appendChild(li);

        if (index === 0) {
            atualizarTeoria(tema);
        }
    });

    adicionarEventosDeClique();
}

function atualizarTeoria(tema) {
    const theoryContainer = document.getElementById('theoryContainer');
    const textoTeoria = teoriasTemas[tema] || 'Teoria em breve para este tópico.';
    if (theoryContainer) {
        theoryContainer.innerHTML = `
            <h3>Teoria Resumida: ${tema}</h3>
            <p>${textoTeoria}</p>
        `;
    }
}

function adicionarEventosDeClique() {
    // Clique no tema abre/fecha opções de dificuldade
    document.querySelectorAll('.theme-item button:first-child').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.theme-item button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            document.querySelectorAll('.difficulty-box').forEach(box => box.style.display = 'none');
            const diffBox = e.target.nextElementSibling;
            if (diffBox) diffBox.style.display = 'block';

            const tema = e.target.getAttribute('data-tema');
            atualizarTeoria(tema);
        });
    });

    // Clique nos botões de Dificuldade
    document.querySelectorAll('.btn-diff').forEach(btnDiff => {
        btnDiff.addEventListener('click', async (e) => {
            const materia = e.target.getAttribute('data-materia');
            const tema = e.target.getAttribute('data-tema');
            const dificuldade = e.target.getAttribute('data-diff');

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // Busca as questões usando a quantidade fixa definida no topo
            questoesAtuais = await buscarQuestoesParaEstudar(session.user.id, materia, tema, dificuldade, QUANTIDADE_QUESTOES_LOTE);
            indiceQuestaoAtual = 0;

            if (questoesAtuais.length > 0) {
                renderizarQuestao(questoesAtuais);
            } else {
                alert("Não há questões cadastradas para este filtro.");
            }
        });
    });
}

// Lógica inteligente de busca (Inéditas + Reciclagem se acabar)
async function buscarQuestoesParaEstudar(userId, materia, tema, dificuldade, quantidadeDesejada) {
    let { data: todasDoTema, error: errTotal } = await supabase
        .from('questoes')
        .select('id')
        .eq('materia', materia)
        .eq('tema', tema)
        .eq('dificuldade', dificuldade);

    if (errTotal || !todasDoTema.length) return [];

    const idsPossiveis = todasDoTema.map(q => q.id);
    
    const { data: historico } = await supabase
        .from('historico_respostas')
        .select('questao_id')
        .eq('user_id', userId)
        .in('questao_id', idsPossiveis);

    const idsRespondidas = historico ? historico.map(h => h.questao_id) : [];
    let idsIneditas = idsPossiveis.filter(id => !idsRespondidas.includes(id));

    let idsSelecionados = [];

    if (idsIneditas.length >= quantidadeDesejada) {
        idsIneditas.sort(() => 0.5 - Math.random());
        idsSelecionados = idsIneditas.slice(0, quantidadeDesejada);
    } else {
        idsSelecionados = [...idsIneditas];
        const idsJaFeitas = idsPossiveis.filter(id => idsRespondidas.includes(id));
        idsJaFeitas.sort(() => 0.5 - Math.random());

        const quantoFalta = quantidadeDesejada - idsSelecionados.length;
        const recicladas = idsJaFeitas.slice(0, quantoFalta);
        idsSelecionados = [...idsSelecionados, ...recicladas];
    }

    const { data: questoesFinais } = await supabase
        .from('questoes')
        .select('*')
        .in('id', idsSelecionados);

    return questoesFinais || [];
}

// Renderiza TODAS as questões do lote de uma vez na tela
function renderizarQuestao(questoesArray) {
    const container = document.getElementById('questionContainer');
    if (!container) return;

    if (!questoesArray || questoesArray.length === 0) {
        container.innerHTML = "<p>Nenhuma questão encontrada para este filtro.</p>";
        return;
    }

    let htmlTotal = '';

    // Loop para montar o card de cada questão do lote
    questoesArray.forEach((q, index) => {
        let alternativasHtml = '';
        for (const [letra, texto] of Object.entries(q.alternativas)) {
            alternativasHtml += `
                <label class="option-item" style="display: block; margin-bottom: 6px; cursor: pointer;">
                    <input type="radio" name="qst_${q.id}" value="${letra.toUpperCase()}">
                    <span class="option-text">${letra.toUpperCase()}) ${texto}</span>
                </label>
            `;
        }

        htmlTotal += `
            <div class="bloco-questao" style="margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #ddd;" data-id="${q.id}" data-gabarito="${q.resposta_correta.toUpperCase()}">
                <div class="question-header" style="font-weight: bold; margin-bottom: 10px; color: #555;">
                    <span>Questão ${index + 1} (ID: ${q.id}) • Dificuldade: ${q.dificuldade}</span>
                </div>
                
                <div class="question-statement" style="margin-bottom: 15px; font-size: 1.05rem;">
                    ${q.enunciado}
                </div>

                <div class="options-list" style="margin-bottom: 15px;">
                    ${alternativasHtml}
                </div>

                <div class="explanation-box" id="explanationBox_${q.id}" style="display: none; margin-top: 10px; padding: 10px; background: #f9f9f9; border-radius: 4px;">
                    <h4 style="margin: 0 0 5px 0;">Gabarito Comentado</h4>
                    <p id="textoComentario_${q.id}" style="margin: 0;"></p>
                </div>
            </div>
        `;
    });
    // Adiciona o botão e a div vazia para o placar no final
    htmlTotal += `
        <div style="margin: 20px auto">
            <button class="btn-action" id="btnResponderLote" style="padding: 10px 20px; background: #2563eb; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                Corresponder e Enviar Respostas
            </button>
        </div>
        <div id="placarLoteContainer"></div>
    `;

    container.innerHTML = htmlTotal;

    // Evento de clique para corrigir todas as respondidas de uma vez
    document.getElementById('btnResponderLote').addEventListener('click', () => {
        corrigirEEnviarLote(questoesArray);
    });
}

// Função para corrigir o lote, bloquear novos cliques e exibir o placar
async function corrigirEEnviarLote(questoesArray) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    let respondidasCount = 0;
    let totalAcertos = 0;

    // 1. Valida se o aluno respondeu pelo menos uma
    let algumaRespondida = questoesArray.some(q => document.querySelector(`input[name="qst_${q.id}"]:checked`));
    if (!algumaRespondida) {
        alert("Responda ao menos uma questão antes de enviar!");
        return;
    }

    // 2. TRAVA IMEDIATA: Desativa o botão de envio e todos os radios para evitar cliques duplos
    const btnEnviar = document.getElementById('btnResponderLote');
    if (btnEnviar) {
        btnEnviar.disabled = true;
        btnEnviar.textContent = "Respostas Enviadas";
        btnEnviar.style.backgroundColor = "#9ca3af"; // Cinza indicando desativado
        btnEnviar.style.cursor = "not-allowed";
    }

    // Desativa todos os inputs de rádio da tela
    document.querySelectorAll('input[type="radio"]').forEach(input => {
        input.disabled = true;
    });

    // 3. Processa cada questão
    for (const q of questoesArray) {
        const opcaoSelecionada = document.querySelector(`input[name="qst_${q.id}"]:checked`);
        if (!opcaoSelecionada) continue; // Pula as que o aluno deixou em branco

        respondidasCount++;
        const respostaUser = opcaoSelecionada.value;
        const acertou = (respostaUser === q.resposta_correta.toUpperCase());

        if (acertou) {
            totalAcertos++;
        }

        // Mostra o comentário individual de cada questão
        const boxExplicacao = document.getElementById(`explanationBox_${q.id}`);
        const textoComentario = document.getElementById(`textoComentario_${q.id}`);
        boxExplicacao.style.display = 'block';

        if (acertou) {
            textoComentario.innerHTML = `<strong>Correto!</strong><br>${q.comentario || 'Sem comentários.'}`;
            boxExplicacao.style.borderLeft = '4px solid #16a34a';
        } else {
            textoComentario.innerHTML = `<strong>Incorreto. A correta era: ${q.resposta_correta.toUpperCase()}</strong><br>${q.comentario || 'Sem comentários.'}`;
            boxExplicacao.style.borderLeft = '4px solid #dc2626';
        }

        // Salva no Supabase (`historico_respostas`)
        await supabase
            .from('historico_respostas')
            .insert([{ user_id: session.user.id, questao_id: q.id, acertou: acertou }]);
    }

    // 4. Renderiza o Placar Final logo abaixo do botão de envio
    const containerPlacar = document.getElementById('placarLoteContainer');
    if (containerPlacar) {
        const porcentagem = Math.round((totalAcertos / respondidasCount) * 100);
        containerPlacar.innerHTML = `
            <div style="margin-top: 25spx; padding: 15px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; text-align: center;">
                <h3 style="margin: 0 0 5px 0; color: #166534;">Resultado do Lote</h3>
                <p style="margin: 0; font-size: 1.1rem; color: #15803d;">
                    Você acertou <strong>${totalAcertos}</strong> de <strong>${respondidasCount}</strong> questões (${porcentagem}%)!
                </p>
                <p style="margin: 5px 0 1rem 0; font-size: 0.85rem; color: #666;">Seu histórico foi atualizado na dashboard.</p>
                <a href="dashboard.html" style="margin=2rem;" class="back-link">Voltar ao Dashboard</a>
            </div>
        `;
    }
}

inicializarPaginaQuestoes();