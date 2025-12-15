import * as Constant from './GameData.js';
import { reactiveGameState, log} from './GameMain.js';
import { getStat, gainXp } from './Character.js';
import { triggerBossFight, triggerCombat } from './CombatSystem.js';
import { closeModal, openModal } from './UIManager.js';
import { checkWeeklyEvent } from './StorySystem.js';
import { updateUI, renderCampActions, showLootModal } from './UIManager.js';
import { getCurrentTier, createItem } from './ItemSystem.js';
import { triggerLocationEvent } from './StorySystem.js';

// camp
// ==================== 3. 營地與主循環 ====================
export function campPhase() {
    if(!reactiveGameState.alive) return;
    if(reactiveGameState.hp<=0) return gameOver("死於耗竭");
    if(reactiveGameState.day >= 197) return triggerBossFight("最終屍王"); 

    reactiveGameState.day++;
    reactiveGameState.playerDefCD = Math.max(0, reactiveGameState.playerDefCD - 1); // 防禦CD如果是回合制也可移走，這裡暫時保留或視需求改動
    
    // =========== ★★★ 請在這裡插入代碼 ★★★ ===========
    // === 新增：30天頓悟系統 ===
    // 檢查條件：有技能樹、天數大於0、且是30的倍數
    if (reactiveGameState.job.skill_tree && reactiveGameState.day > 0 && reactiveGameState.day % 30 === 18) {
        let skillIndex = Math.ceil(reactiveGameState.day / 30); 
        
        // 確保索引在範圍內
        if (skillIndex < reactiveGameState.job.skill_tree.length) {
            let newSkillId = reactiveGameState.job.skill_tree[skillIndex];
            
            // 避免重複添加 (如果存檔系統未來加入，這很重要)
            if (!reactiveGameState.unlockedSkills.includes(newSkillId)) {
                reactiveGameState.unlockedSkills.push(newSkillId);
                
                // 從 DB 獲取技能資料以顯示名稱
                // 注意：這裡需要確保 SKILL_DB 已被 import
                let sData = Constant.SKILL_DB[newSkillId] || { n: "未知技能", desc: "力量在體內湧動..." };
                
                // 使用 setTimeout 稍微延遲彈窗，確保 UI 刷新後才顯示
                setTimeout(() => {
                    openModal("✨ 頓悟時刻", 
                        `<div style="color:#ffd700; font-size:1.2em; margin-bottom:10px; font-weight:bold;">領悟新技能：${sData.n}</div>
                         <div style="color:#ccc; border-left:2px solid #ffd700; padding-left:10px; margin-bottom:10px;">${sData.desc}</div>
                         <div style="font-size:0.9em; color:#888;">(已自動加入戰鬥技能列表)</div>`, 
                        `<button onclick="closeModal()">豁然開朗</button>`
                    );
                }, 500); 
            }
        }
    }
    // =================================================

    if(reactiveGameState.job.trait==='抑鬱霸王') {
        let depressChance = 0.3 - ((reactiveGameState.moral - 50) * 0.005); // 50道德=30%, 100道德=5%
        reactiveGameState.flags.depression = (Math.random() < Math.max(0.05, depressChance));
        if(reactiveGameState.flags.depression) log('狀態', '你今天感到莫名的抑鬱', 'c-loss');
    }

    if(Constant.MAIN_PLOT[reactiveGameState.day]) {
        showPlotDialog(reactiveGameState.day, checkWeeklyEvent);
        return;
    }
    
    checkWeeklyEvent();
}

