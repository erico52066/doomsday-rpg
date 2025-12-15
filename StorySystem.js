import * as Constant from './GameData.js';
import { reactiveGameState, log} from './GameMain.js';
import { normalCampLogic, doScavenge } from './CampSystem.js';
import { renderStoryModal, openModal, showLootModal } from './UIManager.js';
import { gainXp, getStat } from './Character.js';
import { createItem } from './ItemSystem.js';

// story
// ==================== 5. 故事與判定 ====================
let storyState = { step: 0, score: 0, data: null, type: '', lastResult: '' };

// story
// 修改：在 storyState 中記錄地點名稱 (loc)，以便結算時發放對應獎勵
export function triggerLocationEvent(locName) {
    let events = Constant.LOC_EVENT_DB[locName];
    if(!events || events.length === 0) { doScavenge('random', 1); return; } 
    
    let ev = events[Math.floor(Math.random() * events.length)];
    
    storyState = { 
        step: 0, 
        score: 0, 
        type: 'loc_event', 
        loc: locName, // 新增：記錄地點
        lastResult: '', 
        data: {
            title: `📍 ${locName}：${ev.t}`,
            intro: "", 
            steps: ev.s.map(s => ({ q: s.q, opts: s.opts }))
        }
    };
    
    log('奇遇', `觸發事件：${ev.t}`, 'c-epic');
    renderStoryModal(storyState);
}

// combat
export function calculateOutcome(type, statKey) {
    // 1. 獲取成功率 (這與按鈕上顯示的數值一致)
    let successRate = getEventSuccessRate(type, statKey);
    
    // 2. 擲骰子 (0 ~ 99)
    let roll = Math.random() * 100;
    
    // 3. 判定邏輯
    // 大成功機率固定為 5% (加上幸運修正)
    let critChance = 5 + (getStat('luck') > 15 ? 5 : 0);
    
    // 檢定
    if (roll < critChance) return 'crit_success'; // 大成功
    if (roll < successRate) return 'success';     // 成功
    if (roll > 95) return 'crit_fail';            // 大失敗 (固定 5% 機率)
    
    return 'fail'; // 失敗
}

// story
export function checkWeeklyEvent() {
    if((reactiveGameState.day % 10 === 0 && reactiveGameState.day <= 60) || reactiveGameState.day % 7 === 0) {
        startEpicStory();
        return;
    }
    normalCampLogic();
}

