import {reactiveGameState} from './GameMain.js';
import * as Constant from './GameData.js';
import {getStat} from './Character.js';

// itemp
// === 物品標籤生成器 ===
export function getItemTypeTag(type) {
    const map = {
        'melee': { t: '⚔️ 近戰', c: 'tag-melee' },
        'ranged': { t: '🔫 遠程', c: 'tag-ranged' },
        'head': { t: '🪖 頭部', c: 'tag-def' },
        'body': { t: '👕 身體', c: 'tag-def' },
        'acc': { t: '💍 飾品', c: 'tag-def' },
        'food': { t: '🍖 食品', c: 'tag-con' },
        'water': { t: '💧 飲品', c: 'tag-con' },
        'med': { t: '💊 醫療', c: 'tag-con' },
        'throwable': { t: '💣 投擲', c: 'tag-melee' },
        'shoes': { t: '👟 足部', c: 'tag-def' }
    };
    
    let info = map[type] || { t: '📦 物品', c: '' };
    return `<span class="type-tag ${info.c}">${info.t}</span>`;
}

// itemp
// === 營地背包系統 ===
export function openCampBag() {
    if(reactiveGameState.bag.length === 0) {
        openModal("背包", "背包裡空空如也。", `<button onclick="closeModal()">關閉</button>`);
        return;
    }

    let html = `<div style="display:grid; gap:8px; max-height:60vh; overflow-y:auto;">`;
    reactiveGameState.bag.forEach((item, idx) => {
        let descriptions = [];
        
        // 1. 顯示基礎數值
        if(item.val > 0) {
            let lbl = getItemValueLabel(item.type);
            // 去掉 emoji 保持簡潔
            lbl = lbl.replace(/[^\u4e00-\u9fa5]/g, ''); 
            descriptions.push(`${lbl}+${getEquipVal(item)}`);
        }

        // 2. 顯示所有詞綴屬性 (包含負面效果)
        if(item.stats) {
            for(let k in item.stats) {
                if(k === 'desc' || k === 'eff' || k === 'all') continue;
                let v = item.stats[k];
                if(v === 0) continue;
                let name = Constant.STAT_MAP[k] || k;
                let sign = v > 0 ? '+' : '';
                
                // ★★★ 新增：提示判定邏輯 ★★★
                let hint = "";
                // 條件：如果是消耗品 (med/food/water) 且 屬性是戰鬥數值 (s/a/i/w/crit/dodge/acc/defP)
                // 注意：HP 和 SAN 不加提示，因為它們在營地也是立即生效的
                if (['med', 'food', 'water'].includes(item.type) && ['s','a','i','w','crit','dodge','acc','defP'].includes(k)) {
                    hint = `<span style="color:#fa0;font-size:0.8em;margin-left:2px">(戰鬥中使用才發動額外加成)</span>`;
                }
                    // ==========================================
                // 處理百分比
                if (['defP', 'dodge', 'crit', 'acc'].includes(k) || (Math.abs(v) < 1 && v !== 0)) {
                    descriptions.push(`${name}${sign}${Math.floor(v*100)}%`);
                } else {
                    descriptions.push(`${name}${sign}${v}`);
                }
            }
        }

        // 3. 顯示特殊描述
        if(item.stats && item.stats.desc) descriptions.push(`"${item.stats.desc}"`);
        if(item.stats && item.stats.eff) descriptions.push(`特效:${item.stats.eff}`);

        let valDesc = descriptions.join(' | ');

        let actionBtn = '';
        if(item.type === 'med' || item.type === 'food' || item.type === 'water') {
            actionBtn = `<button onclick="useCampItem(${idx})" style="width:auto; padding:4px 10px; background:#254; border-color:#4f4">使用</button>`;
        }
        else if (['melee', 'ranged', 'head', 'body', 'acc', 'shoes'].includes(item.type)) {
            actionBtn = `<button onclick="equipFromBag(${idx})" style="width:auto; padding:4px 10px; background:#245; border-color:#48f">裝備</button>`;
        }
        
        html += `<div style="background:#222; padding:8px; border:1px solid #444; display:flex; justify-content:space-between; align-items:center;">
            <div style="text-align:left; width:70%">
                <div>${getItemTypeTag(item.type)} <span class="q${item.rarity}" style="font-weight:bold">${item.fullName}</span></div>
                <div style="font-size:0.8em; color:#bbb; margin-top:2px; line-height:1.4;">${valDesc}</div>
            </div>
            <div style="display:flex; gap:5px;">
                ${actionBtn}
                <button onclick="discardCampItem(${idx})" style="width:auto; padding:4px 10px; background:#522; border-color:#f44">丟棄</button>
            </div>
        </div>`;
    });

    html += `</div>`;
    html += `<div style="margin-top:10px; font-size:0.9em; color:#888; text-align:right">
        容量: ${reactiveGameState.bag.length} / ${getBagCapacity()}
    </div>`;
    openModal("🎒 營地背包", html, `<button onclick="closeModal()">關閉</button>`);
}

