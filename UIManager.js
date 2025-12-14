import * as Constant from './GameData.js';
import { reactiveGameState } from './GameMain.js';
import { getSanityState, getStat } from './Character.js';
import { getBagCapacity, getEquipVal, getItemValue, getItemValueLabel, getItemTypeTag} from './ItemSystem.js';
import { finishStory, getEventSuccessRate } from './StorySystem.js';
import { getDmgEst } from './CombatSystem.js';

// ==================== UI 與 輔助函數 ====================
// ui
export function renderCampActions() {
	// ★★★ 新增這兩行來隱藏敵人區域 ★★★
    // document.getElementById('enemy-area').style.display = 'none';
    // document.getElementById('enemy-area').innerHTML = ''; 
    Alpine.store('ui').showEnemy = false;
    Alpine.store('ui').showCampAction = true;
    // let html = `<div style="text-align:center; margin-bottom:10px; color:#fff">⛺ 營地 Day ${reactiveGameState.day}</div>`;
    // html += `<div class="btn-grid">`;
    // html += `<button onclick="exploreSetup()">🗺️ 外出探索<br><span style="font-size:0.8em;color:#aaa">精力-20</span></button>`;
    // html += `<button onclick="campAction('rest')">💤 休息<br><span style="font-size:0.8em;color:#aaa">食物-20</span></button>`;
    // html += `<button onclick="campAction('water')">💧 尋水<br><span style="font-size:0.8em;color:#aaa">精力-15</span></button>`;
    // html += `<button onclick="campAction('train')">🏋️ 訓練<br><span style="font-size:0.8em;color:#aaa">水-30</span></button>`;
    
    let cap = getBagCapacity();
    let count = reactiveGameState.bag.length;
    let bagColor = count >= cap ? '#f44' : '#aaa';
    Alpine.store('ui').bagCapacity = `(${count}/${cap})`;
    Alpine.store('ui').bagColor = bagColor;
    
    // html += `</div>`;
    // document.getElementById('action-area').innerHTML = html;
}

// ui
export function renderStoryModal(storyState, showingResult = false) {
    let maxSteps = storyState.type=='epic' ? 5 : 1;
    if(storyState.step >= maxSteps) { finishStory(); return; }
    let stepData = storyState.data.steps[storyState.step];
    if(!stepData) { finishStory(); return; }

    if (showingResult) {
        openModal(storyState.data.title, `<div class="story-text">${storyState.lastResult}</div>`, `<button onclick="nextStoryStep()">繼續</button>`);
        return;
    }

    let html = `<div class="story-text" style="${storyState.type=='epic'?'border-left:3px solid var(--r-legend)':'border-left:3px solid var(--r-rare)'}">
        <strong>${storyState.data.title} (${storyState.step+1}/${maxSteps})</strong><br><br>
        ${storyState.step===0 ? storyState.data.intro + '<br><br>' : ''}
        ${stepData.q}
        </div>
        
        <!-- 顯示當前屬性供參考 -->
        <div style="margin-bottom:10px; font-size:0.85em; color:#888; display:flex; gap:10px; justify-content:center;">
            <span>💪 ${getStat('s')}</span>
            <span>🦵 ${getStat('a')}</span>
            <span>🧠 ${getStat('i')}</span>
            <span>🛡️ ${getStat('w')}</span>
            <span>🍀 ${getStat('luck')}</span>
        </div>`;
    
    let shuffledOpts = [...stepData.opts].sort(() => 0.5 - Math.random());
    let btns = '';
    
    // 定義屬性圖標映射
    const STAT_ICON = { 's':'💪', 'a':'🦵', 'i':'🧠', 'w':'🛡️', 'luck':'🍀' };

    shuffledOpts.forEach(opt => {
        // 1. Boss 戰選項
        if (opt.boss) {
             btns += `<button class="opt-btn" style="border-left-color:#f44" onclick="storyChoose('${opt.type}', 'luck', true, '${opt.bossName}', ${opt.isQuest}, '${opt.strategy}')">
    <div style="font-weight:bold; color:#f44">💀 BOSS戰</div>
    <div>${opt.t}</div>
    <div style="font-size:0.75em; color:#ddd; margin-top:2px">成功率: ${getEventSuccessRate(opt.type, opt.stat)}%</div>
                        </button>`;
        } 
        // 2. 普通判定選項
        else {
             let statKey = opt.stat || 'luck';
             let icon = STAT_ICON[statKey] || '❓';
             let chance = getEventSuccessRate(opt.type, statKey);
             
             // 根據機率決定顏色
             let rateColor = chance >= 70 ? '#4f4' : (chance >= 40 ? '#fa0' : '#f44');
             let borderStyle = `border-left: 4px solid ${rateColor}`;

             btns += `<button class="opt-btn" style="${borderStyle}" onclick="storyChoose('${opt.type}', '${statKey}', false)">
                <div style="display:flex; justify-content:space-between; width:100%">
                    <span>${icon} ${opt.t}</span>
                    <span style="color:${rateColor}; font-weight:bold">${chance}%</span>
                </div>
                <div style="font-size:0.75em; color:#666; text-align:left; margin-top:2px">
                    檢定: ${Constant.STAT_MAP[statKey] || statKey}
                </div>
             </button>`;
        }
    });
    openModal(storyState.data.title, html, btns);
}

