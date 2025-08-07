// --- START OF FILE src/main.js (CORRECTED & CLEANED) ---

import { 
  playerState, 
  setSkillsData, 
  skillsData, 
  resetPlayerState, 
  SKILL_POINTS_PER_LEVEL, 
  MIN_PLAYER_LEVEL, 
  MAX_PLAYER_LEVEL, 
  MAX_SKILL_LEVEL, 
  MIN_SKILL_LEVEL 
} from './state.js';
import { 
  getSkillData, 
  simulateCombatTick, 
  calculateCumulativeSkillCost, 
  simulateFullCombatWithFood,
  calculateStatDetails 
} from './calculator.js';
import { 
  ui, 
  cacheDOMElements, 
  renderAllUI, 
  showItemInConfigPanel,
  hideItemConfigPanel,
  handleStatMouseEnter,
  handleStatMouseLeave,
  applyButtonTransform,
  renderSimulationLog,
  handleProgressBlockMouseEnter,
  handleProgressBlockMouseLeave,
  showFoodSelectionModal,
  hideFoodSelectionModal,
  formatSkillValue
} from './ui.js';

async function fetchJsonData(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Could not load data from ${path}:`, error);
    return null;
  }
}

// --- Event Handlers ---

function handleSkillButtonClick(button) {
  const skillCode = button.dataset.skill;
  const action = button.dataset.action;
  let currentLevel = playerState.assignedSkillLevels[skillCode];

  const maxHealthBefore = getSkillData('health', playerState.assignedSkillLevels.health)?.value || 50;
  const maxHungerBefore = getSkillData('hunger', playerState.assignedSkillLevels.hunger)?.value || 10;
  const wasHealthMax = playerState.currentHealth >= maxHealthBefore;
  const wasHungerMax = playerState.currentHunger >= maxHungerBefore;

  if (action === 'plus') {
    const nextLevel = Math.min(currentLevel + 1, MAX_SKILL_LEVEL);
    const nextSkillInfo = getSkillData(skillCode, nextLevel);
    
    if (nextSkillInfo && playerState.skillPointsAvailable >= nextSkillInfo.cost && playerState.playerLevel >= nextSkillInfo.unlockAtLevel) {
      playerState.assignedSkillLevels[skillCode] = nextLevel;
      playerState.skillPointsAvailable -= nextSkillInfo.cost;
      playerState.skillPointsSpent += nextSkillInfo.cost;
    }
  } else if (action === 'minus') {
    if (currentLevel > MIN_SKILL_LEVEL) {
        const refundedCost = getSkillData(skillCode, currentLevel)?.cost || 0;
        playerState.assignedSkillLevels[skillCode] = currentLevel - 1;
        playerState.skillPointsAvailable += refundedCost;
        playerState.skillPointsSpent -= refundedCost;
    }
  }

  if (action === 'plus') {
    if (skillCode === 'health' && wasHealthMax) {
        const maxHealthAfter = getSkillData('health', playerState.assignedSkillLevels.health)?.value || 50;
        playerState.currentHealth = maxHealthAfter;
    }
    if (skillCode === 'hunger' && wasHungerMax) {
        const maxHungerAfter = getSkillData('hunger', playerState.assignedSkillLevels.hunger)?.value || 10;
        playerState.currentHunger = maxHungerAfter;
    }
  }

  renderAllUI();
}

function handleLevelButtonClick(event) {
  const button = event.target;
  const action = button.id === 'level-plus-btn' ? 'plus' : 'minus';
  let newLevel = playerState.playerLevel;

  if (action === 'plus') {
    newLevel = Math.min(playerState.playerLevel + 1, MAX_PLAYER_LEVEL);
  } else {
    newLevel = Math.max(playerState.playerLevel - 1, MIN_PLAYER_LEVEL);
  }

  if (newLevel !== playerState.playerLevel) {
    const oldTotalPoints = playerState.playerLevel * SKILL_POINTS_PER_LEVEL;
    playerState.playerLevel = newLevel;
    const newTotalPoints = newLevel * SKILL_POINTS_PER_LEVEL;
    playerState.skillPointsAvailable += (newTotalPoints - oldTotalPoints);
    if (playerState.skillPointsSpent > newTotalPoints) {
      console.warn("Player level decreased, resetting skills as spent points exceed new total.");
      for (const skillCode in playerState.assignedSkillLevels) {
        playerState.assignedSkillLevels[skillCode] = 0;
      }
      playerState.skillPointsSpent = 0;
      playerState.skillPointsAvailable = newTotalPoints;
    }
  }
  renderAllUI();
}

function handleInventoryItemClick(event) {
  const itemElement = event.target.closest('.inventory-item');
  if (!itemElement) return;

  const itemCode = itemElement.dataset.code;
  const itemData = skillsData.skills[itemCode];
  
  if (!itemData) {
    console.warn(`Item with code "${itemCode}" not found in skills data.`);
    return;
  }

  if (itemData.isConsumable && itemData.flatStats && itemData.flatStats.healthRegen) {
    handleConsumeFood(itemData);
  } else {
    playerState.selectedItemForConfig = { ...itemData, code: itemCode };
    showItemInConfigPanel(itemData);
  }
}

function handleConsumeFood(foodData) {
  if (playerState.currentHunger < 1) {
    console.log("Not enough hunger to eat.");
    return;
  }
  const maxHealth = getSkillData('health', playerState.assignedSkillLevels.health)?.value || 50;
  if (playerState.currentHealth >= maxHealth) {
    console.log("Cannot eat, health is already full or overcharged.");
    return;
  }
  const healthRestored = foodData.flatStats.healthRegen || 0;
  playerState.currentHunger -= 1;
  playerState.currentHealth += healthRestored;
  console.log(`Consumed ${foodData.name || foodData.code}, restored ${healthRestored} health.`);
  renderAllUI();
}

function handleResetGame() {
  resetPlayerState();
  playerState.skillPointsAvailable = SKILL_POINTS_PER_LEVEL;
  playerState.skillPointsSpent = 0;
  const maxHealth = getSkillData('health', 0)?.value || 50;
  const maxHunger = getSkillData('hunger', 0)?.value || 10;
  playerState.currentHealth = maxHealth;
  playerState.currentHunger = maxHunger;
  if (ui.simulationLog) ui.simulationLog.innerHTML = 'Simulation results will appear here.';
  renderAllUI();
  applyButtonTransform(ui.resetBtn);
}

function handleEquipItem() {
  const itemToConfigure = playerState.selectedItemForConfig;
  if (!itemToConfigure) return;
  const itemSlot = itemToConfigure.usage;
  if (!itemSlot) return;
  const configuredStats = {};
  const statSliders = ui.itemStatsConfig.querySelectorAll('input[type="range"]');
  if (statSliders.length > 0) {
      statSliders.forEach(slider => {
          configuredStats[slider.dataset.stat] = parseFloat(slider.value);
      });
  } else if (itemToConfigure.flatStats) {
      Object.assign(configuredStats, itemToConfigure.flatStats);
  }
  const equippedItem = {
      code: itemToConfigure.code,
      name: formatCodeToName(itemToConfigure.code),
      stats: configuredStats
  };
  playerState.equippedItems[itemSlot] = equippedItem;
  Object.keys(equippedItem.stats).forEach(statCode => {
      if(ui.charStats[statCode]) {
          const statSpan = ui.charStats[statCode].parentNode.querySelector('span:last-child');
          statSpan.classList.add('stat-updated');
          setTimeout(() => statSpan.classList.remove('stat-updated'), 700);
      }
  });
  hideItemConfigPanel();
  renderAllUI();
}

function handleUnequipItem(event) {
    event.preventDefault();
    const slotElement = event.target.closest('.equipment-slot');
    if (!slotElement) return;
    const slot = slotElement.dataset.slot;
    if (slot && playerState.equippedItems[slot]) {
        playerState.equippedItems[slot] = null;
        renderAllUI();
    }
}

function handleBuffButtonClick(event) {
  const button = event.target.closest('.buff-btn');
  if (!button || button.disabled) return; // No hacer nada si el botÃ³n estÃ¡ deshabilitado

  const buffCode = button.dataset.buffCode;
  const buffData = skillsData.skills[buffCode];
  if (!buffData) return;

  const buffType = buffData.usage === 'ammo' ? 'ammo' : 'consumable';
  const buffObject = {
      code: buffCode,
      name: formatCodeToName(buffCode),
      stats: buffData.flatStats,
  };

  // CORRECCIÃ“N: LÃ³gica de sincronizaciÃ³n de MuniciÃ³n
  if (buffType === 'ammo') {
    // Si la municiÃ³n seleccionada ya estÃ¡ activa, la desactivamos de ambos sitios.
    if (playerState.activeBuffs.ammo?.code === buffCode) {
      playerState.activeBuffs.ammo = null;
      playerState.equippedItems.ammo = null;
    } else {
      // Si no, la activamos en ambos sitios.
      playerState.activeBuffs.ammo = buffObject;
      playerState.equippedItems.ammo = buffObject; // Sincronizamos con el slot de equipamiento
    }
  } else { // LÃ³gica para otros buffs (consumables)
    if (playerState.activeBuffs[buffType]?.code === buffCode) {
        playerState.activeBuffs[buffType] = null;
    } else {
        playerState.activeBuffs[buffType] = buffObject;
    }
  }

  renderAllUI();
}

function handleDamageSimulation() {
  if (playerState.currentHealth <= 0) {
      console.log("Cannot simulate, character has no health.");
      return;
  }
  const simulationResult = simulateCombatTick();
  playerState.currentHealth = Math.max(0, playerState.currentHealth - simulationResult.healthLost);
  renderSimulationLog(simulationResult);
  applyButtonTransform(ui.simulateBtn);
  renderAllUI();
}

// CORRECCIÃ“N: Esta funciÃ³n ahora tiene UNA SOLA responsabilidad: abrir el modal.
function handleFullCombatModalOpening() {
  if (playerState.currentHealth <= 0) {
      console.log("Cannot simulate, character has no health.");
      return;
  }
  showFoodSelectionModal();
  applyButtonTransform(ui.simulateFullBtn);
}



/**
 * Formata um código num nome legível, com exceções para nomes específicos.
 * @param {string} code - O código a formatar.
 * @returns {string} O nome formatado.
 */
function formatCodeToName(code) {
    if (!code) return '';

    // Mapeamento de exceções para nomes específicos em Português
    const nameOverrides = {
        'bread': 'Pão',
        'steak': 'Bife',
        'cookedFish': 'Peixe Cozido'
        // Adiciona mais conforme necessário
    };

    // Se houver uma exceção definida, usa-a
    if (nameOverrides[code]) {
        return nameOverrides[code];
    }

    // Caso contrário, aplica a formatação padrão
    return code
        .replace(/([A-Z])/g, ' $1')
        .replace(/(\d+)/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase());
}


/**
 * Inicia a simulação de combate completo com o item de comida selecionado.
 * Esta função é chamada quando o utilizador clica no botão "Simular" no modal de seleção de comida.
 */
function startFullCombatWithFood() {
  // Procura o elemento do item de comida selecionado dentro do modal
  const selectedItemElement = ui.modal.foodOptions.querySelector('.selected');
  
  // Se nenhum item estiver selecionado, não faz nada (medida de segurança)
  if (!selectedItemElement) return;

  // Obtém o código do item selecionado a partir do atributo 'data-code'
  const itemCode = selectedItemElement.dataset.code;
  
  // Procura os dados completos do item de comida nos dados do jogo carregados
  const foodItem = skillsData.skills[itemCode];

  // Executa a simulação completa de combate, passando o item de comida selecionado
  // O operador spread (...) é usado para passar uma cópia enriquecida do objeto foodItem
  const fullResult = simulateFullCombatWithFood({ 
    ...foodItem, 
    name: formatCodeToName(itemCode) // Adiciona o nome formatado ao objeto
  });
  
  // --- ATUALIZAÇÃO DO ESTADO DO JOGADOR ---
  // CORREÇÃO: Atualiza o estado do jogador com os resultados finais da simulação.
  // Define a vida restante após a simulação
  playerState.currentHealth = fullResult.finalHealth;
  // Define a fome restante após a simulação
  playerState.currentHunger = fullResult.finalHunger;

  // Cria uma string de resumo com os resultados principais da simulação
  const summary = `Sobreviveu ${fullResult.ticksSurvived} golpes usando ${formatCodeToName(itemCode)}, causando ${fullResult.totalDamageDealt} de dano total.`;
  
  // Armazena este resumo no estado do jogador para uso futuro (ex: exportação)
  playerState.lastSimulationSummary = summary;
  
  // Renderiza os resultados detalhados da simulação no log da interface
  renderSimulationLog(fullResult, summary);
  
  // Esconde o modal de seleção de comida, pois a ação foi concluída
  hideFoodSelectionModal();
  
  // Re-renderiza toda a interface do utilizador.
  // Isto é crucial para atualizar as barras de vida/fome e outros elementos
  // com os novos valores do estado do jogador.
  renderAllUI(); 
}

/**
 * Lida com o clique no botão "Exportar".
 * Gera uma imagem da build atual do jogador e inicia o download.
 */
function handleExportBuild() {
  // Obtém o elemento do botão de exportar a partir do cache da UI
  const exportButton = ui.exportBtn;
  
  // Verifica se a biblioteca html2canvas necessária foi carregada
  if (!window.html2canvas) {
    // Se não estiver carregada, regista um erro na consola e alerta o utilizador
    console.error('A biblioteca html2canvas não está carregada.');
    alert('Erro: Biblioteca de exportação não encontrada.');
    return; // Interrompe a função
  }

  // --- PROCESSO DE EXPORTAÇÃO ---
  
  // Preenche o cartão oculto de exportação com os dados atuais do jogador
  // Passa o resumo da última simulação como argumento
  populateExportCard(playerState.lastSimulationSummary);

  // Fornece feedback visual ao utilizador durante a geração da imagem
  // Altera o texto do botão
  exportButton.textContent = 'A gerar...';
  // Desativa o botão para prevenir cliques múltiplos
  exportButton.disabled = true;

  // Obtém o elemento DOM do cartão de exportação (invisível na página)
  const cardElement = document.getElementById('build-export-card');

  // Utiliza a biblioteca html2canvas para capturar o cartão como uma imagem
  html2canvas(cardElement, { 
    // Define uma cor de fundo para a imagem, evitando transparências
    backgroundColor: '#0d1117',
    // Permite o carregamento de imagens externas, se necessário
    useCORS: true 
  }).then(canvas => {
    // --- SUCESSO NA GERAÇÃO DA IMAGEM ---
    
    // Cria um elemento de link (<a>) temporário para iniciar o download
    const link = document.createElement('a');
    
    // Define o nome do ficheiro a ser descarregado, incluindo o nível do jogador
    link.download = `build-jogador-nvl-${playerState.playerLevel}.png`;
    
    // Define o destino do link como os dados da imagem em formato PNG
    link.href = canvas.toDataURL('image/png');
    
    // Simula um clique no link, iniciando o download do ficheiro
    link.click();

    // --- LIMPEZA PÓS-DOWNLOAD ---
    // Restaura o texto original do botão
    exportButton.textContent = '📤 Exportar';
    // Reativa o botão
    exportButton.disabled = false;
    
  }).catch(err => {
    // --- TRATAMENTO DE ERROS ---
    
    // Se ocorrer um erro durante a geração ou download, regista-o na consola
    console.error('Falha ao exportar a build:', err);
    
    // Alerta o utilizador sobre o erro
    alert('Ocorreu um erro ao gerar a imagem.');
    
    // Restaura o estado do botão, mesmo em caso de erro
    exportButton.textContent = '📤 Exportar';
    exportButton.disabled = false;
  });
}

/**
 * Preenche o cartão de exportação com os dados do jogador.
 * Este cartão é um elemento HTML oculto usado especificamente para a geração da imagem de exportação.
 * @param {string} summary - O resumo da última simulação de combate.
 */
function populateExportCard(summary) {
  // --- 1. INFORMAÇÕES GERAIS ---
  // Preenche o distintivo de nível no cabeçalho do cartão
  document.getElementById('export-level-badge').textContent = `NVL ${playerState.playerLevel}`;
  
  // Preenche o resumo da simulação no rodapé do cartão
  // Se não houver resumo, mostra uma mensagem padrão
  document.getElementById('export-simulation-summary').textContent = summary || 'Sem dados de simulação.';

  // --- 2. LISTA DE HABILIDADES ---
  // Obtém o elemento da lista de habilidades no cartão
  const skillsList = document.getElementById('export-skills-list');
  // Limpa qualquer conteúdo anterior da lista
  skillsList.innerHTML = '';
  
  // Define os ícones para cada habilidade
  const skillIcons = { 
    attack: '🗡️', 
    precision: '🎯', 
    criticalChance: '💥', 
    criticalDamages: '🔥', 
    armor: '🛡️', 
    dodge: '🌀', 
    health: '❤️', 
    hunger: '🍗' 
    // lootChance é intencionalmente excluído da exportação
  };
  
  // Itera sobre os códigos de habilidade definidos em 'skillIcons' para manter a ordem
  // e garantir que 'lootChance' não seja incluída
  Object.keys(skillIcons).forEach(code => {
      // Obtém o nível atual atribuído à habilidade
      const level = playerState.assignedSkillLevels[code];
      
      // Cria um novo elemento de lista (<li>) para esta habilidade
      const li = document.createElement('li');
      // Aplica a classe CSS para estilização
      li.className = 'export-skills-list-item';
      
      // Define o conteúdo HTML do item da lista, incluindo ícone, nome e nível
      li.innerHTML = `
          <span class="icon">${skillIcons[code]}</span>
          <span class="name">${formatCodeToName(code)}</span>
          <span class="points">${level}</span>
      `;
      
      // Adiciona o item da lista ao elemento da lista principal
      skillsList.appendChild(li);
  });

  // --- 3. ESTATÍSTICAS DO PERSONAGEM COM DETALHAMENTO ---
  // Obtém o elemento do contentor das estatísticas no cartão
  const statsContainer = document.getElementById('export-stats-list');
  // Limpa qualquer conteúdo anterior
  statsContainer.innerHTML = '';
  
  // Define quais estatísticas serão exibidas (exclui 'health' e 'hunger' pois são recursos)
  const statsToDisplay = ['attack', 'precision', 'criticalChance', 'criticalDamages', 'armor', 'dodge', 'lootChance'];

  // Itera sobre cada estatística a ser exibida
  statsToDisplay.forEach(code => {
      // Calcula os detalhes da estatística, incluindo base, equipamento e buffs
      const details = calculateStatDetails(code);
      
      // Cria um novo elemento 'div' para conter os dados desta estatística
      const statItemDiv = document.createElement('div');
      // Aplica a classe CSS para estilização
      statItemDiv.className = 'export-stat-item';

      // Inicia a construção do HTML para o detalhamento (breakdown)
      let breakdownHtml = '<ul class="export-stat-breakdown">';
      
      // Adiciona a contribuição da habilidade base
      breakdownHtml += `<li><span class="source">Habilidade Base:</span> <span class="value">${formatSkillValue(code, details.skillValue)}</span></li>`;

      // Se houver contribuição de equipamento, adiciona ao detalhamento
      if (details.equipmentValue > 0) {
          // Cria uma lista dos nomes dos itens equipados que contribuíram
          const itemNames = details.equipmentItems.map(item => item.name).join(', ');
          breakdownHtml += `<li><span class="source">Equipamento (${itemNames}):</span> <span class="value">+${formatSkillValue(code, details.equipmentValue)}</span></li>`;
      }

      // Adiciona contribuições específicas de buffs para o Ataque
      if (code === 'attack') {
          if (details.ammoPercent > 0) {
              breakdownHtml += `<li><span class="source">Buff de Munição:</span> <span class="value">+${details.ammoPercent}%</span></li>`;
          }
          if (details.buffPercent > 0) {
              breakdownHtml += `<li><span class="source">Buff de Consumível:</span> <span class="value">+${details.buffPercent}%</span></li>`;
          }
      }
      
      // Finaliza o HTML do detalhamento
      breakdownHtml += '</ul>';

      // Define o conteúdo HTML completo para este item de estatística,
      // incluindo o cabeçalho com nome e valor total, e o detalhamento
      statItemDiv.innerHTML = `
          <div class="export-stat-header">
              <span class="name">${formatCodeToName(code)}</span>
              <span class="total-value">${formatSkillValue(code, details.total)}</span>
          </div>
          ${breakdownHtml}
      `;
      
      // Adiciona o item de estatística ao contentor principal
      statsContainer.appendChild(statItemDiv);
  });

  // --- 4. EQUIPAMENTO EQUIPADO ---
  // Obtém o elemento da grelha de equipamento no cartão
  const equipmentGrid = document.getElementById('export-equipment-grid');
  // Limpa qualquer conteúdo anterior
  equipmentGrid.innerHTML = '';
  
  // Itera sobre cada slot de equipamento e o item nele equipado
  Object.entries(playerState.equippedItems).forEach(([slot, item]) => {
      // Cria um novo elemento 'div' para representar este slot no cartão
      const slotDiv = document.createElement('div');
      // Aplica a classe CSS para estilização
      slotDiv.className = 'export-equipment-slot';
      
      // Inicia a construção do conteúdo do slot
      let content = '';
      
      // Adiciona o nome do slot formatado
      content += `<span class="slot-name">${formatCodeToName(slot)}</span>`;
      
      // Se houver um item equipado neste slot
      if (item) {
          // Adiciona a imagem do item, utilizando o código do item para o caminho
          const imgSrc = `public/images/equipments/${item.code}.png`;
          content += `<img src="${imgSrc}" alt="${item.name}">`;
      } 
      // Se não houver item equipado
      else {
          // Adiciona um traço para indicar slot vazio
          content += '<span>-</span>';
      }
      
      // Define o conteúdo HTML completo do slot
      slotDiv.innerHTML = content;
      
      // Adiciona o slot à grelha de equipamento
      equipmentGrid.appendChild(slotDiv);
  });
}

/**
 * Função de inicialização assíncrona da aplicação.
 * É executada quando o conteúdo DOM está totalmente carregado.
 */
async function initialize() {
  // --- 1. CARREGAMENTO DE DADOS ---
  // Tenta carregar os dados das habilidades e itens a partir do ficheiro JSON
  const data = await fetchJsonData('../public/data/skills.json');
  
  // Se o carregamento falhar, regista um erro e interrompe a inicialização
  if (!data) {
    console.error("Falha ao carregar os dados das habilidades. A aplicação não pode iniciar.");
    return;
  }
  
  // Armazena os dados carregados no estado da aplicação
  setSkillsData(data);
  
  // --- 2. INICIALIZAÇÃO DO ESTADO DO JOGADOR ---
  // Define a vida e fome iniciais com base nos níveis atuais das habilidades 'health' e 'hunger'
  const maxHealth = getSkillData('health', playerState.assignedSkillLevels.health)?.value || 50;
  const maxHunger = getSkillData('hunger', playerState.assignedSkillLevels.hunger)?.value || 10;
  playerState.currentHealth = maxHealth;
  playerState.currentHunger = maxHunger;

  // --- 3. CONFIGURAÇÃO DA INTERFACE ---
  // Preenche o cache com referências aos elementos da DOM para acesso rápido
  cacheDOMElements();
  
  // Calcula e define o número inicial de pontos de habilidade disponíveis
  playerState.skillPointsAvailable = (playerState.playerLevel * SKILL_POINTS_PER_LEVEL) - playerState.skillPointsSpent;

  // --- 4. CONFIGURAÇÃO DOS LISTENERS DE EVENTOS ---
  // Adiciona listeners para os cliques nos botões +/- das habilidades
  document.querySelector('.skills-section').addEventListener('click', (event) => {
    const button = event.target.closest('.skill-btn');
    if (button && !button.disabled) {
      applyButtonTransform(button); // Efeito visual
      handleSkillButtonClick(button); // Lógica da habilidade
    }
  });

  // Adiciona listener para o clique direito (des equipar) nos slots de equipamento
  ui.equipmentSlotsContainer.addEventListener('contextmenu', handleUnequipItem);
  
  // Adiciona listeners para os botões +/- do nível do jogador
  ui.levelMinusBtn.addEventListener('click', (event) => { 
    applyButtonTransform(event.target); // Efeito visual
    handleLevelButtonClick(event); // Lógica de mudança de nível
  });
  ui.levelPlusBtn.addEventListener('click', (event) => { 
    applyButtonTransform(event.target); // Efeito visual
    handleLevelButtonClick(event); // Lógica de mudança de nível
  });
  
  // Adiciona listeners para botões de ação gerais
  ui.resetBtn.addEventListener('click', handleResetGame); // Reiniciar jogo
  ui.exportBtn.addEventListener('click', handleExportBuild); // Exportar
  ui.inventoryGrid.addEventListener('click', handleInventoryItemClick); // Clicar em item do inventário
  
  // Adiciona listeners para os tooltips das estatísticas do personagem
  document.querySelectorAll('.character-stats .stat-item').forEach(statItem => {
    statItem.addEventListener('mouseenter', handleStatMouseEnter); // Mostrar tooltip
    statItem.addEventListener('mouseleave', handleStatMouseLeave); // Esconder tooltip
  });
  
  // Adiciona listener para o botão de equipar item
  ui.equipItemBtn.addEventListener('click', handleEquipItem);
  
  // Adiciona listener para os botões de seleção de buffs
  ui.buffSelection.addEventListener('click', handleBuffButtonClick);
  
  // Adiciona listeners para os botões de simulação
  ui.simulateBtn.addEventListener('click', handleDamageSimulation); // Simular dano único
  // CORREÇÃO: Associa o botão de simulação completa à função que abre o modal
  ui.simulateFullBtn.addEventListener('click', handleFullCombatModalOpening); // Abrir modal de comida

  // Adiciona listeners para os tooltips das barras de progresso das habilidades
  const skillsSection = document.querySelector('.skills-section');
  skillsSection.addEventListener('mouseover', (event) => {
      if (event.target.classList.contains('progress-block')) 
        handleProgressBlockMouseEnter(event); // Mostrar tooltip do bloco
  });
  skillsSection.addEventListener('mouseout', (event) => {
      if (event.target.classList.contains('progress-block')) 
        handleProgressBlockMouseLeave(event); // Esconder tooltip do bloco
  });

  // --- 5. CONFIGURAÇÃO DOS LISTENERS DO MODAL ---
  // Listener para o botão "Cancelar" no modal de seleção de comida
  ui.modal.cancelBtn.addEventListener('click', hideFoodSelectionModal);
  
  // Listener para clicar fora do conteúdo do modal para fechá-lo
  ui.modal.overlay.addEventListener('click', (event) => {
      if (event.target === ui.modal.overlay) hideFoodSelectionModal();
  });
  
  // Listener para a seleção de um item de comida no modal
  ui.modal.foodOptions.addEventListener('click', (event) => {
      const itemElement = event.target.closest('.modal-food-item');
      if (!itemElement) return; // Se não clicou num item, ignora
      
      // Remove a seleção de qualquer item anteriormente selecionado
      const currentSelected = ui.modal.foodOptions.querySelector('.selected');
      if (currentSelected) currentSelected.classList.remove('selected');
      
      // Marca o item clicado como selecionado
      itemElement.classList.add('selected');
      
      // Ativa o botão "Simular" do modal
      ui.modal.startBtn.disabled = false;
  });
  
  // Listener para o botão "Simular" no modal, que inicia a simulação com a comida selecionada
  ui.modal.startBtn.addEventListener('click', startFullCombatWithFood);
  
  // --- 6. RENDERIZAÇÃO INICIAL ---
  // Renderiza toda a interface do utilizador com o estado inicial
  renderAllUI();
}

// Associa a função de inicialização ao evento DOMContentLoaded
// Isto garante que o código só corre quando toda a estrutura HTML está pronta
document.addEventListener('DOMContentLoaded', initialize);