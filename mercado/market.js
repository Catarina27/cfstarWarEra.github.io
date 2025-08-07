// market.js

// URLs das APIs
const PRICES_API_URL = "https://api2.warera.io/trpc/itemTrading.getPrices";
const CONFIG_API_URL = "https://api2.warera.io/trpc/gameConfig.getGameConfig";

// Estado da aplicação
let marketData = {}; // Dados brutos da API de preços
let configData = {}; // Dados brutos da API de configuração
let bonusPercent = 0; // Valor do bónus (simulado)
let ingredientCosts = {}; // Simulação de custos dos ingredientes (se tiveres uma fonte, pode ser carregado aqui)

// Elementos do DOM
const ui = {
    backToMenuBtn: document.getElementById('back-to-menu-btn'),
    refreshBtn: document.getElementById('refresh-btn'),
    bonusInput: document.getElementById('bonus-input'),
    updateBonusBtn: document.getElementById('update-bonus-btn'),
    bonusStatus: document.getElementById('bonus-status'),
    loadingMessage: document.getElementById('loading-message'),
    marketTable: document.getElementById('market-table'),
    marketTableBody: document.getElementById('market-table-body'),
    bestItemDisplay: document.getElementById('best-item'),
    worstItemDisplay: document.getElementById('worst-item'),
    chartCanvas: document.getElementById('profit-chart')
};

let profitChart = null; // Instância do Chart.js

// --- FUNÇÕES AUXILIARES ---

/**
 * Converte um nome de item para a chave usada pela API.
 * @param {string} nome - O nome do item.
 * @returns {string} A chave da API.
 */
function converterParaChaveAPI(nome) {
    switch (nome) {
        case "Misterious Plant":
            return "coca";
        case "Pill":
            return "cocain";
        case "Case":
            return "case1";
        // Adiciona mais mapeamentos conforme necessário
        default:
            // Converte para camelCase e remove espaços
            return nome
                .replace(/\s+/g, "") // remove espaços
                .replace(/^[A-Z]/, (c) => c.toLowerCase()) // primeira letra minúscula
                .replace(/\s(.)/g, (_, c) => c.toUpperCase()); // camelCase
    }
}

/**
 * Converte um nome de item para camelCase (para config API).
 * @param {string} str - O nome do item.
 * @returns {string} O nome em camelCase.
 */
function toCamelCase(str) {
    return str
        .toLowerCase()
        .split(/[\s-_]+/)
        .map((word, index) =>
            index === 0 ? word : word[0].toUpperCase() + word.slice(1)
        )
        .join('');
}

/**
 * Mostra uma mensagem de status temporária.
 * @param {string} message - A mensagem a mostrar.
 * @param {boolean} isSuccess - Se é uma mensagem de sucesso.
 */
function showStatus(message, isSuccess = true) {
    ui.bonusStatus.textContent = message;
    ui.bonusStatus.style.color = isSuccess ? 'var(--color-accent-green, #3fb950)' : 'var(--color-accent-red, #f85149)';
    setTimeout(() => {
        ui.bonusStatus.textContent = '';
    }, 3000); // Limpa após 3 segundos
}

/**
 * Atualiza o gráfico e os displays de melhor/pior item com os dados fornecidos.
 * @param {Array} data - Array de objetos com dados dos itens.
 */