// ui
export function showStats() {
    let d = calcDerivedStats();
    let finalS = getStat('s'), finalA = getStat('a'), finalI = getStat('i'), finalW = getStat('w');
    
    // 計算面板攻擊力與防禦力
  // 修改：使用 getEquipVal
    let atkMelee = getEquipVal(reactiveGameState.eq.melee) + finalS;
    let atkRanged = getEquipVal(reactiveGameState.eq.ranged) + finalA;
    let totalDef = getEquipVal(reactiveGameState.eq.head) + getEquipVal(reactiveGameState.eq.body);

  let html = `<div style="text-align:left; padding:10px;">
        <h3 style="border-bottom:1px solid #444; padding-bottom:5px; margin-top:0">📊 角色屬性 (Lv.${reactiveGameState.level})</h3>
        
       <!-- 被動技能顯示區 -->
        <div class="comp-box" style="margin-bottom:15px; border-left:3px solid var(--skill-color); background:#1a1a1a">
            <div style="color:var(--skill-color); font-weight:bold">被動特質: ${reactiveGameState.job.trait}</div>
            <div style="font-size:0.9em; color:#ccc; margin-top:3px">${reactiveGameState.job.desc}</div>
            ${reactiveGameState.job.passive === 'pills' ? '<div style="font-size:0.8em;color:#666">(每回合機率觸發紅/藍藥丸)</div>' : ''}
        </div>

        <div class="comp-container">
            <!-- 基礎四維 (新增說明) -->
            <div class="comp-box">
                <div style="color:#f66">💪 力量: ${finalS} <span style="font-size:0.75em; color:#888; float:right; margin-top:2px">近戰攻擊 / 暴傷</span></div>
                <div style="color:#4f4">🦵 敏捷: ${finalA} <span style="font-size:0.75em; color:#888; float:right; margin-top:2px">遠程攻擊 / 閃避</span></div>
                <div style="color:#4cf">🧠 智力: ${finalI} <span style="font-size:0.75em; color:#888; float:right; margin-top:2px">暴擊率 / 探索</span></div>
                <div style="color:#f4f">🛡️ 意志: ${finalW} <span style="font-size:0.75em; color:#888; float:right; margin-top:2px">物理減傷 / 抗性</span></div>
            </div>
            
            <!-- 戰鬥數值 -->
            <div class="comp-box">
                <div>⚔️ 近戰攻擊: <strong>${atkMelee}</strong></div>
                <div>🔫 遠程攻擊: <strong>${atkRanged}</strong></div>
                <div>🛡️ 物理防禦: <strong>${totalDef}</strong> <span style="font-size:0.8em;color:#aaa">(-${d.dmgRed}%)</span></div>
                <hr style="border-color:#333; margin:4px 0">
                <div>💨 閃避率: <strong>${d.dodge}%</strong></div>
                <div>💥 暴擊率: <strong>${d.crit}%</strong> <span style="font-size:0.8em;color:#aaa">(傷${d.critDmg}%)</span></div>
            </div>
        </div>

        <div style="margin-top:10px; font-size:0.85em; color:#888">
            XP: <span style="color:var(--xp-color)">${reactiveGameState.xp}/20</span> | 道德: ${reactiveGameState.moral} | 幸運: ${getStat('luck')}
        </div>
    </div>`;
    openModal("詳細屬性", html, `<button onclick="closeModal()">關閉</button>`);
}

// ui
// 3. 播放受傷動畫
export function triggerShake() {
    let el = document.getElementById('enemy-area');
    if(el) {
        el.classList.remove('shaking');
        void el.offsetWidth; // trigger reflow
        el.classList.add('shaking');
        
        // 飄字效果
        let damage = reactiveGameState.lastDmg || 0;
        if (damage > 0) {
            // Get enemy position
             const rect = el.getBoundingClientRect();
            let popup = document.createElement('div');
            popup.className = 'dmg-popup';
            popup.innerHTML = `-${damage}`;
            if(reactiveGameState.lastCrit) popup.style.color = '#ff0';

            // Position at enemy center using fixed positioning
            popup.style.position = 'fixed';
            popup.style.left = (rect.left + rect.width / 2) + 'px';
            popup.style.top = (rect.top + rect.height / 2) + 'px';
            popup.style.transform = 'translate(-50%, -50%)';
            popup.style.zIndex = '10000';
            
            // // Add to BODY not enemy-area
            document.body.appendChild(popup);
            setTimeout(() => popup.remove(), 1000);
        }
    }
}

// ui
export function openCombatBag() {
    if(reactiveGameState.bag.length === 0) {
        openModal("背包", "背包是空的。", `<button onclick="closeModal()">關閉</button>`);
        return;
    }

    let html = `<div style="display:grid; gap:8px;">`;
    reactiveGameState.bag.forEach((item, idx) => {
        // 戰鬥中只過濾能用的 (藥品/投擲)，或者全部顯示但按鈕不同
        let isUsable = (item.type === 'med' || item.type === 'throwable');
        let effDesc = item.stats.eff ? ` (${item.stats.eff})` : '';
        let valDesc = item.type==='med' ? `HP+${item.stats.hp||0}` : `傷${item.val}`;
        
        // ★★★ 修改處：加入 Tag ★★★
        html += `<div style="background:#222; padding:8px; border:1px solid #444; display:flex; justify-content:space-between; align-items:center;">
            <div style="text-align:left">
                <div>${getItemTypeTag(item.type)} <span class="q${item.rarity}">${item.fullName}</span></div>
                <div style="font-size:0.8em; color:#888">${valDesc} ${effDesc}</div>
            </div>
            ${isUsable ? `<button onclick="useCombatItem(${idx})" style="width:auto; padding:4px 10px;">使用</button>` : `<span style="font-size:0.8em; color:#555; padding:0 10px">不可用</span>`}
        </div>`;
    });
    html += `</div>`;
    openModal("戰鬥背包 (選擇物品)", html, `<button onclick="closeModal()">取消</button>`);
}

