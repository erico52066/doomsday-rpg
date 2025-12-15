import * as Constant from './GameData.js';
import { reactiveGameState, log, gameOver } from './GameMain.js';
import { getCurrentTier, getEquipVal, generateBossLoot, createItem } from './ItemSystem.js';
import { renderCombat, triggerShake, showBossLootWindow, updateUI, showLootModal } from './UIManager.js';
import { getStat, calcDerivedStats, getSanityState, gainXp } from './Character.js';
import { completeQuest } from './StorySystem.js';
import { continueExploration } from './CampSystem.js';


// combat
// ==================== 戰鬥與物品 ====================
export function triggerBossFight(name, isQuest=false, strategy='normal', outcome='success') { 
    
    let typeKey = (name === "最終屍王") ? 'final_boss' : 'boss';
    let stats = getDynamicEnemyStats(typeKey);

    let hp = stats.hp;
    let atk = stats.atk;
    let bossDodge = (getCurrentTier() - 1) * 10 + 5; 

    // 1. 計算 Boss 開場威壓 (SAN值扣除)
    let terror = 10; 
    if (name === "最終屍王") terror = 20; 
    if (reactiveGameState.diff === 3) terror = Math.floor(terror * 1.5); 

    let willMitigation = Math.floor(getStat('w') * 0.5);
    terror = Math.max(1, terror - willMitigation);

    // 2. 應用戰術對 SAN 值的影響
    let logExtra = "";
    if (strategy === 'faith' && (outcome === 'success' || outcome === 'crit_success')) {
        terror = 0; // 堅定信念成功：免疫恐懼
        logExtra = "(信念免疫)";
    } else if (outcome === 'fail' || outcome === 'crit_fail') {
        terror += 5; // 戰術失敗：受到驚嚇
        logExtra = "(戰術失敗驚嚇 +5)";
    }

    if (terror > 0) {
        reactiveGameState.san -= terror;
        log('遭遇', `強敵的壓迫感讓你呼吸困難！ <span style="color:var(--san-color)">SAN -${terror}</span> ${logExtra}`, 'c-loss');
    } else {
        log('遭遇', `你堅定的意志抵擋了強敵的威壓！`, 'c-gain');
    }

    // 3. 初始化戰鬥數據
    let tier = getCurrentTier();
    let bossDef = (tier * 10) + (reactiveGameState.diff === 3 ? 10 : 0);
    if (name === "最終屍王") { bossDodge = 50; hp = Math.floor(hp * 1.2); atk = Math.floor(atk * 1.1); bossDef = 50; }

    reactiveGameState.activeSkillCD = 0; 
    reactiveGameState.playerDefCD = 0;

    reactiveGameState.combat = { 
        n:name, baseName: name, maxHp:hp, hp:hp, atk:atk, def: bossDef, defP: 0.15,
        sk:'終極毀滅', isBoss:true, isQuest:isQuest, turnCount:0, 
        buffs:{}, enemySkillCD:0, cloneTurns:0, xpVal: 50 + Math.floor(reactiveGameState.day/2), 
        isStunned: false, playerShield: 0, usedItem: false, dodge: bossDodge,
        playerDebuffs: { stun:0, silence:0, blind:0 }
    };
    
    // 4. ★★★ 應用 6 種戰術效果 ★★★
    let isSuccess = (outcome === 'success' || outcome === 'crit_success');
    
    if (isSuccess) {
        log('戰術', `【${strategy}】執行成功！`, 'c-gain');
        switch(strategy) {
            case 'smash': // 蠻力衝撞：扣 1-10% 血
                let pct = 0.01 + Math.random() * 0.09; // 0.01 ~ 0.10
                let smashDmg = Math.floor(hp * pct);
                reactiveGameState.combat.hp -= smashDmg;
                log('戰術', `蠻力衝擊！Boss 損失了 ${smashDmg} (${Math.floor(pct*100)}%) 生命！`, 'c-gain');
                break;
            case 'rush': // 急速突襲：先手 + 閃避
                // 邏輯上如果沒有被暈眩，玩家通常是先手，但這裡給予額外閃避確保優勢
                reactiveGameState.combat.buffs.dodgeUp = 3; 
                log('戰術', `身法靈活！獲得 3 回合閃避提升。`, 'c-gain');
                break;
            case 'analyze': // 尋找破綻：降防
                reactiveGameState.combat.buffs.defDown = 4;
                log('戰術', `弱點識破！Boss 防禦大幅下降 (4回合)。`, 'c-gain');
                break;
            case 'trap': // 佈置陷阱：暈眩
                reactiveGameState.combat.isStunned = true;
                reactiveGameState.combat.buffs.stun = 1;
                log('戰術', `陷阱觸發！Boss 開場暈眩 1 回合。`, 'c-gain');
                break;
            case 'faith': // 堅定信念：護盾 (SAN免疫已在上面處理)
                let shieldAmt = Math.floor(reactiveGameState.maxHp * 0.3);
                reactiveGameState.combat.playerShield = shieldAmt;
                log('戰術', `信念如鐵！獲得 ${shieldAmt} 點護盾。`, 'c-gain');
                break;
            case 'gamble': // 孤注一擲：隨機負面
                let debuffs = ['bleed', 'burn', 'blind', 'accDown'];
                let chosen = debuffs[Math.floor(Math.random() * debuffs.length)];
                reactiveGameState.combat.buffs[chosen] = 3;
                log('戰術', `賭對了！Boss 陷入 ${chosen} 狀態 (3回合)。`, 'c-gain');
                break;
        }
    } else {
        log('戰術', `【${strategy}】執行失敗！`, 'c-loss');
        // 失敗懲罰
        switch(strategy) {
            case 'smash': // 反震
                let recoil = Math.floor(reactiveGameState.maxHp * 0.1);
                reactiveGameState.hp -= recoil;
                reactiveGameState.combat.buffs.defUp = 3;
                log('戰術', `衝撞失敗受到反傷 (-${recoil})，Boss 進入防禦姿態。`, 'c-loss');
                break;
            case 'rush': // 失足
                reactiveGameState.combat.playerDebuffs.stun = 1;
                log('戰術', `突襲失敗摔倒了！開場暈眩 1 回合。`, 'c-loss');
                break;
            case 'analyze': // 誤判
                reactiveGameState.combat.buffs.atkUp = 3;
                log('戰術', `分析錯誤！激怒了 Boss (攻擊提升)。`, 'c-loss');
                break;
            case 'trap': // 故障
                reactiveGameState.activeSkillCD = 2; // 全技能 CD +2
                log('戰術', `陷阱卡住了！你手忙腳亂 (技能冷卻增加)。`, 'c-loss');
                break;
            case 'faith': // 崩潰
                // SAN 值加倍扣除已在上面處理
                log('戰術', `恐懼吞噬了你的內心。`, 'c-loss');
                break;
            case 'gamble': // 厄運
                reactiveGameState.combat.playerDebuffs.bleed = 3;
                log('戰術', `賭輸了！你自己陷入流血狀態。`, 'c-loss');
                break;
        }
    }

    // 裝備特效 (保留不變)
    if (reactiveGameState.eq.head && reactiveGameState.eq.head.fx && reactiveGameState.eq.head.fx.t === 'fear_aura' && Math.random() < 0.5) {
        reactiveGameState.combat.buffs.atkDown = (reactiveGameState.combat.buffs.atkDown || 0) + 3;
        log('裝備', `🤡 小丑面具發動：${reactiveGameState.combat.n} 感到恐懼`);
    }
    if (reactiveGameState.eq.acc && reactiveGameState.eq.acc.fx && reactiveGameState.eq.acc.fx.t === 'hypnosis') {
        reactiveGameState.combat.buffs.sleep = 3;
        log('裝備', `📻 洗腦廣播發動：${reactiveGameState.combat.n} 陷入深層睡眠`);
    }
    
    let eArea = document.getElementById('enemy-area');
    if (eArea) eArea.style.display = 'block';
    
    renderCombat();
}

// combat
// ==================== 替換原有的 triggerCombat ====================    
export function triggerCombat(enemyTemplate, danger) { 
    let locationName = window.currentLocName || "民居";
    let tier = getCurrentTier();
    let enemy = null;
    let isElite = false;
    let isBoss = false;

    // 1. 決定敵人模板
    if (enemyTemplate) {
        enemy = enemyTemplate;
    } else {
        let safeDanger = danger || 1;
        let bossChance = 0.02 * safeDanger; 
        let eliteChance = 0.1 * safeDanger; 
        let spawnTier = tier;
        if(safeDanger >= 4 && Math.random() < 0.3) spawnTier = Math.min(5, tier + 1);

        if (Math.random() < bossChance && Constant.LOCATION_BOSSES && Constant.LOCATION_BOSSES[locationName]) {
            let bosses = Constant.LOCATION_BOSSES[locationName];
            if (bosses) {
                enemy = bosses.find(b => b.t === spawnTier) || bosses[0];
                if (enemy) isBoss = true;
            }
        } 
        
        if (!enemy && Math.random() < eliteChance) {
            let pool = Constant.ELITE_ENEMIES[spawnTier];
            if (!pool || pool.length === 0) pool = Constant.ELITE_ENEMIES[1];
            if (pool && pool.length > 0) {
                enemy = pool[Math.floor(Math.random() * pool.length)];
                isElite = true;
            }
        } 
        
        if (!enemy) {
            let pool = Constant.NORMAL_ENEMIES[spawnTier];
            if (!pool || pool.length === 0) pool = Constant.NORMAL_ENEMIES[1];
            if (!pool || pool.length === 0) enemy = { n: "迷路的喪屍", hp: 30, atk: 5 };
            else enemy = pool[Math.floor(Math.random() * pool.length)];
        }
    }
    
    enemy = JSON.parse(JSON.stringify(enemy));
    let originalName = enemy.n; 

    // 2. 應用動態數值平衡
    let typeKey = isBoss ? 'boss' : (isElite ? 'elite' : 'normal');
    let stats = getDynamicEnemyStats(typeKey);
    
    // 危險度修正
    let dangerMult = 1 + ((danger || 1) - 1) * 0.05;
    
    let hp = Math.floor(stats.hp * dangerMult);
    let atk = Math.floor(stats.atk * dangerMult);

    // 3. 詞綴生成
    let prefixData = null;
    let prefixChance = 0.1 + (reactiveGameState.day / 120); 
    if (isElite || isBoss) prefixChance += 0.3;
    if (reactiveGameState.diff === 3) prefixChance += 0.2; 
    
    if (Math.random() < prefixChance) {
        let pTier = tier;
        if (Math.random() < 0.2) pTier = Math.min(5, pTier + 1);
        if (reactiveGameState.day <= 10) pTier = 1; 

        let pool = Constant.ENEMY_PREFIXES[pTier] || Constant.ENEMY_PREFIXES[1];
        if (pool) {
            prefixData = pool[Math.floor(Math.random() * pool.length)];
            enemy.n = `${prefixData.n}${enemy.n}`;
            hp = Math.floor(hp * (prefixData.hp || 1));
            atk = Math.floor(atk * (prefixData.atk || 1));
            
            if(prefixData.dodge) enemy.dodge = (enemy.dodge || 0) + prefixData.dodge;
            if(prefixData.defP) enemy.defP = (enemy.defP || 0) + prefixData.defP;
            if(prefixData.crit) enemy.crit = (enemy.crit || 0) + prefixData.crit;
            if(prefixData.acc) enemy.acc = (enemy.acc || 0) + prefixData.acc;
        }
    }

    // 4. 基礎閃避與經驗
    let baseDodge = (tier - 1) * 5;
    if (isBoss) baseDodge += 10; else if (isElite) baseDodge += 5;
    if (enemy.dodge) baseDodge += enemy.dodge;
    let finalDodge = Math.max(0, Math.min(60, baseDodge));

    let xp = Math.max(1, Math.floor((danger || 1) * (isBoss ? 5 : isElite ? 2 : 1)));
    if (prefixData) xp = Math.floor(xp * 1.5);

    // ★★★ 計算固定防禦力 (新平衡) ★★★
    let baseDefVal = (tier - 1) * 5 + (isBoss ? 5 : 0) + (isElite ? 2 : 0);
    let finalDef = baseDefVal + Math.floor(Math.random() * 5);

    reactiveGameState.activeSkillCD = 0;
    reactiveGameState.playerDefCD = 0;

    // 5. 初始化 Combat
    reactiveGameState.combat = { 
        n: enemy.n, 
        baseName: originalName,
        maxHp: hp, 
        hp: hp, 
        atk: atk, 
        
        // ★★★ 修正後的防禦屬性 ★★★
        def: finalDef,          // 固定防禦
        defP: enemy.defP || 0,  // 百分比減傷 (記得這裡要有逗號)
        // ========================

        dodge: finalDodge,
        acc: enemy.acc || 0,   
        crit: enemy.crit || 0, 
        isBoss: isBoss, 
        isElite: isElite,
        sks: enemy.sks || [],
        prefixEff: prefixData ? prefixData.eff : null,
        prefixDesc: prefixData ? prefixData.desc : null,
        turnCount: 0, 
        buffs: {}, 
        playerDebuffs: { stun:0, silence:0, blind:0 }, 
        enemyShield: 0,                                 
        playerShield: 0,
        enemySkillCD: 0, 
        xpVal: xp, 
        isStunned: false, 
        usedItem: false 
    };

     // ★★★ 新增：Boss 裝備開場特效 ★★★
    if (reactiveGameState.eq.head && reactiveGameState.eq.head.fx && reactiveGameState.eq.head.fx.t === 'fear_aura') {
        if (Math.random() < 0.5) {
            reactiveGameState.combat.buffs.atkDown = 3;
            log('裝備', `🤡 小丑面具發動：${reactiveGameState.combat.n} 感到恐懼 (攻擊下降)`);
        }
    }
    if (reactiveGameState.eq.acc && reactiveGameState.eq.acc.fx && reactiveGameState.eq.acc.fx.t === 'hypnosis') {
        reactiveGameState.combat.buffs.sleep = 3;
        log('裝備', `📻 洗腦廣播發動：${reactiveGameState.combat.n} 陷入深層睡眠`);
    }

    if(!reactiveGameState.combat.sk) reactiveGameState.combat.sk = '普通攻擊'; 

    let logStr = `遭遇敵人：${reactiveGameState.combat.n} (HP:${hp}, ATK:${atk})`;
    if (prefixData) logStr += ` <span style="color:#f44">[${prefixData.desc}]</span>`;
    log('遭遇', logStr, 'c-loss');

    let eArea = document.getElementById('enemy-area');
    if (eArea) eArea.style.display = 'block';

    renderCombat();
}