function updateChartAndRankings(data) {
    // Destroi o gráfico existente se houver
    if (profitChart) {
        profitChart.destroy();
    }

    // Ordena os dados por lucro com bónus por trabalho (descendente)
    const sortedData = [...data].sort((a, b) => (b.lucroPorTrabalhoComBonus || 0) - (a.lucroPorTrabalhoComBonus || 0));

    // Encontrar melhor e pior item
    const bestItem = sortedData.length > 0 ? sortedData[0] : null;
    const worstItem = sortedData.length > 0 ? sortedData[sortedData.length - 1] : null;

    // Atualizar displays de melhor/pior
    ui.bestItemDisplay.textContent = bestItem ? bestItem.item : '-';
    ui.worstItemDisplay.textContent = worstItem ? worstItem.item : '-';

    // Top 10 para o gráfico
    //const top10Data = sortedData.slice(0, 10);

    const labels = sortedData.map(d => d.item);
    const values = sortedData.map(d => d.lucroPorTrabalhoComBonus);


    const ctx = ui.chartCanvas.getContext('2d');
    
    // Se já existe um gráfico, destrói-o
    if (profitChart) {
        profitChart.destroy();
    }

    // Cria um novo gráfico
    profitChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Lucro por Trabalho (c/ Bónus)',
                data: values, // Corrigido: estava faltando 'data: values,'
                backgroundColor: 'rgba(139, 92, 246, 0.7)', // Roxo suave
                borderColor: 'rgba(139, 92, 246, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y', // Gráfico horizontal
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        // Cores iniciais
                        color: '#e6edf3' // Placeholder, será atualizado
                    },
                    grid: {
                        // Cores iniciais
                        color: 'rgba(255, 255, 255, 0.1)' // Placeholder, será atualizado
                    }
                },
                y: {
                    ticks: {
                        // Cores iniciais
                        color: '#e6edf3' // Placeholder, será atualizado
                    },
                    grid: {
                        // Cores iniciais
                        color: 'rgba(255, 255, 255, 0.1)' // Placeholder, será atualizado
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        // Cores iniciais
                        color: '#e6edf3' // Placeholder, será atualizado
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Lucro/Trabalho: ${context.parsed.x.toFixed(4)}`;
                        }
                    }
                }
            },
            responsive: true,
            maintainAspectRatio: false
        }
    });

    // --- ATUALIZAÇÃO DE CORES ---
    // Após criar o gráfico, atualiza as cores com base no tema atual
    updateChartColors(profitChart);
}

// --- FUNÇÕES DE API ---

/**
 * Busca dados da API de preços.
 */
async function fetchPrices() {
    try {
        const response = await fetch(PRICES_API_URL);
        if (!response.ok) throw new Error(`Erro HTTP! status: ${response.status}`);
        const json = await response.json();
        marketData = json.result.data; // Assume a estrutura { "itemKey": price, ... }
        console.log("Dados de preços carregados:", marketData);
    } catch (error) {
        console.error("Erro ao carregar dados de preços:", error);
        showStatus("Erro ao carregar preços.", false);
    }
}

/**
 * Busca dados da API de configuração.
 */
async function fetchConfig() {
    try {
        const response = await fetch(CONFIG_API_URL);
        if (!response.ok) throw new Error(`Erro HTTP! status: ${response.status}`);
        const json = await response.json();
        configData = json.result.data.items; // Assume a estrutura { "itemKey": { ...itemData }, ... }
        console.log("Dados de configuração carregados:", configData);
    } catch (error) {
        console.error("Erro ao carregar dados de configuração:", error);
        showStatus("Erro ao carregar configuração.", false);
    }
}

// --- FUNÇÕES DE PROCESSAMENTO E RENDERIZAÇÃO ---

/**
 * Processa os dados combinados e atualiza a tabela e o gráfico.
 */
function processDataAndRender() {
    if (!marketData || !configData) {
        console.warn("Dados insuficientes para processar.");
        return;
    }

    ui.loadingMessage.classList.add('hidden');
    ui.marketTable.classList.remove('hidden');

    const knownItems = [
        "Livestock", "Coca", "Cocain", "Cooked Fish", "Heavy Ammo", "Concrete", "Fish", "Bread", "Ammo", "Limestone", "Grain", "Iron", "Steel", "Lead", "Light Ammo", "Oil", "Petroleum", "Steak"
    ];

    const tableRows = [];
    const chartData = [];


    knownItems.forEach(itemName => {
        const apiPriceKey = converterParaChaveAPI(itemName);
        const apiConfigKey = toCamelCase(itemName);

        const price = marketData[apiPriceKey] !== undefined ? marketData[apiPriceKey] : null;
        const configItem = configData[apiConfigKey];

        const productionPoints = configItem?.productionPoints ?? null;
        // NOTA: numIngredients agora vem diretamente da API, mas só é usado para exibição.
        // O cálculo real usa productionNeeds.
        const numIngredientsAPI = configItem?.productionNeeds ? Object.keys(configItem.productionNeeds).length : null;
        const productionNeeds = configItem?.productionNeeds ?? null; // { "ingrediente": quantidade, ... }

        // --- Cálculos baseados na planilha e nas regras fornecidas ---
        let precoMercado = 'N/A';
        let lucroBruto = 'N/A';
        let trabalho = 'N/A';
        let numIngredientes = 'N/A'; // Para exibição na tabela
        let custoIngredientes = 'N/A';
        let lucroPorTrabalhoBase = 'N/A';
        let lucroComBonus = 'N/A';
        let lucroPorTrabalhoComBonus = 'N/A';

        if (price !== null && productionPoints !== null) {
            precoMercado = parseFloat(price.toFixed(2));

            // --- CÁLCULO DO CUSTO DOS INGREDIENTES E Nº INGREDIENTES ---
            let custoDosIngredientes = 0;
            let totalQuantidadeIngredientes = 0; // Nova variável para a soma das quantidades
            if (productionNeeds) {
                // Itera sobre os ingredientes necessários definidos na API
                for (const [ingredientKey, quantityNeeded] of Object.entries(productionNeeds)) {
                    // Acumula a quantidade total (correção principal)
                    totalQuantidadeIngredientes += quantityNeeded;

                    // Mapeia a chave da API de volta para o nome do item
                    let ingredientItemName = "";
                    switch (ingredientKey) {
                        case "livestock":
                            ingredientItemName = "Livestock";
                            break;
                        case "coca": // Chave da API para Misterious Plant
                            ingredientItemName = "Misterious Plant";
                            break;
                        case "fish":
                            ingredientItemName = "Fish";
                            break;
                        case "lead":
                            ingredientItemName = "Lead";
                            break;
                        case "limestone":
                            ingredientItemName = "Limestone";
                            break;
                        case "grain":
                            ingredientItemName = "Grain";
                            break;
                        case "iron":
                            ingredientItemName = "Iron";
                            break;
                        case "petroleum":
                            ingredientItemName = "Petroleum";
                            break;
                        default:
                            ingredientItemName = ingredientKey.charAt(0).toUpperCase() + ingredientKey.slice(1);
                            console.warn(`Mapeamento de ingrediente não encontrado para a chave API: '${ingredientKey}'. Usando '${ingredientItemName}'.`);
                    }

                    // Obtém o preço de mercado do ingrediente
                    const ingredientApiPriceKey = converterParaChaveAPI(ingredientItemName);
                    const ingredientPrice = marketData[ingredientApiPriceKey];

                    if (ingredientPrice !== undefined && !isNaN(ingredientPrice)) {
                        custoDosIngredientes += ingredientPrice * quantityNeeded;
                    } else {
                        console.warn(`Preço não disponível para o ingrediente '${ingredientItemName}' (chave API: ${ingredientApiPriceKey}) necessário para '${itemName}'. Custo total será N/A.`);
                        custoDosIngredientes = NaN;
                        break;
                    }
                }
            }
            // Se não houver productionNeeds, totalQuantidadeIngredientes e custoDosIngredientes permanecem 0.

            if (!isNaN(custoDosIngredientes)) {
                custoIngredientes = parseFloat(custoDosIngredientes.toFixed(2));
                // --- FIM DO CÁLCULO DO CUSTO DOS INGREDIENTES ---

                lucroBruto = parseFloat((precoMercado - custoDosIngredientes).toFixed(2));
                trabalho = productionPoints;
                // Correção: Usa a soma total das quantidades para "Nº ingredientes"
                // Se não houver productionNeeds, mostra '-' ou 0, dependendo da lógica desejada.
                // Aqui, se totalQuantidadeIngredientes for 0 mas productionNeeds existir, mostra 0.
                // Se nem productionNeeds existir, mostra '-'.
                if (productionNeeds) {
                    numIngredientes = totalQuantidadeIngredientes;
                } else {
                    numIngredientes = '-'; // Ou 0, se for o padrão para itens sem receita
                }

                if (trabalho > 0) {
                    lucroPorTrabalhoBase = parseFloat((lucroBruto / trabalho).toFixed(6));
                    const lucroBrutoNum = lucroBruto;
                    const lucroComBonusNum = lucroBrutoNum * (1 + bonusPercent / 100);
                    lucroComBonus = parseFloat(lucroComBonusNum.toFixed(2));
                    lucroPorTrabalhoComBonus = parseFloat((lucroComBonusNum / trabalho).toFixed(6));
                }
                precoMercado = precoMercado.toFixed(2);
            } else {
                precoMercado = precoMercado.toFixed(2);
                // custoIngredientes, lucroBruto, etc. já estão como 'N/A'
            }
        }

        // Criar linha da tabela
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${itemName}</td>
            <td>${precoMercado}</td>
            <td>${lucroBruto}</td>
            <td>${trabalho}</td>
            <td>${numIngredientes}</td>
            <td>${custoIngredientes}</td>
            <td>${lucroPorTrabalhoBase}</td>
            <td>${lucroPorTrabalhoComBonus}</td>
        `;
        tableRows.push(row);

        // Preparar dados para o gráfico e rankings (apenas se for um número válido)
        const lucroNum = parseFloat(lucroPorTrabalhoComBonus);
        if (!isNaN(lucroNum) && isFinite(lucroNum)) { // Adiciona verificação de finitude
            chartData.push({ 
                item: itemName, 
                lucroPorTrabalhoComBonus: lucroNum,
                lucroPorTrabalhoBase: parseFloat(lucroPorTrabalhoBase) || 0
            });
        }
    });


    // Limpar e preencher a tabela
    ui.marketTableBody.innerHTML = '';
    tableRows.forEach(row => ui.marketTableBody.appendChild(row));

    // Atualizar o gráfico e rankings
    updateChartAndRankings(chartData);
}

