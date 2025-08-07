//src/calculator.js
import { skillsData, playerState, MIN_SKILL_LEVEL, MAX_SKILL_LEVEL } from './state.js';

export function getSkillData(skillCode, level) {
  if (!skillsData || !skillsData.skills || !skillsData.skills[skillCode]) {
    return null;
  }
  const validLevel = Math.max(MIN_SKILL_LEVEL, Math.min(MAX_SKILL_LEVEL, level));
  return skillsData.skills[skillCode][validLevel.toString()];
}

export function calculateCumulativeSkillCost(skillCode, level) {
    if (!skillsData || !skillsData.skills || !skillsData.skills[skillCode] || level <= MIN_SKILL_LEVEL) {
        return 0;
    }
    let totalCost = 0;
    for (let i = 1; i <= level; i++) {
        const levelData = getSkillData(skillCode, i);
        if (levelData && levelData.cost) {
            totalCost += levelData.cost;
        }
    }
    return totalCost;
}

export function calculateStatDetails(skillCode) {
    const currentSkillLevel = playerState.assignedSkillLevels[skillCode];
    const skillBaseInfo = getSkillData(skillCode, currentSkillLevel);
    const skillValue = skillBaseInfo ? skillBaseInfo.value : 0;
    const { equippedItems, activeBuffs } = playerState;
    let equipmentValue = 0;
    let equipmentItems = [];
    let ammoPercent = 0;
    let buffPercent = 0;
    let total = skillValue;

    switch (skillCode) {
        case 'attack':
            equipmentValue = equippedItems.weapon?.stats?.attack || 0;
            if (equippedItems.weapon) equipmentItems.push(equippedItems.weapon);
            ammoPercent = activeBuffs.ammo?.stats?.percentAttack || 0;
            buffPercent = activeBuffs.consumable?.stats?.percentAttack || 0;
            total = (skillValue + equipmentValue) * (1 + (ammoPercent / 100) + (buffPercent / 100));
            break;
        case 'precision':
            equipmentValue = equippedItems.gloves?.stats?.precision || 0;
            if (equippedItems.gloves) equipmentItems.push(equippedItems.gloves);
            total = skillValue + equipmentValue;
            break;
        case 'criticalChance':
            equipmentValue = (equippedItems.weapon?.stats?.criticalChance || 0);
            if (equippedItems.weapon) equipmentItems.push(equippedItems.weapon);
            total = skillValue + equipmentValue;
            break;
        case 'criticalDamages':
            equipmentValue = equippedItems.helmet?.stats?.criticalDamages || 0;
            if (equippedItems.helmet) equipmentItems.push(equippedItems.helmet);
            total = skillValue + equipmentValue;
            break;
        case 'armor':
            const chestArmor = equippedItems.chest?.stats?.armor || 0;
            const pantsArmor = equippedItems.pants?.stats?.armor || 0;
            equipmentValue = chestArmor + pantsArmor;
            if (equippedItems.chest) equipmentItems.push(equippedItems.chest);
            if (equippedItems.pants) equipmentItems.push(equippedItems.pants);
            total = skillValue + equipmentValue;
            break;
        case 'dodge':
            equipmentValue = equippedItems.boots?.stats?.dodge || 0;
            if (equippedItems.boots) equipmentItems.push(equippedItems.boots);
            total = skillValue + equipmentValue;
            break;
        case 'lootChance':
            total = skillValue;
            break;
    }

    return {
        skillValue,
        equipmentValue,
        equipmentItems,
        ammoPercent,
        buffPercent,
        total: parseFloat(total.toFixed(1))
    };
}