// combat
// 2. 戰鬥描述生成器 (Flavor Text)
export function getCombatFlavor(attacker, target, dmg, isCrit, isKill) {
    // 閃避描述
    if (dmg === 0) {
        const dodgeTexts = [
            `${target} 側身一閃，勉強避開了 ${attacker} 的攻擊！`,
            `${attacker} 的攻擊落空了，只打中了空氣。`,
            `${target} 以驚人的反應速度格擋了這次攻擊。`,
            `太慢了！${target} 輕鬆閃過了這一擊。`
        ];
        return dodgeTexts[Math.floor(Math.random() * dodgeTexts.length)];
    }

    // 擊殺描述
    if (isKill) {
        const killTexts = [
            `${target} 發出一聲慘叫，緩緩倒在血泊中。`,
            `致命一擊！${target} 的頭顱像西瓜一樣爆開了。`,
            `${attacker} 給了 ${target} 最後的慈悲，結束了它的痛苦。`,
            `${target} 被徹底粉碎，再也無法動彈。`
        ];
        return killTexts[Math.floor(Math.random() * killTexts.length)];
    }

    // 暴擊描述
    if (isCrit) {
        const critTexts = [
            `<strong>暴擊！</strong> ${attacker} 精準地命中了 ${target} 的要害！(傷害 ${dmg})`,
            `<strong>毀滅打擊！</strong> ${target} 被巨大的衝擊力轟飛！(傷害 ${dmg})`,
            `鮮血飛濺！這一擊貫穿了 ${target} 的防禦！(傷害 ${dmg})`
        ];
        return critTexts[Math.floor(Math.random() * critTexts.length)];
    }

    // 普通攻擊描述 (根據傷害量)
    if (dmg < 10) return `${attacker} 輕輕擦傷了 ${target}。(-${dmg})`;
    if (dmg < 30) return `${attacker} 擊中了 ${target}，造成了明顯的傷口。(-${dmg})`;
    if (dmg < 60) return `${attacker} 的攻擊重創了 ${target}！(-${dmg})`;
    return `${attacker} 對 ${target} 造成了毀滅性的傷害！(-${dmg})`;
}

// combat
// === 缺少的核心函數：傷害預估 ===
export function getDmgEst(type) {
    let val = 0;
    // 近戰傷害 = 近戰武器數值 + 力量(s)
    if(type === 'melee') {
        val = getEquipVal(reactiveGameState.eq.melee) + getStat('s');
    } 
    // 遠程傷害 = 遠程武器數值 + 敏捷(a)
    else if(type === 'ranged') {
        val = getEquipVal(reactiveGameState.eq.ranged) + getStat('a');
    }
    
    // 確保不小於 1
    return Math.max(1, Math.floor(val));
}