// story
// 修改：修復變數名稱錯誤 (isQuest -> isQuestStory)
export function startEpicStory() {
    let storyData;
    let isQuestStory = false; // ★ 正確的變數名稱定義在這裡
    let bossName = '區域領主';

    // 優先檢查是否有活躍任務
    if (reactiveGameState.activeQuest) {
        let q = reactiveGameState.activeQuest;
        isQuestStory = true; // 標記為任務劇情
        bossName = q.boss;
        
        storyData = {
            title: `⚔️ 任務決戰：${q.loc}`,
            intro: `你依照情報來到了 <strong>${q.loc}</strong>。<br>空氣中瀰漫著令人作嘔的氣息，${q.boss} 就在深處。`,
             steps: [
                {q:"外圍充滿了警戒的變異生物。", opts: [{t:"潛伏穿過", type:'good', stat:'a'}, {t:"強行突破", type:'bad', stat:'s'}]},
                {q:"你發現了大門的電子鎖被破壞了。", opts: [{t:"修復電路", type:'good', stat:'i'}, {t:"尋找通風口", type:'bad', stat:'luck'}]},
                {q:"接近核心區域，精神壓迫感極強。", opts: [{t:"堅定意志", type:'good', stat:'w'}, {t:"服用鎮靜劑", type:'bad', stat:'i'}]},
                {q:"前方就是目標的巢穴！", opts: [{t:"佈置陷阱", type:'good', stat:'i'}, {t:"拔刀衝鋒", type:'bad', stat:'s'}]},
                // Boss 選項標記
                {q:`${q.boss} 出現在你面前！`, opts: [{t:"尋找弱點攻擊", type:'good', boss:true, bossName:q.boss, isQuest:true}, {t:"正面迎擊", type:'bad', boss:true, bossName:q.boss, isQuest:true}]}
            ]
        };
    } else {
        // 沒有任務時，使用原有的隨機地點邏輯
        let idx = reactiveGameState.storyOrder[(Math.floor(reactiveGameState.day/7) - 1) % Constant.EPIC_THEMES.length];
        if(idx === undefined) idx = 0; 
        let theme = Constant.EPIC_THEMES[idx];
        
        storyData = {
            title: `📅 第 ${Math.ceil(reactiveGameState.day/7)} 週：${theme}`,
            intro: `你來到了 <strong>${theme}</strong>。<br>這裡充滿未知的風險。`,
            steps: [
                {q:"入口被堵死。", opts: [{t:"尋找縫隙", type:'good', stat:'a'}, {t:"暴力破壞", type:'bad', stat:'s'}]},
                {q:"聽到腳步聲。", opts: [{t:"躲進通風管", type:'good', stat:'a'}, {t:"設下陷阱", type:'bad', stat:'i'}]},
                {q:"發現補給站。", opts: [{t:"尋找文件", type:'good', stat:'i'}, {t:"撬開鎖", type:'bad', stat:'s'}]},
                {q:"遇到倖存者。", opts: [{t:"安撫情緒", type:'good', stat:'w'}, {t:"先發制人", type:'bad', stat:'a'}]},
                {q:"遭遇領主！", opts: [{t:"觀察弱點", type:'good', boss:true, bossName:'區域領主', isQuest:false}, {t:"正面衝鋒", type:'bad', boss:true, bossName:'區域領主', isQuest:false}]}
            ]
        };
    }

     // 2. 定義 6 種戰術選項池
    const tactics = [
        { id: 'smash', t: '蠻力衝撞', stat: 's', desc: '造成 1-10% 最大生命傷害' },
        { id: 'rush',  t: '急速突襲', stat: 'a', desc: '先手 + 閃避提升' },
        { id: 'analyze', t: '尋找破綻', stat: 'i', desc: '大幅降低 Boss 防禦' },
        { id: 'trap',  t: '佈置陷阱', stat: 'i', desc: '開場暈眩 Boss' },
        { id: 'faith', t: '堅定信念', stat: 'w', desc: '獲得護盾 + 減免恐懼' },
        { id: 'gamble', t: '孤注一擲', stat: 'luck', desc: '隨機賦予多重負面狀態' }
    ];

    // 3. 隨機抽取 4 個選項供玩家選擇
    let availableTactics = tactics.sort(() => 0.5 - Math.random()).slice(0, 4);

    // 4. 構建選項數據
    let bossOpts = availableTactics.map(tac => {
        return {
            t: `${tac.t} <span style="font-size:0.8em;color:#aaa">(${tac.desc})</span>`,
            type: 'good', 
            stat: tac.stat,
            boss: true,
            bossName: bossName,
            // ★★★ 修復點：原本這裡是 isQuest (未定義)，必須改為 isQuestStory ★★★
            isQuest: isQuestStory, 
            strategy: tac.id 
        };
    });

    // 5. 組合最終步驟 (覆蓋原本的隨機步驟，強制進入 Boss 戰術選擇)
    storyData.steps = [
        {
            q: `遭遇強敵 <strong style="color:#f44">${bossName}</strong>！你打算採取什麼戰術開局？`,
            opts: bossOpts
        }
    ];

    storyState = { 
        step: 0, 
        score: 0, 
        type: 'epic', 
        lastResult: '', 
        data: storyData
    };

    hideGameContainer();
    renderStoryModal();
}