// item
export function showLootModal(newItem, type, onCloseCallback) {
    reactiveGameState.tempLoot = { item: newItem, type: type, cb: onCloseCallback };
    
    // 計算回收價格
    let val = getItemValue(newItem);
    let sellPrice = Math.max(1, Math.floor(val * 0.3));

    // 戰鬥日誌顯示區
    let logHtml = '';
    if (reactiveGameState.lastCombatLog && reactiveGameState.lastCombatLog.length > 0) {
        let logs = reactiveGameState.lastCombatLog.map(l => `<div style="margin-bottom:3px;">${l}</div>`).join('');
        logHtml = `
        <div style="text-align:left; background:#000; padding:10px; border:1px dashed #444; border-radius:4px; margin-bottom:15px; font-size:0.85em; color:#ccc; max-height:120px; overflow-y:auto;">
            <div style="color:#666; font-size:0.8em; border-bottom:1px solid #333; margin-bottom:5px;">最後一擊回放:</div>
            ${logs}
            <div style="color:#ffd700; font-weight:bold; margin-top:8px; text-align:center;">🏆 戰鬥勝利！</div>
        </div>`;
        reactiveGameState.lastCombatLog = null; 
    }

    // === 判斷是否為消耗品或投擲物 ===
    if (type === 'med' || type === 'food' || type === 'water' || type === 'throwable') {
        let bagCap = getBagCapacity();
        let isFull = reactiveGameState.bag.length >= bagCap;
        let valInfo = '';
        
        if (type === 'med') {
            let parts = [];
            if(newItem.stats.hp) parts.push(`HP+${newItem.stats.hp}`);
            if(newItem.stats.san) parts.push(`SAN+${newItem.stats.san}`);
            valInfo = parts.join(' ');
        } else if (type === 'food') {
            valInfo = `飽食度 +${newItem.val}`;
        } else if (type === 'water') {
            valInfo = `水分 +${newItem.val}`;
        } else if (type === 'throwable') {
            valInfo = `造成傷害 ${newItem.val}`;
        }
        
        let html = `${logHtml} 
        <div class="comp-box">
            <div style="margin-bottom:5px">${getItemTypeTag(type)}</div>
            <div class="q${newItem.rarity}" style="font-size:1.2em; font-weight:bold">${newItem.fullName}</div>
            <div style="margin:5px 0">${valInfo}</div>
            <div style="font-size:0.8em;color:#aaa">${newItem.stats.desc || ''} ${newItem.stats.eff ? '('+newItem.stats.eff+')' : ''}</div>
            <hr style="border-color:#333; margin:5px 0">
            <div style="font-size:0.9em">背包容量: ${reactiveGameState.bag.length} / ${bagCap}</div>
        </div>`;
        
        // 投擲物不能直接使用，其他消耗品可以
        let canUse = (type !== 'throwable');
        let useBtn = canUse ? `<button onclick="useLootItemDirectly()" style="border-color:#4f4; color:#4f4">✨ 直接使用</button>` : '';

        let btns = `${useBtn}
                    <button onclick="takeItemToBag()">放入背包</button>
                    <button onclick="recycleLoot()" style="border-color:#ffd700; color:#ffd700">回收 (+$${sellPrice})</button>
                    <button onclick="discardLoot()">丟棄</button>`;
        
        if(isFull) {
            html += `<div style="color:#f44; margin-top:5px">背包已滿！放入需整理背包。</div>`;
            btns = `${useBtn}
                    <button onclick="showBagSwapUI()">整理背包</button>
                    <button onclick="recycleLoot()" style="border-color:#ffd700; color:#ffd700">回收 (+$${sellPrice})</button>
                    <button onclick="discardLoot()">丟棄</button>`;
        }
        
        openModal("發現物資", html, btns);
        return;
    }

    // === 裝備類比對邏輯 ===
    let curr = reactiveGameState.eq[type];
    let lbl = getItemValueLabel(type);
    let ammoText = newItem.ammo ? `<br><span style="color:#aaa;font-size:0.8em">附帶彈藥: ${newItem.ammo}</span>` : '';
    
    let newVal = getEquipVal(newItem);
    let currVal = getEquipVal(curr);
    let diff = newVal - currVal;
    
    let jobTag = newItem.isJobNative ? `<br><span style="color:var(--skill-color);font-size:0.8em">★ 職業專屬 (+10% 屬性)</span>` : "";

    let html = `${logHtml}
    <div class="comp-container">
        <div class="comp-box">
            <div style="color:#888;font-size:0.8em">當前裝備</div>
            <div style="margin:3px 0">${getItemTypeTag(type)}</div>
            <div class="q${curr.rarity}">${curr.fullName}</div>
            <div>${lbl}: ${currVal}</div>
            <div style="font-size:0.8em;color:#aaa">${JSON.stringify(curr.stats).replace(/[{"}]/g,'')}</div>
        </div>
        <div class="comp-box" style="border:1px solid var(--gain)">
            <div style="color:#4f4;font-size:0.8em">新發現</div>
            <div style="margin:3px 0">${getItemTypeTag(type)}</div>
            <div class="q${newItem.rarity}">${newItem.fullName}</div>
            <div>${lbl}: ${newVal} <span class="${diff >= 0 ? 'diff-up' : 'diff-down'}">(${diff>=0?'+':''}${diff})</span></div>
            <div style="font-size:0.8em;color:#aaa">${JSON.stringify(newItem.stats).replace(/[{"}]/g,'')}${ammoText}</div>
            ${jobTag}
        </div>
    </div>`;

    let btns = `<button onclick="equipLoot()">裝備並替換</button>
                <button onclick="takeItemToBag()">放入背包</button>
                <button onclick="recycleLoot()" style="border-color:#ffd700; color:#ffd700">回收 (+$${sellPrice})</button>
                <button onclick="discardLoot()">丟棄</button>`;
    
    if(reactiveGameState.bag.length >= getBagCapacity()) {
         btns = `<button onclick="equipLoot()">裝備 (舊物自動賣出)</button>
                 <button onclick="showBagSwapUI()">整理背包</button>
                 <button onclick="recycleLoot()" style="border-color:#ffd700; color:#ffd700">回收 (+$${sellPrice})</button>
                 <button onclick="discardLoot()">丟棄</button>`;
    }

    openModal("獲得戰利品", html, btns);
}

// item
// 新增：背包整理/替換 UI (當背包滿時)
export function showBagSwapUI() {
    let html = `<div>背包已滿，請選擇一個物品<span style="color:#f44">丟棄</span>以騰出空間，或直接丟棄新物品。</div>
    <div style="display:grid; gap:5px; margin-top:10px; max-height:300px; overflow-y:auto;">`;
    
    reactiveGameState.bag.forEach((item, idx) => {
        html += `<div style="background:#222; padding:5px; border:1px solid #444; display:flex; justify-content:space-between; align-items:center;">
            <span>${item.fullName}</span>
            <button onclick="discardBagItem(${idx})" style="padding:2px 8px; width:auto; font-size:0.8em; background:#522;">丟棄此物</button>
        </div>`;
    });
    html += `</div>`;
    
    // 顯示新物品
    html += `<div style="margin-top:10px; border-top:1px solid #666; padding-top:5px;">
        待拾取：<strong class="q${reactiveGameState.tempLoot.item.rarity}">${reactiveGameState.tempLoot.item.fullName}</strong>
    </div>`;

    openModal("整理背包", html, `<button onclick="discardLoot()">放棄新物品</button>`);
}