// combat
// ==================== 戰鬥邏輯核心 (完整修復版) ====================
// ==================== 完整修復版 combatRound (包含所有技能) ====================
export function combatRound(act) {
    let c = reactiveGameState.combat;
    let logMsg = [];
    
    // 1. Buff 倒數
    if (c.buffs.dlss > 0) c.buffs.dlss--;
    if (c.buffs.redbull > 0) c.buffs.redbull--;
    if (c.buffs.allUp > 0) c.buffs.allUp--;
    if (c.buffs.matrix > 0) c.buffs.matrix--;
    if (c.buffs.drift > 0) c.buffs.drift--;
    
    // ★★★ 新增：物品臨時屬性倒數 ★★★
    if (c.buffs.itemBuffTimer > 0) {
        c.buffs.itemBuffTimer--;
        if (c.buffs.itemBuffTimer === 0) {
            // 清除臨時屬性 (重置為0)
            c.buffs.tempStats = {}; 
            logMsg.push(`<span style="color:#aaa">藥物效果消退了。</span>`);
        }
    }
    // ================================

    if (c.buffs.rageShieldTimer > 0) {
        c.buffs.rageShieldTimer--;
        if (c.buffs.rageShieldTimer === 0 && c.playerShield > 0) {
            c.playerShield = 0;
            logMsg.push(`<span style="color:#aaa">狂暴的血氣消散了</span>`);
        }
    }

    // 初始化
    if (!c.playerDebuffs) c.playerDebuffs = { stun: 0, silence: 0, blind: 0 };
    if (!c.enemyShield) c.enemyShield = 0;
    if (!c.buffs) c.buffs = {};

    c.turnCount++;
    reactiveGameState.isDefending = (act === 'defend'); // 標記防禦狀態

    // =========== ★★★ 請在這裡插入代碼 ★★★ ===========
    // 新技能系統 CD 遞減
    if (c.skillCDs) {
        for (let k in c.skillCDs) {
            if (c.skillCDs[k] > 0) c.skillCDs[k]--;
        }
    }
    // =================================================
    // ★★★ 新增：SAN值過低導致的幻覺檢查 ★★★
    let sanState = getSanityState();
    if (sanState.state === 'madness' && act !== 'flee' && act !== 'defend') {
        // 只有攻擊/技能會受幻覺影響，逃跑和防禦是本能，不受影響
        if (Math.random() < sanState.buffs.hallucination) {
            logMsg.push(`<span style="color:#d0f; font-weight:bold;">😵 精神崩潰！你因為幻覺對著空氣揮舞了一回合...</span>`);
            // 跳過玩家行動，直接進入敵人回合 (如果有)
            // 這裡我們直接 return false 讓敵人行動，但不執行 doPlayerMove
            
            // 敵人回合
            processEnemyTurn(c, logMsg);
            return; // 結束本回合
        }
    }
    // ==========================================
    if (act !== 'skill' && reactiveGameState.activeSkillCD > 0) reactiveGameState.activeSkillCD--;
    if (act !== 'defend' && reactiveGameState.playerDefCD > 0) reactiveGameState.playerDefCD--;
    if (c.playerDebuffs.silence > 0) c.playerDebuffs.silence--;

    // === 2. 判斷先手權 (Initiative) ===
    let playerSpd = getStat('agi');
    let enemySpd = (c.dodge || 0) + (c.isBoss ? 10 : 0); // Boss 速度較快
    
    // 如果玩家防禦，優先級最高；否則比敏捷
    // 敵人如果被暈/睡，玩家自動先手
    let enemyGoesFirst = false;
    if (act !== 'defend' && !c.isStunned && !c.buffs.sleep && !c.buffs.stun && !c.buffs.root) {
        if (playerSpd < enemySpd) {
            enemyGoesFirst = true;
        }
    }

    // === 定義玩家行動函數 (為了可以調換順序) ===
    const doPlayerMove = () => {
            // ★★★ 1. 新增：處理「跳過回合」按鈕 (必須放在暈眩檢查之前) ★★★
            if (act === 'skip') {
                if (c.playerDebuffs.stun > 0) c.playerDebuffs.stun--;
                logMsg.push(`<span style="color:#aaa">你無法行動，跳過回合...</span>`);
                return false; // 返回 false 代表行動完成，讓程式繼續往下跑(去執行敵人回合)
            }
            
            // ★★★ 2. 修改：暈眩攔截 ★★★
            if (c.playerDebuffs.stun > 0) {
                // 如果玩家試圖點擊其他按鈕(如攻擊)，但被暈眩，阻止操作
                logMsg.push(`<span style="color:#fa0">你被擊暈了！請點擊跳過。</span>`);
                return true; // 返回 true 代表行動失敗，阻止後續流程
            }

        // === 2. 被動效果 ===
        if (reactiveGameState.job.passive === 'pills' && Math.random() < 0.33) {
            if (Math.random() < 0.5) { reactiveGameState.hp = Math.max(1, reactiveGameState.hp - Math.floor(reactiveGameState.maxHp * 0.1)); logMsg.push("<span style='color:#f44'>Red Pill: 扣血</span>"); }
            else { reactiveGameState.hp += Math.floor((reactiveGameState.maxHp - reactiveGameState.hp) * 0.5); logMsg.push("<span style='color:#4f4'>Blue Pill: 回血</span>"); }
        }
        if(reactiveGameState.job.passive === 'dance_style') {
            let styles = ['Slim','Greenteck','Hoan','Hozin','Pete'];
            c.buffs.dance = styles[Math.floor(Math.random()*5)];
            logMsg.push(`切換舞風: ${c.buffs.dance}`);
        }
        // 被動：道士
        if(reactiveGameState.job.passive === 'taoist_buff') {
            if(Math.random()<0.5) {
                let h = Math.floor((reactiveGameState.maxHp - reactiveGameState.hp)*0.05); reactiveGameState.hp+=h; logMsg.push("南部毛家: 回血");
            } else {
                c.buffs.taoistAtk = (c.buffs.taoistAtk || 0) + 0.02; logMsg.push("北部馬家: 攻+2%");
            }
        }
        // 被動：米芝蓮回血
        if(reactiveGameState.job.passive === 'chef_regen') {
            let pct = 0.005 + Math.random()*0.045;
            let h = Math.floor(reactiveGameState.maxHp * pct); reactiveGameState.hp = Math.min(reactiveGameState.maxHp, reactiveGameState.hp+h);
        }
        if(reactiveGameState.job.passive === 'nurse_buff') {
            let h = Math.floor(reactiveGameState.maxHp * 0.02); reactiveGameState.hp = Math.min(reactiveGameState.maxHp, reactiveGameState.hp+h);
        }
        if(reactiveGameState.job.passive === 'random_buff') {
            let stat = ['s','a','i','w','luck'][Math.floor(Math.random()*5)];
            reactiveGameState.stats[stat] = Math.floor((reactiveGameState.stats[stat]||0) * 1.1);
            logMsg.push(`諾貝爾獎: ${Constant.STAT_MAP[stat]}提升`);
        }

        let derived = calcDerivedStats(); // 重新獲取 (包含 SAN 加成)
        // === 3. 玩家行動結算 ===
        let dmg = 0;

        if (act === 'melee' || act === 'ranged') {
            if (act === 'ranged') reactiveGameState.ammo--;

            // 機械師召喚
            let engSummon = '';
            if(reactiveGameState.job.passive === 'eng_summon' && Math.random() < 0.1) {
                let r = Math.random();
                if(r < 0.33) engSummon = 'dog';
                else if(r < 0.66) engSummon = 'doraemon';
                else engSummon = 'terminator';
            }
            // 玻璃大炮
            if(reactiveGameState.job.passive === 'weapon_break' && Math.random() < 0.015) {
                logMsg.push("糟糕！武器承受不住你的中二之力而損壞了！"); 
            }
            
            // --- ★★★ Lil Kid 連擊邏輯 ★★★ ---
            let baseDmg = getDmgEst(act);

        // ★★★ 新增：瘋狂狀態攻擊力加成 ★★★
            if (derived.sanAtkBonus > 0) {
                let bonus = Math.floor(baseDmg * derived.sanAtkBonus);
                baseDmg += bonus;
                // 這裡不 push log，以免訊息太多，數值會直接反映在傷害上
            }
            // ==============================

            let hits = 1; 
            
            if (c.buffs.kidClones > 0) {
                for(let k=0; k<4; k++) {
                    if(Math.random() < 0.3) hits++;
                }
                c.buffs.kidClones--; 
            }
            
            dmg = baseDmg * hits;
            // ---------------------------------

            // 量子計算晶片 (auto_aim)：必定命中且暴擊
            let autoAim = (reactiveGameState.eq.acc && reactiveGameState.eq.acc.fx && reactiveGameState.eq.acc.fx.t === 'auto_aim');
            // 暴擊判定
            derived = calcDerivedStats();
            let isCrit = false;
            // 修改暴擊判定
            if (autoAim || (Math.random() * 100 < derived.crit) || (c.buffs.sleep > 0)) {
                dmg = Math.floor(dmg * (derived.critDmg / 100));
                isCrit = true;
                logMsg.push("🔥 暴擊！");
            }
            reactiveGameState.lastCrit = isCrit;

            // 技能/被動加成
            if (c.buffs.hedgeTurns > 0) { dmg += c.buffs.hedgeAtk; logMsg.push(`(對沖基金 +${c.buffs.hedgeAtk})`); c.buffs.hedgeTurns--; }
            if (c.buffs.chuunibyou > 0) { dmg += c.buffs.chuuniVal; c.buffs.chuunibyou--; logMsg.push("中二修正拳！"); }
            if (c.buffs.redbull > 0) { dmg = Math.floor(dmg * 1.3); c.buffs.redbull--; logMsg.push("Red Bull翼擊！"); }
            if (c.buffs.drift) { dmg = Math.floor(dmg * 1.2); c.buffs.drift--; }
            
            // 舞者加成
            if(c.buffs.dance === 'Greenteck') dmg = Math.floor(dmg * 1.2);
            if(c.buffs.dance === 'Pete') dmg = Math.floor(dmg * 1.1);
            if(c.buffs.dance === 'Hoan') dmg = Math.floor(dmg * 1.5);
            
            if (reactiveGameState.job.passive === 'truck_hit' && Math.random() < 0.05) { dmg = Math.floor(dmg * 1.5); logMsg.push("CyberTruck撞擊！"); }
            if (reactiveGameState.job.passive === 'dev_buff' && Math.random() < 0.15) { dmg += (getStat('s')*0.5); logMsg.push("工人助陣！"); }
            
            // 連擊 (Wing Chun)
            let multiHit = (reactiveGameState.job.passive === 'wing_chun' && Math.random() < 0.1) ? 2 : 1;
            dmg *= multiHit; 
            if(multiHit>1) logMsg.push(`${multiHit}連擊！`);
            
            // 華爾街吸血
            if(reactiveGameState.job.passive === 'olive_eat') {
                if(Math.random() < 0.5) { 
                    let heal = Math.floor((reactiveGameState.maxHp - reactiveGameState.hp) * 0.1); 
                    reactiveGameState.hp += heal; 
                    logMsg.push(`量化寬鬆!恢復 +${heal}血`); 
                } else { 
                    let suck = Math.floor(dmg * 0.3); 
                    reactiveGameState.hp = Math.min(reactiveGameState.maxHp, reactiveGameState.hp + suck); 
                    logMsg.push(`高額手續費! 抽取+${suck}血`); 
                }
            }
            
            // 機械師效果
            if(engSummon === 'dog') { c.buffs.bleed = 99; logMsg.push("機械狗咬傷流血！"); } 
            else if(engSummon === 'doraemon') {
                let tool = Math.random();
                if(tool<0.33) { c.buffs.shrink = 1; logMsg.push("縮小電筒！"); }
                else if(tool<0.66) { c.buffs.doraemon = 'copter'; logMsg.push("竹蜻蜓！"); }
                else { reactiveGameState.hp = Math.min(reactiveGameState.maxHp, reactiveGameState.hp + Math.floor(reactiveGameState.maxHp*0.2)); logMsg.push("吃豆沙包！"); }
            }

            // 命中判定
            let enemyDodge = c.dodge || 0;
            if (c.buffs.dodgeUp) enemyDodge += 30;
            if (c.buffs.sleep || c.isStunned || c.buffs.root) enemyDodge = 0;

            let myAcc = getStat('agi') * 0.5;
            // ★★★ 新增：冷靜狀態命中加成 / 瘋狂狀態命中懲罰 ★★★
            if (derived.sanAccBonus) {
                myAcc += derived.sanAccBonus;
            }
            // ==============================
            let finalDodge = Math.max(0, enemyDodge - myAcc);
            let ignoreDodge = autoAim || (c.buffs.ignoreDef > 0) || (c.buffs.matrix > 0);

            if (!ignoreDodge && Math.random() * 100 < finalDodge) {
                dmg = 0;
                logMsg.push(`<span style="color:#aaa">攻擊被閃避 (${Math.floor(finalDodge)}%)</span>`);
            } else {
                // 命中成功
                if (hits > 1) {
                    logMsg.push(`<strong style="color:#4f4">🥷 忍刀連斬 (x${hits} 連擊)！</strong>`);
                }
                
                // 觸發命中特效
                if (reactiveGameState.job.passive === 'flash_blind' && Math.random() < 0.1) { c.buffs.blind = 1; logMsg.push("致盲！"); }
                if (reactiveGameState.job.passive === 'sleep_hit' && Math.random() < 0.1) { c.buffs.sleep = 1; logMsg.push("催眠！"); }
                if (reactiveGameState.job.passive === 'bleed_hit' && Math.random() < 0.2) { c.buffs.bleed = 2; logMsg.push("流血！"); }
                if(reactiveGameState.job.passive === 'counter_block' && Math.random() < 0.15) { c.buffs.tempBlock = 0.8; logMsg.push("格擋反擊架勢！"); }
                if(reactiveGameState.job.passive === 'burn_proc' && Math.random() < 0.2) { c.buffs.burn = 2; logMsg.push("燃燒！"); }
            }

        } else if (act === 'skill') {
            reactiveGameState.activeSkillCD = SKILLS[reactiveGameState.job.sk].cd;
            let sk = reactiveGameState.job.sk;
            let s = getStat('str'), i = getStat('int'), w = getStat('wil'), luck = getStat('luck');
            let dScale = 1 + (reactiveGameState.diff - 1) * 0.25;
            let sScale = 1 + (reactiveGameState.diff - 1) * 0.4;
            let baseAvg = (getDmgEst('melee') + getDmgEst('ranged')) / 2;
            let derived = calcDerivedStats();

    // 輔助函數：計算屬性變化
            const getStatDiff = (statName) => {
                let oldVal = getStat(statName);
                // 這裡我們無法簡單回滾狀態再計算，所以採用顯示"當前值與Buff說明"的方式
                // 或者直接根據Buff邏輯計算預期增幅
                return oldVal; 
            };

            // --- 完整技能列表 ---
            if (sk === 'kid_squad') {
                c.buffs.kidClones = 5; 
                logMsg.push("🥷 忍法：影分身之術！(接下來 5 回合攻擊機率連擊)");
                dmg = 0;
            } 
            else if(sk === 'chuunibyou') {
                c.buffs.chuunibyou = 3; 
                c.buffs.chuuniVal = Math.floor(baseAvg * Math.random() * dScale); 
                dmg = (baseAvg * dScale) + c.buffs.chuuniVal;
                logMsg.push(`中二病發作！攻擊力波動上升！`);
            } 
            else if (sk === 'snipe') {
                dmg = baseAvg * 2 * dScale;
                if(Math.random()*100 < derived.crit) dmg *= (derived.critDmg/100);
                logMsg.push("🎯 狙擊鎖定！");
            } 
            else if(sk === 'first_aid') {
                let pct = 0.5 * sScale; 
                let h = Math.floor((reactiveGameState.maxHp - reactiveGameState.hp) * pct); 
                reactiveGameState.hp += h;
                logMsg.push(`急救處理：恢復了 ${h} 點生命`);
            } 
            else if(sk === 'fate_throw') {
                let mult = 0.5 + Math.random() * 3.5; 
                dmg = baseAvg * mult * dScale; 
                if(Math.random()*100 < derived.crit) dmg *= (derived.critDmg/100);
                logMsg.push("命運一擲！");
            } 
            else if(sk === 'weakness_scan') {
                c.buffs.defDown = 3;
                logMsg.push("弱點分析：敵人防禦力大幅下降 (3回合)");
            } 
            else if(sk === 'risk_manage') {
                c.playerShield = Math.floor(reactiveGameState.maxHp * sScale);
                logMsg.push(`風險管理：獲得鉅額護盾 (${c.playerShield})`);
            } 
            else if (sk === 'kungfu_panda') {
                let r = Math.random();
                if(r < 0.01 && !c.isBoss) { dmg = c.hp; logMsg.push("【無錫碎骨指】直接秒殺！"); }
                else if(r < 0.5) { 
                    let h = Math.floor((reactiveGameState.maxHp-reactiveGameState.hp)*0.5 * sScale); 
                    reactiveGameState.hp += h; logMsg.push(`【吞併Diliveroo】恢復了 ${h} 點生命`); 
                }
                else { 
                    c.isStunned = true; c.buffs.stun = 2; 
                    dmg = baseAvg * 1.5 * dScale; 
                    logMsg.push("【衝擊Keeta】造成傷害並暈眩敵人！"); 
                }
            }
            else if(sk === 'flash_bang') {
                c.buffs.blind = 3; c.buffs.atkDown = 3;
                logMsg.push("投擲閃光彈！敵人降攻致盲");
            } 
            else if(sk === 'rage') {
                let hpCost = Math.floor(reactiveGameState.hp * 0.2);
                reactiveGameState.hp = Math.max(1, reactiveGameState.hp - hpCost);
                dmg = s * 8 * dScale; 
                let strBonus = s * (reactiveGameState.diff === 3 ? 12 : 6); 
                let shieldGain = Math.floor((hpCost * (reactiveGameState.diff === 3 ? 3 : 2)) + strBonus);
                c.playerShield = shieldGain;
                c.buffs.rageShieldTimer = 2;
                logMsg.push(`狂暴：犧牲血量，爆發 <strong style="color:#4f4">${shieldGain} 肌肉護盾</strong> (2回合)！`);
            } 
            else if(sk === 'god_hand') {
                c.buffs.godBlock = 1; 
                logMsg.push("神之一手：絕對防禦架勢！(下回合必反擊)");
            } 
            else if(sk === 'tree_strike') {
                dmg = baseAvg * 1.5 * dScale; 
                c.buffs.root = 2; c.isStunned = true;
                logMsg.push("鏟泥種樹：敵人被樹根纏繞定身！");
            } 
            else if(sk === 'risk_hedge') {
                c.buffs.hedge = 1; 
                c.buffs.hedgeAtk = Math.floor(c.atk * dScale); 
                c.buffs.hedgeTurns = 2;
                logMsg.push(`風險對沖: 免疫傷害，轉化敵攻為加成`);
            } 
            else if(sk === 'dictionary') {
                let r = Math.random();
                if(r < 0.25) { dmg = baseAvg * 5 * dScale; logMsg.push("【習相遠】：習帝之擊！"); } 
                else if(r < 0.5) { 
                    c.playerShield = Math.floor(w * 5 * sScale); 
                    logMsg.push(`【性相近】：獲得聖賢護盾 (${c.playerShield})`); 
                } 
                else if(r < 0.75) { c.buffs.atkDown = 3; logMsg.push("【人之初】：嘮叨說教，敵人攻擊力下降"); } 
                else { c.buffs.atkDown=2; c.buffs.defDown=2; logMsg.push("【性本善】：精神污染，敵人攻防同時下降"); }
            } 
            else if(sk === 'dlss') {
                // ★★★ 優化顯示：DLSS ★★★
                c.buffs.dlss = 3;
                let boostA = Math.floor(getStat('a') * 0.5); // DLSS 增加 50%
                logMsg.push(`DLSS 開啟：敏捷大幅提升 <span style="color:#4f4">(+${boostA})</span>！`);
            }    
            else if(sk === 'bullseye') {
                dmg = baseAvg * 1 * dScale; 
                c.buffs.ignoreDef = 1; 
                if(Math.random()*100 < derived.crit) dmg *= (derived.critDmg/100);
                logMsg.push("紅心鎖定：無視防禦的一擊！");
            } 
            else if(sk === 'creatine') {

                    // 肌酸全屬性增加 50%
                    let boostS = Math.floor(getStat('s') * 0.5);
                    let boostA = Math.floor(getStat('a') * 0.5);
                    let boostI = Math.floor(getStat('i') * 0.5);
                    let boostW = Math.floor(getStat('w') * 0.5);
                    logMsg.push(`喝下肌酸：全屬性爆發提升！<br><span style="font-size:0.8em;color:#4f4">(力+${boostS} 敏+${boostA} 智+${boostI} 意+${boostW})</span>`);
                    
                    // 最後才應用 Buff
                    c.buffs.allUp = 2;
            }
            else if(sk === 'hypnosis') {
                c.buffs.sleep = 2;
                logMsg.push("催眠術：敵人陷入睡眠 (下次受傷必定暴擊)");
            } 
            else if(sk === 'shave') {
                c.buffs.atkDown = 3; c.buffs.defDown = 3; c.buffs.accDown = 3;
                logMsg.push("剃光頭：敵人全能力大幅削弱！");
            } 
            else if (sk === 'tesla_coil') {
                dmg = baseAvg * 2 * dScale;
                c.buffs.defDown = (1 + Math.floor(Math.random()*3));
                logMsg.push("⚡ 特斯拉線圈：電擊破甲");
            } 
            else if (sk === 'pi_strike') {
                let baseRnd = (1 + Math.random()*200) * 3.14159;
                dmg = (baseRnd + (i * 10)) * dScale;
                logMsg.push("🔢 圓周率打擊！");
            } 
            else if(sk === 'money_rain') {
                let baseCost = (reactiveGameState.diff === 3) ? 60 : ((reactiveGameState.diff === 2) ? 40 : 20);
                if (reactiveGameState.money >= baseCost) {
                    reactiveGameState.money -= baseCost;
                    let rawDmg = (luck * 15) + (i * 5);
                    dmg = Math.floor(rawDmg * dScale * (reactiveGameState.diff===3 ? 1.5 : 1)); 
                    c.buffs.ignoreDef = 1;
                    logMsg.push(`大撒幣：有錢使得鬼推磨 <span style="color:#ffd700">$${baseCost}</span> ！`);
                } else {
                    dmg = (5 + s) * dScale;
                    logMsg.push("大撒幣：沒錢了... ");
                }
            } 
            else if(sk === 'waterfall') {
                reactiveGameState.hp -= Math.floor(reactiveGameState.hp * 0.1); 
                dmg = (1.1 + Math.random()*3.9) * baseAvg * dScale;
                logMsg.push("Kim Setup：高風險高回報一擊！");
            } 
            else if(sk === 'drift') {
                c.buffs.drift = 5;
                logMsg.push("東京漂移：進入連擊狀態！");
            } 
            else if(sk === 'matrix') {
                // ★★★ 優化顯示：Matrix ★★★
                c.buffs.matrix = 3;
                logMsg.push("Matrix：看穿代碼，閃避極限提升 <span style='color:#4f4'>(+50%)</span>！");
            } 
            else if(sk === 'one_cue') {
                if(c.isBoss) {
                    dmg = Math.floor(c.hp * 0.15); 
                    logMsg.push("庖丁解牛!");
                } else if (Math.random() < 0.15) { 
                    dmg = c.hp; logMsg.push("一Q清檯！"); 
                } else { 
                    dmg = baseAvg * 2 * dScale; logMsg.push("大力出奇跡！"); 
                }
            } 
            else if(sk === 'holy_chant') {
                if(c.isBoss) { dmg = 0; logMsg.push("Boss 免疫此效果..."); }
                else {
                    let cost = 15;
                    if (reactiveGameState.san > cost) {
                        reactiveGameState.san -= cost;
                        let pct = 0.2 + Math.random()*0.4; 
                        dmg = Math.floor(c.hp * pct); 
                        c.playerShield = Math.floor(dmg * 0.5 * sScale);
                        logMsg.push(`聖靈吟唱：消耗 SAN 值，削減敵人血量並獲得護盾`);
                    } else {
                        logMsg.push("聖靈吟唱：信仰不足 (SAN過低)...");
                    }
                }
            } 
            else if(sk === 'talisman') {
                if (c.buffs.zombie) {
                    dmg = baseAvg * 2 * dScale;
                    c.isStunned = true; c.buffs.stun = 1;
                    logMsg.push(`天師鎮屍！重創僵屍並定身！`);
                } else {
                    c.isStunned = true; c.buffs.zombieCountdown = 3; 
                    logMsg.push("急急如律令！貼符定身，<strong style='color:#fa0'>3回合後</strong>轉化敵人");
                }
            } 
            else if(sk === 'welding') {
                c.buffs.accDown = 5; c.buffs.defDown = 5;
                logMsg.push("全身焊接：封死敵人關節，命中防禦下降");
            } 
            else if(sk === 'raptor') {
                if (c.isBoss) {
                    dmg = baseAvg * 2 * dScale;
                    c.buffs.atkDown = 3; 
                    logMsg.push("速龍突襲：火力壓制！(Boss 攻擊下降)");
                } else {
                    dmg = baseAvg * 2 * dScale; 
                    if(Math.random() < 0.05) { dmg = c.hp; logMsg.push("速龍突襲：當場逮捕！"); }
                    else logMsg.push("速龍突襲：強力撕咬！");
                }
            } 
            else if(sk === 'redbull') {
                // ★★★ 優化顯示：RedBull ★★★
                c.buffs.redbull = 3;
                // 30% 提升
                let boostA = Math.floor(getStat('a') * 0.3);
                logMsg.push(`Red Bull：送你一對翼！閃避與攻擊提升 <span style="color:#4f4">(敏+${boostA})</span>`);
            } 
            else if(sk === 'high_pitch') {
                // === 平衡修正：消耗大幅降低至 2 (避免戰鬥後餓死) ===
                if (reactiveGameState.food >= 2) {
                    reactiveGameState.food -= 2;
                    
                    // 1. 傷害：1.5倍 + 無視防禦 (音波穿透)
                    dmg = baseAvg * 1.5 * dScale; 
                    c.buffs.ignoreDef = 1; 

                    // 2. 控制：Debuff 持續 3 回合
                    c.buffs.atkDown = 3; 
                    c.buffs.accDown = 3;

                    // 3. ★★★ 新增：追星族的熱情，恢復少量 SAN 值 ★★★
                    // 這樣阿孫越打越 high，符合人設
                    let sanRec = 3;
                    reactiveGameState.san = Math.min(100, reactiveGameState.san + sanRec);

                    logMsg.push(`飆高音：<span style='color:#d0f'>高頻穿腦！</span>(SAN+${sanRec}) 無視防禦傷害，敵人攻命下降`);
                } else {
                    logMsg.push("肚子太餓，丹田無力，唱不上去了...");
                    dmg = 0; 
                }
            }

        } else if (act === 'defend') {
            reactiveGameState.isDefending = true; reactiveGameState.playerDefCD = 3; logMsg.push("🛡️ 防禦姿態");
        } else if (act === 'flee') {
            if (Math.random() < 0.5) { campPhase(); return true; }
            logMsg.push("🏃 逃跑失敗");
        }

        // 讀取武器特效
            let weapon = (act === 'melee') ? reactiveGameState.eq.melee : reactiveGameState.eq.ranged;
            let fx = weapon.fx;
            
            if (fx && dmg > 0) {
                // 1. 暈眩
                if (fx.t === 'stun_hit' && Math.random() < fx.v) {
                    c.buffs.stun = 1; c.isStunned = true;
                    logMsg.push(`<span style="color:#fa0">⚡ 武器特效：暈眩！</span>`);
                }
                // 2. 流血
                if (fx.t === 'bleed_hit' && Math.random() < fx.v) {
                    c.buffs.bleed = 3;
                    logMsg.push(`<span style="color:#f44">🩸 武器特效：流血！</span>`);
                }
                // 3. 雙重打擊
                if (fx.t === 'double_hit' && Math.random() < fx.v) {
                    hits++; // 增加連擊數
                    logMsg.push(`⚡ 武器特效：連擊！`);
                }
                // 4. 滿血增傷 (First Strike)
                if (fx.t === 'first_strike' && c.hp >= c.maxHp * 0.95) {
                    dmg = Math.floor(dmg * (1 + fx.v));
                    logMsg.push(`⚔️ 滿血增傷！`);
                }
                // 5. 斬殺 (Execute)
                if (fx.t === 'execute' && c.hp < c.maxHp * 0.3) {
                    dmg = Math.floor(dmg * (1 + fx.v));
                    logMsg.push(`💀 斬殺！`);
                }
                // 6. 打錢 (Gold Hit)
                if (fx.t === 'gold_hit') {
                    reactiveGameState.money += Math.floor(fx.v);
                }
                // 7. 特攻 (Slayer) - 簡單版，所有都加傷
                if (fx.t === 'zombie_killer' || fx.t === 'mech_killer') {
                    dmg = Math.floor(dmg * (1 + fx.v)); // 暫時全部生效，之後可判斷 c.n
                }
                // 8. 無視防禦
                if (fx.t === 'ignore_def' && Math.random() < fx.v) {
                    c.buffs.ignoreDef = 1;
                    logMsg.push(`🛡️ 無視防禦！`);
                }
            }
        
            // === 4. 最終傷害扣除 (含平衡修正) ===
            if (dmg > 0) {
                // 讀取固定防禦力
                let eDef = c.def || 0;
                
                // 應用 Debuff
                if (c.buffs.defDown) eDef = Math.floor(eDef * 0.5);
                if (c.buffs.ignoreDef) eDef = 0;

                // 計算減傷後傷害
                let reducedDmg = dmg - eDef;
                
                // ★★★ 核心修正：最小傷害機制 (10% 面板傷害) ★★★
                // 確保即使不破防，也能造成 10% 的傷害，避免絕望感
                let minDmg = Math.floor(dmg * 0.1); 
                let realDmg = Math.max(minDmg, reducedDmg);
                realDmg = Math.max(1, Math.floor(realDmg)); // 保底 1 點
                // ==========================================
                // 詞綴減傷 (百分比)
                if (c.defP > 0 && !c.buffs.ignoreDef) {
                    realDmg = Math.floor(realDmg * (1 - c.defP));
                }

                // 護盾抵扣 (保持不變)
                if (c.enemyShield > 0) {
                    if (c.enemyShield >= realDmg) {
                        c.enemyShield -= realDmg; realDmg = 0; logMsg.push("🛡️ 傷害被護盾抵擋");
                    } else {
                        realDmg -= c.enemyShield; c.enemyShield = 0; logMsg.push("⚡ 擊破護盾！");
                    }
                }

                // 執行扣血
                if (realDmg > 0) {
                    c.hp -= realDmg;
                    logMsg.push(`💥 造成 <strong>${realDmg}</strong> 點傷害`);
                    
                    // ... (反傷與日誌代碼保持不變) ...
                    if (c.prefixEff === 'thorns' || c.prefixEff === 'thorns_light' || c.prefixEff === 'thorns_heavy') {
                        let rate = (c.prefixEff==='thorns_heavy') ? 0.4 : (c.prefixEff==='thorns') ? 0.2 : 0.1;
                        let thornsDmg = Math.floor(realDmg * rate);
                        if (thornsDmg > 0) {
                            reactiveGameState.hp -= thornsDmg;
                            logMsg.push(`<span style="color:#f44">⚡ 受到反傷 -${thornsDmg}</span>`);
                        }
                    }

                    let isCritFlavor = (dmg > getDmgEst(act) * 1.2); 
                    let flavor = getCombatFlavor('你', c.n, act, realDmg, isCritFlavor, false);
                    logMsg.push(`<div class="log-combat-h">${flavor}</div>`);

                    reactiveGameState.lastDmg = realDmg;            
                    triggerShake();
                }
            }

        return false; // not fled
    };

    // === 3. 執行流程控制 ===
    
    if (enemyGoesFirst) {
        // A. 敵人先手
        logMsg.push(`<span style="color:#f44; font-size:0.8em;">⚡ 對方速度更快 (${enemySpd} > ${playerSpd})，搶先行動！</span>`);
        
        processEnemyTurn(c, logMsg); // 敵人行動
        
        // 檢查玩家是否死亡
        if (reactiveGameState.hp <= 0) { checkCombatEnd(c, logMsg); return; }
        
        // 玩家後手
        let fled = doPlayerMove();
        if (fled) return;
        
    } else {
        // B. 玩家先手
        let fled = doPlayerMove();
        if (fled) return;
        
        // 檢查敵人是否死亡
        if (c.hp <= 0) { checkCombatEnd(c, logMsg); return; }
        
        processEnemyTurn(c, logMsg); // 敵人行動
    }

     // ★★★ 修復 3：確保被擊暈後強制更新畫面 ★★★
    if (c.playerDebuffs && c.playerDebuffs.stun > 0) {
        log('戰鬥', logMsg.join(' ')); // 先輸出戰鬥紀錄
        log('系統', '你被擊暈了！', 'c-loss');
        updateUI();
        renderCombat(); // 強制重繪，顯示「跳過」按鈕
        return; // 暫停，等待玩家點擊跳過
    }
    // ==========================================

    checkCombatEnd(c, logMsg);
}