// camp
export function normalCampLogic() {
    let weather = [{n:'☀️ 晴朗',c:0},{n:'🌧️ 暴雨',c:1},{n:'🌫️ 濃霧',c:2}][Math.floor(Math.random()*3)];
    Alpine.store('ui').weather = weather.n;    
    
    let baseCost = 20;
    if(reactiveGameState.diff === 2) baseCost = 25;
    if(reactiveGameState.diff === 3) baseCost = 35;

    if(reactiveGameState.job.passive === 'dev_buff') baseCost = Math.floor(baseCost * 0.6);  // Kim 地產霸權

    reactiveGameState.food -= baseCost; 
    reactiveGameState.water -= baseCost;
    log('生存', `消耗食物 -${baseCost}, 水源 -${baseCost}`, 'c-loss');

    // === 天氣收益 (削弱) ===
    if(weather.c === 1) { 
        // 舊版: +30 / +15
        // 新版: +15 (正常) / +5 (噩夢 - 酸雨難以收集)
        // 這樣玩家不能單靠天氣活著，必須去尋水
        let waterGain = (reactiveGameState.diff === 3) ? 5 : 15;
        reactiveGameState.water += waterGain; 
        log('天氣', `收集雨水 +${waterGain}`, 'c-gain'); 
    }
    
    // === 飢渴懲罰 (致命化) ===
    if(reactiveGameState.food < 0 || reactiveGameState.water < 0) { 
        let starveDmg = (reactiveGameState.diff === 3) ? 50 : 20;
        reactiveGameState.hp -= starveDmg; 
        log('生存', `嚴重飢渴受傷 -${starveDmg}`, 'c-loss'); 
    }
    
    // === 自然回血 ===
    let heal = 5;
    if(reactiveGameState.mbti && 
        reactiveGameState.mbti.bonus && 
        reactiveGameState.mbti.bonus.heal) 
        heal += reactiveGameState.mbti.bonus.heal;
    if(reactiveGameState.job.trait==='護理') heal += 5;
    for(let k in reactiveGameState.eq) {
        if(reactiveGameState.eq[k]?.stats?.heal) {
            heal += reactiveGameState.eq[k].stats.heal;
        }
    }
    
    // 噩夢模式下，只有通過藥物或技能才能有效回血，自然回復極低
    if(reactiveGameState.diff === 3) heal = Math.floor(heal * 0.3);
    
    if(heal > 0) { 
        reactiveGameState.hp = Math.min(reactiveGameState.maxHp, reactiveGameState.hp+heal); 
    }
    
    updateUI();
    renderCampActions();
}

// camp
export function campAction(act) {
    if(act==='rest') {
        if(reactiveGameState.food<20) { log('提示','食物不足'); return; }
        
        // === 修改點：大幅提升休息效果 ===
        reactiveGameState.food -= 20; 
        // HP恢復改為：固定30 + 最大血量的20% (這樣血量越高回越多)
        let healAmt = 30 + Math.floor(reactiveGameState.maxHp * 0.2);
        reactiveGameState.hp = Math.min(reactiveGameState.maxHp, reactiveGameState.hp + healAmt); 
        reactiveGameState.san = Math.min(100, reactiveGameState.san + 25); // SAN值也多回一點
        
        log('休息',`體力恢復 (+${healAmt} HP)`,'c-gain');
    }  else if(act==='water') {
        let v = 20+Math.floor(Math.random()*30); reactiveGameState.water+=v;
        log('尋水',`獲得水 ${v}`,'c-gain');
    } else if(act==='train') {
        if(reactiveGameState.water<30) { log('提示','水不足'); return; }
        reactiveGameState.water-=30; let s=['s','a','i'][Math.floor(Math.random()*3)]; reactiveGameState.stats[s]++;
        log('訓練',`${Constant.STAT_MAP[s]} +1`,'c-gain');
    }
    campPhase(); 
}