// item
export function showItemDetail(type) {
    let i = reactiveGameState.eq[type];
    
    // 如果該部位未裝備，直接返回或提示
    if (!i || i.name === '無') {
        openModal("未裝備", "該部位目前沒有裝備。", `<button onclick="closeModal()">關閉</button>`);
        return;
    }

    let lbl = getItemValueLabel(type);
    let jobTag = i.isJobNative ? `<span style="color:var(--skill-color);font-weight:bold;font-size:0.8em;border:1px solid var(--skill-color);padding:0 4px;border-radius:3px;margin-left:5px">★ 職業專屬</span>` : "";
    
    // 1. 處理基礎屬性 (Stats) 中文化與格式化
    let statsArr = [];
    if (i.stats) {
        for (let k in i.stats) {
            // 跳過 'desc'，因為我們要另外顯示
            if (k === 'desc') continue;
            
            let val = i.stats[k];
            // 將代碼轉為中文 (STAT_MAP 已經定義了大部分)
            let name = Constant.STAT_MAP[k] || k;
            
            // 特殊處理百分比數值 (如 defP, dodge)
            if (['defP', 'dodge', 'crit', 'loot'].includes(k) || (val < 1 && val > -1)) {
                // 如果是小數點 (如 0.1)，轉為 10%
                if (val < 1 && val > -1) val = Math.floor(val * 100);
                statsArr.push(`${name} +${val}%`);
            } else {
                statsArr.push(`${name} ${val > 0 ? '+' : ''}${val}`);
            }
        }
    }
    let statsHtml = statsArr.length > 0 ? `<div style="color:#aaa; margin-top:5px;">${statsArr.join(' | ')}</div>` : "";

    // 2. 處理特效 (FX)
    let fxHtml = "";
    if (i.fx) {
        fxHtml = `<div style="margin-top:8px; padding:5px; background:#222; border-left:3px solid #b5f; font-size:0.9em;">
            <strong style="color:#d0f">特效：</strong> ${i.fx.desc}
        </div>`;
    }

    // 3. 處理描述 (Desc)
    let descText = i.stats && i.stats.desc ? i.stats.desc : (i.desc || "");
    let descHtml = descText ? `<div style="margin-top:10px; font-style:italic; color:#666; font-size:0.85em;">"${descText}"</div>` : "";

    // 4. 組合最終 HTML
    let html = `
        <div style="text-align:left;">
            <div style="font-size:0.9em; color:#888; margin-bottom:5px;">Tier ${i.tier} ${jobTag}</div>
            <div style="font-size:1.1em;">${lbl}: <strong style="color:#fff">${getEquipVal(i)}</strong> ${i.isJobNative?'<span style="color:#4f4">(+10%)</span>':''}</div>
            ${statsHtml}
            ${fxHtml}
            ${descHtml}
        </div>
    `;
    
    openModal(i.fullName, html, `<button onclick="closeModal()">關閉</button>`);
}

// ui
export function showPlotDialog(day, callback) {
    let text = Constant.MAIN_PLOT[day] || "......";
    reactiveGameState.dialogCallback = callback;
    let modal = {
        title: `📜 主線劇情 (Day ${day})`,
        content: text,
        class: "story-text main-story-text",
        buttonAction: closePlotDialog,
        buttonText: "繼續",
    }
    openModal(modal);
}

// ui
export function closePlotDialog() { 
    closeModal();
    if(reactiveGameState.dialogCallback) {
        reactiveGameState.dialogCallback(); 
    }
}

// ui
export function openModal(modal) {
    Alpine.store('ui').showGameScreen = modal.showGameScreen;
    Alpine.store('dialog').title = modal.title;
    Alpine.store('dialog').content = modal.content;
    Alpine.store('dialog').class = modal.class? modal.class: "";
    Alpine.store('dialog').style = modal.style? modal.style: "";
    Alpine.store('dialog').buttonAction = modal.buttonAction? modal.buttonAction: closeModal;
    Alpine.store('dialog').buttonText = modal.buttonText? modal.buttonText: "關閉";
    Alpine.store('ui').showModal = true;
}

// ui
export function closeModal() { 
    Alpine.store('ui').showModal = false;
    Alpine.store('ui').showGameScreen = true;
}

// ui
export function updateUI() {
    Alpine.store('data').sanState={};
    Alpine.store('data').sanState.text = reactiveGameState.san;
    let sanStates = getSanityState();
    if(sanStates.state === 'calm') {
        Alpine.store('data').sanState.text = `${reactiveGameState.san} (冷靜)`;
        Alpine.store('data').sanState.color = '#4f4';
    } else if (ss.state === 'madness') {
        Alpine.store('data').sanState.text = `${reactiveGameState.san} (瘋狂)`;
        Alpine.store('data').sanState.color = '#f44';
    } else {
        Alpine.store('data').sanState.color = '#55aaff';
    }
}

// ui
// 4. 渲染商店介面
export function renderShopModal() {
    let title = reactiveGameState.shop.isBlackMarket ? "🌑 地下黑市 (Tier +1)" : "⛺ 營地商店";
    let refreshCost = reactiveGameState.shop.isBlackMarket ? 500 : 100;
    let titleColor = reactiveGameState.shop.isBlackMarket ? "#a3f" : "#fff";

    let html = `<div style="text-align:center; margin-bottom:10px; color:${titleColor}">
        每天2%機率遭遇黑市。每週免費刷新。<br>當前金錢: <strong style="color:#ffd700">${reactiveGameState.money}</strong>
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">`;

    reactiveGameState.shop.items.forEach((slot, idx) => {
        if(slot.bought) {
            html += `<div class="comp-box" style="opacity:0.5; display:flex; align-items:center; justify-content:center;">已售出</div>`;
        } else {
            let item = slot.item;
            html += `<div class="comp-box" onclick="buyShopItem(${idx})" style="cursor:pointer; border-color:${reactiveGameState.money >= slot.price ? '#fa0' : '#444'}">
                <div style="margin-bottom:2px">${getItemTypeTag(item.type)}</div>
                <div class="q${item.rarity}" style="font-weight:bold">${item.fullName}</div>
                <div style="font-size:0.8em; color:#ccc">${getItemValueLabel(item.type)}: ${getEquipVal(item)}</div>
                <div style="margin-top:5px; color:${reactiveGameState.money >= slot.price ? '#ffd700' : '#f44'}">$${slot.price}</div>
            </div>`;
        }

    });
    html += `</div>`;
    
	// === 修改處：新增【背包出售區】 ===
    if (reactiveGameState.bag.length > 0) {
        html += `<div style="font-size:0.9em; color:#aaa; margin:15px 0 5px 0; border-top:1px solid #333; padding-top:10px;">💰 出售背包物品 (30%價格)</div>`;
        html += `<div style="display:grid; grid-template-columns: 1fr; gap:5px; max-height:150px; overflow-y:auto;">`;
        
        reactiveGameState.bag.forEach((item, idx) => {
            let val = getItemValue(item);
            let sellPrice = Math.max(1, Math.floor(val * 0.3));
            
            html += `<div style="background:#1a1a1a; padding:5px 10px; border:1px solid #333; display:flex; justify-content:space-between; align-items:center;">
                <span class="q${item.rarity}" style="font-size:0.9em">${item.fullName}</span>
                <button onclick="sellBagItem(${idx})" style="width:auto; padding:2px 8px; border-color:#ffd700; color:#ffd700; font-size:0.8em;">賣出 +$${sellPrice}</button>
            </div>`;
        });
        html += `</div>`;
    } else {
        html += `<div style="margin-top:15px; border-top:1px solid #333; padding-top:10px; color:#666; font-size:0.8em; text-align:center;">背包為空，無法出售。</div>`;
    }

    let btns = `<button onclick="manualRefreshShop()" style="border-color:#fa0">🔄 刷新商品 (-$${refreshCost})</button>
                <button onclick="closeModal()">離開</button>`;
    
    openModal(title, html, btns);
}