// item
export function useCampItem(idx) {
    let item = reactiveGameState.bag[idx];
    let used = false;
    let msg = "";

    if(item.type === 'food' || item.type === 'water') {
        let val = item.val;
        if(item.type === 'food') { reactiveGameState.food += val; msg = `飽食度 +${val}`; } 
        else { reactiveGameState.water += val; msg = `水分 +${val}`; }
        used = true;
        log('營地', `使用了 ${item.fullName}: ${msg}`, 'c-gain');
    }

    if(item.type === 'med') {
        let healed = false;
        if(item.stats.hp && reactiveGameState.hp < reactiveGameState.maxHp) {
            let oldHp = reactiveGameState.hp;
            reactiveGameState.hp = Math.min(reactiveGameState.maxHp, reactiveGameState.hp + item.stats.hp);
            msg += `HP恢復 ${reactiveGameState.hp - oldHp}. `;
            healed = true;
        }
        if(item.stats.san && reactiveGameState.san < 100) {
            let oldSan = reactiveGameState.san;
            reactiveGameState.san = Math.min(100, reactiveGameState.san + item.stats.san);
            msg += `SAN值恢復 ${reactiveGameState.san - oldSan}. `;
            healed = true;
        }
        // 如果有屬性buff，雖然營地使用只能暫時沒效果，但也算使用成功
        if(item.stats.s || item.stats.i || item.stats.a || item.stats.w || item.stats.crit) {
             msg += `(屬性變化僅在戰鬥中生效) `;
             healed = true; 
        }

        if(!healed) {
            if(!confirm("狀態已滿，確定要浪費藥品嗎？")) return;
        }
        used = true;
        log('營地', `使用了 ${item.fullName}: ${msg}`, 'c-gain');
    }

    if(used) {
        reactiveGameState.bag.splice(idx, 1); 
        updateUI(); 
        renderCampActions(); // ★★★ 修復：強制刷新營地按鈕狀態 (1/5) ★★★
        openCampBag(); 
    }
}

// item
export function discardCampItem(idx) {
    let item = reactiveGameState.bag[idx];
    if(confirm(`確定要丟棄 ${item.fullName} 嗎？此操作無法撤銷。`)) {
        reactiveGameState.bag.splice(idx, 1);
        log('營地', `丟棄了 ${item.fullName}`, 'c-loss');
        
        updateUI(); 
        renderCampActions(); // 更新外面按鈕的 (數量/上限)
        openCampBag(); // 重新整理背包清單
    }
}