// combat
// 提取敵人回合邏輯，避免函數過長和嵌套錯誤
export function processEnemyTurn(c, logMsg) {
    
    // ★★★ 裝備免疫判定 ★★★
    // 冠軍腰帶 (grit)：免疫所有負面
    let isImmuneAll = (reactiveGameState.eq.body && reactiveGameState.eq.body.fx && reactiveGameState.eq.body.fx.t === 'grit');
    
    // 暴君頭盔 (stun_res)：免疫暈眩
    let isImmuneStun = isImmuneAll || (reactiveGameState.eq.head && reactiveGameState.eq.head.fx && reactiveGameState.eq.head.fx.t === 'stun_res');
    
    if (isImmuneStun && (c.playerDebuffs.stun > 0)) {
        c.playerDebuffs.stun = 0;
        log('裝備', `🛡️ 裝備免疫了暈眩效果！`);
    }

    // --- 5. 敵人狀態結算 (DoT) ---
    if(c.hp > 0) {

// ★★★ 新增：敵人詞綴被動 (Regen) ★★★
        if (c.prefixEff && (c.prefixEff.includes('regen')) && !c.buffs.burn && !c.buffs.bleed) {
             let rate = (c.prefixEff === 'regen_god') ? 0.2 : (c.prefixEff === 'regen_heavy') ? 0.1 : 0.05;
             let amt = Math.floor(c.maxHp * rate);
             c.hp = Math.min(c.maxHp, c.hp + amt);
             logMsg.push(`<span style="color:#4f4">${c.n} 再生恢復 +${amt}</span>`);
        }

        if(c.buffs.bleed) { let d=Math.floor(c.maxHp*0.05); c.hp-=d; logMsg.push(`流血 -${d}`); c.buffs.bleed--; }
        if(c.buffs.burn) { let d=Math.floor(c.maxHp*0.03); c.hp-=d; logMsg.push(`燃燒 -${d}`); c.buffs.burn--; }
        if(reactiveGameState.job.passive === 'welder_burn') { c.hp -= Math.floor(c.maxHp*0.01); } 
     if(reactiveGameState.job.passive === 'god_dot') { 
            let d = Math.ceil(c.maxHp * 0.01); 
            c.hp -= d; 
            logMsg.push(`神聖灼燒 -${d}`); 
        }
        
        // 殭屍轉化
        if(c.buffs.zombieCountdown > 0) {
            c.buffs.zombieCountdown--;
            if(c.buffs.zombieCountdown === 0) {
                let zMap = [
                    { k: 'Purple', n: '紫殭', desc: '遲緩' }, { k: 'White', n: '白殭', desc: '脆弱' },
                    { k: 'Green', n: '綠殭', desc: '帶毒' }, { k: 'Black', n: '黑殭', desc: '硬化' },
                    { k: 'Hair', n: '毛殭', desc: '兇猛' }
                ];
                let z = zMap[Math.floor(Math.random() * zMap.length)];
                c.buffs.zombie = z.k;
                c.n = `${z.n} (被控制)`;
                logMsg.push(`符咒生效！敵人變成了 <strong style="color:#a5f">${z.n}</strong>`);
                c.buffs.stun = 2; 
            }
        }
    }

    // --- 6. 敵人行動 ---
    if(c.hp > 0) {
        let cantMove = c.isStunned || (c.buffs.sleep>0) || (c.buffs.root>0) || (c.buffs.stun>0);
        if(c.buffs.sleep) c.buffs.sleep--;
        if(c.buffs.root) c.buffs.root--;
        if(c.buffs.stun) c.buffs.stun--;
        
        if(cantMove) {
            logMsg.push(`${c.n} 無法行動`);
            c.isStunned = false; 
        } else {
            // ★★★ 錯誤修正：這裡開始 else 區塊 ★★★
            let eDmg = c.atk;
            let usedSkill = null;
            
            // (原本這裡有一個錯誤的 } 導致 eDmg 變量失效，已移除)

            // 敵人技能釋放
            let skillChance = c.isBoss ? 0.4 : 0.3;
            if (c.sks && c.sks.length > 0 && c.enemySkillCD <= 0 && Math.random() < skillChance) {
                let skill = c.sks[Math.floor(Math.random() * c.sks.length)];
                usedSkill = skill;
                c.enemySkillCD = 4; 
                logMsg.push(`<span style="color:#f44;font-weight:bold">${c.n} 使用了【${skill.n}】！</span>`);

        // === 新增點：意志力(Will) 抵抗判定 ===
                // 公式：抵抗率 = 意志 * 2% (上限 60%)
                // 例如：意志 10 = 20% 抵抗, 意志 30 = 60% 抵抗
                let resistChance = Math.min(60, getStat('w') * 2);
                let isResisted = (Math.random() * 100 < resistChance);
                
                // 只有「異常狀態類」效果可以被抵抗，直接傷害類(aoe/crit)不可抵抗
                // 特殊：san_dmg (精神傷害) 也可以被意志抵抗

                // ★★★ 新增：解析技能效果是否帶有 SAN 傷害 ★★★
                let effectType = skill.eff;
                let hasSanDmg = false;

                // 如果效果名稱包含 "_san" (例如 "crit_san")
                if (effectType.includes("_san")) {
                    hasSanDmg = true;
                    // 移除後綴，還原為基礎效果 (例如 "crit")，讓後面的邏輯繼續處理物理部分
                    effectType = effectType.replace("_san", "");
                }

                // 處理 SAN 傷害部分
                if (hasSanDmg) {
                    if (isResisted) {
                        logMsg.push("<span style='color:#4f4'>抵抗了精神衝擊！</span>");
                    } else {
                        // 混合技能的 SAN 傷害適中 (10-15)
                        let drain = 10 + (reactiveGameState.diff * 2);
                        reactiveGameState.san -= drain;
                        logMsg.push(`<span style='color:#a0f'>精神受損 SAN -${drain}</span>`);
                    }
                }
                
                // ★★★ 處理純精神攻擊 (新增的第3招) ★★★
                if (skill.eff === 'san_dmg') { 
                    // 原有的 san_dmg 邏輯
                    if(isResisted) logMsg.push("<span style='color:#4f4'>堅定的意志抵擋了精神污染！</span>");
                    else { 
                        let drain = 15 + (reactiveGameState.diff * 5); // 傷害加強
                        reactiveGameState.san -= drain; 
                        logMsg.push(`<span style='color:#a0f'>精神受損 SAN -${drain}</span>`); 
                    }
                }
                else if (skill.eff === 'san_heavy') { 
                    if(isResisted) { reactiveGameState.san -= 15; logMsg.push(`<span style='color:#4f4'>意志減輕了精神重創 (SAN -15)</span>`); }
                    else { 
                        let drain = 40 + (reactiveGameState.diff * 10);
                        reactiveGameState.san -= drain; 
                        logMsg.push(`<strong style='color:#a0f'>精神崩潰！ SAN -${drain}</strong>`); 
                    }
                }
                else if (skill.eff === 'san_half') { 
                    if(isResisted) { reactiveGameState.san -= Math.floor(reactiveGameState.san * 0.2); logMsg.push("抵抗了理智斷線。"); }
                    else { 
                        let drain = Math.floor(reactiveGameState.san * 0.5);
                        reactiveGameState.san -= drain; 
                        logMsg.push(`<strong style='color:#d0f'>理智斷線！ SAN 減半 (-${drain})</strong>`); 
                    }
                }

                // ★★★ 處理物理/狀態效果 (使用處理過的 effectType) ★★★
                // 把原本代碼中的 skill.eff 全部換成 effectType
                
                else if (effectType === 'stun') { 
                    if(isResisted) logMsg.push("<span style='color:#4f4'>你的意志抵抗了暈眩！</span>");
                    else c.buffs.nextStunPlayer = true; 
                } 
                else if (effectType === 'def_down') { 
                    if(isResisted) logMsg.push("<span style='color:#4f4'>抵抗了破甲效果！</span>");
                    else c.buffs.playerDefDown = true; 
                }
                else if (effectType === 'acc_down' || effectType === 'blind') { 
                    if(isResisted) logMsg.push("<span style='color:#4f4'>抵抗了致盲效果！</span>");
                    else c.buffs.playerAccDown = true; 
                }
                else if (effectType === 'poison' || effectType === 'poison_aoe') {
         // 生化呼吸器 (gas_heal)：中毒轉回血
         if (reactiveGameState.eq.head && reactiveGameState.eq.head.fx && reactiveGameState.eq.head.fx.t === 'gas_heal') {
             let heal = Math.floor(reactiveGameState.maxHp * 0.05);
             reactiveGameState.hp = Math.min(reactiveGameState.maxHp, reactiveGameState.hp + heal);
             logMsg.push(`<span style='color:#4f4'>☣️ 毒氣轉化為治療 (+${heal})</span>`);
         }
         // 瘟疫醫生面具 (poison_imm)：免疫中毒
         else if (isResisted || (reactiveGameState.eq.head && reactiveGameState.eq.head.fx && reactiveGameState.eq.head.fx.t === 'poison_imm') || isImmuneAll) {
             logMsg.push("<span style='color:#4f4'>免疫了毒素！</span>");
         }
         else {
             let pDmg = Math.floor(reactiveGameState.maxHp * 0.05);
             reactiveGameState.hp -= pDmg;
             logMsg.push(`中毒受到 ${pDmg} 傷害`);
         }
    }
                else if (effectType === 'hp_halve') { 
                    if(isResisted) { eDmg = Math.floor(reactiveGameState.hp * 0.25); logMsg.push("意志減輕了重力壓制"); }
                    else { eDmg = Math.floor(reactiveGameState.hp * 0.5); logMsg.push("生命被強制減半！"); }
                }
                else if (effectType === 'crit') { eDmg = Math.floor(eDmg * 1.5); logMsg.push("暴擊傷害！"); }
                else if (effectType === 'double_hit') { eDmg = Math.floor(eDmg * 0.8); c.buffs.doubleHit = true; }
                else if (effectType === 'aoe') { eDmg = Math.floor(eDmg * 1.2); }
                else if (effectType === 'heal_self') { let h = Math.floor(c.maxHp * 0.1); c.hp += h; logMsg.push(`恢復了 ${h} HP`); }
                else if (effectType === 'atk_up') { c.atk = Math.floor(c.atk * 1.2); logMsg.push("攻擊力提升！"); }
                else if (effectType === 'def_up') { c.buffs.defUp = 3; logMsg.push("防禦力提升！"); }
                else if (effectType === 'acc_up') { c.buffs.accUp = 3; logMsg.push("命中率提升！"); }
                else if (effectType === 'dodge_up') { c.buffs.dodgeUp = 3; logMsg.push("變得難以捉摸！"); }
                else if (effectType === 'kill' && !reactiveGameState.isDefending) { eDmg = 999; logMsg.push("即死攻擊！"); }
                else if (effectType === 'shield') { c.enemyShield += 100; logMsg.push("獲得護盾！"); }
                else if (effectType === 'burn') { c.playerDebuffs.burn = 3; logMsg.push("被點燃了！"); }
                else if (effectType === 'bleed') { c.playerDebuffs.bleed = 3; logMsg.push("嚴重流血！"); }
                else if (effectType === 'sleep') { c.playerDebuffs.sleep = 2; logMsg.push("陷入睡眠！"); }

            }  else if (c.enemySkillCD > 0) {
                c.enemySkillCD--;
            }
            
            // 狀態減益
            if(c.buffs.atkDown) eDmg = Math.floor(eDmg * 0.7);
            if(c.buffs.shrink) { eDmg = Math.floor(eDmg * 0.5); c.buffs.shrink = 0; }
            if(c.buffs.blind) { if(Math.random()<0.6) eDmg=0; c.buffs.blind--; }
            
            // 殭屍屬性變化
            if(c.buffs.zombie === 'Purple') eDmg = Math.floor(eDmg * 0.6); 
            if(c.buffs.zombie === 'White')  eDmg = Math.floor(eDmg * 0.8); 
            if(c.buffs.zombie === 'Green')  eDmg = Math.floor(eDmg * 1.1); 
            if(c.buffs.zombie === 'Black')  eDmg = Math.floor(eDmg * 1.3); 
            if(c.buffs.zombie === 'Hair')   eDmg = Math.floor(eDmg * 2.0); 

            // 防禦狀態
            if(reactiveGameState.isDefending) eDmg = Math.floor(eDmg*0.2);
            if(c.buffs.tempBlock) { eDmg = Math.floor(eDmg * 0.2); c.buffs.tempBlock = 0; } 

            // 閃避判定
            let derived = calcDerivedStats();
            let hitChance = 100;
          // ★★★ 新增：如果敵人有 accDown (命中下降/致盲) 狀態，他的命中率大幅降低 ★★★
            if(c.buffs.accDown) hitChance -= 30; 
            if(c.buffs.playerAccDown) hitChance -= 20;
            
            let isDodged = (Math.random()*100 > hitChance) || (Math.random()*100 < derived.dodge);
            if (usedSkill && (usedSkill.eff === 'san_dmg' || usedSkill.eff === 'hp_halve')) isDodged = false;

            // 特殊防禦/反擊
            if(c.buffs.godBlock) { 
                isDodged = true; eDmg = 0; logMsg.push("神之一手格擋！"); 
                let counter = getDmgEst('ranged') * 2; c.hp -= counter; logMsg.push(`反擊 ${counter}`);
                c.buffs.godBlock = 0;
            }
            if(c.buffs.hedge) {
                isDodged = true; eDmg = 0; logMsg.push("風險對沖: <span style='color:#4f4'>完美規避風險 (傷害 0)</span>"); 
                c.buffs.hedge = 0; 
            }

            if(!isDodged && eDmg > 0) {

                 if (c.prefixEff) {
                    if ((c.prefixEff === 'burn_hit' || c.prefixEff === 'burn_aura') && Math.random() < 0.3) {
                        c.playerDebuffs.burn = (c.playerDebuffs.burn || 0) + 2; 
                         logMsg.push("<span style='color:#f60'>你被點燃了！</span>");
                    }
                    if ((c.prefixEff === 'poison_hit' || c.prefixEff === 'poison_stack') && Math.random() < 0.3) {
                         let pDmg = Math.floor(reactiveGameState.maxHp * 0.05);
                         reactiveGameState.hp -= pDmg;
                         logMsg.push(`<span style='color:#a0f'>中毒 -${pDmg}</span>`);
                    }
                    if (c.prefixEff.includes('lifesteal')) {
                         let rate = c.prefixEff === 'lifesteal' ? 0.2 : 0.1;
                         let suck = Math.floor(eDmg * rate); 
                         c.hp += suck;
                         logMsg.push(`<span style='color:#f44'>敵人吸血 +${suck}</span>`);
                    }
                    if (c.prefixEff === 'stun_hit' && Math.random() < 0.15) {
                         c.playerDebuffs.stun = 1;
                         logMsg.push("<span style='color:#fa0'>你被擊暈了！</span>");
                    }
                    if (c.prefixEff.includes('san_dmg')) {
                        let sDmg = c.prefixEff === 'san_dmg' ? 5 : 2;
                        reactiveGameState.san -= sDmg;
                        logMsg.push(`<span style='color:#88f'>精神受損 SAN -${sDmg}</span>`);
                    }
                    if (c.prefixEff === 'execute' && reactiveGameState.hp < reactiveGameState.maxHp * 0.3) {
                        eDmg *= 2;
                        logMsg.push("<strong style='color:#f00'>處決一擊！</strong>");
                    }
                }

                if(reactiveGameState.job.passive === 'block_chance' && Math.random()<0.2) { eDmg = Math.floor(eDmg*0.5); logMsg.push("鐵壁格擋"); }
                if(c.buffs.dance === 'Hozin' && Math.random()<0.2) { eDmg=0; logMsg.push("Hozin格擋"); }

                let def = reactiveGameState.eq.body.val + reactiveGameState.eq.head.val;
                if (c.buffs.playerDefDown) def = 0;
                let take = Math.max(1, Math.floor((eDmg - def) * (1 - derived.dmgRed/100)));

                // ★★★ Kenboy (圍村村霸) 抑鬱減傷修復 ★★★
                // 必須放在 take 計算出來之後
                if (reactiveGameState.job.trait === '抑鬱霸王' && reactiveGameState.flags.depression) {
                    take = Math.floor(take * 0.5); // 傷害減半
                    logMsg.push("<span style='color:#88f'>(太抑鬱了...I don't give a shit.)</span>");
                }
                
                // === 新增：裝備受擊特效 (反傷/格擋/減傷) ===
                ['body','head','shoes','acc'].forEach(part => {
                    let item = reactiveGameState.eq[part];
                    let f = item ? item.fx : null;
                    
                    if(f && take > 0) {
                        // 1. 反傷 (Thorns) - 例如: 主板護甲, 法拉第籠
                        if(f.t === 'thorns' || f.t === 'thorns_elec') {
                            let thornDmg = Math.max(1, Math.floor(take * (f.v || 0.2)));
                            c.hp -= thornDmg;
                            logMsg.push(`<span style="color:#a5f">⚡ 反傷 -${thornDmg}</span>`);
                        }
                        
                        // 2. 機率完全格擋 (Parry) - 例如: 勞斯萊斯雨傘, 十方雲履(雲步)
                        if((f.t === 'parry' || f.t === 'cloud_step') && Math.random() < f.v) {
                            take = 0;
                            logMsg.push(`<span style="color:#4cf">☔ ${item.name}特效：完全迴避！</span>`);
                        }
                        
                        // 3. 瀕死減傷 (Low HP) - 例如: 定製西裝
                        if(f.t === 'dmg_red_low_hp' && reactiveGameState.hp < reactiveGameState.maxHp * 0.3) {
                            take = Math.floor(take * (1 - f.v));
                            logMsg.push(`<span style="color:#fa0">🛡️ 瀕死減傷生效</span>`);
                        }
                        
                        // 4. 固定減傷 (Flat Reduction) - 例如: 熊貓衣, 工裝靴
                        if(f.t === 'tough_skin' || f.t === 'safety') {
                            let oldTake = take;
                            take = Math.max(0, take - f.v);
                            if(oldTake > take) logMsg.push(`<span style="color:#888">(硬化減傷 -${f.v})</span>`);
                        }
                        
                        // 5. 金錢護盾 - 例如: 荷官西裝
                        if(f.t === 'gold_shield' && reactiveGameState.money > 0) {
                            let absorb = Math.floor(take * f.v);
                            if(reactiveGameState.money >= absorb) {
                                reactiveGameState.money -= absorb;
                                take -= absorb;
                                logMsg.push(`<span style="color:#ffd700">💰 金錢抵傷 -$${absorb}</span>`);
                            }
                        }
                        
                        // 6. 受擊致盲 - 例如: 胡椒噴霧
                        if(f.t === 'blind_atk' && Math.random() < f.v) {
                            c.buffs.accDown = 2;
                            logMsg.push(`<span style="color:#fff">🌫️ 噴霧致盲敵人！</span>`);
                        }
                    }
                });
                // ==========================================

                // 玩家護盾抵扣
                if(c.playerShield > 0) {
                     if(c.playerShield >= take) { c.playerShield -= take; take = 0; logMsg.push("護盾抵擋"); } 
                     else { take -= c.playerShield; c.playerShield = 0; }
                }

              if(take > 0) {
                        // ... (原有的減傷代碼) ...
                        if(reactiveGameState.job.passive === 'dmg_reduce' && Math.random()<0.5) take = Math.floor(take * 0.7);

                        reactiveGameState.hp -= take; 
                        logMsg.push(`玩家受到 ${Math.floor(take)} 傷害`);

                        // ★★★ 新增：受傷扣除 SAN 值邏輯 ★★★
                        let sanLoss = 0;
                        // 1. 重擊恐懼：如果單次受傷超過 10% 最大血量，SAN -3
                        if (take >= reactiveGameState.maxHp * 0.1) {
                            sanLoss = 3;
                        } 
                        // 2. 普通恐懼：每次受傷有 30% 機率 SAN -1
                        else if (Math.random() < 0.3) {
                            sanLoss = 1;
                        }

                        // 3. 噩夢難度額外懲罰
                        if (reactiveGameState.diff === 3 && sanLoss > 0) sanLoss += 1;

                        if (sanLoss > 0) {
                            reactiveGameState.san -= sanLoss;
                            logMsg.push(`<span style="color:var(--san-color); font-size:0.8em;">(痛楚 SAN -${sanLoss})</span>`);
                        }
                        // ======================================
                        
                        // 反傷
                        let reflect = 0;
                        if(reactiveGameState.eq.body.name === '法拉第籠') reflect += (c.isBoss ? 0.01 : 0.1);
                        if(reactiveGameState.job.passive === 'counter_block' && Math.random()<0.15) { reflect += 0.8; logMsg.push("圍棋反擊"); }
                        if(reactiveGameState.job.passive === 'money_shield' && Math.random()<0.1) { c.hp -= 20; logMsg.push("保鏢反擊"); }
                        
                        if(reflect > 0) {
                            let rDmg = Math.floor(take * reflect);
                            if(rDmg>0) { c.hp -= rDmg; logMsg.push(`反彈 ${rDmg}`); }
                        }

                        // 應用技能Debuff
                        if (c.buffs.nextStunPlayer) { 
                            c.playerDebuffs.stun = 1; 
                            logMsg.push("<strong style='color:#fa0'>你被擊暈了！(下回合無法行動)</strong>"); 
                            
                            c.buffs.nextStunPlayer = false; 
                        }
                        
                        // 連擊
                        if (c.buffs.doubleHit) {
                            reactiveGameState.hp -= take;
                            logMsg.push(`連擊！再次受到 ${take} 傷害`);
                            c.buffs.doubleHit = false;
                        }

               } else if (isDodged) {
                let flavor = getCombatFlavor('你', c.n, 0, false, false);
                logMsg.push(`<div class="log-combat-h">${flavor}</div>`);
                
                // ★★★ 新增：閃避觸發特效 (如 Boogaloo 皮鞋) ★★★
                if(reactiveGameState.eq.shoes && reactiveGameState.eq.shoes.fx && reactiveGameState.eq.shoes.fx.t === 'dance_step') {
                    let danceDmg = Math.floor(getStat('a') * 0.5); // 反擊傷害 = 敏捷的一半
                    c.hp -= danceDmg;
                    logMsg.push(`<span style="color:#f4f">💃 霹靂一閃！對敵人造成 ${danceDmg} 傷害</span>`);
                }
                if(reactiveGameState.eq.body && reactiveGameState.eq.body.fx && reactiveGameState.eq.body.fx.t === 'dance_dodge') {
                     let heal = 10;
                     reactiveGameState.hp = Math.min(reactiveGameState.maxHp, reactiveGameState.hp + heal);
                     logMsg.push(`<span style="color:#4f4">💃 狂舞派 +${heal}</span>`);
                }
                // ===========================================
            }
        }
           if(c.buffs.atkDown > 0) c.buffs.atkDown--;
        if(c.buffs.accDown > 0) c.buffs.accDown--;
        if(c.buffs.defDown > 0) c.buffs.defDown--;
        
        if(c.buffs.atkUp > 0) c.buffs.atkUp--;
        if(c.buffs.defUp > 0) c.buffs.defUp--;
        if(c.buffs.dodgeUp > 0) c.buffs.dodgeUp--;
        }
    }
}