// story
// 新增：計算事件選項的成功率 (回傳 0-100 的數字)
export function getEventSuccessRate(type, statKey) {
    // 基礎機率：Good(穩妥選項)=66%, Bad(冒險選項)=24%
    let pSuccess = type === 'good' ? 66 : 24;
    
    // 1. 屬性修正
    let statVal = getStat(statKey);
    // 難度隨天數增加 (係數需與 calculateOutcome 保持一致)
    let difficulty = 10 + (reactiveGameState.day * 0.2); 
    
    // 每一點屬性差提供 0.5% 加成，上限 +/- 20%
    let statMod = (statVal - difficulty) * 0.5; 
    statMod = Math.max(-20, Math.min(20, statMod)); 

    // 2. 幸運修正
    let luckMod = (getStat('luck') - 10) * 0.5;
    luckMod = Math.max(-10, Math.min(10, luckMod));

    // 3. 道德修正 (善選項受高道德加成，惡選項受低道德加成)
    let moralMod = 0;
    if(type === 'good') { 
        if(reactiveGameState.moral > 50) moralMod = (reactiveGameState.moral - 50) * 0.2; 
    } else { 
        if(reactiveGameState.moral < 50) moralMod = (50 - reactiveGameState.moral) * 0.2; 
    }
    
    // 最終成功率
    let finalRate = pSuccess + statMod + luckMod + moralMod;
    
    // 馮狗 (休班警) 被動修正：成功率稍微降低但獎勵高 (這裡只反映顯示機率)
    if(reactiveGameState.job.passive === 'bad_cop') finalRate -= 10;

    return Math.floor(Math.max(5, Math.min(95, finalRate)));
}

// story
export function getEventReward() {
    let roll = Math.floor(Math.random() * 5);
    if(roll === 0) { reactiveGameState.san = Math.min(100, reactiveGameState.san + 5); return "🧠 意志堅定 (SAN +5)"; }
    if(roll === 1) { reactiveGameState.hp = Math.min(reactiveGameState.maxHp, reactiveGameState.hp + 10); return "❤️ 稍微喘息 (HP +10)"; }
    if(roll === 2) { gainXp(1); return "✨ 累積經驗 (XP +1)"; }
    if(roll === 3) { reactiveGameState.food += 2; return "🍖 找到殘渣 (Food +2)"; }
    if(roll === 4) { reactiveGameState.water += 2; return "💧 收集露水 (Water +2)"; }
}

// story
export function storyChoose(type, statKey, isBoss, bossName, isQuest, strategy) {
    // 1. 如果是 Boss 戰選項
    if (isBoss) {
        // 先進行屬性檢定 (成功/失敗)
        // 注意：這裡我們暫時把 'good' 傳入 calculateOutcome，代表這是正面檢定
        let outcome = calculateOutcome('good', statKey);
        
        // 記錄日誌
        let logText = (outcome === 'success' || outcome === 'crit_success') 
            ? `戰術執行成功！` 
            : `戰術執行失敗！`;
        
        // 關閉故事視窗
        closeModal();
        showGameContainer();
        
        // 觸發戰鬥，並傳入 策略ID 和 檢定結果
        let targetName = bossName || '區域領主';
        triggerBossFight(targetName, isQuest, strategy, outcome);
        return;
    }
    
    if(type === 'good') 
        reactiveGameState.moral = Math.min(100, reactiveGameState.moral + 2);
    if(type === 'bad') 
        reactiveGameState.moral = Math.max(0, reactiveGameState.moral - 2);
    let res = calculateOutcome(type, statKey);
    let resultText = "";
    let scoreChange = 0;
    
    // 馮狗 (休班警) 判定修正
    if(reactiveGameState.job.passive === 'bad_cop') {
        if(res === 'success' || res === 'crit_success') {
            if(Math.random() < 0.4) res = 'fail';
        }
    }

    if (res === 'crit_success') {
        scoreChange = 2;
        let reward = getEventReward();
        resultText = `<span class="c-epic">大成功！</span><br>${reward}<br>(全屬性微升)`;
        ['s','a','i','w'].forEach(s=>reactiveGameState.stats[s]++);
        gainXp(1); 
        reactiveGameState.money += 30;
        resultText += " (獲得 $30)";
        if(reactiveGameState.job.passive === 'bad_cop') { reactiveGameState.stats[s]++; resultText += " (黑警加成)"; }
    } else if (res === 'success') {
        scoreChange = 1;
        let reward = getEventReward();
        if(Math.random() < 0.5) {
            reactiveGameState.money += 5;
            resultText += " (獲得 $5)";
        }
        resultText = `<span class="c-gain">判定成功。</span><br>${reward}`;
    } else if (res === 'fail') {
        scoreChange = -1;
        let dmg = 10 + Math.floor(Math.random()*10);
        reactiveGameState.hp -= dmg;
        resultText = `<span class="c-loss">判定失敗。</span> (HP -${dmg})`;
    } else {
        scoreChange = -2;
        let dmg = 25 + Math.floor(Math.random()*15);
        reactiveGameState.hp -= dmg; reactiveGameState.san -= 10;
        resultText = `<span class="c-loss" style="font-weight:bold">大失敗！</span> (HP -${dmg}, SAN -10)`;
    }

    storyState.score += scoreChange;
    storyState.lastResult = resultText;
    renderStoryModal(true);
}