// camp
// 修改：強制任務地點出現
export function exploreSetup() {
    // // 隱藏敵人區域
    // document.getElementById('enemy-area').style.display = 'none';
    // document.getElementById('enemy-area').innerHTML = '';

    // 1. 先打亂所有地點
    let allLocs = [...Constant.LOCATIONS].sort(() => 0.5 - Math.random());
    
    // 2. 預設取前 9 個
    let locs = allLocs.slice(0, 9);

    // ★★★ 核心修復：如果有任務，強制任務地點出現 ★★★
    if (reactiveGameState.activeQuest) {
        let qLocName = reactiveGameState.activeQuest.loc;
        
        // 檢查這 9 個裡面有沒有包含任務地點
        let alreadyHas = locs.some(l => l.name === qLocName);
        
        if (!alreadyHas) {
            // 如果沒有，從總表裡找出那個地點的資料
            let targetLocData = LOCATIONS.find(l => l.name === qLocName);
            
            // 如果在資料庫裡找到了這個地點
            if (targetLocData) {
                // 把第 9 個格子替換成任務地點
                locs[8] = targetLocData;
                // 再次打亂，讓它不要總是出現在最後一個位置
                locs = locs.sort(() => 0.5 - Math.random());
            } else {
                console.error(`錯誤：QUEST_DB 中的地點 "${qLocName}" 在 LOCATIONS.json 中找不到對應資料！`);
            }
        }
    }
    // =================================================

    window.currentLocs = locs;
    
    // let html = `<div style="margin-bottom:5px; color:#fff">📍 選擇地點: <button onclick="renderCampActions()" style="display:inline-block;padding:2px 5px;width:auto;">↩️</button></div>`;
    // html += `<div class="grid-3x3">`;
    
    Alpine.store('ui').exploreLoc = locs

    locs.forEach((loc, index) => {
        let isQuest = reactiveGameState.activeQuest && reactiveGameState.activeQuest.loc === loc.name;
        // 如果是任務地點，邊框變色並加強顯示
        let qStyle = isQuest ? 'border: 2px solid var(--quest-color); box-shadow: 0 0 10px var(--quest-color);' : '';
        let riskClass = loc.risk <= 2 ? 'd-low' : loc.risk >= 5 ? 'd-dead' : loc.risk >= 4 ? 'd-high' : 'd-mid';
        let riskText = loc.risk <= 2 ? '低' : loc.risk >= 5 ? '極危' : loc.risk >= 4 ? '高' : '中';
        loc.class = riskClass;
        loc.riskText = riskText;
        loc.style = qStyle;
        loc.trigger = ()=>{triggerExplore(index);};
        // html += `<button class="loc-btn" style="${qStyle}" onclick="triggerExplore(${index})">
        //     <div class="loc-name">${isQuest ? '👑 ' : ''}${l.n}</div>
        //     <div class="loc-info">
        //         <span class="loc-danger ${dClass}">危:${dText}</span>
        //         <span>${isQuest ? '<strong style="color:var(--quest-color)">任務目標</strong>' : l.desc}</span>
        //     </div>
        // </button>`;
    });
    // html += `</div>`;
    // document.getElementById('action-area').innerHTML = html;
    Alpine.store('ui').showAction = Constant.ACTION.explore;
}
window.exploreSetup = exploreSetup;

// camp
export function triggerExplore(index) {
    let loc = window.currentLocs[index];
    explore(loc.name, loc.risk, loc.loot, loc.desc);
}

// camp
// 確保探索邏輯正確連接
// 修改後的 explore 函數
export function explore(name, risk, loot, desc) { 
    window.currentLocName = name; 
    
    // ★★★ 新增：記錄這次探索的目標資源與危險度，供戰後使用 ★★★
    window.pendingScavenge = { loot: loot, risk: risk };
    // ========================================================

    log('探索', `前往 ${name}...`); 
    
    // 1. 任務檢查
    if(reactiveGameState.activeQuest && reactiveGameState.activeQuest.loc === name) {
        log('任務', '發現任務目標！', 'c-quest');
        window.pendingScavenge = null; // 任務戰不觸發普通搜刮
        triggerBossFight(reactiveGameState.activeQuest.boss, true);
        return;
    }

    // 2. 地點專屬事件
    if(Math.random() < (0.05 + risk * 0.04) && Constant.LOC_EVENT_DB[name]) {
        window.pendingScavenge = null; // 事件有自己的獎勵邏輯
        triggerLocationEvent(name);
        return;
    }

    // 3. 遭遇戰鬥檢查
    let combatChance = 0.1 + (risk * 0.15); 
    if(reactiveGameState.job.trait === '外送傳說') combatChance -= 0.15;
    
    if(Math.random() < combatChance) {
        log('警告', `高危區域反應！(${Math.floor(combatChance*100)}%)`, 'c-loss');
        triggerCombat(null, risk); 
    }
    // 4. 沒遇敵 -> 直接進入搜刮
    else {
        window.pendingScavenge = null; // 清除標記，避免重複
        doScavenge(loot, risk); 
    }
}