// item
// ==========================================
// ★★★ 請在這裡插入 equipFromBag 函數 ★★★
// ==========================================
export function equipFromBag(idx) {
    let newItem = reactiveGameState.bag[idx];    // 從背包獲取新裝備
    let type = newItem.type;     // 獲取部位類型
    let oldItem = reactiveGameState.eq[type];    // 獲取身上當前裝備

    // 1. 從背包移除新裝備
    reactiveGameState.bag.splice(idx, 1);

    // 2. 將身上的舊裝備放入背包
    // 交換必定成功，因為是一進一出，不需要檢查容量
    if (oldItem) {
        reactiveGameState.bag.push(oldItem);
    }

    // 3. 穿上新裝備
    reactiveGameState.eq[type] = newItem;

    // 4. 更新狀態與UI
    log('裝備', `更換裝備：${newItem.fullName}`, 'c-gain');
    
    recalcMaxHp(); // 重新計算屬性（血量上限等）
    // updateUI();    // 更新主介面數值
    openCampBag(); // 重新渲染背包介面（顯示交換後的結果）
}

// item
// 計算當前 Tier (Day 0-29=1, 30-59=2, ..., 120+=5)
export function getCurrentTier() {
    let t = Math.floor(reactiveGameState.day / 30) + 1;
    return Math.min(5, Math.max(1, t));
}

// item
export function getBagCapacity() {
    let tier = getCurrentTier();
    let str = getStat('s');

    // 1. 基礎容量: 4
    // (開局 T1, 力5 -> 總共 4格。只能帶 水+糧+藥+1空位，非常局促)
    let base = 4;

    // 2. Tier成長 (大幅削弱): 
    // 不再每級都送，只有在 Tier 3 和 Tier 5 時各 +1 格
    // 活得久不代表你能背更多東西
    let tierBonus = Math.floor((tier - 1) / 2);

    // 3. 力量成長 (削弱): 
    // 每 6 點力量才 +1 格 (原本是 4)
    // 這讓力量流玩家有優勢，但不會失控
    let strBonus = Math.floor(str / 6);

    // 4. 職業/MBTI 加成 (保持不變，這是職業特色)
    let traitBonus = 0;
    if(reactiveGameState.mbti.id === 'ISTJ') traitBonus += 2; // 物流師
    if(reactiveGameState.job.trait === '外送傳說') traitBonus += 3; // 外送員
    if(reactiveGameState.job.trait === '地產霸權') traitBonus += 2; // 地產商

    // 5. 硬上限 (Hard Cap) - 最重要的平衡修正
    // 基礎+成長 最高鎖死在 9 格。
    // 只有靠職業天賦才能突破 9 格。
    let total = base + tierBonus + strBonus;
    if(total > 9) total = 9;

    return total + traitBonus;
}

// item
// 將詞綴屬性合併到物品上
export function applyAffix(item, affix) {
    if (!affix) return;
    
    // 1. 合併 Stats (屬性)
    if (affix.stats) {
        for (let k in affix.stats) {
            // 特殊處理：如果是攻擊力(atk)或防禦力(def)，直接加到 item.val
            if (k === 'atk' && (item.type === 'melee' || item.type === 'ranged')) {
                item.val += affix.stats[k];
            } else if (k === 'def' && (item.type === 'head' || item.type === 'body')) {
                item.val += affix.stats[k];
            } else {
                // 其他屬性 (s, a, i, w, luck, loot...) 加到 item.stats
                item.stats[k] = (item.stats[k] || 0) + affix.stats[k];
            }
        }
    }

    // 2. 合併 FX (特效)
    // 目前邏輯：如果物品原本沒有特效，直接獲得詞綴特效
    // 如果原本有特效，詞綴特效會變成 "副特效" (顯示在描述中，但程式邏輯需支援多重特效)
    // 為了簡化，我們暫時將詞綴特效視為 "fx2" 或直接疊加描述
    if (affix.fx) {
        if (!item.fx) {
            item.fx = {...affix.fx}; // 獲得新特效
        } else {
            // 如果已經有特效 (例如專屬裝備)，我們把詞綴特效寫入描述，
            // 並嘗試將其數值加成到現有特效 (如果類型相同)，或忽視 (暫時避免過度複雜)
            // 進階：您可以將 item.fx 改為陣列來支援多特效
            if(item.stats.desc){
                item.stats.desc += ` [${affix.fx.desc}]`; 
            }else{
                item.stats.desc = `[${affix.fx.desc}]`; 
            }
            
            // 簡單實作：如果是同類型特效，疊加數值
            if (item.fx.t === affix.fx.t) {
                item.fx.v += affix.fx.v;
            }
        }
    }
}