// combat
export function checkCombatEnd(c, logMsg) {
    log('戰鬥', logMsg.join(' ')); 
    updateUI();
    if(reactiveGameState.hp<=0) gameOver(`被 ${c.n} 殺死`);
    else if(c.hp<=0) { 
        log('戰鬥', '勝利！', 'c-gain'); 
        gainXp(c.xpVal || 1); 

        reactiveGameState.lastCombatLog = logMsg;   

        if(c.isBoss && c.n==="最終屍王") {
            gameOver("通關！");
        }
        // ★★★ 修改：Boss 戰勝利邏輯 ★★★
        else if(c.isBoss) { 
            // 1. 生成 Diablo 式掉落列表
            let loot = generateBossLoot(c.baseName, c.isQuest);
            
            showBossLootWindow(loot, () => {
                if(c.isQuest) {
                    completeQuest(); 
                } else {
                    // ★★★ 修改：地點 Boss 打完後，也嘗試進行搜刮 ★★★
                    continueExploration();
                }
            });
        }
        else { 
            let t=['melee','ranged','head','body','acc','med','throwable'][Math.floor(Math.random()*7)];
            if(t==='med'||t==='throwable') t = (Math.random()<0.5)?'med':'throwable';
            let lootItem = createItem(t,'random', 0);
            showLootModal(lootItem, t, continueExploration);
        }
    } else {
        c.usedItem = false; 
        renderCombat();
    }
}