// camp
// 修復：增加對 food 和 random 類型的處理，防止程式崩潰
export function doScavenge(loot, risk) { 
    // 類型隨機化
    if(loot === 'random') {
        let r = Math.random();
        if(r < 0.25) loot = 'med';
        else if(r < 0.5) loot = 'throwable';
        else loot = ['melee','ranged','head','body','acc'][Math.floor(Math.random()*5)];
    }

    // --- 1. 搜刮成功率判定 ---
    // Danger 1: 95% | Danger 5: 55%
    // 智力(i) 越高，成功率越高 (每點智力+1%)
    let baseChance = 1.05 - (risk * 0.1);
    let intBonus = getStat('int') * 0.01;
    let successChance = baseChance + intBonus;

    if(Math.random() < successChance) { 
        // === 成功搜刮 ===
        
        // 經驗值：高危區給予更多經驗
        let xpGain = Math.max(1, Math.floor(risk * 0.5));
        gainXp(xpGain);

        // --- 新增：搜刮金錢 ---
        if(Math.random() < 0.5) { // 50% 機率發現金錢
            let moneyFound = 5 + Math.floor(Math.random() * 10); // 5-15元
            reactiveGameState.money += moneyFound;
            // 這裡不需要彈窗，只需 log，因為後面會有物品彈窗
            log('搜刮', `意外發現零錢 +$${moneyFound}`, 'c-gain');
        }

        // 食物/水：高風險=高回報 (維持之前的設定)
        if(loot === 'food' || loot === 'water') {
            let baseAmt = 40 + Math.floor(Math.random()*30);
            let finalAmt = Math.floor(baseAmt * (1 + risk * 0.3)); // D5可得 2.5倍
            
            if(loot==='water') {
                reactiveGameState.water += finalAmt;
            } else { 
                reactiveGameState.food += finalAmt;
            }
            
            let modal = {
                showGameScreen: true,
                title: "獲得物資",
                content: `在高危區域發現了大量${loot==='food'?'食物':'飲水'}。
                            <br>危險加成: +${Math.floor(risk*30)}%
                            <br><strong style="color:#4f4">${loot==='food'?'食物':'水'} +${finalAmt}</strong>`,
                buttonAction: ()=>{
                    closeModal();
                    campPhase();
                },
                buttonText: "收下 (Day +1)",
            }

            openModal(modal);

            // openModal("獲得物資", 
            //     `在高危區域發現了大量${loot==='food'?'食物':'飲水'}。<br>危險加成: +${Math.floor(risk*30)}%<br><strong style="color:#4f4">${loot==='food'?'食物':'水'} +${finalAmt}</strong>`, 
            //     `<button onclick="closeModal(); campPhase()">收下 (Day +1)</button>`
            // );
            return;
        }
            
        // === 裝備生成核心平衡 (修正處) ===
        
        let currentTier = getCurrentTier();
        let lootTier = currentTier;
        
        // 1. Tier 越級限制 (時間鎖)
        // 只有 Danger 4 以上才有機會獲得 Tier+1
        // 且最大只能是 Current + 1 (絕對不能在 Day 1 拿到 Tier 3)
        if (risk >= 4) {
            // 基礎機率 15%，每點幸運(luck) +1%
            let tierUpChance = 0.15 + (getStat('luck') * 0.01);
            if (Math.random() < tierUpChance) {
                lootTier = Math.min(5, currentTier + 1);
            }
        }

        // 2. 稀有度 (Rarity) 補償
        // 雖然 Tier 不一定高，但高危區容易出「藍裝/紫裝」
        // createItem 函數雖然沒有直接接受 rarity 參數，但我們可以在生成後修改它
        let item = createItem(loot, 'random', lootTier); 
        
        // 根據 Danger 提升稀有度 (Rarity: 0=白, 1=綠, 2=紫, 3=橙)
        // Danger 1-2: 主要是白/綠
        // Danger 5: 保底綠，高機率紫
        let rarityRoll = Math.random() + (risk * 0.1) + (getStat('luck')*0.02);
        
        if (rarityRoll > 0.9) { // 觸發高品質
            item.rarity = Math.min(3, item.rarity + 1);
            // 根據稀有度強化數值 (模擬詞條加成)
            item.val = Math.floor(item.val * 1.2); 
            // 增加一條隨機屬性
            let extraStats = ['crit','dodge','str','agi','int','wil','hp'];
            let k = extraStats[Math.floor(Math.random()*extraStats.length)];
            item.stats[k] = (item.stats[k] || 0) + Math.floor(lootTier * 2);
            item.fullName = `✨ 精良的 ${item.fullName}`;
        }
        
        // 高危區且越級成功的提示
        if(lootTier > currentTier) {
            item.fullName = `⚠️ ${item.fullName}`; // 越級危險標記
        }

        showLootModal(item, loot, campPhase); 

   } else { 
        // === 失敗懲罰與保底 ===
        let baseDmg = 15 + Math.floor(Math.random() * 10);
        let diffMult = 1 + (reactiveGameState.diff - 1) * 0.3; 
        
        let dmg = Math.floor(baseDmg * (1 + risk * 0.5) * diffMult);
        let reduce = getStat('w');
        dmg = Math.max(1, dmg - reduce);

        reactiveGameState.hp -= dmg;
        // ★★★ 新增：陷阱驚嚇扣除 SAN ★★★
        // 危險度越高，扣得越多 (Danger 1 = -2, Danger 5 = -10)
        let scare = Math.floor(risk * 2);
        reactiveGameState.san -= scare;
        
        log('搜刮', `觸發陷阱！受到傷害 (-${dmg} HP) 並受到驚嚇 (<span style="color:var(--san-color)">-${scare} SAN</span>)`, 'c-loss'); 
        // ==============================
        
        // --- 修改開始：失敗保底 ---
        // 即使失敗，也能找到一點點垃圾食物 (5-10點)
        // 這一點點在噩夢模式下可能就是多活半天的關鍵
        let scrapFood = 5 + Math.floor(Math.random() * 5);
        if(t === 'food') {
             reactiveGameState.food += scrapFood;
        } else {
            // 如果不是找食物，也可能撿到一點
             if(Math.random() < 0.5) reactiveGameState.food += scrapFood;
        }
        // --- 修改結束 ---
        
        openModal("搜刮失敗", 
            `這片區域(危險度 ${d})過於凶險，你觸發了陷阱。<br><br><strong style='color:#f44'>HP -${dmg}</strong><br><span style="color:#aaa">但在逃離時，你順手抓了一些殘餘物資 (食物 +${scrapFood})</span>`, 
            `<button onclick="closeModal(); campPhase()">包紮撤退 (Day +1)</button>`
        );
    }
}