// item
// 物品生成工廠 (升級版)
export function createItem(type, specificName, forcedTier, forceCommon = false) {
    let tier = forcedTier || getCurrentTier();
    if (reactiveGameState.day <= 10 && tier > 1) tier = 1;
    let isJobItem = false;
    let jobHasItem = false;
    let finalName = "";
    
    // 對應 ALL_JOBS 中 g 數組的順序
    let jobItemIndex = -1;
    if (type === 'melee') jobItemIndex = 0;
    else if (type === 'ranged') jobItemIndex = 1;
    else if (type === 'head') jobItemIndex = 2;
    else if (type === 'body') jobItemIndex = 3;
    else if (type === 'acc') jobItemIndex = 4;
    else if (type === 'shoes') jobItemIndex = 5;

    let jobBaseName = '無';
    if(reactiveGameState.job && reactiveGameState.job.equip && reactiveGameState.job.equip[jobItemIndex]) {
        jobBaseName = reactiveGameState.job.equip[jobItemIndex];
    }
    if (jobBaseName !== '無') jobHasItem = true;

    if (!forceCommon && jobHasItem) {
        if (specificName === 'random') {
            if (Math.random() < 0.3) isJobItem = true; 
        } else if (specificName && specificName.includes(jobBaseName)) {
            isJobItem = true;
        }
    }

    let itemData = {};

    // 1. 食物/水 (消耗品不加詞綴)
    if (type === 'food' || type === 'water') {
        let isFood = (type === 'food');
        let names = isFood ? ['壓縮餅乾', '午餐肉罐頭', '軍用口糧'] : ['過濾水', '瓶裝水', '運動飲料'];
        let name = names[Math.floor(Math.random() * names.length)];
        let val = 20 + (tier * 10) + Math.floor(Math.random()*10);
        return { name: name, fullName: name, type: type, val: val, tier: tier, rarity: 1, stats: { desc: isFood ? '恢復飽食度' : '恢復水分' }, uid: Math.random() };
    }
    
    // 2. 決定基礎物品 (專屬 或 通用)
    let baseItem = null;
    let isNative = false;

    if (isJobItem) {
        if (!Constant.JOB_EXCLUSIVE_DB[type]) return { name: "錯誤", fullName: "DB錯誤", type: type, val: 1, tier: 1, rarity: 0, stats: {}, uid: Math.random() };
        let tpl = Constant.JOB_EXCLUSIVE_DB[type].find(x => x.n === jobBaseName);
        if (!tpl) tpl = { n: jobBaseName, v: 10 };
        
        baseItem = JSON.parse(JSON.stringify(tpl)); // 深拷貝
        if (!baseItem.stats) baseItem.stats = {}; 


        // 專屬裝備數值隨 Tier 成長
        let mul = Constant.JOB_TIER_PREFIX[tier - 1].mul;
        baseItem.v = Math.floor(baseItem.v * mul * (1 + reactiveGameState.day/200));
        isNative = true;
    } else {
        if (!Constant.COMMON_DB[type]) return { name: "錯誤", fullName: "DB錯誤", type: type, val: 1, tier: 1, rarity: 0, stats: {}, uid: Math.random() };
        let pool = Constant.COMMON_DB[type][tier - 1] || Constant.COMMON_DB[type][0];
        let tpl = pool[Math.floor(Math.random() * pool.length)];
        if (specificName !== 'random') {
            let found = pool.find(x => x.n === specificName);
            if (found) tpl = found;
        }
        if (!tpl) tpl = {"n": "未知物品", "v": 1};
        
        baseItem = JSON.parse(JSON.stringify(tpl)); // 深拷貝
        if (!baseItem.stats) baseItem.stats = {};
        

        ['hp', 'san', 'heal', 'eff', 's', 'a', 'i', 'w', 'luck'].forEach(key => {
            if (baseItem[key] !== undefined && baseItem.stats[key] === undefined) {
                baseItem.stats[key] = baseItem[key];
            }
        });


        // 通用裝備基礎屬性注入
        let bonusPoints = tier * 2; 
        if(type === 'melee') baseItem.stats.s = (baseItem.stats.s||0) + Math.ceil(bonusPoints*0.8);
        else if(type === 'ranged') baseItem.stats.a = (baseItem.stats.a||0) + Math.ceil(bonusPoints*0.8);
        else if(type === 'head') { baseItem.stats.i = (baseItem.stats.i||0) + Math.ceil(bonusPoints*0.5); baseItem.stats.hp = (baseItem.stats.hp||0) + tier*5; }
        else if(type === 'body') { baseItem.stats.hp = (baseItem.stats.hp||0) + tier*10; baseItem.stats.w = (baseItem.stats.w||0) + Math.ceil(bonusPoints*0.5); }
        else if(type === 'acc') { baseItem.stats.luck = (baseItem.stats.luck||0) + Math.ceil(bonusPoints*0.5); }
        else if(type === 'shoes') { baseItem.stats.a = (baseItem.stats.a||0) + Math.ceil(bonusPoints*0.5); baseItem.stats.dodge = (baseItem.stats.dodge||0) + tier*2; }
    }

    // === 3. 詞綴生成邏輯 (平衡版) ===
    let rarity = 0; // 默認 Common
    
    if (!forceCommon) {
        let luck = getStat('luck');
        // 基礎機率 (受 Day 和 Luck 影響)
        let chanceUncommon = 0.2 + (reactiveGameState.day * 0.002) + (luck * 0.005); 
        let chanceRare = 0.05 + (reactiveGameState.day * 0.001) + (luck * 0.002);
        let chanceEpic = 0.01 + (reactiveGameState.day * 0.0005) + (luck * 0.001);

        // Day 限制 (Hard Gate) - 這是為了防止第一天拿到太強的裝備
        if (reactiveGameState.day < 5) { chanceUncommon = 0.1; chanceRare = 0; chanceEpic = 0; }
        else if (reactiveGameState.day < 15) { chanceRare = 0.05; chanceEpic = 0; }
        else if (reactiveGameState.day < 30) { chanceEpic = 0; }

        let r = Math.random();
        if (r < chanceEpic) rarity = 3;      // 橙
        else if (r < chanceRare) rarity = 2; // 紫
        else if (r < chanceUncommon) rarity = 1; // 綠
    }

    if (isNative) rarity = Math.max(rarity, 2); // 專屬裝備保底紫
    rarity = Math.min(3, rarity); 

    let prefix = null;
    let suffix = null;

    // 綠色以上：50% 前綴, 50% 後綴
    if (rarity >= 1) {
        if (Math.random() < 0.5) prefix = getRandomAffix('prefixes', tier);
        else suffix = getRandomAffix('suffixes', tier);
    }
    // 藍色以上：保底 1 前綴 1 後綴
    if (rarity >= 2) {
        prefix = getRandomAffix('prefixes', tier);
        suffix = getRandomAffix('suffixes', tier);
    }

    // 構建名稱
    let displayName = baseItem.n;
    let pName = "";
    let sName = "";

    if (prefix) {
        applyAffix(baseItem, prefix);
        pName = prefix.n.replace('的', ''); 
    }
    
    if (suffix) {
        applyAffix(baseItem, suffix);
        sName = suffix.n + "之";
    }

    if (pName || sName) {
        if (sName) {
            displayName = `${sName}${pName}${baseItem.n}`;
        } else {
            displayName = `${prefix.n}${baseItem.n}`;
        }
    }

    if (isNative) {
        let tierP = Constant.JOB_TIER_PREFIX[tier - 1].prefix;
        displayName = `${tierP}${displayName}`;
    }

    itemData = {
        name: baseItem.n,
        fullName: displayName,
        type: type,
        val: baseItem.v,
        tier: tier,
        isJobNative: isNative,
        rarity: rarity,
        stats: baseItem.stats,
        fx: baseItem.fx
    };
    
    if(type === 'ranged') itemData.ammo = 5 + (tier * 5);
    itemData.uid = Math.random();
    
    return itemData;
}