// combat
export function useCombatItem(idx) {
    let item = reactiveGameState.bag[idx];
    let c = reactiveGameState.combat;
    
    // 移除物品
    reactiveGameState.bag.splice(idx, 1);
    
    let logMsg = `使用 ${item.fullName}: `;
    
    if (item.type === 'med') {
        // 藥物效果
        if (item.stats.hp) {
            let heal = item.stats.hp;
            reactiveGameState.hp = Math.min(reactiveGameState.maxHp, reactiveGameState.hp + heal);
            logMsg += `HP +${heal} `;
        }
        if (item.stats.san) {
            reactiveGameState.san = Math.min(100, reactiveGameState.san + item.stats.san);
            logMsg += `SAN +${item.stats.san} `;
        }

         // ★★★ 插入開始：藥品屬性 Buff/Debuff 處理 ★★★
        let statChanges = [];
        // 用來顯示中文名稱的對照表
        const STAT_NAMES_Display = { s:'力量', a:'敏捷', i:'智力', w:'意志', crit:'暴擊', dodge:'閃避' };
        
        // 遍歷物品屬性
        for (let k in item.stats) {
            // 如果屬性是戰鬥數值 (排除 hp, san, desc 等)
            if (['s', 'a', 'i', 'w', 'crit', 'dodge', 'acc'].includes(k)) {
                let val = item.stats[k];
                if (val !== 0) {
                    // 初始化臨時屬性物件
                    if (!c.buffs.tempStats) c.buffs.tempStats = {};
                    // 疊加數值
                    c.buffs.tempStats[k] = (c.buffs.tempStats[k] || 0) + val;
                    
                    let sign = val > 0 ? '+' : '';
                    let name = STAT_NAMES_Display[k] || k;
                    statChanges.push(`${name}${sign}${val}`);
                }
            }
        }
        
        // 如果有屬性變化，設定計時器並顯示日誌
        if (statChanges.length > 0) {
            c.buffs.itemBuffTimer = 2; // 設定持續 2 回合
            logMsg += `<br><span style="color:#ffd700">藥效(2回合): ${statChanges.join(', ')}</span>`;
        }
        // ★★★ 插入結束 ★★★

        if (item.stats.s) { c.buffs.allUp = 3; logMsg += `力量提升 `; } 
        if (item.stats.eff) {
            if(item.stats.eff === 'bleed' && c.buffs.bleed) c.buffs.bleed=0;
        }
    } else if (item.type === 'throwable') {
        // 投擲物效果
        let dmg = item.val || 0;
        // 投擲物傷害隨天數成長
        dmg = Math.floor(dmg * (1 + reactiveGameState.day/60));
        
        c.hp -= dmg;
        logMsg += `造成 ${dmg} 傷害 `;
        
        if (item.stats.eff) {
            if(item.stats.eff === 'burn') { c.buffs.burn = 3; logMsg += "燃燒! "; }
            if(item.stats.eff === 'stun') { c.isStunned = true; c.buffs.stun = 1; logMsg += "暈眩! "; }
            if(item.stats.eff === 'poison') { c.buffs.bleed = 3; logMsg += "中毒(流血)! "; }
            if(item.stats.eff === 'blind') { c.buffs.blind = 2; logMsg += "致盲! "; }
            if(item.stats.eff === 'slow') { c.buffs.accDown = 3; logMsg += "緩速! "; }
            
            // --- 變動：即死道具的 Boss 抗性邏輯 ---
            if(item.stats.eff === 'kill') {
                if (!c.isBoss) {
                    // 對普通怪：直接秒殺
                    c.hp = 0; 
                    logMsg += "即死! "; 
                } else {
                    // 對 Boss：傷害遞減機制
                    c.artifactResist = c.artifactResist || 0; 
                    
                    let baseDmg = 2500; // 基礎高傷
                    // 公式：基礎傷害 / (2 的 抗性次方) -> 2500, 1250, 625...
                    let artifactDmg = Math.floor(baseDmg / Math.pow(2, c.artifactResist));
                    if (artifactDmg < 100) artifactDmg = 100; // 保底傷害

                    c.hp -= artifactDmg;
                    
                    if (c.artifactResist === 0) {
                        logMsg += `神器爆發！造成 <strong style="color:#d0f">${artifactDmg}</strong> 點毀滅傷害！ `;
                    } else if (c.artifactResist < 3) {
                        logMsg += `Boss逐漸適應了法則...造成 <span style="color:#d0f">${artifactDmg}</span> 傷害。 `;
                    } else {
                        logMsg += `Boss已完全解析法則！僅造成 ${artifactDmg} 傷害。 `;
                    }
                    
                    c.artifactResist++; // 增加抗性層數
                }
            }
        }
    } 
    // ★★★ 重點：這裡補上了之前導致錯誤的閉合括號 ★★★

    // 標記本回合已使用
    c.usedItem = true;
    
    closeModal();
    log('戰鬥', logMsg, 'c-skill');
    
    // 檢查敵人是否死亡
    if (c.hp <= 0) {
        log('戰鬥', '敵人被擊敗！', 'c-gain');
        gainXp(c.xpVal || 1);
        if(c.isBoss && c.n==="最終屍王") gameOver("通關！");
        else if(c.isQuest) { completeQuest(); return; }
        else { 
            let t=['melee','ranged','head','body','acc','med','throwable'][Math.floor(Math.random()*7)];
            if(t==='med'||t==='throwable') t = (Math.random()<0.5)?'med':'throwable';
            showLootModal(createItem(t,'random',0), t, campPhase);
        }
    } else {
        updateUI();
        renderCombat(); // 重新渲染
    }
}