// ui
export function hideGameContainer(){
    document.getElementById('game-container').style.display = 'none';
}

// ui
export function showGameContainer(){
    document.getElementById('game-container').style.display = 'flex';
}

// ui
export function collapseStat(){
    const statBar = document.getElementById('stat-bar');
    const statBtn = document.getElementById('stat-btn');
    statBar.classList.toggle('collapsed');
    if (statBar.classList.contains('collapsed')) {
        statBtn.textContent = '▶️ 現在資訊';
    } else {
        statBtn.textContent = '🔽 現在資訊';
    }
}

// ui
export function collapseEquip(){
    const equipContainer = document.getElementById('equip-container');
    const equipBtn = document.getElementById('equip-btn');
    equipContainer.classList.toggle('collapsed');

    if (equipContainer.classList.contains('collapsed')) {
        equipBtn.textContent = '▶️ 裝備';
    } else {
        equipBtn.textContent = '🔽 裝備';
    }
}

// combat
// ==================== 極度昇華版 renderCombat ====================
export function renderCombat() {
    let c = reactiveGameState.combat;
    if (!c) return; // 防呆

    // === 1. 渲染敵人區域 (上方) ===
    // let eArea = document.getElementById('enemy-area');
    // eArea.style.display = 'block';
    Alpine.store('ui').showEnemy = true;
    Alpine.store('enemy').status = c;
    Alpine.store('enemy').name = c.isBoss ? '👑 ' : '';
    Alpine.store('enemy').name += c.n;

// --- 修改開始：計算基礎值與當前值，並生成差異顯示 ---
    
    // --- 修改：讀取固定防禦力 ---
    // 1. 防禦力 (Base: c.def)
    let baseDef = c.def || 0; // 讀取 reactiveGameState.combat.def
    let curDef = baseDef;
    if(c.buffs.defDown) curDef = Math.floor(curDef * 0.5);
    if(c.buffs.defUp) curDef = Math.floor(curDef * 1.5);
    let defHtml = getStatDiffHtml(baseDef, curDef);

    Alpine.store('enemy').def = getStatDiffHtml(baseDef, curDef);

    // 2. 閃避率 (Base: c.dodge)
    let baseDodge = c.dodge || 0;
    let curDodge = baseDodge;
    if(c.buffs.dodgeUp) curDodge += 30;
    if(c.isStunned || c.buffs.sleep || c.buffs.stun || c.buffs.root) curDodge = 0; // 暈眩/定身時閃避歸零
    let dodgeHtml = getStatDiffHtml(baseDodge, curDodge, '%');
    Alpine.store('enemy').dodge = getStatDiffHtml(baseDodge, curDodge, '%');
    
    // 3. 攻擊力 (Base: c.atk)
    // 註：c.atk 可能已被永久成長技能修改，這裡的 Base 指的是「本回合計算 Buff 前的面板」
    let baseAtk = c.atk;
    let curAtk = baseAtk;
    if(c.buffs.atkDown) curAtk = Math.floor(curAtk * 0.7);
    if(c.buffs.atkUp) curAtk = Math.floor(curAtk * 1.2); 
    let atkHtml = getStatDiffHtml(baseAtk, curAtk);
    Alpine.store('enemy').atk = getStatDiffHtml(baseAtk, curAtk);

    // --- 修改結束 ---

    // 敵人 Buff 列表 (視覺化)
    let enemyBuffs = [];
    // if(c.enemyShield > 0) enemyBuffs.push(`<span class="buff-badge" style="color:#fa0;border-color:#fa0">🛡️ ${c.enemyShield}</span>`);
    // if(c.buffs.defUp) enemyBuffs.push(`<span class="buff-badge" style="color:#aaa">🛡️UP</span>`);
    // if(c.buffs.atkUp) enemyBuffs.push(`<span class="buff-badge" style="color:#f44">⚔️UP</span>`);
    // if(c.buffs.bleed) enemyBuffs.push(`<span class="buff-badge" style="color:#f44">🩸${c.buffs.bleed}</span>`);
    // if(c.buffs.burn) enemyBuffs.push(`<span class="buff-badge" style="color:#f60">🔥${c.buffs.burn}</span>`);
    // if(c.buffs.stun) enemyBuffs.push(`<span class="buff-badge" style="color:#ff0;border-color:#ff0">⚡暈眩</span>`);
    // if(c.buffs.sleep) enemyBuffs.push(`<span class="buff-badge" style="color:#88f;border-color:#88f">💤睡眠</span>`);
    // if(c.buffs.defDown) enemyBuffs.push(`<span class="buff-badge" style="color:#f44">💔破甲</span>`);
    if(c.enemyShield > 0) enemyBuffs.push(`🛡️${c.enemyShield}`);
    if(c.buffs.defUp) enemyBuffs.push(`🛡️UP`);
    if(c.buffs.atkUp) enemyBuffs.push(`⚔️UP`);
    if(c.buffs.bleed) enemyBuffs.push(`🩸${c.buffs.bleed}`);
    if(c.buffs.burn) enemyBuffs.push(`🔥${c.buffs.burn}`);
    if(c.buffs.stun) enemyBuffs.push(`⚡暈眩`);
    if(c.buffs.sleep) enemyBuffs.push(`💤睡眠`);
    if(c.buffs.defDown) enemyBuffs.push(`💔破甲`);
    if(enemyBuffs.length == 0){
        enemyBuffs.push("無狀態");
    }
    Alpine.store('enemy').buffs = enemyBuffs;


    // 敵人技能顯示
    let skillHtml = '';
    // if(c.sks && c.sks.length > 0) {
    //     let skillsList = c.sks.map(s => `<span class="skill-tag" style="font-size:0.75em">${s.n}</span>`).join('');
    //     let cdText = c.enemySkillCD > 0 ? `<span style="color:#666">CD: ${c.enemySkillCD}</span>` : `<span class="cd-alert">⚠️準備就緒</span>`;
    //     skillHtml = `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px; border-top:1px dashed #333; padding-top:3px">
    //         <div>${skillsList}</div>
    //         <div style="font-size:0.8em">${cdText}</div>
    //     </div>`;
    // }

    let hpPercent = Math.max(0, Math.min(100, (c.hp / c.maxHp) * 100));
    Alpine.store('enemy').hpPercent = hpPercent + "%";

    let avatar = getEnemyAvatar(c.n);
    Alpine.store('enemy').avatar = avatar;
    // eArea.innerHTML = `
    //  <div class="enemy-visual"><div class="enemy-avatar">${avatar}</div></div>
    // <div class="enemy-hud">
    //     <div class="hud-row">
    //         <span style="font-size:1.2em; font-weight:bold; color:#f66; text-shadow:0 0 5px #500">${c.isBoss ? '👑 ' : ''}${c.n}</span>
    //         <span style="font-family:'Consolas'; color:#fff">${c.hp} <span style="color:#666">/ ${c.maxHp}</span></span>
    //     </div>
    //     <div class="hp-bar-container"><div class="hp-bar-fill" style="width: ${hpPercent}%"></div></div>
        
    //     <!-- 更新後的數值面板 -->
    //     <div class="stat-grid-compact" style="background:rgba(0,0,0,0.5); margin-top:5px;">
    //         <div>⚔️ ${atkHtml}</div>
    //         <div>🛡️ ${defHtml}</div>
    //         <div>💨 ${dodgeHtml}</div>
    //     </div>
        
    //     <div class="buff-row">${enemyBuffs.length ? enemyBuffs.join('') : '<span style="color:#444;font-size:0.8em">無狀態</span>'}</div>
    //     ${skillHtml}
    // </div>`;

   // === 2. 渲染玩家與操作區域 (下方) ===
    
    // 安全讀取 Debuffs (先定義這個，因為按鈕狀態需要用到)
    let safeDebuffs = c.playerDebuffs || {};
    let isSilenced = safeDebuffs.silence > 0;

    // ★★★ 新增：判斷使用新系統還是舊系統 ★★★
    let skillBtnHtml = "";
    
    if (reactiveGameState.job.skill_tree) {
        // --- 新系統：顯示「技能選單」按鈕 ---
        let cdCount = 0;
        let skillStatus = "";
        if (reactiveGameState.combat.skillCDs) {
            for (let k in reactiveGameState.combat.skillCDs) {
                if (reactiveGameState.combat.skillCDs[k] > 0){
                    cdCount++;
                    skillStatus += "⚫";
                }else{
                    skillStatus += "🟢";
                }
            }
        }
        
        Alpine.store('player').skillText =`⚡ 技能 (${reactiveGameState.unlockedSkills.length})`;
        Alpine.store('player').isSilenced = isSilenced;
        if (isSilenced){
            Alpine.store('player').skillStatus = `⛔沉默(${safeDebuffs.silence})`;
        }
        else{
            Alpine.store('player').skillStatus = skillStatus;
        }
        Alpine.store('player').skillAction = openSkillMenu;


        // let btnText = `<div style="font-weight:bold">⚡ 技能 (${reactiveGameState.unlockedSkills.length})</div>`;
        
        // if (isSilenced) {
        //     btnText += `<div style="font-size:0.75em;color:#d0f">⛔沉默(${safeDebuffs.silence})</div>`;
        // } else if (cdCount > 0) {
        //     btnText += `<div style="font-size:0.75em;color:#fa0">${cdCount}招冷卻中</div>`;
        // } else {
        //     btnText += `<div style="font-size:0.75em;color:#4f4">就緒</div>`;
        // }
        
        // skillBtnHtml = `<button onclick="openSkillMenu()" ${isSilenced?'disabled':''}>${btnText}</button>`;
        
    } else {
        // --- 舊系統：保留原有邏輯 (兼容舊職業) ---
        let skillData = Constant.SKILLS[reactiveGameState.job.sk];
        if(!skillData) skillData = {n:'無技能', desc:'', cd:99};
        
        Alpine.store('player').skillText =skillData.n;
        Alpine.store('player').isSilenced = isSilenced;
        if (isSilenced){
            Alpine.store('player').skillStatus = `⛔沉默(${safeDebuffs.silence})`;
        }
        else{
            if(reactiveGameState.activeSkillCD > 0){
                Alpine.store('player').skillStatus = "⚫";
            }else{
                Alpine.store('player').skillStatus = "🟢";
            }
        }
        Alpine.store('player').skillAction = combatRound('skill');


        // let btnLabel = `<div style="font-weight:bold">${skillData.n}</div>`;
        // if(isSilenced) btnLabel += `<div style="font-size:0.75em;color:#d0f">⛔沉默(${safeDebuffs.silence})</div>`;
        // else if(reactiveGameState.activeSkillCD > 0) btnLabel += `<div style="font-size:0.75em;color:#f44">CD:${reactiveGameState.activeSkillCD}</div>`;
        // else btnLabel += `<div style="font-size:0.75em;color:#4f4">就緒</div>`;
        
        // skillBtnHtml = `<button title="${skillData.desc}" onclick="combatRound('skill')" ${(reactiveGameState.activeSkillCD>0 || isSilenced)?'disabled':''}>${btnLabel}</button>`;
    }
    // ==========================================

    let pStun = safeDebuffs.stun > 0;
    
    let pStatus = [];
    if(pStun) pStatus.push({color:'#fa0', text:`⚡暈眩(${safeDebuffs.stun})`});
    if(c.playerShield > 0) pStatus.push({color:'#4f4', text:`🛡️盾(${c.playerShield})`});

    Alpine.store('player').playerStatus = pStatus;
    // if(pStun) pStatus.push(`<span class="buff-badge" style="color:#fa0;border-color:#fa0">⚡暈眩(${safeDebuffs.stun})</span>`);
    // if(c.playerShield > 0) pStatus.push(`<span class="buff-badge" style="color:#4f4;border-color:#4f4">🛡️盾${c.playerShield}</span>`);
    // --- ★★★ 新增：玩家血條計算 ★★★ ---
    let playerHpPercent = Math.max(0, Math.min(100, (reactiveGameState.hp / reactiveGameState.maxHp) * 100));
    // 使用綠色漸變代表玩家 (區別於敵人的紅色)
    Alpine.store('player').hpPercent = playerHpPercent + "%";
    // 如果血量低於 30%，變成黃色/橘色警示
    // let playerBarColor = 'linear-gradient(90deg, #4f4, #0a0)'; 
    // if(playerHpPercent < 30) playerBarColor = 'linear-gradient(90deg, #fa0, #a50)';
    // if(playerHpPercent < 15) playerBarColor = 'linear-gradient(90deg, #f44, #a00)'; // 瀕死變紅
    let playerBarColor = '(90deg, #4f4, #0a0)'; 
    if(playerHpPercent < 30) playerBarColor = '(90deg, #fa0, #a50)';
    if(playerHpPercent < 15) playerBarColor = '(90deg, #f44, #a00)'; // 瀕死變紅

    Alpine.store('player').hpColor = playerBarColor;
    Alpine.store('player').melee = getEquipVal(reactiveGameState.eq.melee) + getStat('str');
    Alpine.store('player').ranged = getEquipVal(reactiveGameState.eq.ranged) + getStat('agi');
    Alpine.store('player').hpText = `${Math.floor(reactiveGameState.hp)} / ${Math.floor(reactiveGameState.maxHp)}`;

    // 構建玩家面板 HTML
    // let statsBar = `<div style="background:#161616; padding:10px; border-radius:4px; border:1px solid #333; margin-bottom:10px;">
        
    //     <!-- 名字與狀態 -->
    //     <div style="font-size:0.95em; color:#fff; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center;">
    //         <span style="font-weight:bold">👤 ${reactiveGameState.job.n} (Lv.${reactiveGameState.level})</span>
    //         <span style="font-size:0.9em">${pStatus.join(' ')}</span>
    //     </div>

    //     <!-- ★★★ 新增：玩家血條區域 ★★★ -->
    //     <div style="margin-bottom:8px;">
    //         <div style="display:flex; justify-content:space-between; font-size:0.8em; color:#ccc; margin-bottom:2px;">
    //             <span>HP</span>
    //             <span>${Math.floor(reactiveGameState.hp)} / ${Math.floor(reactiveGameState.maxHp)}</span>
    //         </div>
    //         <div class="hp-bar-container">
    //             <div class="hp-bar-fill" style="width: ${playerHpPercent}%; background: ${playerBarColor};"></div>
    //         </div>
    //     </div>
    //     <!-- ★★★ 結束 ★★★ -->
        
    //     <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:8px; font-size:0.85em; text-align:center;">
    //         <div style="background:#222; padding:3px; border-radius:3px;">近戰: ${getEquipVal(reactiveGameState.eq.melee) + getStat('s')}</div>
    //         <div style="background:#222; padding:3px; border-radius:3px;">遠程: ${getEquipVal(reactiveGameState.eq.ranged) + getStat('a')}</div>
    //     </div>
    // </div>`;

    let actionButtonsHtml = '';

    if (pStun) {
        Alpine.store('player').stuned = true;
        // actionButtonsHtml = `
        // <div class="combat-grid">
        //     <button class="combat-full-width" onclick="combatRound('skip')" style="border-color:#fa0; color:#fa0; height:100px; font-size:1.2em;">
        //         ⚡ 你被擊暈了！<br><span style="font-size:0.8em; color:#fff">(點擊跳過回合)</span>
        //     </button>
        // </div>`;
    } else {
        Alpine.store('player').stuned = false;
        // actionButtonsHtml = `
        // <div class="combat-grid">
        //     <button onclick="combatRound('melee')">⚔️ 近戰<br><small style="color:#888">預估: ${getDmgEst('melee')}</small></button>
        //     <button onclick="combatRound('ranged')" ${reactiveGameState.ammo>0?'':'disabled'}>🔫 射擊 (${reactiveGameState.ammo})<br><small style="color:#888">預估: ${getDmgEst('ranged')}</small></button>
            
        //     <!-- ★★★ 這裡插入剛剛生成的技能按鈕變數 ★★★ -->
        //     ${skillBtnHtml}
            
        //     <button onclick="combatRound('defend')" ${reactiveGameState.playerDefCD>0?'disabled':''} style="border-color:#55aaff">🛡️ 防禦 (CD:${reactiveGameState.playerDefCD})</button>
        //     <button class="combat-full-width" onclick="openCombatBag()" ${c.usedItem?'disabled style="opacity:0.5"':''}>🎒 戰鬥物品 (${reactiveGameState.bag.length})</button>
        //     <button class="combat-full-width" onclick="combatRound('flee')">🏃 逃跑</button>
        // </div>`;
    }

    // document.getElementById('action-area').innerHTML = statsBar + actionButtonsHtml;
    updateUI();
}