// camp
// 2. 營地商店按鈕 (請修改 renderCampActions 調用此處)
export function openShop() {
    // 每日首次打開判定黑市 (2%)
    if (reactiveGameState.shop.lastDay !== reactiveGameState.day) {
        // 每週自動刷新商品 (或者第一天)
        if (Math.floor(reactiveGameState.day / 7) != Math.floor(reactiveGameState.shop.lastDay / 7) || reactiveGameState.shop.items.length === 0) {
            refreshShopItems(false); // 每週刷新重置為普通商店
        }
        
        // 每天第一次打開有 2% 機率突變為黑市 (如果還不是黑市)
        // 注意：如果剛好是週日刷新，這一步會覆蓋刷新，讓它變黑市
        if (Math.random() < 0.02) {
            activateBlackMarket();
        }
    }
    renderShopModal();
    reactiveGameState.shop.lastDay = reactiveGameState.day;
}

// camp
export function activateBlackMarket() {
    reactiveGameState.shop.isBlackMarket = true;
    refreshShopItems(true); // 強制刷新為黑市商品
    log('商店', '你遇到了一位神秘的黑市商人...', 'c-epic');
}

// camp
// 3. 刷新商店商品
export function refreshShopItems(forceBlackMarket) {
    reactiveGameState.shop.items = [];
    reactiveGameState.shop.isBlackMarket = forceBlackMarket;
    
    let shopTier = getCurrentTier();
    if(forceBlackMarket) shopTier = Math.min(5, shopTier + 1); // 黑市 Tier +1

    for(let i=0; i<6; i++) {
        // 隨機類型
        let types = ['melee','ranged','head','body','acc','shoes','med','med','food','food','water'];
        let t = types[Math.floor(Math.random() * types.length)];
        
        // 生成物品
        let item = createItem(t, 'random', shopTier);
        
        // 計算價格
        let value = getItemValue(item);
         let priceMult = forceBlackMarket ? 5.0 : 1.3;
       if (t === 'food' || t === 'water') {
            if (forceBlackMarket) {
                priceMult = 8.0; 
            } else if (reactiveGameState.diff === 3) {
                // 噩夢難度：商店食物價格翻倍
                priceMult = 2.6; 
            }
        }
        let price = Math.floor(value * priceMult); 

        reactiveGameState.shop.items.push({ item: item, price: price, bought: false });
    }
}