// combat
// ==================== 全新動態難度平衡系統 (請貼在文件末尾) ====================
// 1. 計算裝備特效的隱藏權重 (Power Score) - 精細化計算 v3.1
export function calcEquipmentPowerScore() {
    let score = 1.0; // 基礎權重 100%

    // 遍歷全身裝備
    for (let key in reactiveGameState.eq) {
        let item = reactiveGameState.eq[key];
        if (item && item.fx) {
            let t = item.fx.t;
            let v = item.fx.v || 0.1; // 預設值，防止為 0

            // --- 攻擊類特效 ---
            if (t === 'execute') {
                // 斬殺是極強屬性。v=0.5 (50%斬殺) 
                score += 0.1 + (v * 1.5); 
            }
            else if (t === 'double_hit') {
                score += v * 0.8;
            }
            else if (t === 'ignore_def' || t === 'true_dmg') {
                score += 0.1 + (v * 0.5);
            }
            else if (t === 'crit_dmg') {
                score += v * 0.5;
            }
            else if (t === 'auto_aim') {
                score += 0.2; 
            }
            else if (t === 'gold_hit') {
                score += 0.05;
            }

            // --- 控制類特效 ---
            else if (t === 'stun_hit' || t === 'freeze_hit' || t === 'hypnosis') {
                score += 0.15 + (v * 1.2);
            }
            else if (t === 'blind_atk' || t === 'slow_hit') {
                score += 0.1 + (v * 0.5);
            }

            // --- 生存類特效 ---
            else if (t === 'lifesteal') {
                score += 0.2 + (v * 1.0);
            }
            else if (t === 'regen') {
                let regenPct = v / 500;
                score += regenPct * 2; 
            }
            else if (t === 'revive') {
                score += 0.6; 
            }
            else if (t === 'dodge_lucky' || t === 'parry') {
                score += 0.1 + (v * 0.8);
            }
            else if (t === 'grit' || t === 'tough_skin') {
                score += 0.15;
            }
            else if (t === 'immune' || t === 'poison_imm' || t === 'stun_res') {
                score += 0.15; 
            }
        }
    }

    // 職業技能修正
    if (reactiveGameState.job.sk === 'kid_squad') score += 0.3; 
    if (reactiveGameState.job.sk === 'god_hand') score += 0.25; 
    if (reactiveGameState.job.sk === 'one_cue') score += 0.4;   
    if (reactiveGameState.job.sk === 'time_stop') score += 0.5; 

    return score;
}

// combat
// 2. 計算玩家綜合戰力 (DPS & EHP) - v4.0 修正版 (讓玩家享受神裝優勢)
export function getPlayerCombatPower() {
    // A. 基礎面板
    let s = getStat('str'), a = getStat('agi');
    let meleeRaw = getEquipVal(reactiveGameState.eq.melee) + s;
    let rangedRaw = getEquipVal(reactiveGameState.eq.ranged) + a;
    let baseAtk = Math.max(meleeRaw, rangedRaw);
    
    // B. 暴擊期望
    let derived = calcDerivedStats();
    let critChance = Math.min(100, derived.crit) / 100;
    let critDmgMult = (derived.critDmg || 150) / 100;
    let expAtk = baseAtk * (1 + (critChance * (critDmgMult - 1)));

    // C. 生存
    let def = getEquipVal(reactiveGameState.eq.head) + getEquipVal(reactiveGameState.eq.body);
    let reducPct = Math.min(80, derived.dmgRed) / 100; 
    
    // ★★★ 修正核心：特效權重「鈍化」處理 ★★★
    let rawScore = calcEquipmentPowerScore(); 
    
    // 我們不直接乘上 rawScore (例如 1.85)，因為那會完全抵消裝備優勢
    // 我們使用「開根號」或者「打折」的方式，讓系統只追趕一部分強度
    // 例如：玩家強了 85%，系統只增強 40%
    // 公式：1 + (增幅部分 * 0.5)
    let dampedScore = 1 + ((rawScore - 1) * 0.5);

    let finalAtk = Math.max(5, Math.floor(expAtk * dampedScore));

    return { 
        atk: finalAtk, 
        def: def, 
        hp: reactiveGameState.maxHp, 
        reduc: reducPct,
        powerScore: rawScore // 傳遞原始分數備用，但不影響核心數值
    };
}

// combat
// 3. 核心：根據類型生成動態數值 (v4.1 修復版 - 降低難度曲線)
export function getDynamicEnemyStats(type) {
    let p = getPlayerCombatPower();
    let diff = reactiveGameState.diff; 

    let variance = 0.85 + Math.random() * 0.3; 

    // 目標節奏 (回合數)
    // 這裡定義：玩家需要幾回合殺死怪，怪需要幾回合殺死玩家
    let target = { playerTurns: 3.0, enemyTurns: 10 }; // 普通怪改為 3 回合，讓戰鬥稍微輕鬆點

    if (type === 'elite') {
        target.playerTurns = 6;
        target.enemyTurns = 8;
    } else if (type === 'boss') {
        target.playerTurns = 15; 
        target.enemyTurns = 6;   
    } else if (type === 'final_boss') {
        target.playerTurns = 25;
        target.enemyTurns = 5;
        variance = 1.0; 
    }

    // --- ★★★ 修改 1：難度係數明確化 ★★★ ---
    let hpMult = 1.0;
    let atkMult = 1.0;

    if (diff === 1) { 
        // 🟢 歡快模式：怪物全面削弱 25%
        hpMult = 0.75; 
        atkMult = 0.75; 
    } else if (diff === 2) { 
        // 🟡 標準模式：基準
        hpMult = 1.0; 
        atkMult = 1.0; 
    } else if (diff === 3) { 
        // 🔴 挑戰模式：增強
        hpMult = 1.3; 
        atkMult = 1.3; 
    }

    // ------------------------------------
    // --- ★★★ 修改 2：階梯式時間係數 (Time Scaling) ★★★ ---
    // 這是為了防止新手期(裝備沒成型)遇到太強的怪
    let timeScale = 1.0;
    if (reactiveGameState.day <= 15) {
        timeScale = 0.5; // Day 0-15: 50% 強度 (極其溫柔)
    } else if (reactiveGameState.day <= 30) {
        timeScale = 0.7; // Day 16-30: 70% 強度
    } else if (reactiveGameState.day <= 60) {
        timeScale = 0.9; // Day 31-60: 90% 強度
    }

    // Day 60+ 恢復 100% 強度
    // -----------------------------------------------------
    // 成長係數 (0.85) - 讓怪物比玩家弱一點點，產生「爽感」
    let scalingFactor = 0.85; 
    let adjustedAtk = p.atk * scalingFactor;

    // --- ★★★ 修改 3：大幅降低天數帶來的膨脹 (之前加太多了) ★★★ ---
    // 舊代碼這裡加了兩次 day，導致數值爆炸
    // 現在只加一次，且數值很小，主要只為了讓後期不至於太弱
    let dayFlatBonus = reactiveGameState.day * 0.5; 
    adjustedAtk += dayFlatBonus; 
    // -----------------------------------------------------------
    // 計算敵人 HP
    let eHP = Math.floor(adjustedAtk * target.playerTurns * hpMult * variance * timeScale);
    
    // 計算敵人攻擊力
    let requiredNetDmg = p.hp / target.enemyTurns;
    
    // 依然保留對吸血/回血的輕微抵抗
    if (p.powerScore > 1.4) requiredNetDmg *= 1.1;

    let effectiveReduc = Math.max(0.1, 1 - p.reduc); 
    let rawDmgNeeded = requiredNetDmg / effectiveReduc;
    
    let eAtk = Math.floor((rawDmgNeeded + p.def) * atkMult * variance * timeScale);

    // --- ★★★ 修改 4：保底數值也受到 timeScale 影響 ★★★ ---
    // 確保 Day 1 絕對不會出現攻擊力 20 的怪
    let dayScale = 1 + (reactiveGameState.day * 0.05); // 降低保底成長速度
    let minHP = 30 * dayScale * timeScale;
    let minAtk = 5 * dayScale * timeScale; // 最低攻擊力降低

    if (type === 'boss' || type === 'elite') { minHP *= 4.0; minAtk *= 1.5; }
    if (type === 'final_boss') { minHP = 12000; minAtk = 250; } 

    eHP = Math.max(eHP, Math.floor(minHP));
    eAtk = Math.max(eAtk, Math.floor(minAtk));

    return { hp: eHP, atk: eAtk };
}