// combat
// ==================== 修正後的戰鬥渲染 (修復變數未定義錯誤) ====================
// === 戰鬥視覺輔助函數 ===
// 1. 根據怪物名稱獲取頭像 Emoji
export function getEnemyAvatar(name) {
    if(name.includes('狗') || name.includes('犬')) return '🐕';
    if(name.includes('貓')) return '🐈';
    if(name.includes('鼠')) return '🐀';
    if(name.includes('蟲') || name.includes('蟑螂')) return '🪳';
    if(name.includes('喪屍') || name.includes('屍') || name.includes('感染')) return '🧟';
    if(name.includes('機械') || name.includes('砲台') || name.includes('無人機')) return '🤖';
    if(name.includes('醫生') || name.includes('護士')) return '👨‍⚕️';
    if(name.includes('警') || name.includes('SWAT')) return '👮';
    if(name.includes('小丑')) return '🤡';
    if(name.includes('王') || name.includes('神') || name.includes('主')) return '👹';
    if(name.includes('幽靈') || name.includes('影')) return '👻';
    if(name.includes('豬')) return '🐗';
    if(name.includes('熊')) return '🐻';
    return '💀'; // 默認
}

// ui
//使敵人受到的debuff顯示得更清晰//
export function getStatDiffHtml(base, current, unit='') {
    let diff = current - base;
    let text = current + unit;
    if(diff > 0){
        text += "🔺";
    }else if(diff < 0){
        text += "🔻";
    }

    return text;
    // let color = '#ccc'; // 預設灰色 (無變化)
    
    // // 數值變大 (綠色)，數值變小 (紅色)
    // // 註：對於敵人來說，攻擊力變高其實對玩家是壞事，但為了UI統一，通常「數值上升=綠/金」，「數值下降=紅」比較直觀
    // if(diff > 0) color = '#4f4'; // Buff (Green)
    // if(diff < 0) color = '#f44'; // Debuff (Red)

    // let html = `<span style="color:${color}">${current}${unit}</span>`;
    
    // // 如果有差異，顯示括號內的數值
    // if(diff !== 0) {
    //     let sign = diff > 0 ? '+' : '';
    //     html += ` <span style="font-size:0.75em; color:${color}; margin-left:2px;">(${sign}${diff})</span>`;
    // }
    // return html;
}