/**
 * Função principal para carregar todos os dados e renderizar.
 */
async function loadDataAndRender() {
    ui.loadingMessage.classList.remove('hidden');
    ui.marketTable.classList.add('hidden');
    showStatus("A carregar dados...");

    try {
        // Carrega ambas as APIs em paralelo
        await Promise.all([fetchPrices(), fetchConfig()]);
        showStatus("Dados carregados com sucesso!");
        processDataAndRender();
    } catch (error) {
        console.error("Erro geral no carregamento:", error);
        showStatus("Erro ao carregar dados.", false);
        ui.loadingMessage.classList.remove('hidden');
        ui.marketTable.classList.add('hidden');
    }
}

/**
 * Obtém as cores atuais do tema (escuro ou claro) para usar no Chart.js.
 * @returns {Object} Um objeto com as cores extraídas das variáveis CSS.
 */
function getChartColorsFromTheme() {
    const style = getComputedStyle(document.body);
    // Tenta obter as cores das variáveis CSS, com fallbacks para o tema escuro
    return {
        textColor: style.getPropertyValue('--color-text-primary').trim() || '#e6edf3',
        gridColor: style.getPropertyValue('--color-border-secondary').trim() || 'rgba(255, 255, 255, 0.1)',
        backgroundColor: style.getPropertyValue('--color-background-secondary').trim() || '#161b22'
    };
}


