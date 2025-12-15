import * as Constant from './GameData.js';
import { reactiveGameState } from './GameMain.js';
import { getSanityState, getStat, calcDerivedStats } from './Character.js';
import { getBagCapacity, getEquipVal, getItemValue, getItemValueLabel, getItemTypeTag, recycleLoot, discardLoot, equipLoot, takeItemToBag} from './ItemSystem.js';
import { finishStory, getEventSuccessRate } from './StorySystem.js';
import { getDmgEst } from './CombatSystem.js';

// ==================== UI 與 輔助函數 ====================
// ui
export function renderCampActions() {
    let cap = getBagCapacity();
    let count = reactiveGameState.bag.length;
    let bagColor = count >= cap ? '#f44' : '#aaa';
    Alpine.store('ui').showEnemy = false;
    Alpine.store('ui').showAction = Constant.ACTION.camp;
    Alpine.store('ui').bagCapacity = `(${count}/${cap})`;
    Alpine.store('ui').bagColor = bagColor;
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
    let finalS = getStat('str'), finalA = getStat('agi'), finalI = getStat('int'), finalW = getStat('wil');
    
    // 計算面板攻擊力與防禦力
    // 修改：使用 getEquipVal
    let atkMelee = getEquipVal(reactiveGameState.eq.melee) + finalS;
    let atkRanged = getEquipVal(reactiveGameState.eq.ranged) + finalA;
    let totalDef = getEquipVal(reactiveGameState.eq.head) + getEquipVal(reactiveGameState.eq.body);

    // Alpine.store('ui').showModal = Constant.MODAL.stats;
    Alpine.store('stat').finalS = finalS;
    Alpine.store('stat').finalA = finalA;
    Alpine.store('stat').finalI = finalI;
    Alpine.store('stat').finalW = finalW;
    Alpine.store('stat').atkMelee = atkMelee;
    Alpine.store('stat').atkRanged = atkRanged;
    Alpine.store('stat').totalDef = totalDef;
    Alpine.store('stat').totalDef = totalDef;
    Alpine.store('stat').derived = d;
    Alpine.store('stat').luck = getStat('luck');

    let modal = {
        title: "詳細屬性",
        content: "",
        buttons:[{ 
            action: ()=>{
                // {Alpine.store('ui').showStats};
                closeModal([Alpine.store('ui').showStats]);
            }, 
            text:"關閉" ,
        }],
        layout: Constant.MODAL.stats,
    }

    // let html = `<div style="text-align:left; padding:10px;">
    //         <h3 style="border-bottom:1px solid #444; padding-bottom:5px; margin-top:0">📊 角色屬性 (Lv.${reactiveGameState.level})</h3>
            
    //     <!-- 被動技能顯示區 -->
    //         <div class="comp-box" style="margin-bottom:15px; border-left:3px solid var(--skill-color); background:#1a1a1a">
    //             <div style="color:var(--skill-color); font-weight:bold">被動特質: ${reactiveGameState.job.trait}</div>
    //             <div style="font-size:0.9em; color:#ccc; margin-top:3px">${reactiveGameState.job.desc}</div>
    //             ${reactiveGameState.job.passive === 'pills' ? '<div style="font-size:0.8em;color:#666">(每回合機率觸發紅/藍藥丸)</div>' : ''}
    //         </div>

    //         <div class="comp-container">
    //             <!-- 基礎四維 (新增說明) -->
    //             <div class="comp-box">
    //                 <div style="color:#f66">💪 力量: ${finalS} <span style="font-size:0.75em; color:#888; float:right; margin-top:2px">近戰攻擊 / 暴傷</span></div>
    //                 <div style="color:#4f4">🦵 敏捷: ${finalA} <span style="font-size:0.75em; color:#888; float:right; margin-top:2px">遠程攻擊 / 閃避</span></div>
    //                 <div style="color:#4cf">🧠 智力: ${finalI} <span style="font-size:0.75em; color:#888; float:right; margin-top:2px">暴擊率 / 探索</span></div>
    //                 <div style="color:#f4f">🛡️ 意志: ${finalW} <span style="font-size:0.75em; color:#888; float:right; margin-top:2px">物理減傷 / 抗性</span></div>
    //             </div>
                
    //             <!-- 戰鬥數值 -->
    //             <div class="comp-box">
    //                 <div>⚔️ 近戰攻擊: <strong>${atkMelee}</strong></div>
    //                 <div>🔫 遠程攻擊: <strong>${atkRanged}</strong></div>
    //                 <div>🛡️ 物理防禦: <strong>${totalDef}</strong> <span style="font-size:0.8em;color:#aaa">(-${d.dmgRed}%)</span></div>
    //                 <hr style="border-color:#333; margin:4px 0">
    //                 <div>💨 閃避率: <strong>${d.dodge}%</strong></div>
    //                 <div>💥 暴擊率: <strong>${d.crit}%</strong> <span style="font-size:0.8em;color:#aaa">(傷${d.critDmg}%)</span></div>
    //             </div>
    //         </div>

    //         <div style="margin-top:10px; font-size:0.85em; color:#888">
    //             XP: <span style="color:var(--xp-color)">${reactiveGameState.xp}/20</span> | 道德: ${reactiveGameState.moral} | 幸運: ${getStat('luck')}
    //         </div>
    //     </div>`;
    // openModal("詳細屬性", html, `<button onclick="closeModal()">關閉</button>`);
    openModal(modal);
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
    // Alpine.store('ui').showModal = 'loot';
    Alpine.store('loot').type = getItemTypeTag(type);
    Alpine.store('loot').newItem = newItem;

    // 計算回收價格
    let val = getItemValue(newItem);
    let sellPrice = Math.max(1, Math.floor(val * 0.3));

    let bagCap = getBagCapacity();
    let isFull = reactiveGameState.bag.length >= bagCap;
    let modalButtons;

    // === 判斷是否為消耗品或投擲物 ===
    if (type === 'med' || type === 'food' || type === 'water' || type === 'throwable') {
        Alpine.store('dialog').isEquip = false;

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
        
        Alpine.store('loot').valInfo = valInfo;
        Alpine.store('loot').newStat = `${newItem.stats.desc || ''} ${newItem.stats.eff ? '('+newItem.stats.eff+')' : ''}`;
        Alpine.store('loot').bagText = `背包容量: ${reactiveGameState.bag.length} / ${bagCap}`;
        
        // 投擲物不能直接使用，其他消耗品可以
        let canUse = (type !== 'throwable');

        let useButton = {
            action: useLootItemDirectly,
            text: "✨ 直接使用",
        };

        modalButtons = [
            {
                action: takeItemToBag,
                text: "放入背包",
            },
            {
                action: recycleLoot,
                text: `回收 (+$${sellPrice})`,
                color: '#ffd700',
            },
            {
                action: discardLoot,
                text: "丟棄",
            },
        ];

        if(canUse){
            modalButtons.unshift(useButton);
        }

        if(isFull){
            modalButtons = [
                {
                    action: showBagSwapUI,
                    text: "整理背包",
                },
                {
                    action: recycleLoot,
                    text: `回收 (+$${sellPrice})`,
                    color: '#ffd700',
                },
                {
                    action: discardLoot,
                    text: "丟棄",
                },
            ];
        }

        
        let modal ={
            showGameScreen: true,
            title: "發現物資",
            content: "",
            buttons: modalButtons,
            layout: Constant.MODAL.loot,
        }

        openModal(modal);
        return;
    }

    // === 裝備類比對邏輯 ===
    let curr = reactiveGameState.eq[type];
    let lbl = getItemValueLabel(type);
    let newVal = getEquipVal(newItem);
    let currVal = getEquipVal(curr);
    let diff = newVal - currVal;
    
    Alpine.store('loot').isEquip = true;
    Alpine.store('loot').newAmmo = newItem.ammo;
    Alpine.store('loot').isJobNative = newItem.isJobNative;
    Alpine.store('loot').label = lbl;
    Alpine.store('loot').currItem = curr;
    Alpine.store('loot').currVal = currVal;
    Alpine.store('loot').currStat = JSON.stringify(curr.stats).replace(/[{"}]/g,'');
    Alpine.store('loot').newVal = newVal;
    Alpine.store('loot').newStat = JSON.stringify(newItem.stats).replace(/[{"}]/g,'');
    Alpine.store('loot').diffText = `(${diff>=0?'+':''}${diff})`;
    Alpine.store('loot').diffClass = diff >= 0 ? 'diff-up' : 'diff-down';

    modalButtons = [
        {
            action: equipLoot,
            text: "裝備並替換",
        },
        {
            action: showBagSwapUI,
            text: "整理背包",
        },
        {
            action: recycleLoot,
            text: `回收 (+$${sellPrice})`,
            color: '#ffd700',
        },
        {
            action: discardLoot,
            text: "丟棄",
        },
    ];

    if(isFull) {
        modalButtons = [
            {
                action: equipLoot,
                text: "裝備 (舊物自動賣出)",
            },
            {
                action: takeItemToBag,
                text: "放入背包",
            },
            {
                action: recycleLoot,
                text: `回收 (+$${sellPrice})`,
                color: '#ffd700',
            },
            {
                action: discardLoot,
                text: "丟棄",
            },
        ]
    }

    let modal ={
        showGameScreen: true,
        title: "獲得戰利品",
        content: "",
        buttons: modalButtons,
        layout: Constant.MODAL.loot,
    }

    openModal(modal);
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
        buttons: [{
            action:closePlotDialog, 
            text: "繼續"
        }],
        layout: Constant.MODAL.story,
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
    Alpine.store('dialog').buttons = modal.buttons? modal.buttons: [{action: closeModal, text: "關閉"}];
    Alpine.store('ui').showModal = modal.layout;
}

// ui
export function closeModal() { 
    Alpine.store('ui').showModal = false;
    Alpine.store('ui').showGameScreen = true;
}

// ui
export function updateUI() {
    let sanStates = getSanityState();
    Alpine.store('data').sanState={};
    Alpine.store('data').sanState.text = reactiveGameState.san;
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
    Alpine.store('ui').showGameScreen = false;
}

// ui
export function showGameContainer(){
    Alpine.store('ui').showGameScreen = true;
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
    Alpine.store('ui').showEnemy = true;
    Alpine.store('ui').showAction = Constant.ACTION.combat;
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
    Alpine.store('enemy').def = getStatDiffHtml(baseDef, curDef);

    // 2. 閃避率 (Base: c.dodge)
    let baseDodge = c.dodge || 0;
    let curDodge = baseDodge;
    if(c.buffs.dodgeUp) curDodge += 30;
    if(c.isStunned || c.buffs.sleep || c.buffs.stun || c.buffs.root) curDodge = 0; // 暈眩/定身時閃避歸零
    Alpine.store('enemy').dodge = getStatDiffHtml(baseDodge, curDodge, '%');
    
    // 3. 攻擊力 (Base: c.atk)
    // 註：c.atk 可能已被永久成長技能修改，這裡的 Base 指的是「本回合計算 Buff 前的面板」
    let baseAtk = c.atk;
    let curAtk = baseAtk;
    if(c.buffs.atkDown) curAtk = Math.floor(curAtk * 0.7);
    if(c.buffs.atkUp) curAtk = Math.floor(curAtk * 1.2); 
    Alpine.store('enemy').atk = getStatDiffHtml(baseAtk, curAtk);

    // --- 修改結束 ---
    // 敵人 Buff 列表 (視覺化)
    let enemyBuffs = [];
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


    let hpPercent = Math.max(0, Math.min(100, (c.hp / c.maxHp) * 100));
    Alpine.store('enemy').hpPercent = hpPercent + "%";

    let avatar = getEnemyAvatar(c.n);
    Alpine.store('enemy').avatar = avatar;

    // === 2. 渲染玩家與操作區域 (下方) ===
    // 安全讀取 Debuffs (先定義這個，因為按鈕狀態需要用到)
    let safeDebuffs = c.playerDebuffs || {};
    let isSilenced = safeDebuffs.silence > 0;

    // ★★★ 新增：判斷使用新系統還是舊系統 ★★★    
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
        }else{
            skillStatus = "🟢";
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
    }

    let pStun = safeDebuffs.stun > 0;
    let pStatus = [];
    if(pStun) pStatus.push({color:'#fa0', text:`⚡暈眩(${safeDebuffs.stun})`});
    if(c.playerShield > 0) pStatus.push({color:'#4f4', text:`🛡️盾(${c.playerShield})`});

    Alpine.store('player').playerStatus = pStatus;
    // --- ★★★ 新增：玩家血條計算 ★★★ ---
    let playerHpPercent = Math.max(0, Math.min(100, (reactiveGameState.hp / reactiveGameState.maxHp) * 100));
    // 使用綠色漸變代表玩家 (區別於敵人的紅色)
    Alpine.store('player').hpPercent = playerHpPercent + "%";
    // 如果血量低於 30%，變成黃色/橘色警示
    let playerBarColor = '(90deg, #4f4, #0a0)'; 
    if(playerHpPercent < 30) playerBarColor = '(90deg, #fa0, #a50)';
    if(playerHpPercent < 15) playerBarColor = '(90deg, #f44, #a00)'; // 瀕死變紅

    Alpine.store('player').hpColor = playerBarColor;
    Alpine.store('player').melee = getEquipVal(reactiveGameState.eq.melee) + getStat('str');
    Alpine.store('player').ranged = getEquipVal(reactiveGameState.eq.ranged) + getStat('agi');
    Alpine.store('player').hpText = `${Math.floor(reactiveGameState.hp)} / ${Math.floor(reactiveGameState.maxHp)}`;

    if (pStun) {
        Alpine.store('player').stuned = true;
    } else {
        Alpine.store('player').stuned = false;
    }

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