// ui
export function showBossLootWindow(lootList, callback) {
    // 構建 HTML
    let html = `<div style="text-align:left; max-height:60vh; overflow-y:auto;">
        <div style="text-align:center; color:#ffd700; margin-bottom:10px; font-size:1.2em; font-weight:bold;">
            ✨ Boss 擊殺獎勵 ✨
        </div>
        <div style="display:grid; gap:8px;">`;

    lootList.forEach((item, idx) => {
        let tag = item.type === 'money' ? '💰' : getItemTypeTag(item.type);
        let valInfo = item.type === 'money' ? '' : `${getItemValueLabel(item.type)}: ${getEquipVal(item)}`;
        let bg = item.rarity === 3 ? 'background:linear-gradient(90deg, #310, #520)' : 'background:#222';
        
        // 物品按鈕
        html += `<div id="loot-row-${idx}" style="${bg}; padding:8px; border:1px solid #444; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div class="q${item.rarity}" style="font-weight:bold; font-size:0.95em;">${tag} ${item.fullName}</div>
                <div style="font-size:0.8em; color:#aaa;">${valInfo} ${item.stats && item.stats.desc ? item.stats.desc : ''}</div>
                ${item.fx ? `<div style="font-size:0.75em; color:#d0f;">特效: ${item.fx.desc}</div>` : ''}
            </div>
            ${item.type !== 'money' 
                ? `<button onclick="pickUpBossLoot(${idx})" style="width:auto; padding:4px 10px; font-size:0.8em;">拾取</button>`
                : `<span style="color:#ffd700; font-size:0.8em;">已自動拾取</span>`
            }
        </div>`;
    });

    html += `</div></div>`;
    
    // 將 lootList 存入全局變數以便拾取函數使用
    window.currentBossLoot = lootList;
    window.bossLootCallback = callback;

    openModal("戰利品", html, `<button onclick="closeBossLoot()">離開 (丟棄剩餘)</button>`);
    
    // 自動拾取金錢
    lootList.forEach(item => {
        if(item.type === 'money') reactiveGameState.money += item.val;
    });
    updateUI();
}

