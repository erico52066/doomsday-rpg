import * as Constant from './GameData.js';
import { reactiveGameState, log } from './GameMain.js';
import { updateUI, openModal } from './UIManager.js';

// character
export function recalcMaxHp() {
    let base = 100;
    if(reactiveGameState.job.hpBonus) {
        base += reactiveGameState.job.hpBonus;
    }
    if(reactiveGameState.job.trait==='南丁格爾') base += 50;
    if(reactiveGameState.mbti && 
        reactiveGameState.mbti.bonus && 
        reactiveGameState.mbti.bonus.hp) { 
        base += reactiveGameState.mbti.bonus.hp;
    }
    for(let k in reactiveGameState.eq) {
        if(reactiveGameState.eq[k] && 
            reactiveGameState.eq[k].stats && 
            reactiveGameState.eq[k].stats.hp) {
            base += reactiveGameState.eq[k].stats.hp;
        }
    }
    
    // ★★★ 修改：扣除累積的血量懲罰 ★★★
    if (reactiveGameState.hpPenalty > 0) {
        base -= reactiveGameState.hpPenalty;
    }

    // 保底 10 點血，避免負數
    base = Math.max(10, base);

    reactiveGameState.maxHp = base;
    if(reactiveGameState.hp > reactiveGameState.maxHp) {
        reactiveGameState.hp = reactiveGameState.maxHp;
    }
    updateUI();
}

// character
// ==================== 等級與經驗系統 ====================
export function gainXp(amount) {
    reactiveGameState.xp += amount;
    log('成長', `獲得經驗 +${amount}`, 'c-xp');
    checkLevelUp();
    updateUI();
}

// character
export function checkLevelUp() {
    while(reactiveGameState.xp >= 20) {
        reactiveGameState.xp -= 20;
        reactiveGameState.level++;
        recalcMaxHp(); // 升級可能影響屬性，從而影響HP上限
        reactiveGameState.hp = reactiveGameState.maxHp; 
        let stats = ['str','agi','int','wil'];
        let s = stats[Math.floor(Math.random()*stats.length)];
        reactiveGameState.stats[s]++;
        
        let statName = Constant.STAT_MAP[s];
        openModal("✨ 升級！", 
            `<h2 style="color:var(--xp-color)">Level ${reactiveGameState.level}</h2>
            <div>狀態完全恢復！</div>
            <div style="margin-top:10px;font-size:1.2em">獲得屬性：<strong style="color:#fff">${statName} +1</strong></div>`, 
            `<button onclick="closeModal()">太棒了</button>`
        );
    }
}

// character
export function calcDerivedStats() {
    let s = getStat('str'), a = getStat('agi'), i = getStat('int'), w = getStat('wil'), l = getStat('luck');
    let sanState = getSanityState(); // ★★★ 獲取精神狀態 ★★★

    // 1. 基礎閃避
    let dodgeBase = a * 0.4; 

    // 2. 被動與職業修正
    if(reactiveGameState.job.passive === 'high_dodge') dodgeBase = 60 + (a * 0.5); // Lil Kid
    if(reactiveGameState.job.passive === 'racer_sense') dodgeBase += 20; 
    if(reactiveGameState.job.passive === 'high_reflex') dodgeBase += 10;
    if(reactiveGameState.job.passive === 'dealer_luck') dodgeBase = dodgeBase *0.8;

    // 3. 技能 Buff 修正 (加法)
    if(reactiveGameState.job.name.includes('Doraemon') 
        && reactiveGameState.combat?.buffs?.doraemon === 'copter') 
        dodgeBase += 30;
    if(reactiveGameState.combat?.buffs?.dlss) dodgeBase += 40;
    if(reactiveGameState.combat?.buffs?.redbull) dodgeBase += 25;
    if(reactiveGameState.combat?.buffs?.matrix) dodgeBase += 50;
    if(reactiveGameState.combat?.buffs?.dance === 'Pete') dodgeBase += 10;
    
    // =======================================================
    // ▼ 這句加在這裡 (4. 裝備修正) ▼
    // 遍歷所有裝備部位，如果有提供 dodge 屬性，就加上去
    for(let k in reactiveGameState.eq) 
        if(reactiveGameState.eq[k]?.stats?.dodge) 
            dodgeBase += reactiveGameState.eq[k].stats.dodge;
    // =======================================================
// ★★★ 5. SAN 值修正 (閃避) ★★★
    if(sanState.buffs.dodge) dodgeBase += sanState.buffs.dodge;

    // 6. 最終上限判定 (Hard Cap 70%)
     let maxDodge = reactiveGameState.job.passive === 'high_dodge' ? 85 : 70;
    let finalDodge = Math.floor(dodgeBase);
    if (finalDodge > maxDodge) finalDodge = maxDodge;
    
    let critBase = (i * 0.5) + (l * 0.5); 
    if(reactiveGameState.job.passive === 'high_acc_crit') critBase += 30;
    if(reactiveGameState.job.passive === 'high_reflex') critBase += 10;
    if(reactiveGameState.job.passive === 'dealer_luck') critBase += 2;
    if(reactiveGameState.combat?.buffs?.dance === 'Hoan') critBase += 20;
    for(let k in reactiveGameState.eq) if(reactiveGameState.eq[k]?.stats?.crit) critBase += reactiveGameState.eq[k].stats.crit;


    // ★★★ SAN 值修正 (暴擊) ★★★
    if(sanState.buffs.crit) critBase += sanState.buffs.crit;

    // --- 減傷計算 ---
    let dmgRed = w * 0.25; 
    for(let k in reactiveGameState.eq) {
        if(reactiveGameState.eq[k] && reactiveGameState.eq[k].stats && reactiveGameState.eq[k].stats.defP) {
            let bonus = reactiveGameState.eq[k].stats.defP;
            if(reactiveGameState.eq[k].isJobNative) bonus *= 1.1; 
            dmgRed += (bonus * 100);
        }
    }
    if(reactiveGameState.combat?.buffs?.dance === 'Pete') dmgRed += 10;

    // ★★★ SAN 值修正 (防禦/減傷) ★★★
    if(sanState.buffs.defP) dmgRed += (sanState.buffs.defP * 100);

    // ★★★ 修復：確保回傳命中與攻擊加成，避免 NaN ★★★
    let sanAccBonus = sanState.buffs.acc || 0;     // 來自 SAN 的命中加成
    let sanAtkBonus = sanState.buffs.atkPct || 0;  // 來自 SAN 的攻擊百分比

    return {
        dodge: Math.min(75, Math.max(0, finalDodge)), 
        crit: Math.min(100, Math.floor(critBase)),
        critDmg: 150 + s,
        dmgRed: Math.min(80, Math.floor(dmgRed))
    };
}