export function simulateFullCombat() {
    // Esta função é agora um wrapper simples sem comida.
    // A nova lógica estará em simulateFullCombatWithFood
    let totalDamageDealt = 0;
    let ticksSurvived = 0;
    let fullLog = [];
    let tempCurrentHealth = playerState.currentHealth;
    const MAX_TICKS = 1000;

    while (tempCurrentHealth > 0 && ticksSurvived < MAX_TICKS) {
        const tickResult = simulateCombatTick();
        tempCurrentHealth -= tickResult.healthLost;
        if (tempCurrentHealth >= 0 || (tempCurrentHealth < 0 && ticksSurvived === 0)) {
            totalDamageDealt += tickResult.finalDamageDealt;
        }
        ticksSurvived++;
        const healthAfterTick = Math.max(0, tempCurrentHealth).toFixed(1);
        fullLog.push(`--- Golpe ${ticksSurvived} (Vida: ${healthAfterTick}) ---`);
        fullLog.push(...tickResult.log);
    }

    if (ticksSurvived >= MAX_TICKS) {
        fullLog.push("--- SIMULAÇÃO PARADA: Número máximo de golpes atingido. ---");
    }

    return {
        totalDamageDealt: parseFloat(totalDamageDealt.toFixed(1)),
        ticksSurvived,
        log: fullLog,
        finalHealth: Math.max(0, tempCurrentHealth)
    };
}

// NOVA FUNÇÃO PARA A SIMULAÇÃO COM COMIDA
export function simulateFullCombatWithFood(foodItem) {
    let totalDamageDealt = 0;
    let ticksSurvived = 0;
    let fullLog = [];
    let tempCurrentHealth = playerState.currentHealth;
    let tempCurrentHunger = playerState.currentHunger;
    const healthPerFood = foodItem.flatStats.healthRegen || 0;
    const maxHealthFromSkills = getSkillData('health', playerState.assignedSkillLevels.health)?.value || 50;
    const INCOMING_DAMAGE_PER_TICK = 10; // Dano base que se recebe por golpe
    const MAX_TICKS = 2000;

    fullLog.push(`--- Simulação iniciada com ${foodItem.name} (+${healthPerFood} PV por ponto de fome) ---`);

    while (ticksSurvived < MAX_TICKS) {
        // --- COMEÇO DO NOVO FLUXO LÓGICO ---
        // 1. VERIFICAÇÃO DE PÂNICO E CONSUMO DE COMIDA (ANTES DE RECEBER O GOLPE)
        // Se a vida é criticamente baixa E o personagem pode comer, entra num ciclo de consumo.
        if (tempCurrentHealth <= INCOMING_DAMAGE_PER_TICK && tempCurrentHunger > 0 && healthPerFood > 0) {
            fullLog.push(`<strong>VIDA CRÍTICA!</strong> PV a ${tempCurrentHealth.toFixed(1)}. A tentar comer.`);
            // Ciclo de consumo: comer até estar seguro ou não poder mais.
            while (tempCurrentHunger > 0 && tempCurrentHealth <= INCOMING_DAMAGE_PER_TICK) {
                // Segurança para a regra de sobrecura: não comer se a vida já é >= maxHealth
                if (tempCurrentHealth >= maxHealthFromSkills) {
                    fullLog.push(`Parou de comer: a vida está cheia ou sobrecarregada (${tempCurrentHealth.toFixed(1)} / ${maxHealthFromSkills}).`);
                    break;
                }
                tempCurrentHunger--;
                const healthBeforeHeal = tempCurrentHealth;
                tempCurrentHealth += healthPerFood;
                fullLog.push(`<strong>COMEU ${foodItem.name.toUpperCase()}!</strong> Curado em ${healthPerFood}. PV: ${healthBeforeHeal.toFixed(1)} -> ${tempCurrentHealth.toFixed(1)}. Fome restante: ${tempCurrentHunger}.`);
            }
        }

        // 2. VERIFICAÇÃO DE FIM DE COMBATE
        // Se depois de tentar comer, a vida continuar insuficiente para sobreviver ao próximo golpe, o combate termina.
        if (tempCurrentHealth <= 0) {
            fullLog.push(`--- COMBATE TERMINADO: Jogador derrotado. Vida insuficiente para continuar. ---`);
            break;
        }

        // 3. EXECUÇÃO DO TICK DE COMBATE (Causar e receber dano)
        const tickResult = simulateCombatTick(); // Esta função já calcula o dano recebido e causado.
        // Aplicar o dano recebido neste tick
        const healthLostThisTick = tickResult.healthLost;
        tempCurrentHealth -= healthLostThisTick;
        // Somar o dano infligido neste tick
        totalDamageDealt += tickResult.finalDamageDealt;
        ticksSurvived++;

        // 4. REGISTO NO LOG
        const healthAfterDamage = tempCurrentHealth;
        let logEntry = `--- Golpe ${ticksSurvived} | PV restantes: ${Math.max(0, healthAfterDamage).toFixed(1)} | Fome: ${tempCurrentHunger} ---`;
        fullLog.push(logEntry);
        fullLog.push(...tickResult.log); // Adicionar os detalhes do golpe (falha, crítico, etc.)

        // Se a vida chegar a 0 depois deste golpe, o próximo ciclo o detectará e terminará o combate.
    }

    if (ticksSurvived >= MAX_TICKS) {
        fullLog.push("--- SIMULAÇÃO PARADA: Número máximo de golpes atingido. ---");
    }

    return {
        totalDamageDealt: parseFloat(totalDamageDealt.toFixed(1)),
        ticksSurvived,
        log: fullLog,
        finalHealth: Math.max(0, tempCurrentHealth),
        // CORREÇÃO: Adicionar a fome restante ao objeto de retorno.
        finalHunger: tempCurrentHunger
    };
}