// ui
export function closeBossLoot() {
    closeModal();
    if(window.bossLootCallback) window.bossLootCallback();
}

// ui
// === 新技能系統核心 ===
export function openSkillMenu() {
    if (!reactiveGameState.combat.skillCDs) reactiveGameState.combat.skillCDs = {};
    
    let html = `<div style="display:grid; gap:8px; max-height:60vh; overflow-y:auto;">`;
    
reactiveGameState.unlockedSkills.forEach(sid => {
        // --- 修改開始：加入保底資料，防止技能消失 ---
        let s = SKILL_DB[sid];
        if (!s) {
            // 如果資料庫找不到這招，手動生成一個「未知技能」物件，而不是 return 跳過
            s = { 
                n: `未知技能 (${sid})`, 
                desc: "資料庫中找不到此技能定義，請檢查 SKILL_DB.json", 
                cost: {}, 
                cd: 0 
            };
        }
        // --- 修改結束 ---
        
        let cd = reactiveGameState.combat.skillCDs[sid] || 0;
        let costText = [];
        let canAfford = true;
        
        // 計算消耗顯示
        if (s.cost) {
            if (s.cost.hp) { 
                costText.push(`<span style="color:#f44">HP-${s.cost.hp}</span>`);
                if (reactiveGameState.hp <= s.cost.hp) canAfford = false;
            }
            if (s.cost.san) {
                costText.push(`<span style="color:#88f">SAN-${s.cost.san}</span>`);
                if (reactiveGameState.san < s.cost.san) canAfford = false;
            }
            if (s.cost.food) {
                costText.push(`<span style="color:#fa0">飽-${s.cost.food}</span>`);
                if (reactiveGameState.food < s.cost.food) canAfford = false;
            }
            if (s.cost.money) {
                costText.push(`<span style="color:#ffd700">$${s.cost.money}</span>`);
                if (reactiveGameState.money < s.cost.money) canAfford = false;
            }
        }
        
        let btnStyle = `background:#222; border:1px solid #444; padding:10px; display:flex; justify-content:space-between; align-items:center; text-align:left;`;
        let statusHtml = '';
        let disabled = '';
        
        if (cd > 0) {
            statusHtml = `<span style="color:#f44; font-weight:bold;">CD: ${cd}</span>`;
            btnStyle = `background:#111; border:1px solid #333; opacity:0.6;`;
            disabled = 'disabled';
        } else if (!canAfford) {
            statusHtml = `<span style="color:#888;">消耗不足</span>`;
            btnStyle = `background:#111; border:1px solid #333; opacity:0.6;`;
            disabled = 'disabled';
        } else {
            statusHtml = `<span style="color:#4f4; font-weight:bold;">就緒</span>`;
            btnStyle += ` cursor:pointer; border-color:#fa0;`;
        }
        
        html += `<button onclick="performSkill('${sid}')" ${disabled} style="${btnStyle} width:100%;">
            <div>
                <div style="font-weight:bold; font-size:1.1em; color:#fff;">${s.n}</div>
                <div style="font-size:0.8em; color:#ccc; margin-top:2px;">${s.desc}</div>
                <div style="font-size:0.75em; margin-top:4px;">消耗: ${costText.join(' ') || '無'}</div>
            </div>
            <div>${statusHtml}</div>
        </button>`;
    });
    
    html += `</div>`;
    openModal("⚡ 選擇技能", html, `<button onclick="closeModal()">取消</button>`);
}