// item
// 輔助：隨機抽取詞綴 (限制等級版)
export function getRandomAffix(category, currentTier) {
    let pool = Constant.AFFIX_DB[category];
    // 關鍵修正：只允許 tier <= currentTier 的詞綴
    // 絕對禁止 Day 1 (Tier 1) 抽到 Tier 2+ 的詞綴
    let validPool = pool.filter(a => a.tier <= currentTier);
    
    // 如果池子空了 (以防萬一)，保底用 T1
    if (validPool.length === 0) validPool = pool.filter(a => a.tier === 1);
    
    return validPool[Math.floor(Math.random() * validPool.length)];
}

// item
// 新增：獲取裝備實際數值 (含職業加成)
export function getEquipVal(item) {
    if (!item) return 0;
    let v = item.val;
    if (item.isJobNative) {
        v = Math.floor(v * 1.1); // 10% 加成
    }
    return v;
}
// item-loot
export function equipLoot() { 
    let type = reactiveGameState.tempLoot.type;
    let newItem = reactiveGameState.tempLoot.item;
    let oldItem = reactiveGameState.eq[type]; // 獲取當前身上的裝備

    // 1. 裝備新物品
    reactiveGameState.eq[type] = newItem; 
    if(newItem.ammo) reactiveGameState.ammo += newItem.ammo; // 增加彈藥
    
    let msg = `裝備了 ${newItem.fullName}`;

    // 2. 處理舊物品 (如果不是"未裝備"狀態)
    // 這裡我們假設所有部位都有初始裝備(即使是破爛T恤)，所以直接處理
    if (oldItem) {
        // 檢查背包空間
        if (reactiveGameState.bag.length < getBagCapacity()) {
            // A. 背包有空位 -> 自動放入
            reactiveGameState.bag.push(oldItem);
            msg += `，舊裝備已放入背包。`;
        } else {
            // B. 背包已滿 -> 自動賣出
            let val = getItemValue(oldItem);
            let sellPrice = Math.max(1, Math.floor(val * 0.3));
            reactiveGameState.money += sellPrice;
            msg += `，背包已滿，舊裝備自動賣出獲得 $${sellPrice}。`;
        }
    }

    log('裝備', msg, 'c-gain');
    recalcMaxHp(); // 重新計算屬性
    // updateUI();
    closeModal(); 
    if(reactiveGameState.tempLoot.cb) reactiveGameState.tempLoot.cb(); 
}