// combat
// 萬能技能解析器 (修復版 v2：括號結構嚴格檢查)
export function performSkill(sid) {
    let s = Constant.SKILL_DB[sid];
    let c = reactiveGameState.combat;
    let logMsg = [];
    
    // 定義屬性中文名稱映射
    const STAT_NAMES = {
        atkUp: "攻擊力", defUp: "防禦力", dodgeUp: "閃避率", accUp: "命中率",
        atkDown: "攻擊力", defDown: "防禦力", accDown: "命中率",
        bleed: "流血", burn: "燃燒", blind: "致盲", sleep: "睡眠",
        stun: "暈眩", root: "定身"
    };

    closeModal();
    
    // 1. 支付消耗
    if (s.cost) {
        if (s.cost.hp) reactiveGameState.hp -= s.cost.hp;
        if (s.cost.san) reactiveGameState.san -= s.cost.san;
        if (s.cost.food) reactiveGameState.food -= s.cost.food;
        if (s.cost.money) reactiveGameState.money -= s.cost.money;
    }
    
    // 2. 設定冷卻
    if (!c.skillCDs) c.skillCDs = {};
    c.skillCDs[sid] = s.cd;
    
    // 3. 基礎數值計算 (Power)
    let power = 0;
    let stats = ['s','a','i','w','luck'];
    if (s.scale) {
        stats.forEach(stat => {
            if (s.scale[stat]) {
                power += getStat(stat) * s.scale[stat];
            }
        });
        if (s.scale.fixed) power += s.scale.fixed;
    }

    // 林正英專屬殭屍剋星被動
    let isTaoist = (reactiveGameState.job.n && reactiveGameState.job.n.includes('道士'));
    let isZombie = (c.n.includes('屍') || c.n.includes('感染') || c.n.includes('殭') || c.buffs.zombie);

    if (isTaoist && isZombie) {
        power = Math.floor(power * 1.25);
        logMsg.push(`<span style="color:#ffd700; font-size:0.8em;">(道術加成 +25%)</span>`);
    }
    
    // 4. 執行效果
    let totalDmg = 0;
    
    if (s.effects) {
        s.effects.forEach(eff => {
            // --- A. 傷害類 ---
            if (eff.t === 'dmg') {
                let base = power;
                if (eff.var) base *= (1 + (Math.random() * eff.var - (eff.var/2)));
                let weaponDmg = (getEquipVal(reactiveGameState.eq.melee) + getEquipVal(reactiveGameState.eq.ranged)) / 2;
                totalDmg += Math.floor(base + (weaponDmg * 0.5));
            }
            else if (eff.t === 'dmg_multi') {
                let hits = eff.hits || 2;
                let dmgPerHit = Math.floor(power * 0.4); 
                for(let i=0; i<hits; i++) {
                    totalDmg += dmgPerHit;
                    logMsg.push(`連擊`);
                }
            }
            else if (eff.t === 'true_dmg_day') { 
                totalDmg += (reactiveGameState.day * (eff.factor || 1));
                c.buffs.ignoreDef = 1;
            }
            else if (eff.t === 'execute') { 
                let threshold = eff.limit || 0.3; 
                if (c.hp < c.maxHp * threshold) {
                    totalDmg += Math.floor(power * 3);
                    logMsg.push(`<strong style="color:#f00">斬殺!</strong>`);
                } else {
                    totalDmg += Math.floor(power * 0.5);
                }
            }
            
            // --- B. 恢復類 ---
            else if (eff.t === 'heal_hp') {
                let amt = Math.floor(eff.v + (power * 0.5));
                reactiveGameState.hp = Math.min(reactiveGameState.maxHp, reactiveGameState.hp + amt);
                logMsg.push(`<span style="color:#4f4">HP +${amt}</span>`);
            }
            else if (eff.t === 'heal_san') {
                reactiveGameState.san = Math.min(100, reactiveGameState.san + eff.v);
                logMsg.push(`<span style="color:#88f">SAN +${eff.v}</span>`);
            }
            
            // --- C. 防禦/控制類 ---
            else if (eff.t === 'shield') {
                let val = Math.floor(eff.v + power);
                c.playerShield += val;
                logMsg.push(`<span style="color:#fa0">護盾 +${val}</span>`);
            }
            else if (eff.t === 'stun') {
                c.isStunned = true;
                c.buffs.stun = (c.buffs.stun || 0) + eff.v;
                logMsg.push(`<span style="color:#fa0">暈眩 ${eff.v} 回</span>`);
            }

            // --- D. 特殊技能 (Matthew) ---
            else if (eff.t === 'random_amazon') {
                const amazonItems = [
                    { n: "氣槍", dmg: 3, unit: "支", tag: "精準", debuff: { k: "defDown", v: 2, t: "debuff" } }, 
                    { n: "伐木斧", dmg: 6, unit: "把", tag: "重擊", debuff: { k: "stun", v: 1, t: "debuff" } }, 
                    { n: "廚房刀", dmg: 4, unit: "把", tag: "鋒利", debuff: { k: "bleed", v: 2, t: "debuff" } }, 
                    { n: "花生油", dmg: 2, unit: "罐", tag: "易燃", debuff: { k: "burn", v: 3, t: "debuff" } }, 
                    { n: "啞鈴", dmg: 5, unit: "個", tag: "壓制", debuff: { k: "accDown", v: 3, t: "debuff" } }, 
                    { n: "樂高積木", dmg: 3, unit: "盒", tag: "痛楚", debuff: { k: "atkDown", v: 2, t: "debuff" } }, 
                    { n: "防狼噴霧", dmg: 1, unit: "瓶", tag: "致盲", debuff: { k: "blind", v: 2, t: "debuff" } }, 
                    { n: "急凍魚", dmg: 5, unit: "條", tag: "冰凍", debuff: { k: "accDown", v: 2, t: "debuff" } }, 
                    { n: "平底鍋", dmg: 4, unit: "個", tag: "格擋", debuff: { k: "shield", v: 5, t: "shield" } }, 
                    { n: "機械鍵盤", dmg: 3, unit: "個", tag: "嘲諷", debuff: { k: "atkDown", v: 2, t: "debuff" } } 
                ];

                let item = amazonItems[Math.floor(Math.random() * amazonItems.length)];
                let maxQty = 6 + Math.floor(getStat('luck') * 0.4) + Math.floor(reactiveGameState.day * 0.15);
                let qty = Math.max(1, Math.floor(Math.random() * maxQty) + 1);
                
                let dimFactor = Math.sqrt(qty) * 2; 
                if (qty <= 3) dimFactor = qty; 

                let rawDmg = item.dmg * dimFactor;
                let finalDmg = Math.floor(rawDmg * (1 + power * 0.05));
                
                totalDmg += Math.max(1, finalDmg);
                
                if (item.debuff) {
                    let effectChance = 0.2 + (qty * 0.03); 
                    if (Math.random() < effectChance) {
                        if (item.debuff.t === 'debuff') {
                            c.buffs[item.debuff.k] = (c.buffs[item.debuff.k] || 0) + item.debuff.v;
                            logMsg.push(`<span style="color:#a0f">附加: ${item.tag}</span>`);
                        } else if (item.debuff.t === 'shield') {
                            let shieldAmt = item.debuff.v * qty; 
                            c.playerShield += shieldAmt;
                            logMsg.push(`<span style="color:#fa0">擋子彈: 盾+${shieldAmt}</span>`);
                        }
                    }
                }

                const quotes = [
                    "「雙11淨低嘅死貨，送畀你！」",
                    "「系統出錯發多咗貨？算啦照殺！」",
                    "「Amazon Prime 次日達，接招！」",
                    "「呢批貨好評率 99%，你試下！」",
                    "「清倉大減價，全部一折！」"
                ];
                let quote = quotes[Math.floor(Math.random() * quotes.length)];
                
                if (item.n === '樂高積木') quote = "「踩中呢個痛過生仔呀！」";
                if (item.n === '急凍魚') quote = "「新鮮空運，仲識跳架！」";
                if (item.n === '顯卡') quote = "「呢張卡依家炒到好貴架！」";
                if (item.n === '花生油') quote = "「小心地滑！」";

                logMsg.push(`${quote} (訂購了 ${qty} ${item.unit} <strong style="color:#ffd700">${item.n}</strong>)`);
            }

            // Matthew: 醫管局供應商
            else if (eff.t === 'random_medical') {
                const medItems = [
                    { n: "外科口罩", v: 10, type: "shield", desc: "防禦" },
                    { n: "消毒液", v: 5, type: "san", desc: "清爽" }, 
                    { n: "必理痛", v: 10, type: "hp", desc: "止痛" }, 
                    { n: "繃帶", v: 8, type: "hp", desc: "包紮" },
                    { n: "維他命C", v: 1, type: "all_up", desc: "狀態" } 
                ];
                
                let item = medItems[Math.floor(Math.random() * medItems.length)];
                let qty = Math.max(1, Math.floor(Math.random() * 3) + 1);
                if (getStat('luck') > 20 && Math.random() < 0.5) qty += 1;
                
                const medQuotes = [
                    "「利用內部關係調咗批貨...」",
                    "「雖然過咗期，但應該食唔死人。」",
                    "「呢啲係戰略儲備，慳啲使！」",
                    "「根據大數據分析，依家你需要呢個。」"
                ];
                let mQuote = medQuotes[Math.floor(Math.random() * medQuotes.length)];
                
                logMsg.push(`${mQuote} (調用了 ${qty} ${item.n})`);
                
                if (item.type === 'hp') {
                    let heal = item.v * qty;
                    reactiveGameState.hp = Math.min(reactiveGameState.maxHp, reactiveGameState.hp + heal);
                    logMsg.push(`<span style="color:#4f4">HP +${heal}</span>`);
                } else if (item.type === 'san') {
                    let heal = item.v * qty;
                    reactiveGameState.san = Math.min(100, reactiveGameState.san + heal);
                    logMsg.push(`<span style="color:#88f">SAN +${heal}</span>`);
                } else if (item.type === 'shield') {
                    let shield = item.v * qty;
                    c.playerShield += shield;
                    logMsg.push(`<span style="color:#fa0">護盾 +${shield}</span>`);
                } else if (item.type === 'all_up') {
                    c.buffs.ignoreDef = 3;
                    logMsg.push(`<span style="color:#ffd700">免疫力提升(無視防禦)</span>`);
                }
            }

            // 林正英: 殭屍符
            else if (eff.t === 'zombie_curse') {
                if (c.buffs.zombie) {
                    let base = power * 2.0; 
                    let weaponDmg = (getEquipVal(reactiveGameState.eq.melee) + getEquipVal(reactiveGameState.eq.ranged)) / 2;
                    totalDmg += Math.floor(base + weaponDmg);
                    c.isStunned = true; 
                    c.buffs.stun = 1;
                    logMsg.push(`<span style="color:#fa0">鎮屍！造成暴擊並定身</span>`);
                } else {
                    c.buffs.zombieCountdown = eff.v;
                    logMsg.push(`<strong style="color:#a5f">貼符！${eff.v}回合後將轉化敵人</strong>`);
                }
            }
            
            // --- E. Buff/Debuff ---
            else if (eff.t === 'buff') {
                c.buffs[eff.k] = (c.buffs[eff.k] || 0) + eff.v;
                let name = STAT_NAMES[eff.k] || eff.k;
                let desc = eff.desc ? `${eff.desc} (${name} +${eff.v})` : `${name}提升 (+${eff.v})`;
                logMsg.push(`<span style="color:#4f4">${desc}</span>`);
            }
            else if (eff.t === 'debuff') {
                if (eff.k === 'bleed' || eff.k === 'burn') {
                    c.buffs[eff.k] = (c.buffs[eff.k] || 0) + eff.v;
                    let name = STAT_NAMES[eff.k];
                    logMsg.push(`<span style="color:#f44">${name} ${eff.v}層</span>`);
                } else {
                    c.buffs[eff.k] = (c.buffs[eff.k] || 0) + eff.v;
                    let name = STAT_NAMES[eff.k] || eff.k;
                    let desc = eff.desc ? `${eff.desc} (${name} -${eff.v})` : `${name}下降 (-${eff.v})`;
                    logMsg.push(`<span style="color:#a0f">${desc}</span>`);
                }
            }
        }); // forEach 結束
    } // if s.effects 結束
    
    // 5. 輸出日誌
    log('技能', `<span style="color:#ffd700; font-weight:bold">${s.n}</span>: ${s.log || ''}`, 'c-skill');
    if (logMsg.length > 0) log('效果', logMsg.join(', '));
    
    // 6. 傷害結算
    if (totalDmg > 0) {
        let eDef = Math.floor(c.maxHp * 0.05);
        if (c.buffs.defDown) eDef = Math.floor(eDef * 0.5);
        if (c.buffs.ignoreDef) { eDef = 0; c.buffs.ignoreDef = 0; }
        
        let realDmg = Math.max(1, Math.floor(totalDmg - eDef));
        
        if (c.enemyShield > 0) {
            if (c.enemyShield >= realDmg) {
                c.enemyShield -= realDmg; realDmg = 0;
                log('戰鬥', "傷害被護盾抵擋");
            } else {
                realDmg -= c.enemyShield; c.enemyShield = 0;
            }
        }
        
        if (realDmg > 0) {
            c.hp -= realDmg;
            log('戰鬥', `💥 技能造成 <strong>${realDmg}</strong> 點傷害`);
            triggerShake();
        }
    }
    
    updateUI();
    
    if (c.hp <= 0) {
        checkCombatEnd(c, [`${c.n} 被技能擊敗`]);
    } else {
        processEnemyTurn(c, []);
        if (c.playerDebuffs && c.playerDebuffs.stun > 0) {
            log('系統', '你被擊暈了！', 'c-loss');
            updateUI();
            renderCombat(); 
            return;
        }
        checkCombatEnd(c, []);
    }
}