//src/state.js

/**
 * Número de pontos de habilidade ganhos por nível de jogador.
 */
export const SKILL_POINTS_PER_LEVEL = 4;

/**
 * Nível máximo que o jogador pode alcançar.
 */
export const MAX_PLAYER_LEVEL = 50;

/**
 * Nível mínimo do jogador (nível inicial).
 */
export const MIN_PLAYER_LEVEL = 1;

/**
 * Nível máximo para cada habilidade individual.
 */
export const MAX_SKILL_LEVEL = 10;

/**
 * Nível mínimo para cada habilidade (nível inicial).
 */
export const MIN_SKILL_LEVEL = 0;

/**
 * Estado inicial do jogador.
 * Este objeto serve como um modelo para reiniciar o jogo.
 * @type {Object}
 */
const INITIAL_PLAYER_STATE = {
  /**
   * Nível atual do jogador.
   * @type {number}
   */
  playerLevel: 1,

  /**
   * Pontos de habilidade disponíveis para gastar.
   * @type {number}
   */
  skillPointsAvailable: 0,

  /**
   * Total de pontos de habilidade gastos.
   * @type {number}
   */
  skillPointsSpent: 0,

  /**
   * Vida atual do jogador.
   * @type {number}
   */
  currentHealth: 50,

  /**
   * Fome atual do jogador.
   * @type {number}
   */
  currentHunger: 10,

  /**
   * Níveis atribuídos a cada habilidade do jogador.
   * @type {Object.<string, number>}
   */
  assignedSkillLevels: {
    attack: 0, precision: 0, criticalChance: 0, criticalDamages: 0, armor: 0,
    dodge: 0, health: 0, lootChance: 0, hunger: 0,
  },

  /**
   * Itens atualmente equipados pelo jogador, organizados por slot.
   * @type {Object.<string, Object|null>}
   */
  equippedItems: {
    weapon: null, ammo: null, helmet: null, chest: null,
    pants: null, boots: null, gloves: null,
  },

  /**
   * Buffs ativos no jogador (ex: munição especial, consumíveis).
   * @type {Object.<string, Object|null>}
   */
  activeBuffs: {
    ammo: null, consumable: null
  },

  /**
   * Item selecionado pelo utilizador para configuração (no painel de inventário).
   * @type {Object|null}
   */
  selectedItemForConfig: null,

  /**
   * Resumo da última simulação de combate realizada.
   * @type {string}
   */
  lastSimulationSummary: 'Nenhuma simulação foi executada ainda.',
};

/**
 * Estado atual do jogador em jogo.
 * Este é o objeto que é modificado durante a sessão do jogo.
 * É inicializado como uma cópia profunda do estado inicial.
 * @type {Object}
 */
export let playerState = JSON.parse(JSON.stringify(INITIAL_PLAYER_STATE));

/**
 * Dados carregados do ficheiro JSON que contém as definições das habilidades e itens.
 * É preenchido pela função `setSkillsData`.
 * @type {Object|null}
 */
export let skillsData = null;

/**
 * Função para definir os dados das habilidades carregados do JSON.
 * @param {Object} data - Os dados das habilidades carregados.
 */
export function setSkillsData(data) {
  skillsData = data;
}

/**
 * Reinicia o estado do jogador para o seu estado inicial.
 * Cria uma nova cópia do estado inicial e substitui as propriedades
 * do `playerState` existente, preservando a referência ao objeto original.
 * Isto é importante para que outros módulos que importaram `playerState`
 * vejam as mudanças.
 */
export function resetPlayerState() {
  // Cria uma cópia profunda do estado inicial
  const initialCopy = JSON.parse(JSON.stringify(INITIAL_PLAYER_STATE));
  
  // Itera sobre as propriedades do estado atual
  for (const key in playerState) {
    // Se a propriedade também existir no estado inicial, substitui o valor
    if (initialCopy.hasOwnProperty(key)) {
      playerState[key] = initialCopy[key];
    } else {
      // Se a propriedade não existir no estado inicial, remove-a
      // (limpeza de propriedades que possam ter sido adicionadas dinamicamente)
      delete playerState[key];
    }
  }
}