/**
 * Atualiza as cores do gráfico Chart.js com base no tema atual.
 * @param {Chart} chart - A instância do Chart.js a ser atualizada.
 */
function updateChartColors(chart) {
    if (!chart) return;

    const colors = getChartColorsFromTheme();

    // Atualiza as opções de escala (eixos X e Y)
    if (chart.options.scales) {
        if (chart.options.scales.x) {
            chart.options.scales.x.ticks.color = colors.textColor;
            chart.options.scales.x.grid.color = colors.gridColor;
        }
        if (chart.options.scales.y) {
            chart.options.scales.y.ticks.color = colors.textColor;
            chart.options.scales.y.grid.color = colors.gridColor;
        }
    }

    // Atualiza as opções da legenda
    if (chart.options.plugins && chart.options.plugins.legend) {
        chart.options.plugins.legend.labels.color = colors.textColor;
    }

    // Atualiza as opções do tooltip
    if (chart.options.plugins && chart.options.plugins.tooltip) {
        // As cores do tooltip geralmente são geridas pelo Chart.js com base no tema da página,
        // mas podes personalizá-las se necessário.
        // chart.options.plugins.tooltip.backgroundColor = colors.backgroundColor;
    }

    // Atualiza o gráfico para aplicar as novas opções
    chart.update('none'); // 'none' evita animação na atualização de cores
}