// camp
// 5. 購買邏輯
export function buyShopItem(idx) {
    let slot = reactiveGameState.shop.items[idx];
    if(!slot || slot.bought) return;

    if(reactiveGameState.money >= slot.price) {
        reactiveGameState.money -= slot.price;
        slot.bought = true;
        updateUI();
        log('商店', `購買了 ${slot.item.fullName}`, 'c-gain');
        
        // 進入戰利品分配邏輯
        showLootModal(slot.item, slot.item.type, () => {
            // 購買後關閉戰利品窗，重新回到商店
            renderShopModal();
        });
    } else {
        alert("金錢不足！");
    }
}

// camp
export function sellBagItem(idx) {
    if (idx < 0 || idx >= reactiveGameState.bag.length) return;
    
    let item = reactiveGameState.bag[idx];
    let val = getItemValue(item);
    let sellPrice = Math.max(1, Math.floor(val * 0.3));
    
    // 執行交易
    reactiveGameState.money += sellPrice;
    reactiveGameState.bag.splice(idx, 1); // 移除物品
    
    log('商店', `賣出了 ${item.fullName}，獲得 $${sellPrice}`, 'c-gain');
    updateUI();
    
    // 重新渲染商店介面以更新列表
    renderShopModal();
}

// camp
// 6. 手動刷新
export function manualRefreshShop() {
    let cost = reactiveGameState.shop.isBlackMarket ? 500 : 100;
    if(reactiveGameState.money >= cost) {
        if(confirm(`確定要花費 $${cost} 刷新商品嗎？`)) {
            reactiveGameState.money -= cost;
            updateUI();
            refreshShopItems(reactiveGameState.shop.isBlackMarket); // 保持當前商店類型
            renderShopModal();
        }
    } else {
        alert("金錢不足以刷新！");
    }
}

// camp
// ★★★ 新增：戰鬥勝利後繼續探索的邏輯 ★★★
export function continueExploration() {
    // 檢查是否有暫存的探索目標
    if (window.pendingScavenge) {
        let p = window.pendingScavenge;
        window.pendingScavenge = null; // 清除標記，防止無限循環
        
        log('探索', '威脅已清除，繼續搜尋區域物資...', 'c-gain');
        
        // 執行原本的搜刮邏輯 (傳入原本的類型和危險度)
        // doScavenge 會處理結算介面，它的 callback 會指向 campPhase
        doScavenge(p.loot, p.risk);
    } else {
        // 如果沒有待搜刮項目 (例如只是單純的事件戰鬥)，直接回營地
        campPhase();
    }
}