// item
export function discardLoot() { 
    if(reactiveGameState.tempLoot.item.ammo){
        reactiveGameState.ammo+=reactiveGameState.tempLoot.item.ammo; 
    }

    closeModal(); 

    if(reactiveGameState.tempLoot.cb){
        reactiveGameState.tempLoot.cb(); 
    }
}

// item
export function getItemValueLabel(type) {
    if(type === 'melee' || type === 'ranged') return "⚔️ 攻擊力";
    if(type === 'head' || type === 'body') return "🛡️ 防禦力";
    if(type === 'acc') return "🍀 幸運/強度"; // 飾品通常加幸運或特殊效果
    if(type === 'food') return "🍖 飽食度";
    if(type === 'water') return "💧 水分";
    if(type === 'med') return "💊 恢復/效果";
    if(type === 'throwable') return "💣 傷害";
    if(type === 'shoes') return "🦵 敏捷/閃避";
    return "✨ 數值";
}





// item
export function useLootItemDirectly() {
    if (!reactiveGameState.tempLoot || !reactiveGameState.tempLoot.item) return;
    let item = reactiveGameState.tempLoot.item;
    let msg = "";

    // 1. 食物/水
    if (item.type === 'food' || item.type === 'water') {
        let val = item.val;
        if (item.type === 'food') {
            reactiveGameState.food += val;
            msg = `飽食度 +${val}`;
        } else {
            reactiveGameState.water += val;
            msg = `水分 +${val}`;
        }
    }
    // 2. 藥品
    else if (item.type === 'med') {
        if (item.stats.hp) {
            let oldHp = reactiveGameState.hp;
            reactiveGameState.hp = Math.min(reactiveGameState.maxHp, reactiveGameState.hp + item.stats.hp);
            msg += `HP +${Math.floor(reactiveGameState.hp - oldHp)} `;
        }
        if (item.stats.san) {
            let oldSan = reactiveGameState.san;
            reactiveGameState.san = Math.min(100, reactiveGameState.san + item.stats.san);
            msg += `SAN +${Math.floor(reactiveGameState.san - oldSan)} `;
        }
    }

    log('使用', `直接使用了 ${item.fullName}: ${msg}`, 'c-gain');
    updateUI();
    closeModal();
    if (reactiveGameState.tempLoot.cb) reactiveGameState.tempLoot.cb();
}