// CORREÇÃO: Removida duplicata. Esta é a definição única e correta.
export function simulateCombatTick() {
  const attackStats = calculateStatDetails('attack');
  const precisionStats = calculateStatDetails('precision');
  const critChanceStats = calculateStatDetails('criticalChance');
  const critDamageStats = calculateStatDetails('criticalDamages');
  const armorStats = calculateStatDetails('armor');
  const dodgeStats = calculateStatDetails('dodge');

  let log = [];
  let finalDamageDealt = 0;
  let healthLost = 10;

  const wasDodge = Math.random() * 100 < dodgeStats.total;
  if (wasDodge) {
      healthLost = 0;
      log.push('<strong>ESQUIVA!</strong> Não se perdeu vida.');
  } else {
      const damageReduction = healthLost * (armorStats.total / 100);
      healthLost -= damageReduction;
      log.push(`<strong>ARMADURA</strong> reduziu a perda de vida em ${damageReduction.toFixed(1)}.`);
  }

  let baseDamage = attackStats.total;
  log.push(`Potencial de dano base é ${baseDamage.toFixed(1)}.`);

  const wasHit = Math.random() * 100 < precisionStats.total;
  if (!wasHit) {
      baseDamage /= 2;
      log.push('<strong>FALHOU!</strong> O dano foi reduzido a metade.');
  } else {
      log.push('<strong>ACERTOU!</strong> Potencial de dano total.');
  }

  const wasCritical = Math.random() * 100 < critChanceStats.total;
  if (wasCritical) {
      const critMultiplier = 1 + (critDamageStats.total / 100);
      const criticalDamageBonus = baseDamage * (critDamageStats.total / 100);
      finalDamageDealt = baseDamage * critMultiplier;
      log.push(`<strong>GOLPE CRÍTICO!</strong> Dano multiplicado por ${critMultiplier.toFixed(2)} (+${criticalDamageBonus.toFixed(1)}).`);
  } else {
      finalDamageDealt = baseDamage;
      log.push('Golpe normal.');
  }

  return {
      finalDamageDealt: parseFloat(finalDamageDealt.toFixed(1)),
      healthLost: parseFloat(healthLost.toFixed(1)),
      log,
      wasCritical,
      wasHit,
      wasDodge,
  };
}