// character
// 修改 getStat，讓幸運值也能吃到飾品加成
export function getStat(k) {
    let base = reactiveGameState.stats[k] || 0;
    if (k === 'luck') base = reactiveGameState.luck; 
    if (k === 'moral') return reactiveGameState.moral;
    if (k === 'luck' && reactiveGameState.eq.acc) {
    }

    if (reactiveGameState.job.passive === 'dealer_luck' && ['str','agi','int','wil','luck'].includes(k)) base += 5;
    if (reactiveGameState.job.passive === 'depress_stat' && ['str','agi','int','wil'].includes(k)) base = Math.floor(base * 1.5);
    if (reactiveGameState.job.passive === 'high_dodge' && ['str','agi','int','wil'].includes(k)) base = Math.floor(base * 0.5);

    if(reactiveGameState.flags.depression && ['str','agi','int','wil'].includes(k)) base = Math.floor(base/2);
    
    for(let slot in reactiveGameState.eq) {
        let item = reactiveGameState.eq[slot];
        if(item && item.stats && item.stats[k]) {
            let add = item.stats[k];
            if(item.isJobNative) add = Math.floor(add * 1.1);
            base += add;
        }
        if(item && item.stats && item.stats.all && ['str','agi','int','wil','luck'].includes(k)) {
             base += item.stats.all;
        }
    }
    
    if(reactiveGameState.combat && reactiveGameState.combat.buffs) {

        if (reactiveGameState.combat.buffs.tempStats && reactiveGameState.combat.buffs.tempStats[k]) {
            base += reactiveGameState.combat.buffs.tempStats[k];}
        if(reactiveGameState.combat.buffs.allUp && ['str','agi','int','wil'].includes(k)) base = Math.floor(base * 1.5); 
        if(reactiveGameState.combat.buffs.dlss && k === 'agi') base = Math.floor(base * 1.5);
        if(reactiveGameState.combat.buffs.redbull && k === 'agi') base = Math.floor(base * 1.3);
        if(reactiveGameState.combat.buffs.dance === 'Pete' && ['str','agi','int','wil'].includes(k)) base = Math.floor(base * 1.1);
        if(reactiveGameState.combat.buffs.zombie === 'Green' && k === 'str') base = Math.floor(base * 1.2);
        if(reactiveGameState.combat.buffs.zombie === 'Hair' && k === 'str') base = Math.floor(base * 1.5);
        if(reactiveGameState.combat.buffs.zombie === 'Fly' && k === 'str') base = Math.floor(base * 2.0);
        if(reactiveGameState.combat.buffs.zombie === 'Purple' && k === 'str') base = Math.floor(base * 0.8);
        if(reactiveGameState.combat.buffs.zombie === 'White' && k === 'str') base = Math.floor(base * 0.9);
        if(reactiveGameState.combat.buffs.taoistAtk && k === 'str') base = Math.floor(base * (1 + reactiveGameState.combat.buffs.taoistAtk));
    }
    return base;
}

// character
// 取得當前精神狀態及其加成
export function getSanityState() {
    if (reactiveGameState.san >= 75) {
        return { 
            state: 'calm', 
            name: '🔵 冷靜', 
            desc: '專注力提升 (命中+20%, 閃避+10%, 防禦+10%)',
            buffs: { acc: 20, dodge: 10, defP: 0.1 } 
        };
    } else if (reactiveGameState.san < 30) {
        return { 
            state: 'madness', 
            name: '🔴 瘋狂', 
            desc: '腎上腺素爆發 (攻擊+30%, 暴擊+15%, 防禦-30%, 機率幻覺)',
            buffs: { atkPct: 0.3, crit: 15, defP: -0.3, hallucination: 0.15 } // 15%機率空過
        };
    } else {
        return { 
            state: 'normal', 
            name: '⚪ 正常', 
            desc: '精神狀態穩定',
            buffs: {} 
        };
    }
}