// item
// 新增：放入背包邏輯
export function takeItemToBag() {
    if(reactiveGameState.bag.length < getBagCapacity()) {
        reactiveGameState.bag.push(reactiveGameState.tempLoot.item);
        log('搜刮', `獲得 ${reactiveGameState.tempLoot.item.fullName}`, 'c-gain');
        closeModal();
        if(reactiveGameState.tempLoot.cb) reactiveGameState.tempLoot.cb();
    } else {
        showBagSwapUI(); // 再次確保防呆
    }
}



// item
// 新增：丟棄背包內物品並拾取新物品
export function discardBagItem(idx) {
    let item = reactiveGameState.bag[idx];
    reactiveGameState.bag.splice(idx, 1); // 移除舊的
    reactiveGameState.bag.push(reactiveGameState.tempLoot.item); // 加入新的
    log('背包', `丟棄了 ${item.fullName}，獲得了 ${reactiveGameState.tempLoot.item.fullName}`);
    closeModal();
    if(reactiveGameState.tempLoot.cb) reactiveGameState.tempLoot.cb();
}

// item
// ==================== 經濟與商店系統 ====================
// 1. 物品價值計算 (平衡核心)
export function getItemValue(item) {
  // --- 新增：食物/水定價 ---
    if(item.type === 'food' || item.type === 'water') {
        // 1 點恢復量 = $1.5
        // 一個 40 點的罐頭大約 $60
        // 在噩夢模式下，這是一筆不小的開銷，但能救命
        return Math.floor(item.val * 1.5); 
    }
    // --- 新增結束 ---
    // 基礎價值隨 Tier 指數成長
    // T1: 50, T2: 125, T3: 310, T4: 780, T5: 1950
    let base = 50 * Math.pow(2.5, item.tier - 1);
    
    // 稀有度加成 (白:1.0, 綠:1.3, 紫:1.8, 橙:2.5)
    let rarityMult = 1.0;
    if(item.rarity === 1) rarityMult = 1.3;
    if(item.rarity === 2) rarityMult = 1.8;
    if(item.rarity === 3) rarityMult = 2.5;

    // 隨機浮動 +/- 10%
    let variation = 0.9 + Math.random() * 0.2;
    
    // 職業專屬稍微貴一點
    let jobMult = item.isJobNative ? 1.2 : 1.0;

    return Math.floor(base * rarityMult * jobMult * variation);
}

// item
// 7. 回收 (出售) 邏輯
export function recycleLoot() {
    if(!reactiveGameState.tempLoot) return;
    let val = getItemValue(reactiveGameState.tempLoot.item);
    let sellPrice = Math.max(1, Math.floor(val * 0.3)); // 30% 回收價
    
    reactiveGameState.money += sellPrice;
    log('回收', `出售了 ${reactiveGameState.tempLoot.item.fullName}，獲得 $${sellPrice}`, 'c-gain');
    updateUI();
    closeModal();
    if(reactiveGameState.tempLoot.cb) reactiveGameState.tempLoot.cb();
}