// --- EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    console.log("Market page loaded. Initializing...");


    // --- Lógica de Alternância de Tema ---
    const toggleButtonMarket = document.getElementById('theme-toggle-market');
    const htmlElement = document.documentElement;

    // Verifica e aplica o tema guardado ou o do sistema
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        htmlElement.classList.add('light-theme');
        if (toggleButtonMarket) {
            toggleButtonMarket.textContent = '🌑 Modo Escuro';
        }
    } else if (savedTheme === 'dark') {
        htmlElement.classList.remove('light-theme');
        if (toggleButtonMarket) {
            toggleButtonMarket.textContent = '🌕 Modo Claro';
        }
    }
    // Se não houver tema guardado, mantém o padrão (escuro) e o botão dirá "Modo Claro"

    // Listener para o botão de tema (apenas se o botão existir)
    if (toggleButtonMarket) {
        toggleButtonMarket.addEventListener('click', () => {
            htmlElement.classList.toggle('light-theme');
            const isLight = htmlElement.classList.contains('light-theme');
            toggleButtonMarket.textContent = isLight ? '🌑 Modo Escuro' : '🌕 Modo Claro';
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            
            // --- ATUALIZAÇÃO DO GRÁFICO AO MUDAR O TEMA ---
            // Chama a função para atualizar as cores do gráfico após a mudança de tema
            updateChartColors(profitChart);
        });
    }
    // Carrega o bónus do localStorage (se existir)
    const savedBonus = localStorage.getItem('marketBonus');
    if (savedBonus !== null) {
        bonusPercent = parseFloat(savedBonus);
        ui.bonusInput.value = bonusPercent;
    }

    // Configura listeners
    ui.backToMenuBtn.addEventListener('click', () => {
        window.location.href = '../main-menu.html';
    });

    ui.refreshBtn.addEventListener('click', loadDataAndRender);

    ui.updateBonusBtn.addEventListener('click', () => {
        const newBonus = parseFloat(ui.bonusInput.value);
        if (!isNaN(newBonus) && newBonus >= 0) { // Removida a restrição de 100%
            bonusPercent = newBonus;
            localStorage.setItem('marketBonus', bonusPercent); // Guarda localmente
            showStatus(`Bónus atualizado para ${bonusPercent}%`);
            // Re-processa os dados para refletir o novo bónus
            processDataAndRender();
        } else {
            showStatus("Por favor, insere um valor válido (>= 0).", false);
        }
    });

    // Carrega dados na inicialização
    loadDataAndRender();


    
});