// story
export function nextStoryStep() { 
    storyState.step++;
    renderStoryModal(false);
}

// story
// 修改：修復視窗不關閉的 Bug，並根據地點發放平衡後的獎勵
export function finishStory() {
    // === 1. 地點隨機事件結算 ===
    if(storyState.type === 'loc_event') {
        let loc = storyState.loc;
        let score = storyState.score;
        let btnHtml = `<button onclick="closeModal(); campPhase()">返回營地 (Day +1)</button>`;

        if(score >= 0) { 
            let rewardType = Constant.LOC_REWARDS[loc] || 'random';
            if(rewardType === 'random') rewardType = ['food','water','melee','acc'][Math.floor(Math.random()*4)];
            
            let tier = (score >= 2) ? 2 : 1; 
            let xpGain = (score >= 2) ? 3 : 1;
            gainXp(xpGain);

            // --- 變動：事件獎勵平衡 (給予足夠生存量) ---
            if(rewardType === 'food' || rewardType === 'water') {
                let baseAmt = (score >= 2) ? 80 : 50;
                let finalAmt = baseAmt;
                if(rewardType === 'food') reactiveGameState.food += finalAmt; else reactiveGameState.water += finalAmt;
                
                openModal("事件完成", 
                    `你妥善處理了危機。<br><br>獲得：<strong style="color:#4f4">${rewardType==='food'?'食物':'水'} +${finalAmt}</strong><br>經驗 +${xpGain}`, 
                    btnHtml
                );
            } 
            else {
                // 裝備類獎勵，若是產糧地則額外補貼食物
                let extraFoodMsg = "";
                if(LOC_REWARDS[loc] === 'food') {
                    let subsidy = 25; 
                    reactiveGameState.food += subsidy;
                    log('生存', `事件額外獲得食物 +25`, 'c-gain');
                }

                // 使用 BASE_DB/COMMON_DB 獲取物品名稱
                let dbName = (COMMON_DB[rewardType] && COMMON_DB[rewardType][0]) ? COMMON_DB[rewardType][0].n : 'random';
                let item = createItem(rewardType, dbName, tier);
                showLootModal(item, rewardType, campPhase);
            }
        } else {
            // 失敗懲罰邏輯
            let penalty = "";
            if(score <= -2) {
                let dmg = 15; reactiveGameState.hp -= dmg; penalty = `<br><span style="color:#f44">你在混亂中受了傷 (HP -${dmg})</span>`;
            }
            // 噩夢模式失敗保底
            if(reactiveGameState.diff === 3) {
                reactiveGameState.food += 5; 
                penalty += `<br><span style="color:#888;font-size:0.8em">你只撿到了極少量的碎屑 (食物+5)</span>`;
            }
            openModal("事件結束", 
                `情況失控了，你只能狼狽逃離。${penalty}`, 
                btnHtml
            );
        }
        return; // 重要：結束函數，避免執行下方的代碼
    }

    // === 2. 主線/每週 Epic Story 結算 ===
    let rewardType = ['melee','ranged','acc','med'][Math.floor(Math.random()*4)];
    let tier = storyState.type==='epic' ? 3 : 2;
    if(storyState.score >= 3) tier++; 
    if(storyState.score <= -1) tier = Math.max(1, tier-2); 
    
    if(storyState.score <= -3) { 
        openModal("一無所獲", "沒有任何收穫。", `<button onclick="closeModal(); campPhase()">返回</button>`); 
        return; 
    }
    
    let dbName = (COMMON_DB[rewardType] && COMMON_DB[rewardType][0]) ? COMMON_DB[rewardType][0].n : 'random';
    let item = createItem(rewardType, dbName, tier);
    showLootModal(item, rewardType, campPhase);
}