// item
export function generateBossLoot(bossName, isQuest) {
    let lootList = [];
    
    // 1. 必掉：大量金錢 (Diablo的金幣堆)
    let moneyAmt = 50 + Math.floor(Math.random() * 100) + (reactiveGameState.day * 2);
    if (reactiveGameState.diff === 3) moneyAmt = Math.floor(moneyAmt * 0.6);
    lootList.push({ type: 'money', val: moneyAmt, fullName: `💰 金幣堆 ($${moneyAmt})`, rarity: 1, desc:"亮閃閃的" });

    // 2. 必掉：消耗品 (藥水/食物)
    let itemType = ['med', 'food', 'water', 'throwable'][Math.floor(Math.random()*4)];
    let tier = getCurrentTier();
    let commonItem = createItem(itemType, 'random', tier);
    commonItem.fullName = `${commonItem.fullName} (掉落)`;
    lootList.push(commonItem);

    // 3. 機率掉落：隨機高級裝備 (填充物)
    // 掉落 1-2 件隨機 T+1 裝備
    let randomCount = 1 + Math.floor(Math.random() * 2);
    for(let i=0; i<randomCount; i++) {
        let type = ['melee','ranged','head','body','acc','shoes'][Math.floor(Math.random()*6)];
        // 有機會掉落高一階的裝備
        let lootTier = (Math.random() < 0.3) ? Math.min(5, tier + 1) : tier;
        let item = createItem(type, 'random', lootTier);
        // 強制提升稀有度
        item.rarity = Math.max(item.rarity, 1); 
        if(Math.random() < 0.2) item.rarity = 2; // 紫裝
        item.fullName = `📦 ${item.fullName}`;
        lootList.push(item);
    }

    // 4. 核心：專屬裝備判定 (Exclusive Drops)
    let exclusives = BOSS_LOOT_DB[bossName];
    if (exclusives) {
        exclusives.forEach(ex => {
            // 任務 Boss 套裝每個部位 30% 機率
            // 地點 Boss 單件紅裝 40% 機率 (如果只有一件)
            let dropChance = isQuest ? 0.35 : 0.4; 
            
            // 幸運加成：每 10 點幸運 + 5% 掉落率
            dropChance += (getStat('luck') * 0.005);

            if (Math.random() < dropChance) {
                // 建構物品物件
                let drop = {
                    name: ex.n,
                    fullName: `🔥 [專屬] ${ex.n}`,
                    type: ex.type,
                    val: ex.val,
                    tier: Math.max(3, tier), // 專屬至少 T3
                    rarity: ex.rarity,
                    stats: ex.stats || {},
                    fx: ex.fx || null,
                    isJobNative: false,
                    uid: Math.random()
                };
                // 如果是遠程，補彈藥
                if(drop.type === 'ranged') drop.ammo = ex.ammo || 20;
                
                lootList.push(drop);
            }
        });
    }

    return lootList;
}

// item
// 單個拾取邏輯
export function pickUpBossLoot(idx) {
    let item = window.currentBossLoot[idx];
    if(!item) return;

    if(reactiveGameState.bag.length >= getBagCapacity()) {
        alert("背包已滿！請先整理背包或丟棄其他物品。");
        // 這裡可以做更高級的：打開背包整理視窗，但為了避免UI疊加過於複雜，暫時用 alert
        return;
    }

    reactiveGameState.bag.push(item);
    log('拾取', `獲得 ${item.fullName}`, 'c-gain');
    
    // 視覺更新：隱藏該行或變灰
    let row = document.getElementById(`loot-row-${idx}`);
    if(row) {
        row.style.opacity = '0.3';
        row.innerHTML = `<div style="color:#4f4; width:100%; text-align:center;">已放入背包</div>`;
        row.onclick = null;
    }
    
    // 從清單中移除（標記為 null 防止重複）
    window.currentBossLoot[idx] = null;
    updateUI();
}