// story
export function showQuestDetail() {
    // 計算當前應該出現的任務索引 (每 14 天一個任務)
    let questIndex = Math.floor((reactiveGameState.day - 1) / 14);
    
    // 防止索引超出範圍 (如果超過 196 天)
    if (questIndex >= QUEST_DB.length) questIndex = QUEST_DB.length - 1;

    let availableQuest = QUEST_DB[questIndex];
    
    // 如果目前已經接了任務，顯示當前任務狀態
    if (reactiveGameState.activeQuest) {
        let q = reactiveGameState.activeQuest;
        let rewardName = Constant.STAT_MAP[q.reward.type] || "物資";
        
        let html = `
            <div style="padding:10px;">
                <h2 style="color:var(--quest-color); margin-top:0">${q.n}</h2>
                <div style="background:#222; padding:10px; border-radius:5px; border:1px solid #444; margin-bottom:10px;">
                    <div style="margin-bottom:5px">📍 <strong style="color:#fff">${q.loc}</strong></div>
                    <div style="margin-bottom:5px">💀 目標：<span style="color:#f44">${q.boss}</span></div>
                    <div style="margin-bottom:5px">🎁 獎勵：<span style="color:var(--r-epic)">${rewardName} (Tier ${q.reward.tier})</span></div>
                </div>
                <div style="line-height:1.6; color:#ccc; border-left:2px solid var(--quest-color); padding-left:10px;">
                    ${q.desc}
                </div>
                <div style="margin-top:15px; font-size:0.85em; color:#888">
                    <span style="color:#4f4">提示：</span>本週的【外出事件】將必定發生在該地點。<br>請等待每週結算或繼續探索。
                </div>
            </div>
        `;
        openModal("📜 當前任務", html, `<button onclick="closeModal()">關閉</button><button onclick="abandonQuest()" style="border-color:#f44; color:#f44">放棄任務</button>`);
        return;
    }

    // 如果沒有接任務，顯示當前時段可用的任務
    let html = `
        <div style="text-align:center; padding:10px;">
            <h3 style="color:#aaa">無線電攔截信號...</h3>
            <p style="font-size:0.9em; color:#666">Day ${questIndex * 14 + 1} - Day ${(questIndex + 1) * 14} 週期任務</p>
            <div class="comp-box" style="margin-top:15px; text-align:left">
                <strong style="color:var(--quest-color)">${availableQuest.n}</strong><br>
                <span style="font-size:0.9em">地點：${availableQuest.loc}</span><br>
                <span style="font-size:0.9em; color:#f44">威脅：${availableQuest.boss}</span><br>
                <p style="font-size:0.85em; color:#ccc">${availableQuest.desc}</p>
            </div>
        </div>
    `;
    openModal("任務日誌", html, `<button onclick="acceptQuest(${questIndex})">接取任務</button><button onclick="closeModal()">關閉</button>`);
}

// story
export function acceptQuest(index) {
    reactiveGameState.activeQuest = QUEST_DB[index];
    log('任務', `已接取：${reactiveGameState.activeQuest.n}`, 'c-quest');
    closeModal();
    updateUI(); 
    if(document.getElementById('action-area').innerText.includes('探索')) renderCampActions();
}

// story
export function abandonQuest() {
    log('任務', `放棄了任務：${reactiveGameState.activeQuest.n}`, 'c-loss');
    reactiveGameState.activeQuest = null;
    closeModal();
    updateUI();
}


// story
export function completeQuest() {
    let q = reactiveGameState.activeQuest; reactiveGameState.activeQuest = null;
    
    // 如果獎勵是裝備類
    if(['acc','melee','ranged','med','head','body'].includes(q.reward.type)) {
        // ★★★ 修正：原本這裡使用了未定義的 BASE_DB，導致遊戲卡死 ★★★
        // 改為使用 'random'，讓 createItem 自動生成該類型的隨機傳說物品
        let i = createItem(q.reward.type, 'random', q.reward.tier);
        
        i.val = Math.floor(i.val*1.5); 
        i.fullName = `傳說的 ${i.fullName}`;
        showLootModal(i, q.reward.type, campPhase);
    } 
    // 如果是其他類型 (如果有設定的話)
    else { 
        openModal("任務完成", "獲得特殊獎勵!", `<button onclick="closeModal(); campPhase()">確認</button>`); 
    }
}
