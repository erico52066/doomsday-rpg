// ==================== Data import ====================
// ==================== 0. 基礎資料庫 ====================

import MBTI_TYPES from './data/MBTI_TYPES.json' with  { type: "json" };
// 共通裝備庫：5類 x 5 Tier x 10種 = 250種
// 格式：[ [Tier1 items...], [Tier2 items...], ... ]

// 共通裝備庫：5類裝備 + 2類消耗品
import COMMON_DB from './data/COMMON_DB.json' with  { type: "json" };
// ==================== 職業專屬裝備庫 (Tier 1 基礎值) ====================
// 這些是各職業的「本命裝備」，只有該職業能找到。
// 系統會根據天數自動為它們加上 Tier 前綴 (如 "精工 銀魂武士刀") 並大幅提升數值。
import JOB_EXCLUSIVE_DB from './data/JOB_EXCLUSIVE_DB.json' with  { type: "json" };
import ALL_JOBS from './data/ALL_JOBS.json' with  { type: "json" };
import QUEST_DB from './data/QUEST_DB.json' with  { type: "json" };
import LOCATIONS from './data/LOCATIONS.json' with  { type: "json" };
import LOC_EVENT_DB from './data/LOC_EVENT_DB.json' with { type: "json" };
import AFFIX_DB from './data/AFFIX_DB.json' with { type: "json" };
import BOSS_LOOT_DB from './data/BOSS_LOOT_DB.json' with { type: "json" };
import SKILL_DB from './data/SKILL_DB.json' with { type: "json" };

// ==================== 怪物資料庫擴充 ====================
import ENEMY_PREFIXES from './data/ENEMY_PREFIXES.json' with { type: "json" };
// 1. 普通怪物庫 (50種, 10 per Tier)
// 結構: { n:名字, hp:基數, atk:基數, desc:描述, tier:等級 }
import NORMAL_ENEMIES from './data/NORMAL_ENEMIES.json' with  { type: "json" };

// 2. 精英怪物庫 (20種, 4 per Tier) - 具備獨特技能
import ELITE_ENEMIES from './data/ELITE_ENEMIES.json' with  { type: "json" };

// 3. 地點專屬 Boss (12地點 x 5 Tier = 60 Bosses)
// 每個 Boss 至少 2 個技能
import LOCATION_BOSSES from './data/LOCATION_BOSSES.json' with  { type: "json" };

import SKILLS from './data/SKILLS.json' with  { type: "json" };
import MAIN_PLOT from './data/MAIN_PLOT.json' with  { type: "json" };

const STAT_MAP = { 
    s:'力量',
    a:'敏捷',
    i:'智力',
    w:'意志',
    moral:'道德',
    luck:'幸運',
    loot:'掉寶率', // 修改：加個"率"字
    heal:'回血',
    san:'SAN',
    hp:'生命',
    // ★★★ 新增以下對照 ★★★
    crit: '暴擊率',
    dodge: '閃避率',
    defP: '物理減傷',
    acc: '命中率',
    // 裝備部位 (保持不變)
    melee:'近戰武器',
    ranged:'遠程武器',
    acc_slot:'飾品', // 避免與命中率 acc 衝突，這裡改個 key 名稱 (程式碼裡飾品是用 'acc'，需要注意)
    med:'醫療',
    head:'頭盔',
    body:'護甲',
    shoes:'足部'
};

// 定義職業專屬裝備的 Tier 前綴與倍率
const JOB_TIER_PREFIX = [
    { p: "", mul: 1.0 },              // T1: 0-29 days
    { p: "改良的 ", mul: 1.5 },       // T2: 30-59 days
    { p: "精工 ", mul: 2.2 },         // T3: 60-89 days
    { p: "史詩級 ", mul: 3.5 },       // T4: 90-119 days
    { p: "覺醒·", mul: 5.5 }          // T5: 120+ days
];

const EPIC_THEMES = [
    "🏥 廢棄綜合醫院", "🏫 寂靜的私立高中", "🏢 崩塌的證券交易所", "🎡 鏽蝕的遊樂園", "🕍 古老的山中修道院", 
    "🏭 洩漏的化工廠", "🚉 地下鐵總站", "🛳️ 擱淺的豪華郵輪", "🏰 歷史博物館", "🏟️ 奧林匹克體育場", 
    "🚓 警察總部大樓", "🏨 豪華度假酒店", "📡 軍事通訊塔", "🏗️ 未完工的摩天樓", "🌲 變異森林深處"
];

// 修改：在 storyState 中記錄地點名稱 (loc)，以便結算時發放對應獎勵
function triggerLocationEvent(locName) {
    let events = LOC_EVENT_DB[locName];
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
    renderStoryModal();
}

	// === 新增：職業分類數據 ===
const RPG_CLASSES = {
    'warrior': { 
        label: '🛡️ 鐵衛 (坦克/生存)', 
        color: '#d96',
        jobs: ['健身教練', '男護士', 'iBanker', '圍棋棋士', '特教老師'] 
    },
    'berserker': { 
        label: '⚔️ 狂戰 (爆發/力量)', 
        color: '#f44',
        jobs: ['圍村村霸', '地盤判頭', '三星廚師', '地產商', 'Cosplayer'] 
    },
    'ranger': { 
        label: '🏹 遊俠 (敏捷/暴擊)', 
        color: '#4f4',
        jobs: ['電競選手', '飛鏢運動員', 'F1賽車手', '造型師', '警察', '外送員', 'Popper'] 
    },
    'mage': { 
        label: '🔮 秘法 (智力/控制)', 
        color: '#4cf',
        jobs: ['Tesla工程師', 'Nvidia工程師', '道士', '心理醫生', '攝影師', '神學家', '數學家', '黑客'] 
    },
    'special': { 
        label: '🦄 特殊 (機制/運氣)', 
        color: '#ffd700',
        jobs: ['機械師', '小學生', '莊家', '賭場荷官', '精算師', '園藝師', '追星族'] 
    }
};

// ==================== 1. 遊戲核心變數 ====================
// 1. 替換 let G = { ... }
let G = { 
    day:0, maxDay:196, diff:1, hp:100, maxHp:100, san:100, food:100, water:100, ammo:0, 
    level:1, xp:0, nextLvl:20, money: 100, // 新增 money
    stats:{s:0,a:0,i:0,w:0}, 
    moral: 50, luck: 10,
    eq:{melee:null, ranged:null, head:null, body:null, acc:null}, 
    bag: [], // 新增 bag
    shop: { items: [], lastDay: -1, isBlackMarket: false }, // 新增 shop
    buffs:[], alive:true, job:{}, mbti:null, flags:{depression:false}, 
    activeSkillCD:0, playerDefCD:0, storyOrder: [], activeQuest: null, tempLoot: null, dialogCallback: null,
    danceStyle: null, zombieCount: 0, isDefending: false, combat: null // combat 初始化
};

// 2. 替換 startGame 函數 (確保重置所有數據)
function startGame(diff) {
    G.diff = diff;
    G.day = 0; G.hp = 100; G.san = 100; G.food = 100; G.water = 100; G.ammo = 0; G.alive = true;
    G.stats = {s:0,a:0,i:0,w:0}; G.moral = 50; G.luck = 10;
    G.level = 1; G.xp = 0;
	G.hpPenalty = 0;
    
    // --- 新增重置邏輯 ---
    G.money = (diff === 3) ? 50 : 100; // 噩夢開局錢少
    G.bag = [];
    G.shop = { items: [], lastDay: -1, isBlackMarket: false };
    // ------------------

    G.storyOrder = [...Array(EPIC_THEMES.length).keys()].sort(() => 0.5 - Math.random());
    G.activeQuest = null;
    
    document.getElementById('screen-start').style.display = 'none';
    
    renderJobIntro(); 
    document.getElementById('screen-jobs').style.display = 'flex';
}


// === 新增：初始引導畫面 ===
function renderJobIntro() {
    // 1. 清除所有按鈕的高亮狀態 (重置為預設)
    const allTabs = ['warrior', 'berserker', 'ranger', 'mage', 'special'];
    allTabs.forEach(tab => {
        let btn = document.getElementById('tab-' + tab);
        if (btn) {
            btn.style.backgroundColor = '#252525';
            btn.style.color = RPG_CLASSES[tab].color;
            btn.style.fontWeight = 'normal';
            btn.style.boxShadow = 'none';
            btn.style.opacity = '0.7'; // 稍微變暗，暗示未選中
        }
    });

    // 2. 獲取容器並清空
    let container = document.getElementById('job-container');
    container.innerHTML = '';
    
    // 3. 插入引導文字 (使用 Flex 居中顯示)
    // 這裡我們把容器暫時改為 flex 布局以便居中，點擊按鈕後 renderJobs 會改回 grid
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    
    let html = `
        <div style="text-align:center; padding:20px; color:#aaa;">
            <h3 style="margin-bottom:20px; color:#fff;">請點擊上方按鈕選擇系別</h3>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px; text-align:left; width:100%; max-width:600px;">
                <div style="border-left:3px solid #aaa; padding-left:10px;">
                    <strong style="color:#d96">🛡️ 鐵衛</strong><br>
                    <span style="font-size:0.8em">高生存、防禦、格擋、回血。</span>
                </div>
                <div style="border-left:3px solid #f44; padding-left:10px;">
                    <strong style="color:#f44">⚔️ 狂戰</strong><br>
                    <span style="font-size:0.8em">高爆發、以血換血、燃燒。</span>
                </div>
                <div style="border-left:3px solid #4f4; padding-left:10px;">
                    <strong style="color:#4f4">🏹 遊俠</strong><br>
                    <span style="font-size:0.8em">高敏捷、閃避、暴擊、連擊。</span>
                </div>
                <div style="border-left:3px solid #4cf; padding-left:10px;">
                    <strong style="color:#4cf">🔮 秘法</strong><br>
                    <span style="font-size:0.8em">高智力、控制(暈/睡)、異常狀態。</span>
                </div>
                <div style="border-left:3px solid #ffd700; padding-left:10px;">
                    <strong style="color:#ffd700">🦄 特殊</strong><br>
                    <span style="font-size:0.8em">召喚、金錢攻擊、運氣機制。</span>
                </div>
            </div>
            <p style="margin-top:30px; font-size:0.9em; color:#666;">點擊上方按鈕即可查看詳細角色數值</p>
        </div>
    `;
    
    container.innerHTML = html;
}

function renderJobs(category) {
    // 1. 處理按鈕高亮樣式 (UI回饋)
   const allTabs = ['warrior', 'berserker', 'ranger', 'mage', 'special'];
    allTabs.forEach(tab => {
        let btn = document.getElementById('tab-' + tab);
        if (btn) {
            if (tab === category) {
                // 選中
                btn.style.backgroundColor = RPG_CLASSES[tab].color;
                btn.style.color = '#000'; 
                btn.style.fontWeight = 'bold';
                btn.style.boxShadow = `0 0 10px ${RPG_CLASSES[tab].color}`;
                btn.style.opacity = '1';
            } else {
                // 未選中
                btn.style.backgroundColor = '#252525';
                btn.style.color = RPG_CLASSES[tab].color;
                btn.style.fontWeight = 'normal';
                btn.style.boxShadow = 'none';
                btn.style.opacity = '0.6'; // 未選中變暗
            }
        }
    });

    // 2. 獲取容器並清空
    let container = document.getElementById('job-container');
    container.innerHTML = '';
    
	// ★★★ 新增：將容器樣式還原為 Grid (因為 Intro 頁面把它改成了 Flex) ★★★
    container.style.display = 'grid';
    container.style.flexDirection = 'unset';
    container.style.alignItems = 'unset';
    container.style.justifyContent = 'unset';
    // ===============================================================

    // 3. 獲取該分類的數據
    const group = RPG_CLASSES[category];
    
    // 4. 過濾職業
    let pool = ALL_JOBS.filter(j => 
        group.jobs.some(targetName => j.n.includes(targetName)) && !j.n.includes('Lil Kid')
    );

    // 5. 生成卡片 (Grid Item)
    pool.forEach(j => {
        let div = document.createElement('div');
        div.className = 'comp-box'; 
        div.style.cursor = 'pointer';
        div.style.textAlign = 'left';
        div.style.border = `1px solid ${group.color}`; // 邊框跟隨分類顏色
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.justifyContent = 'space-between';
        
        // 懸停效果
        div.onmouseover = () => { div.style.backgroundColor = '#222'; };
        div.onmouseout = () => { div.style.backgroundColor = '#080808'; };
        
        let statText = `<span style="color:#f66">力${j.s.s}</span> <span style="color:#4f4">敏${j.s.a}</span> <span style="color:#4cf">智${j.s.i}</span> <span style="color:#f4f">意${j.s.w}</span>`;
        
        div.innerHTML = `
            <div>
                <div class="q3" style="font-size:1.1em; margin-bottom:8px; color:${group.color}; text-shadow:none;">${j.n}</div>
                <div style="font-size:0.9em; margin-bottom:8px; background:#1a1a1a; padding:4px; border-radius:3px; text-align:center;">${statText}</div>
                <div style="font-size:0.85em; color:#ccc; line-height:1.5;">${j.desc}</div>
            </div>
            <div style="margin-top:10px; font-size:0.8em; color:#666; text-align:right;">
                特質: ${j.trait}
            </div>
        `;
        
        div.onclick = () => { G.job = j; G.stats = {...j.s}; showMbti(); };
        container.appendChild(div);
    });
}
function showMbti() {
    document.getElementById('screen-jobs').style.display = 'none';
    let c = document.getElementById('mbti-container');
    c.innerHTML = '';
    let choices = MBTI_TYPES.sort(()=>0.5-Math.random()).slice(0, 2);
    choices.forEach(m => {
        let bonusText = [];
        for(let k in m.bonus) {
            let val = m.bonus[k];
            let label = STAT_MAP[k] || k;
            if(val < 1 && val > -1) val = Math.floor(val*100) + '%';
            bonusText.push(`${label} +${val}`);
        }
        let div = document.createElement('div');
        div.className = 'comp-box'; div.style.width='250px'; div.style.cursor='pointer';
        div.innerHTML = `<strong class="c-mbti">${m.id} ${m.name}</strong><br><span style="font-size:0.8em;color:#aaa">${m.desc}</span><br><div style="margin-top:8px;color:#fff;font-size:0.9em">${bonusText.join(', ')}</div>`;
        div.onclick = () => { finishSetup(m); };
        c.appendChild(div);
    });
    document.getElementById('screen-mbti').style.display = 'flex';
}

function finishSetup(m) {
    G.mbti = m;
    for(let k in m.bonus) {
        if(['s','a','i','w'].includes(k)) G.stats[k] += m.bonus[k];
        if(k==='luck') G.luck += m.bonus.luck;
        if(k==='moral') G.moral += m.bonus.moral;
    
    }

    let g = G.job.g; // g[0]=melee name, g[1]=ranged name...
    // 強制生成 Tier 1 的職業裝備
    G.eq.melee = createItem('melee', g[0], 1, false); 
    G.eq.ranged = createItem('ranged', g[1], 1, false); 
    G.eq.head = createItem('head', g[2], 1, false);
    G.eq.body = createItem('body', g[3], 1, false);
    G.eq.acc = createItem('acc', g[4], 1, false);
    G.eq.shoes = createItem('shoes', g[5] || '破爛球鞋', 1, false); 
    
    if(G.eq.ranged.name !== '無') G.ammo += (G.eq.ranged.ammo || 5);

    if(G.diff===2) { G.food=80; G.water=80; }
    if(G.diff===3) { G.food=50; G.water=50; G.hp=80; }
    
    // =========== ★★★ 請在這裡插入代碼 ★★★ ===========
    G.unlockedSkills = [];
    
    // 初始化技能：如果職業有 skill_tree，解鎖第一招
    if (G.job.skill_tree && G.job.skill_tree.length > 0) {
        G.unlockedSkills.push(G.job.skill_tree[0]);
    }
    // =================================================

    document.getElementById('screen-mbti').style.display = 'none';
    
    recalcMaxHp(); 
    G.hp = G.maxHp; 

    updateUI();
    showPlotDialog(1, showJobIntro);
}

function recalcMaxHp() {
    let base = 100;
    if(G.job.hpBonus) base += G.job.hpBonus;
    if(G.job.trait==='南丁格爾') base += 50;
    if(G.mbti && G.mbti.bonus && G.mbti.bonus.hp) base += G.mbti.bonus.hp;
    for(let k in G.eq) {
        if(G.eq[k] && G.eq[k].stats && G.eq[k].stats.hp) base += G.eq[k].stats.hp;
    }
    
    // ★★★ 修改：扣除累積的血量懲罰 ★★★
    if (G.hpPenalty > 0) {
        base -= G.hpPenalty;
    }

    // 保底 10 點血，避免負數
    base = Math.max(10, base);

    G.maxHp = base;
    if(G.hp > G.maxHp) G.hp = G.maxHp;
    updateUI();
}

function showJobIntro() {
    let html = `<div class="story-text" style="border-color:var(--r-legend)">${G.job.back}</div>`;
    openModal(`職業背景：${G.job.n}`, html, `<button onclick="startJourney()">開始旅程</button>`);
}

function startJourney() {
    closeModal();
    G.day = 1; 
    log('系統', '旅程開始。', 'c-story');
    updateUI();
    renderCampActions(); 
}

// ==================== 3. 營地與主循環 ====================
function campPhase() {
    if(!G.alive) return;
    if(G.hp<=0) return gameOver("死於耗竭");
    if(G.day >= 197) return triggerBossFight("最終屍王"); 

    G.day++;
    G.playerDefCD = Math.max(0, G.playerDefCD - 1); // 防禦CD如果是回合制也可移走，這裡暫時保留或視需求改動
    
    // =========== ★★★ 請在這裡插入代碼 ★★★ ===========
    // === 新增：30天頓悟系統 ===
    // 檢查條件：有技能樹、天數大於0、且是30的倍數
    if (G.job.skill_tree && G.day > 0 && G.day % 30 === 18) {
        let skillIndex = Math.ceil(G.day / 30); 
        
        // 確保索引在範圍內
        if (skillIndex < G.job.skill_tree.length) {
            let newSkillId = G.job.skill_tree[skillIndex];
            
            // 避免重複添加 (如果存檔系統未來加入，這很重要)
            if (!G.unlockedSkills.includes(newSkillId)) {
                G.unlockedSkills.push(newSkillId);
                
                // 從 DB 獲取技能資料以顯示名稱
                // 注意：這裡需要確保 SKILL_DB 已被 import
                let sData = SKILL_DB[newSkillId] || { n: "未知技能", desc: "力量在體內湧動..." };
                
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

    if(G.job.trait==='抑鬱霸王') {
        let depressChance = 0.3 - ((G.moral - 50) * 0.005); // 50道德=30%, 100道德=5%
        G.flags.depression = (Math.random() < Math.max(0.05, depressChance));
        if(G.flags.depression) log('狀態', '你今天感到莫名的抑鬱', 'c-loss');
    }

    if(MAIN_PLOT[G.day]) {
        showPlotDialog(G.day, checkWeeklyEvent);
        return;
    }
    
    checkWeeklyEvent();
}

function checkWeeklyEvent() {
    if((G.day % 10 === 0 && G.day <= 60) || G.day % 7 === 0) {
        startEpicStory();
        return;
    }
    normalCampLogic();
}

function normalCampLogic() {
    let weather = [{n:'☀️ 晴朗',c:0},{n:'🌧️ 暴雨',c:1},{n:'🌫️ 濃霧',c:2}][Math.floor(Math.random()*3)];
    document.getElementById('w-text').innerText = weather.n;
    
    
    let baseCost = 20;
    if(G.diff === 2) baseCost = 25;
    if(G.diff === 3) baseCost = 35;

    if(G.job.passive === 'dev_buff') baseCost = Math.floor(baseCost * 0.6);  // Kim 地產霸權

    G.food -= baseCost; G.water -= baseCost;
    log('生存', `消耗食物 -${baseCost}, 水源 -${baseCost}`, 'c-loss');

    // === 天氣收益 (削弱) ===
    if(weather.c === 1) { 
        // 舊版: +30 / +15
        // 新版: +15 (正常) / +5 (噩夢 - 酸雨難以收集)
        // 這樣玩家不能單靠天氣活著，必須去尋水
        let waterGain = (G.diff === 3) ? 5 : 15;
        G.water += waterGain; 
        log('天氣', `收集雨水 +${waterGain}`, 'c-gain'); 
    }
    
    // === 飢渴懲罰 (致命化) ===
    if(G.food < 0 || G.water < 0) { 
        let starveDmg = (G.diff === 3) ? 50 : 20;
        G.hp -= starveDmg; 
        log('生存', `嚴重飢渴受傷 -${starveDmg}`, 'c-loss'); 
    }
    
    // === 自然回血 ===
    let heal = 5;
    if(G.mbti && G.mbti.bonus && G.mbti.bonus.heal) heal += G.mbti.bonus.heal;
    if(G.job.trait==='護理') heal += 5;
    for(let k in G.eq) if(G.eq[k]?.stats?.heal) heal += G.eq[k].stats.heal;
    
    // 噩夢模式下，只有通過藥物或技能才能有效回血，自然回復極低
    if(G.diff === 3) heal = Math.floor(heal * 0.3);
    
    if(heal > 0) { 
        G.hp = Math.min(G.maxHp, G.hp+heal); 
    }
    
    updateUI();
    renderCampActions();
}

function renderCampActions() {
	// ★★★ 新增這兩行來隱藏敵人區域 ★★★
    document.getElementById('enemy-area').style.display = 'none';
    document.getElementById('enemy-area').innerHTML = ''; 

    let html = `<div style="text-align:center; margin-bottom:10px; color:#fff">⛺ 營地 Day ${G.day}</div>`;
    html += `<div class="btn-grid">`;
    html += `<button onclick="exploreSetup()">🗺️ 外出探索<br><span style="font-size:0.8em;color:#aaa">精力-20</span></button>`;
    html += `<button onclick="campAction('rest')">💤 休息<br><span style="font-size:0.8em;color:#aaa">食物-20</span></button>`;
    html += `<button onclick="campAction('water')">💧 尋水<br><span style="font-size:0.8em;color:#aaa">精力-15</span></button>`;
    html += `<button onclick="campAction('train')">🏋️ 訓練<br><span style="font-size:0.8em;color:#aaa">水-30</span></button>`;
    
    let cap = getBagCapacity();
    let count = G.bag.length;
    let bagColor = count >= cap ? '#f44' : '#aaa';
    html += `<button onclick="openCampBag()">🎒 查看背包<br><span style="font-size:0.8em;color:${bagColor}">(${count}/${cap})</span></button>`;
    html += `<button onclick="openShop()">🛒 營地商店<br><span style="font-size:0.8em;color:#ffd700">2%黑市</span></button>`;
    
    html += `</div>`;
    document.getElementById('action-area').innerHTML = html;
}


// === 物品標籤生成器 ===
function getItemTypeTag(type) {
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

// === 營地背包系統 ===

function openCampBag() {
    if(G.bag.length === 0) {
        openModal("背包", "背包裡空空如也。", `<button onclick="closeModal()">關閉</button>`);
        return;
    }

    let html = `<div style="display:grid; gap:8px; max-height:60vh; overflow-y:auto;">`;
    G.bag.forEach((item, idx) => {
        let effDesc = item.stats.eff ? ` (${item.stats.eff})` : '';
        let valDesc = '';
        
         if(item.type === 'med') {
            // 藥品顯示 HP/SAN
            let parts = [];
            if(item.stats.hp) parts.push(`HP+${item.stats.hp}`);
            if(item.stats.san) parts.push(`SAN+${item.stats.san}`);
            valDesc = parts.join(' ');
        }
        else if(item.type === 'food') {
            valDesc = `飽食度 +${item.val}`;
        }
        else if(item.type === 'water') {
            valDesc = `水分 +${item.val}`;
        }
        else if(item.type === 'throwable') {
            valDesc = `造成傷害 ${item.val}`;
        }
        else {
            // 裝備類：動態獲取標籤 (攻擊力/防禦力)
            let lbl = getItemValueLabel(item.type);
            // 去掉 Emoji 以保持背包排版簡潔 (可選，這裡我保留了標籤文字)
            // 由於 getItemValueLabel 現在帶 Emoji，我們直接用
            valDesc = `${lbl}: ${getEquipVal(item)}`; 
        }
        // ========================================

        let actionBtn = '';
       // 1. 消耗品 -> 使用
        if(item.type === 'med' || item.type === 'food' || item.type === 'water') {
            actionBtn = `<button onclick="useCampItem(${idx})" style="width:auto; padding:4px 10px; background:#254; border-color:#4f4">使用</button>`;
        }
        // 2. 裝備類 -> 裝備 (新增)
        else if (['melee', 'ranged', 'head', 'body', 'acc', 'shoes'].includes(item.type)) {
            actionBtn = `<button onclick="equipFromBag(${idx})" style="width:auto; padding:4px 10px; background:#245; border-color:#48f">裝備</button>`;
        }
        
        html += `<div style="background:#222; padding:8px; border:1px solid #444; display:flex; justify-content:space-between; align-items:center;">
            <div style="text-align:left">
                <div>${getItemTypeTag(item.type)} <span class="q${item.rarity}" style="font-weight:bold">${item.fullName}</span></div>
                <div style="font-size:0.8em; color:#ddd; margin-top:2px">${valDesc} ${effDesc}</div>
                <div style="font-size:0.75em; color:#888">${item.stats.desc || ''}</div>
            </div>
            <div style="display:flex; gap:5px;">
                ${actionBtn}
                <button onclick="discardCampItem(${idx})" style="width:auto; padding:4px 10px; background:#522; border-color:#f44">丟棄</button>
            </div>
        </div>`;
    });

    html += `</div>`;
    html += `<div style="margin-top:10px; font-size:0.9em; color:#888; text-align:right">
        容量: ${G.bag.length} / ${getBagCapacity()}
    </div>`;
    openModal("🎒 營地背包", html, `<button onclick="closeModal()">關閉</button>`);
}
function useCampItem(idx) {
    let item = G.bag[idx];
    let used = false;
    let msg = "";

	// --- 新增：食物使用邏輯 ---
    if(item.type === 'food' || item.type === 'water') {
        let val = item.val;
        if(item.type === 'food') {
            G.food += val;
            msg = `飽食度 +${val}`;
        } else {
            G.water += val;
            msg = `水分 +${val}`;
        }
        used = true;
        log('營地', `使用了 ${item.fullName}: ${msg}`, 'c-gain');
    }
    // --- 新增結束 --

    if(item.type === 'med') {
        // 恢復邏輯
        let healed = false;
        if(item.stats.hp && G.hp < G.maxHp) {
            let oldHp = G.hp;
            G.hp = Math.min(G.maxHp, G.hp + item.stats.hp);
            msg += `HP恢復 ${G.hp - oldHp}. `;
            healed = true;
        }
        if(item.stats.san && G.san < 100) {
            let oldSan = G.san;
            G.san = Math.min(100, G.san + item.stats.san);
            msg += `SAN值恢復 ${G.san - oldSan}. `;
            healed = true;
        }

        if(!healed && !item.stats.s && !item.stats.a) {
            // 如果滿血且藥物只有恢復功能
            if(!confirm("狀態已滿，確定要浪費藥品嗎？")) return;
        }
        
        used = true;
        log('營地', `使用了 ${item.fullName}: ${msg}`, 'c-gain');
    }

    if(used) {
        G.bag.splice(idx, 1); // 移除物品
        updateUI(); // 更新血條
        openCampBag(); // 重新打開背包刷新列表
    }
}

function discardCampItem(idx) {
    let item = G.bag[idx];
    if(confirm(`確定要丟棄 ${item.fullName} 嗎？此操作無法撤銷。`)) {
        G.bag.splice(idx, 1);
        log('營地', `丟棄了 ${item.fullName}`, 'c-loss');
        openCampBag(); // 刷新列表
        updateUI(); // 更新UI (如果是裝備按鈕上的狀態)
    }
}
	
	// ==========================================
// ★★★ 請在這裡插入 equipFromBag 函數 ★★★
// ==========================================

function equipFromBag(idx) {
    let newItem = G.bag[idx];    // 從背包獲取新裝備
    let type = newItem.type;     // 獲取部位類型
    let oldItem = G.eq[type];    // 獲取身上當前裝備

    // 1. 從背包移除新裝備
    G.bag.splice(idx, 1);

    // 2. 將身上的舊裝備放入背包
    // 交換必定成功，因為是一進一出，不需要檢查容量
    if (oldItem) {
        G.bag.push(oldItem);
    }

    // 3. 穿上新裝備
    G.eq[type] = newItem;

    // 4. 更新狀態與UI
    log('裝備', `更換裝備：${newItem.fullName}`, 'c-gain');
    
    recalcMaxHp(); // 重新計算屬性（血量上限等）
    updateUI();    // 更新主介面數值
    openCampBag(); // 重新渲染背包介面（顯示交換後的結果）
}


function campAction(act) {
    if(act==='rest') {
        if(G.food<20) { log('提示','食物不足'); return; }
        
        // === 修改點：大幅提升休息效果 ===
        G.food -= 20; 
        // HP恢復改為：固定30 + 最大血量的20% (這樣血量越高回越多)
        let healAmt = 30 + Math.floor(G.maxHp * 0.2);
        G.hp = Math.min(G.maxHp, G.hp + healAmt); 
        G.san = Math.min(100, G.san + 25); // SAN值也多回一點
        
        log('休息',`體力恢復 (+${healAmt} HP)`,'c-gain');
    }  else if(act==='water') {
        let v = 20+Math.floor(Math.random()*30); G.water+=v;
        log('尋水',`獲得水 ${v}`,'c-gain');
    } else if(act==='train') {
        if(G.water<30) { log('提示','水不足'); return; }
        G.water-=30; let s=['s','a','i'][Math.floor(Math.random()*3)]; G.stats[s]++;
        log('訓練',`${STAT_MAP[s]} +1`,'c-gain');
    }
    campPhase(); 
}

// ==================== 等級與經驗系統 ====================
function gainXp(amount) {
    G.xp += amount;
    log('成長', `獲得經驗 +${amount}`, 'c-xp');
    checkLevelUp();
    updateUI();
}

function checkLevelUp() {
    while(G.xp >= 20) {
        G.xp -= 20;
        G.level++;
        recalcMaxHp(); // 升級可能影響屬性，從而影響HP上限
        G.hp = G.maxHp; 
        let stats = ['s','a','i','w'];
        let s = stats[Math.floor(Math.random()*stats.length)];
        G.stats[s]++;
        
        let statName = STAT_MAP[s];
        openModal("✨ 升級！", 
            `<h2 style="color:var(--xp-color)">Level ${G.level}</h2>
            <div>狀態完全恢復！</div>
            <div style="margin-top:10px;font-size:1.2em">獲得屬性：<strong style="color:#fff">${statName} +1</strong></div>`, 
            `<button onclick="closeModal()">太棒了</button>`
        );
    }
}

// ==================== 5. 故事與判定 ====================
let storyState = { step: 0, score: 0, data: null, type: '', lastResult: '' };

function startEpicStory() {
    let storyData;
    let isQuestStory = false;

    // 優先檢查是否有活躍任務
    if (G.activeQuest) {
        let q = G.activeQuest;
        isQuestStory = true;
        
        storyData = {
            title: `⚔️ 任務決戰：${q.loc}`,
            intro: `你依照情報來到了 <strong>${q.loc}</strong>。<br>這裡的空氣中瀰漫著令人作嘔的氣息，${q.boss} 就在深處等著你。`,
            steps: [
                {q:"外圍充滿了警戒的變異生物。", opts: [{t:"潛伏穿過", type:'good', stat:'a'}, {t:"強行突破", type:'bad', stat:'s'}]},
                {q:"你發現了大門的電子鎖被破壞了。", opts: [{t:"修復電路", type:'good', stat:'i'}, {t:"尋找通風口", type:'bad', stat:'luck'}]},
                {q:"接近核心區域，精神壓迫感極強。", opts: [{t:"堅定意志", type:'good', stat:'w'}, {t:"服用鎮靜劑", type:'bad', stat:'i'}]},
                {q:"前方就是目標的巢穴！", opts: [{t:"佈置陷阱", type:'good', stat:'i'}, {t:"拔刀衝鋒", type:'bad', stat:'s'}]},
                // Boss 選項標記 isQuest: true
                {q:`${q.boss} 出現在你面前！`, opts: [{t:"尋找弱點攻擊", type:'good', boss:true, bossName:q.boss, isQuest:true}, {t:"正面迎擊", type:'bad', boss:true, bossName:q.boss, isQuest:true}]}
            ]
        };
    } else {
        // 沒有任務時，使用原有的隨機地點邏輯
        let idx = G.storyOrder[(Math.floor(G.day/7) - 1) % EPIC_THEMES.length];
        if(idx === undefined) idx = 0; 
        let theme = EPIC_THEMES[idx];
        
        storyData = {
            title: `📅 第 ${Math.ceil(G.day/7)} 週：${theme}`,
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

// 新增：計算事件選項的成功率 (回傳 0-100 的數字)
function getEventSuccessRate(type, statKey) {
    // 基礎機率：Good(穩妥選項)=66%, Bad(冒險選項)=24%
    let pSuccess = type === 'good' ? 66 : 24;
    
    // 1. 屬性修正
    let statVal = getStat(statKey);
    // 難度隨天數增加 (係數需與 calculateOutcome 保持一致)
    let difficulty = 10 + (G.day * 0.2); 
    
    // 每一點屬性差提供 0.5% 加成，上限 +/- 20%
    let statMod = (statVal - difficulty) * 0.5; 
    statMod = Math.max(-20, Math.min(20, statMod)); 

    // 2. 幸運修正
    let luckMod = (getStat('luck') - 10) * 0.5;
    luckMod = Math.max(-10, Math.min(10, luckMod));

    // 3. 道德修正 (善選項受高道德加成，惡選項受低道德加成)
    let moralMod = 0;
    if(type === 'good') { 
        if(G.moral > 50) moralMod = (G.moral - 50) * 0.2; 
    } else { 
        if(G.moral < 50) moralMod = (50 - G.moral) * 0.2; 
    }
    
    // 最終成功率
    let finalRate = pSuccess + statMod + luckMod + moralMod;
    
    // 馮狗 (休班警) 被動修正：成功率稍微降低但獎勵高 (這裡只反映顯示機率)
    if(G.job.passive === 'bad_cop') finalRate -= 10;

    return Math.floor(Math.max(5, Math.min(95, finalRate)));
}

function renderStoryModal(showingResult = false) {
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
             btns += `<button class="opt-btn" style="border-left-color:#f44" onclick="storyChoose('${opt.type}', 'luck', true, '${opt.bossName}', ${opt.isQuest})">
                <div style="font-weight:bold; color:#f44">💀 BOSS戰</div>
                <div>${opt.t}</div>
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
                    檢定: ${STAT_MAP[statKey] || statKey}
                </div>
             </button>`;
        }
    });
    openModal(storyState.data.title, html, btns);
}

function getEventReward() {
    let roll = Math.floor(Math.random() * 5);
    if(roll === 0) { G.san = Math.min(100, G.san + 5); return "🧠 意志堅定 (SAN +5)"; }
    if(roll === 1) { G.hp = Math.min(G.maxHp, G.hp + 10); return "❤️ 稍微喘息 (HP +10)"; }
    if(roll === 2) { gainXp(1); return "✨ 累積經驗 (XP +1)"; }
    if(roll === 3) { G.food += 2; return "🍖 找到殘渣 (Food +2)"; }
    if(roll === 4) { G.water += 2; return "💧 收集露水 (Water +2)"; }
}

function storyChoose(type, statKey, isBoss, bossName, isQuest) {
    if (isBoss) {
        closeModal();
        let targetName = bossName || '區域領主';
        triggerBossFight(targetName, isQuest);
        return;
    }
    
    if(type === 'good') G.moral = Math.min(100, G.moral + 2);
    if(type === 'bad') G.moral = Math.max(0, G.moral - 2);
    let res = calculateOutcome(type, statKey);
    let resultText = "";
    let scoreChange = 0;
    
    // 馮狗 (休班警) 判定修正
    if(G.job.passive === 'bad_cop') {
        if(res === 'success' || res === 'crit_success') {
            if(Math.random() < 0.4) res = 'fail';
        }
    }

    if (res === 'crit_success') {
        scoreChange = 2;
        let reward = getEventReward();
        resultText = `<span class="c-epic">大成功！</span><br>${reward}<br>(全屬性微升)`;
        ['s','a','i','w'].forEach(s=>G.stats[s]++);
        gainXp(1); 
        G.money += 30;
        resultText += " (獲得 $30)";
        if(G.job.passive === 'bad_cop') { G.stats[s]++; resultText += " (黑警加成)"; }
    } else if (res === 'success') {
        scoreChange = 1;
        let reward = getEventReward();
        if(Math.random() < 0.5) {
            G.money += 5;
            resultText += " (獲得 $5)";
        }
        resultText = `<span class="c-gain">判定成功。</span><br>${reward}`;
    } else if (res === 'fail') {
        scoreChange = -1;
        let dmg = 10 + Math.floor(Math.random()*10);
        G.hp -= dmg;
        resultText = `<span class="c-loss">判定失敗。</span> (HP -${dmg})`;
    } else {
        scoreChange = -2;
        let dmg = 25 + Math.floor(Math.random()*15);
        G.hp -= dmg; G.san -= 10;
        resultText = `<span class="c-loss" style="font-weight:bold">大失敗！</span> (HP -${dmg}, SAN -10)`;
    }

    storyState.score += scoreChange;
    storyState.lastResult = resultText;
    renderStoryModal(true);
}

function calculateOutcome(type, statKey) {
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

function nextStoryStep() { storyState.step++; renderStoryModal(false); }
// 修改：修復視窗不關閉的 Bug，並根據地點發放平衡後的獎勵
function finishStory() {
    // === 1. 地點隨機事件結算 ===
    if(storyState.type === 'loc_event') {
        let loc = storyState.loc;
        let score = storyState.score;
        let btnHtml = `<button onclick="closeModal(); campPhase()">返回營地 (Day +1)</button>`;

        // 定義地點的預設獎勵類型
        const LOC_REWARDS = {
            "廢棄超市": "food", "民居": "food", "下水道": "random",
            "五金店": "melee", "健身房": "melee",
            "警局分局": "ranged", "服裝店": "body",
            "診所": "med", "公園": "water",
            "銀行": "acc", "電子城": "acc", "學校": "acc"
        };

        if(score >= 0) { 
            let rewardType = LOC_REWARDS[loc] || 'random';
            if(rewardType === 'random') rewardType = ['food','water','melee','acc'][Math.floor(Math.random()*4)];
            
            let tier = (score >= 2) ? 2 : 1; 
            let xpGain = (score >= 2) ? 3 : 1;
            gainXp(xpGain);

            // --- 變動：事件獎勵平衡 (給予足夠生存量) ---
            if(rewardType === 'food' || rewardType === 'water') {
                let baseAmt = (score >= 2) ? 80 : 50;
                let finalAmt = baseAmt;
                if(rewardType === 'food') G.food += finalAmt; else G.water += finalAmt;
                
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
                    G.food += subsidy;
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
                let dmg = 15; G.hp -= dmg; penalty = `<br><span style="color:#f44">你在混亂中受了傷 (HP -${dmg})</span>`;
            }
            // 噩夢模式失敗保底
            if(G.diff === 3) {
                G.food += 5; 
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
}// ==================== UI 與 輔助函數 ====================

function calcDerivedStats() {
    let s = getStat('s'), a = getStat('a'), i = getStat('i'), w = getStat('w'), l = getStat('luck');
    let sanState = getSanityState(); // ★★★ 獲取精神狀態 ★★★

    // 1. 基礎閃避
    let dodgeBase = a * 0.4; 

    // 2. 被動與職業修正
    if(G.job.passive === 'high_dodge') dodgeBase = 60 + (a * 0.5); // Lil Kid
    if(G.job.passive === 'racer_sense') dodgeBase += 20; 
    if(G.job.passive === 'high_reflex') dodgeBase += 10;
    if(G.job.passive === 'dealer_luck') dodgeBase = dodgeBase *0.8;

    // 3. 技能 Buff 修正 (加法)
    if(G.job.n.includes('Doraemon') && G.combat?.buffs?.doraemon === 'copter') dodgeBase += 30;
    if(G.combat?.buffs?.dlss) dodgeBase += 40;
    if(G.combat?.buffs?.redbull) dodgeBase += 25;
    if(G.combat?.buffs?.matrix) dodgeBase += 50;
    if(G.combat?.buffs?.dance === 'Pete') dodgeBase += 10;
    
    // =======================================================
    // ▼ 這句加在這裡 (4. 裝備修正) ▼
    // 遍歷所有裝備部位，如果有提供 dodge 屬性，就加上去
    for(let k in G.eq) if(G.eq[k]?.stats?.dodge) dodgeBase += G.eq[k].stats.dodge;
    // =======================================================
// ★★★ 5. SAN 值修正 (閃避) ★★★
    if(sanState.buffs.dodge) dodgeBase += sanState.buffs.dodge;

    // 6. 最終上限判定 (Hard Cap 70%)
     let maxDodge = G.job.passive === 'high_dodge' ? 85 : 70;
    let finalDodge = Math.floor(dodgeBase);
    if (finalDodge > maxDodge) finalDodge = maxDodge;
    
    let critBase = (i * 0.5) + (l * 0.5); 
    if(G.job.passive === 'high_acc_crit') critBase += 30;
    if(G.job.passive === 'high_reflex') critBase += 10;
    if(G.job.passive === 'dealer_luck') critBase += 2;
    if(G.combat?.buffs?.dance === 'Hoan') critBase += 20;
    for(let k in G.eq) if(G.eq[k]?.stats?.crit) critBase += G.eq[k].stats.crit;


    // ★★★ SAN 值修正 (暴擊) ★★★
    if(sanState.buffs.crit) critBase += sanState.buffs.crit;

    // --- 減傷計算 ---
    let dmgRed = w * 0.25; 
    for(let k in G.eq) {
        if(G.eq[k] && G.eq[k].stats && G.eq[k].stats.defP) {
            let bonus = G.eq[k].stats.defP;
            if(G.eq[k].isJobNative) bonus *= 1.1; 
            dmgRed += (bonus * 100);
        }
    }
    if(G.combat?.buffs?.dance === 'Pete') dmgRed += 10;

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

function showStats() {
    let d = calcDerivedStats();
    let finalS = getStat('s'), finalA = getStat('a'), finalI = getStat('i'), finalW = getStat('w');
    
    // 計算面板攻擊力與防禦力
  // 修改：使用 getEquipVal
    let atkMelee = getEquipVal(G.eq.melee) + finalS;
    let atkRanged = getEquipVal(G.eq.ranged) + finalA;
    let totalDef = getEquipVal(G.eq.head) + getEquipVal(G.eq.body);

  let html = `<div style="text-align:left; padding:10px;">
        <h3 style="border-bottom:1px solid #444; padding-bottom:5px; margin-top:0">📊 角色屬性 (Lv.${G.level})</h3>
        
       <!-- 被動技能顯示區 -->
        <div class="comp-box" style="margin-bottom:15px; border-left:3px solid var(--skill-color); background:#1a1a1a">
            <div style="color:var(--skill-color); font-weight:bold">被動特質: ${G.job.trait}</div>
            <div style="font-size:0.9em; color:#ccc; margin-top:3px">${G.job.desc}</div>
            ${G.job.passive === 'pills' ? '<div style="font-size:0.8em;color:#666">(每回合機率觸發紅/藍藥丸)</div>' : ''}
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
            XP: <span style="color:var(--xp-color)">${G.xp}/20</span> | 道德: ${G.moral} | 幸運: ${getStat('luck')}
        </div>
    </div>`;
    openModal("詳細屬性", html, `<button onclick="closeModal()">關閉</button>`);
}

function exploreSetup() {
// ★★★ 新增這兩行來隱藏敵人區域 (保險起見) ★★★
    document.getElementById('enemy-area').style.display = 'none';
    document.getElementById('enemy-area').innerHTML = '';

    let locs = LOCATIONS.sort(()=>0.5-Math.random()).slice(0, 9);
    window.currentLocs = locs;
    
    let html = `<div style="margin-bottom:5px; color:#fff">📍 選擇地點: <button onclick="renderCampActions()" style="display:inline-block;padding:2px 5px;width:auto;">↩️</button></div>`;
    html += `<div class="grid-3x3">`;
    
    locs.forEach((l, index) => {
        let isQuest = G.activeQuest && G.activeQuest.loc === l.n;
        let qStyle = isQuest ? 'border-color:var(--quest-color)' : '';
        let dClass = l.d <= 2 ? 'd-low' : l.d >= 5 ? 'd-dead' : l.d >= 4 ? 'd-high' : 'd-mid';
        let dText = l.d <= 2 ? '低' : l.d >= 5 ? '極危' : l.d >= 4 ? '高' : '中';
        
        html += `<button class="loc-btn" style="${qStyle}" onclick="triggerExplore(${index})">
            <div class="loc-name">${isQuest ? '👑 ' : ''}${l.n}</div>
            <div class="loc-info">
                <span class="loc-danger ${dClass}">危:${dText}</span>
                <span>${isQuest ? '任務' : l.desc}</span>
            </div>
        </button>`;
    });
    html += `</div>`;
    document.getElementById('action-area').innerHTML = html;
}
window.exploreSetup = exploreSetup;
function triggerExplore(index) {
    let l = window.currentLocs[index];
    explore(l.n, l.d, l.l, l.desc);
}

// 確保探索邏輯正確連接
function explore(n, d, l, desc) { 
    window.currentLocName = n; // 記錄當前地點名稱供戰鬥使用
    log('探索', `前往 ${n}...`); 
    
    // 1. 任務檢查
    if(G.activeQuest && G.activeQuest.loc === n) {
        log('任務', '發現任務目標！', 'c-quest');
        triggerBossFight(G.activeQuest.boss, true);
        return;
    }

    // 2. 地點專屬事件 (機率隨危險度提升)
    if(Math.random() < (0.05 + d * 0.04) && LOC_EVENT_DB[n]) {
        triggerLocationEvent(n);
        return;
    }

    // 3. 遭遇戰鬥檢查
    let combatChance = 0.1 + (d * 0.15); 
    // 潛行特質修正
    if(G.job.trait === '外送傳說') combatChance -= 0.15;
    
    if(Math.random() < combatChance) {
        log('警告', `高危區域反應！(${Math.floor(combatChance*100)}%)`, 'c-loss');
        // --- 修正處：直接傳入 null，讓 triggerCombat 內部根據 danger 自動生成敵人 ---
        triggerCombat(null, d); 
    }
    // 4. 沒遇敵 -> 進入搜刮
    else {
        doScavenge(l, d); 
    }
}

// 修復：增加對 food 和 random 類型的處理，防止程式崩潰
function doScavenge(t, d) { 
    // 類型隨機化
    if(t === 'random') {
        let r = Math.random();
        if(r < 0.25) t = 'med';
        else if(r < 0.5) t = 'throwable';
        else t = ['melee','ranged','head','body','acc'][Math.floor(Math.random()*5)];
    }

    // --- 1. 搜刮成功率判定 ---
    // Danger 1: 95% | Danger 5: 55%
    // 智力(i) 越高，成功率越高 (每點智力+1%)
    let baseChance = 1.05 - (d * 0.1);
    let intBonus = getStat('i') * 0.01;
    let successChance = baseChance + intBonus;

    if(Math.random() < successChance) { 
        // === 成功搜刮 ===
        
        // 經驗值：高危區給予更多經驗
        let xpGain = Math.max(1, Math.floor(d * 0.5));
        gainXp(xpGain);

	// --- 新增：搜刮金錢 ---
    if(Math.random() < 0.5) { // 50% 機率發現金錢
        let moneyFound = 5 + Math.floor(Math.random() * 10); // 5-15元
        G.money += moneyFound;
        // 這裡不需要彈窗，只需 log，因為後面會有物品彈窗
        log('搜刮', `意外發現零錢 +$${moneyFound}`, 'c-gain');
    }

        // 食物/水：高風險=高回報 (維持之前的設定)
        if(t === 'food' || t === 'water') {
            let baseAmt = 40 + Math.floor(Math.random()*30);
            let finalAmt = Math.floor(baseAmt * (1 + d * 0.3)); // D5可得 2.5倍
            
            if(t==='water') G.water += finalAmt; else G.food += finalAmt;

            openModal("獲得物資", 
                `在高危區域發現了大量${t==='food'?'食物':'飲水'}。<br>危險加成: +${Math.floor(d*30)}%<br><strong style="color:#4f4">${t==='food'?'食物':'水'} +${finalAmt}</strong>`, 
                `<button onclick="closeModal(); campPhase()">收下 (Day +1)</button>`
            );
            return;
        }
        
        // === 裝備生成核心平衡 (修正處) ===
        
        let currentTier = getCurrentTier();
        let lootTier = currentTier;
        
        // 1. Tier 越級限制 (時間鎖)
        // 只有 Danger 4 以上才有機會獲得 Tier+1
        // 且最大只能是 Current + 1 (絕對不能在 Day 1 拿到 Tier 3)
        if (d >= 4) {
            // 基礎機率 15%，每點幸運(luck) +1%
            let tierUpChance = 0.15 + (getStat('luck') * 0.01);
            if (Math.random() < tierUpChance) {
                lootTier = Math.min(5, currentTier + 1);
            }
        }

        // 2. 稀有度 (Rarity) 補償
        // 雖然 Tier 不一定高，但高危區容易出「藍裝/紫裝」
        // createItem 函數雖然沒有直接接受 rarity 參數，但我們可以在生成後修改它
        let item = createItem(t, 'random', lootTier); 
        
        // 根據 Danger 提升稀有度 (Rarity: 0=白, 1=綠, 2=紫, 3=橙)
        // Danger 1-2: 主要是白/綠
        // Danger 5: 保底綠，高機率紫
        let rarityRoll = Math.random() + (d * 0.1) + (getStat('luck')*0.02);
        
        if (rarityRoll > 0.9) { // 觸發高品質
            item.rarity = Math.min(3, item.rarity + 1);
            // 根據稀有度強化數值 (模擬詞條加成)
            item.val = Math.floor(item.val * 1.2); 
            // 增加一條隨機屬性
            let extraStats = ['crit','dodge','s','a','i','w','hp'];
            let k = extraStats[Math.floor(Math.random()*extraStats.length)];
            item.stats[k] = (item.stats[k] || 0) + Math.floor(lootTier * 2);
            item.fullName = `✨ 精良的 ${item.fullName}`;
        }
        
        // 高危區且越級成功的提示
        if(lootTier > currentTier) {
            item.fullName = `⚠️ ${item.fullName}`; // 越級危險標記
        }

        showLootModal(item, t, campPhase); 

   } else { 
        // === 失敗懲罰與保底 ===
        let baseDmg = 15 + Math.floor(Math.random() * 10);
        let diffMult = 1 + (G.diff - 1) * 0.3; 
        
        let dmg = Math.floor(baseDmg * (1 + d * 0.5) * diffMult);
        let reduce = getStat('w');
        dmg = Math.max(1, dmg - reduce);

        G.hp -= dmg;
        // ★★★ 新增：陷阱驚嚇扣除 SAN ★★★
        // 危險度越高，扣得越多 (Danger 1 = -2, Danger 5 = -10)
        let scare = Math.floor(d * 2);
        G.san -= scare;
        
        log('搜刮', `觸發陷阱！受到傷害 (-${dmg} HP) 並受到驚嚇 (<span style="color:var(--san-color)">-${scare} SAN</span>)`, 'c-loss'); 
        // ==============================
        
        // --- 修改開始：失敗保底 ---
        // 即使失敗，也能找到一點點垃圾食物 (5-10點)
        // 這一點點在噩夢模式下可能就是多活半天的關鍵
        let scrapFood = 5 + Math.floor(Math.random() * 5);
        if(t === 'food') {
             G.food += scrapFood;
        } else {
            // 如果不是找食物，也可能撿到一點
             if(Math.random() < 0.5) G.food += scrapFood;
        }
        // --- 修改結束 ---
        
        openModal("搜刮失敗", 
            `這片區域(危險度 ${d})過於凶險，你觸發了陷阱。<br><br><strong style='color:#f44'>HP -${dmg}</strong><br><span style="color:#aaa">但在逃離時，你順手抓了一些殘餘物資 (食物 +${scrapFood})</span>`, 
            `<button onclick="closeModal(); campPhase()">包紮撤退 (Day +1)</button>`
        );
    }
}

function showQuestDetail() {
    // 計算當前應該出現的任務索引 (每 14 天一個任務)
    let questIndex = Math.floor((G.day - 1) / 14);
    
    // 防止索引超出範圍 (如果超過 196 天)
    if (questIndex >= QUEST_DB.length) questIndex = QUEST_DB.length - 1;

    let availableQuest = QUEST_DB[questIndex];
    
    // 如果目前已經接了任務，顯示當前任務狀態
    if (G.activeQuest) {
        let q = G.activeQuest;
        let rewardName = STAT_MAP[q.reward.type] || "物資";
        
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

function acceptQuest(index) {
    G.activeQuest = QUEST_DB[index];
    log('任務', `已接取：${G.activeQuest.n}`, 'c-quest');
    closeModal();
    updateUI(); 
    if(document.getElementById('action-area').innerText.includes('探索')) renderCampActions();
}

function abandonQuest() {
    log('任務', `放棄了任務：${G.activeQuest.n}`, 'c-loss');
    G.activeQuest = null;
    closeModal();
    updateUI();
}

// ==================== 戰鬥與物品 ====================
function triggerBossFight(name, isQuest=false) { 
    // 使用動態計算
    let typeKey = (name === "最終屍王") ? 'final_boss' : 'boss';
    let stats = getDynamicEnemyStats(typeKey);

    let hp = stats.hp;
    let atk = stats.atk;
    let bossDodge = (getCurrentTier() - 1) * 10 + 5; 

    // Boss 開場威壓
    let terror = 10; 
    if (name === "最終屍王") terror = 20; 
    if (G.diff === 3) terror = Math.floor(terror * 1.5); 

    let willMitigation = Math.floor(getStat('w') * 0.5);
    terror = Math.max(1, terror - willMitigation);

    G.san -= terror;
    log('遭遇', `強敵的壓迫感讓你呼吸困難！ <span style="color:var(--san-color)">SAN -${terror}</span>`, 'c-loss');

    if (name === "最終屍王") {
        bossDodge = 50; 
        hp = Math.floor(hp * 1.2);
        atk = Math.floor(atk * 1.1);
    }

    // ★★★ 計算 Boss 固定防禦力 ★★★
    let tier = getCurrentTier();
    let bossDef = (tier * 10) + (G.diff === 3 ? 10 : 0);
    if (name === "最終屍王") bossDef = 50;

    G.activeSkillCD = 0; 
    G.playerDefCD = 0;

    G.combat = { 
        n:name,
        baseName: name, 
        maxHp:hp, 
        hp:hp, 
        atk:atk, 
        
        // ★★★ 修正後的防禦屬性 ★★★
        def: bossDef,
        defP: 0.15, // Boss 預設 15% 減傷
        // ========================

        sk:'終極毀滅', 
        isBoss:true, 
        isQuest:isQuest, 
        turnCount:0, 
        buffs:{}, 
        enemySkillCD:0, 
        cloneTurns:0, 
        xpVal: 50 + Math.floor(G.day/2), 
        isStunned: false, 
        playerShield: 0, 
        usedItem: false,
        dodge: bossDodge
    };
    
    // ★★★ 新增：Boss 裝備開場特效 (同步加入) ★★★
    if (G.eq.head && G.eq.head.fx && G.eq.head.fx.t === 'fear_aura') {
        if (Math.random() < 0.5) {
            G.combat.buffs.atkDown = 3;
            log('裝備', `🤡 小丑面具發動：${G.combat.n} 感到恐懼 (攻擊下降)`);
        }
    }
    if (G.eq.acc && G.eq.acc.fx && G.eq.acc.fx.t === 'hypnosis') {
        G.combat.buffs.sleep = 3;
        log('裝備', `📻 洗腦廣播發動：${G.combat.n} 陷入深層睡眠`);
    }

    log('遭遇', `強敵出現：${name} (HP:${hp}, ATK:${atk})`, 'c-loss');
    
    let eArea = document.getElementById('enemy-area');
    if (eArea) eArea.style.display = 'block';
    
    renderCombat();
}

// ==================== 替換原有的 triggerCombat ====================    
function triggerCombat(enemyTemplate, danger) { 
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

        if (Math.random() < bossChance && LOCATION_BOSSES && LOCATION_BOSSES[locationName]) {
            let bosses = LOCATION_BOSSES[locationName];
            if (bosses) {
                enemy = bosses.find(b => b.t === spawnTier) || bosses[0];
                if (enemy) isBoss = true;
            }
        } 
        
        if (!enemy && Math.random() < eliteChance) {
            let pool = ELITE_ENEMIES[spawnTier];
            if (!pool || pool.length === 0) pool = ELITE_ENEMIES[1];
            if (pool && pool.length > 0) {
                enemy = pool[Math.floor(Math.random() * pool.length)];
                isElite = true;
            }
        } 
        
        if (!enemy) {
            let pool = NORMAL_ENEMIES[spawnTier];
            if (!pool || pool.length === 0) pool = NORMAL_ENEMIES[1];
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
    let prefixChance = 0.1 + (G.day / 120); 
    if (isElite || isBoss) prefixChance += 0.3;
    if (G.diff === 3) prefixChance += 0.2; 
    
    if (Math.random() < prefixChance) {
        let pTier = tier;
        if (Math.random() < 0.2) pTier = Math.min(5, pTier + 1);
        if (G.day <= 10) pTier = 1; 

        let pool = ENEMY_PREFIXES[pTier] || ENEMY_PREFIXES[1];
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

    G.activeSkillCD = 0;
    G.playerDefCD = 0;

    // 5. 初始化 Combat
    G.combat = { 
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
    if (G.eq.head && G.eq.head.fx && G.eq.head.fx.t === 'fear_aura') {
        if (Math.random() < 0.5) {
            G.combat.buffs.atkDown = 3;
            log('裝備', `🤡 小丑面具發動：${G.combat.n} 感到恐懼 (攻擊下降)`);
        }
    }
    if (G.eq.acc && G.eq.acc.fx && G.eq.acc.fx.t === 'hypnosis') {
        G.combat.buffs.sleep = 3;
        log('裝備', `📻 洗腦廣播發動：${G.combat.n} 陷入深層睡眠`);
    }

    if(!G.combat.sk) G.combat.sk = '普通攻擊'; 

    let logStr = `遭遇敵人：${G.combat.n} (HP:${hp}, ATK:${atk})`;
    if (prefixData) logStr += ` <span style="color:#f44">[${prefixData.desc}]</span>`;
    log('遭遇', logStr, 'c-loss');

    let eArea = document.getElementById('enemy-area');
    if (eArea) eArea.style.display = 'block';

    renderCombat();
}

// ★★★ 新增：Boss 裝備開場特效 ★★★
    // 1. 小丑面具 (fear_aura)：敵人開場機率膽怯(降攻)
    if (G.eq.head && G.eq.head.fx && G.eq.head.fx.t === 'fear_aura') {
        if (Math.random() < 0.5) {
            G.combat.buffs.atkDown = 3;
            log('裝備', `🤡 小丑面具發動：${G.combat.n} 感到恐懼 (攻擊下降)`);
        }
    }
    // 2. 洗腦廣播 (hypnosis)：開場催眠
    if (G.eq.acc && G.eq.acc.fx && G.eq.acc.fx.t === 'hypnosis') {
        G.combat.buffs.sleep = 3;
        log('裝備', `📻 洗腦廣播發動：${G.combat.n} 陷入深層睡眠`);
    }

// ==================== 修正後的戰鬥渲染 (修復變數未定義錯誤) ====================
// === 戰鬥視覺輔助函數 ===

// 1. 根據怪物名稱獲取頭像 Emoji
function getEnemyAvatar(name) {
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

// 2. 戰鬥描述生成器 (Flavor Text)
function getCombatFlavor(attacker, target, dmg, isCrit, isKill) {
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

// 3. 播放受傷動畫
function triggerShake() {
    let el = document.getElementById('enemy-area');
    if(el) {
        el.classList.remove('shaking');
        void el.offsetWidth; // trigger reflow
        el.classList.add('shaking');
        
        // 飄字效果
        let damage = G.lastDmg || 0;
        if (damage > 0) {
            // Get enemy position
             const rect = el.getBoundingClientRect();
            let popup = document.createElement('div');
            popup.className = 'dmg-popup';
            popup.innerHTML = `-${damage}`;
            if(G.lastCrit) popup.style.color = '#ff0';

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

// === 缺少的核心函數：傷害預估 ===
function getDmgEst(type) {
    let val = 0;
    // 近戰傷害 = 近戰武器數值 + 力量(s)
    if(type === 'melee') {
        val = getEquipVal(G.eq.melee) + getStat('s');
    } 
    // 遠程傷害 = 遠程武器數值 + 敏捷(a)
    else if(type === 'ranged') {
        val = getEquipVal(G.eq.ranged) + getStat('a');
    }
    
    // 確保不小於 1
    return Math.max(1, Math.floor(val));
}

// ==================== 極度昇華版 renderCombat ====================
function renderCombat() {
    let c = G.combat;
    if (!c) return; // 防呆

    // === 1. 渲染敵人區域 (上方) ===
    let eArea = document.getElementById('enemy-area');
    eArea.style.display = 'block';

// --- 修改開始：計算基礎值與當前值，並生成差異顯示 ---
    
    // --- 修改：讀取固定防禦力 ---
    // 1. 防禦力 (Base: c.def)
    let baseDef = c.def || 0; // 讀取 G.combat.def
    let curDef = baseDef;
    if(c.buffs.defDown) curDef = Math.floor(curDef * 0.5);
    if(c.buffs.defUp) curDef = Math.floor(curDef * 1.5);
    let defHtml = getStatDiffHtml(baseDef, curDef);

    // 2. 閃避率 (Base: c.dodge)
    let baseDodge = c.dodge || 0;
    let curDodge = baseDodge;
    if(c.buffs.dodgeUp) curDodge += 30;
    if(c.isStunned || c.buffs.sleep || c.buffs.stun || c.buffs.root) curDodge = 0; // 暈眩/定身時閃避歸零
    let dodgeHtml = getStatDiffHtml(baseDodge, curDodge, '%');

    // 3. 攻擊力 (Base: c.atk)
    // 註：c.atk 可能已被永久成長技能修改，這裡的 Base 指的是「本回合計算 Buff 前的面板」
    let baseAtk = c.atk;
    let curAtk = baseAtk;
    if(c.buffs.atkDown) curAtk = Math.floor(curAtk * 0.7);
    if(c.buffs.atkUp) curAtk = Math.floor(curAtk * 1.2); 
    let atkHtml = getStatDiffHtml(baseAtk, curAtk);

    // --- 修改結束 ---

    // 敵人 Buff 列表 (視覺化)
    let enemyBuffs = [];
    if(c.enemyShield > 0) enemyBuffs.push(`<span class="buff-badge" style="color:#fa0;border-color:#fa0">🛡️ ${c.enemyShield}</span>`);
    if(c.buffs.defUp) enemyBuffs.push(`<span class="buff-badge" style="color:#aaa">🛡️UP</span>`);
    if(c.buffs.atkUp) enemyBuffs.push(`<span class="buff-badge" style="color:#f44">⚔️UP</span>`);
    if(c.buffs.bleed) enemyBuffs.push(`<span class="buff-badge" style="color:#f44">🩸${c.buffs.bleed}</span>`);
    if(c.buffs.burn) enemyBuffs.push(`<span class="buff-badge" style="color:#f60">🔥${c.buffs.burn}</span>`);
    if(c.buffs.stun) enemyBuffs.push(`<span class="buff-badge" style="color:#ff0;border-color:#ff0">⚡暈眩</span>`);
    if(c.buffs.sleep) enemyBuffs.push(`<span class="buff-badge" style="color:#88f;border-color:#88f">💤睡眠</span>`);
    if(c.buffs.defDown) enemyBuffs.push(`<span class="buff-badge" style="color:#f44">💔破甲</span>`);
    
    // 敵人技能顯示
    let skillHtml = '';
    if(c.sks && c.sks.length > 0) {
        let skillsList = c.sks.map(s => `<span class="skill-tag" style="font-size:0.75em">${s.n}</span>`).join('');
        let cdText = c.enemySkillCD > 0 ? `<span style="color:#666">CD: ${c.enemySkillCD}</span>` : `<span class="cd-alert">⚠️準備就緒</span>`;
        skillHtml = `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px; border-top:1px dashed #333; padding-top:3px">
            <div>${skillsList}</div>
            <div style="font-size:0.8em">${cdText}</div>
        </div>`;
    }

    let hpPercent = Math.max(0, Math.min(100, (c.hp / c.maxHp) * 100));
    let avatar = getEnemyAvatar(c.n);

    eArea.innerHTML = `
     <div class="enemy-visual"><div class="enemy-avatar">${avatar}</div></div>
    <div class="enemy-hud">
        <div class="hud-row">
            <span style="font-size:1.2em; font-weight:bold; color:#f66; text-shadow:0 0 5px #500">${c.isBoss ? '👑 ' : ''}${c.n}</span>
            <span style="font-family:'Consolas'; color:#fff">${c.hp} <span style="color:#666">/ ${c.maxHp}</span></span>
        </div>
        <div class="hp-bar-container"><div class="hp-bar-fill" style="width: ${hpPercent}%"></div></div>
        
        <!-- 更新後的數值面板 -->
        <div class="stat-grid-compact" style="background:rgba(0,0,0,0.5); margin-top:5px;">
            <div>⚔️ ${atkHtml}</div>
            <div>🛡️ ${defHtml}</div>
            <div>💨 ${dodgeHtml}</div>
        </div>
        
        <div class="buff-row">${enemyBuffs.length ? enemyBuffs.join('') : '<span style="color:#444;font-size:0.8em">無狀態</span>'}</div>
        ${skillHtml}
    </div>`;

   // === 2. 渲染玩家與操作區域 (下方) ===
    
    // 安全讀取 Debuffs (先定義這個，因為按鈕狀態需要用到)
    let safeDebuffs = c.playerDebuffs || {};
    let isSilenced = safeDebuffs.silence > 0;

    // ★★★ 新增：判斷使用新系統還是舊系統 ★★★
    let skillBtnHtml = "";
    
    if (G.job.skill_tree) {
        // --- 新系統：顯示「技能選單」按鈕 ---
        let cdCount = 0;
        if (G.combat.skillCDs) {
            for (let k in G.combat.skillCDs) {
                if (G.combat.skillCDs[k] > 0) cdCount++;
            }
        }
        
        let btnText = `<div style="font-weight:bold">⚡ 技能 (${G.unlockedSkills.length})</div>`;
        
        if (isSilenced) {
            btnText += `<div style="font-size:0.75em;color:#d0f">⛔沉默(${safeDebuffs.silence})</div>`;
        } else if (cdCount > 0) {
            btnText += `<div style="font-size:0.75em;color:#fa0">${cdCount}招冷卻中</div>`;
        } else {
            btnText += `<div style="font-size:0.75em;color:#4f4">就緒</div>`;
        }
        
        skillBtnHtml = `<button onclick="openSkillMenu()" ${isSilenced?'disabled':''}>${btnText}</button>`;
        
    } else {
        // --- 舊系統：保留原有邏輯 (兼容舊職業) ---
        let skillData = SKILLS[G.job.sk];
        if(!skillData) skillData = {n:'無技能', desc:'', cd:99};
        
        let btnLabel = `<div style="font-weight:bold">${skillData.n}</div>`;
        if(isSilenced) btnLabel += `<div style="font-size:0.75em;color:#d0f">⛔沉默(${safeDebuffs.silence})</div>`;
        else if(G.activeSkillCD > 0) btnLabel += `<div style="font-size:0.75em;color:#f44">CD:${G.activeSkillCD}</div>`;
        else btnLabel += `<div style="font-size:0.75em;color:#4f4">就緒</div>`;
        
        skillBtnHtml = `<button title="${skillData.desc}" onclick="combatRound('skill')" ${(G.activeSkillCD>0 || isSilenced)?'disabled':''}>${btnLabel}</button>`;
    }
    // ==========================================

    let pStun = safeDebuffs.stun > 0;
    
    let pStatus = [];
    if(pStun) pStatus.push(`<span class="buff-badge" style="color:#fa0;border-color:#fa0">⚡暈眩(${safeDebuffs.stun})</span>`);
    if(c.playerShield > 0) pStatus.push(`<span class="buff-badge" style="color:#4f4;border-color:#4f4">🛡️盾${c.playerShield}</span>`);
    // --- ★★★ 新增：玩家血條計算 ★★★ ---
    let playerHpPercent = Math.max(0, Math.min(100, (G.hp / G.maxHp) * 100));
    // 使用綠色漸變代表玩家 (區別於敵人的紅色)
    let playerBarColor = 'linear-gradient(90deg, #4f4, #0a0)'; 
    
    // 如果血量低於 30%，變成黃色/橘色警示
    if(playerHpPercent < 30) playerBarColor = 'linear-gradient(90deg, #fa0, #a50)';
    if(playerHpPercent < 15) playerBarColor = 'linear-gradient(90deg, #f44, #a00)'; // 瀕死變紅

    // 構建玩家面板 HTML
    let statsBar = `<div style="background:#161616; padding:10px; border-radius:4px; border:1px solid #333; margin-bottom:10px;">
        
        <!-- 名字與狀態 -->
        <div style="font-size:0.95em; color:#fff; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:bold">👤 ${G.job.n} (Lv.${G.level})</span>
            <span style="font-size:0.9em">${pStatus.join(' ')}</span>
        </div>

        <!-- ★★★ 新增：玩家血條區域 ★★★ -->
        <div style="margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; font-size:0.8em; color:#ccc; margin-bottom:2px;">
                <span>HP</span>
                <span>${Math.floor(G.hp)} / ${Math.floor(G.maxHp)}</span>
            </div>
            <div class="hp-bar-container">
                <div class="hp-bar-fill" style="width: ${playerHpPercent}%; background: ${playerBarColor};"></div>
            </div>
        </div>
        <!-- ★★★ 結束 ★★★ -->
        
        <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:8px; font-size:0.85em; text-align:center;">
            <div style="background:#222; padding:3px; border-radius:3px;">近戰: ${getEquipVal(G.eq.melee) + getStat('s')}</div>
            <div style="background:#222; padding:3px; border-radius:3px;">遠程: ${getEquipVal(G.eq.ranged) + getStat('a')}</div>
        </div>
    </div>`;

    let actionButtonsHtml = '';

    if (pStun) {
        actionButtonsHtml = `
        <div class="combat-grid">
            <button class="combat-full-width" onclick="combatRound('skip')" style="border-color:#fa0; color:#fa0; height:100px; font-size:1.2em;">
                ⚡ 你被擊暈了！<br><span style="font-size:0.8em; color:#fff">(點擊跳過回合)</span>
            </button>
        </div>`;
    } else {
        actionButtonsHtml = `
        <div class="combat-grid">
            <button onclick="combatRound('melee')">⚔️ 近戰<br><small style="color:#888">預估: ${getDmgEst('melee')}</small></button>
            <button onclick="combatRound('ranged')" ${G.ammo>0?'':'disabled'}>🔫 射擊 (${G.ammo})<br><small style="color:#888">預估: ${getDmgEst('ranged')}</small></button>
            
            <!-- ★★★ 這裡插入剛剛生成的技能按鈕變數 ★★★ -->
            ${skillBtnHtml}
            
            <button onclick="combatRound('defend')" ${G.playerDefCD>0?'disabled':''} style="border-color:#55aaff">🛡️ 防禦 (CD:${G.playerDefCD})</button>
            <button class="combat-full-width" onclick="openCombatBag()" ${c.usedItem?'disabled style="opacity:0.5"':''}>🎒 戰鬥物品 (${G.bag.length})</button>
            <button class="combat-full-width" onclick="combatRound('flee')">🏃 逃跑</button>
        </div>`;
    }

    document.getElementById('action-area').innerHTML = statsBar + actionButtonsHtml;
    updateUI();
}
// ==================== 戰鬥邏輯核心 (完整修復版) ====================

// ==================== 完整修復版 combatRound (包含所有技能) ====================
function combatRound(act) {
    let c = G.combat;
    let logMsg = [];
    
    // 1. Buff 倒數
    if (c.buffs.dlss > 0) c.buffs.dlss--;
    if (c.buffs.redbull > 0) c.buffs.redbull--;
    if (c.buffs.allUp > 0) c.buffs.allUp--;
    if (c.buffs.matrix > 0) c.buffs.matrix--;
    if (c.buffs.drift > 0) c.buffs.drift--;
    
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
    G.isDefending = (act === 'defend'); // 標記防禦狀態

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

    if (act !== 'skill' && G.activeSkillCD > 0) G.activeSkillCD--;
    if (act !== 'defend' && G.playerDefCD > 0) G.playerDefCD--;
    if (c.playerDebuffs.silence > 0) c.playerDebuffs.silence--;

    // === 2. 判斷先手權 (Initiative) ===
    let playerSpd = getStat('a');
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
        // ★★★ 修復 1：處理「跳過回合」按鈕 ★★★
        if (act === 'skip') {
             if (c.playerDebuffs.stun > 0) c.playerDebuffs.stun--;
             logMsg.push(`<span style="color:#aaa">跳過回合...</span>`);
             return true; // 結束玩家行動
        }
        
        // ★★★ 修復 2：防止暈眩時點其他按鈕 ★★★
        if (c.playerDebuffs.stun > 0) {
            logMsg.push(`<span style="color:#fa0">你處於暈眩狀態，無法行動！(剩餘 ${c.playerDebuffs.stun})</span>`);
            // 這裡不扣除 stun 回合，因為要等玩家點擊 skip 才能扣
            return true; // 阻止行動
        }
        // ... (後續代碼保持不變)

    // === 2. 被動效果 ===
    if (G.job.passive === 'pills' && Math.random() < 0.33) {
        if (Math.random() < 0.5) { G.hp = Math.max(1, G.hp - Math.floor(G.maxHp * 0.1)); logMsg.push("<span style='color:#f44'>Red Pill: 扣血</span>"); }
        else { G.hp += Math.floor((G.maxHp - G.hp) * 0.5); logMsg.push("<span style='color:#4f4'>Blue Pill: 回血</span>"); }
    }
    if(G.job.passive === 'dance_style') {
        let styles = ['Slim','Greenteck','Hoan','Hozin','Pete'];
        c.buffs.dance = styles[Math.floor(Math.random()*5)];
        logMsg.push(`切換舞風: ${c.buffs.dance}`);
    }
    // 被動：道士
    if(G.job.passive === 'taoist_buff') {
        if(Math.random()<0.5) {
            let h = Math.floor((G.maxHp - G.hp)*0.05); G.hp+=h; logMsg.push("南部毛家: 回血");
        } else {
            c.buffs.taoistAtk = (c.buffs.taoistAtk || 0) + 0.02; logMsg.push("北部馬家: 攻+2%");
        }
    }
    // 被動：米芝蓮回血
    if(G.job.passive === 'chef_regen') {
        let pct = 0.005 + Math.random()*0.045;
        let h = Math.floor(G.maxHp * pct); G.hp = Math.min(G.maxHp, G.hp+h);
    }
    if(G.job.passive === 'nurse_buff') {
        let h = Math.floor(G.maxHp * 0.02); G.hp = Math.min(G.maxHp, G.hp+h);
    }
    if(G.job.passive === 'random_buff') {
        let stat = ['s','a','i','w','luck'][Math.floor(Math.random()*5)];
        G.stats[stat] = Math.floor((G.stats[stat]||0) * 1.1);
        logMsg.push(`諾貝爾獎: ${STAT_MAP[stat]}提升`);
    }

    let derived = calcDerivedStats(); // 重新獲取 (包含 SAN 加成)
    // === 3. 玩家行動結算 ===
    let dmg = 0;

    if (act === 'melee' || act === 'ranged') {
        if (act === 'ranged') G.ammo--;

        // 機械師召喚
        let engSummon = '';
        if(G.job.passive === 'eng_summon' && Math.random() < 0.1) {
            let r = Math.random();
            if(r < 0.33) engSummon = 'dog';
            else if(r < 0.66) engSummon = 'doraemon';
            else engSummon = 'terminator';
        }
        // 玻璃大炮
        if(G.job.passive === 'weapon_break' && Math.random() < 0.015) {
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
    let autoAim = (G.eq.acc && G.eq.acc.fx && G.eq.acc.fx.t === 'auto_aim');
        // 暴擊判定
        derived = calcDerivedStats();
        let isCrit = false;
         // 修改暴擊判定
    if (autoAim || (Math.random() * 100 < derived.crit) || (c.buffs.sleep > 0)) {
            dmg = Math.floor(dmg * (derived.critDmg / 100));
            isCrit = true;
            logMsg.push("🔥 暴擊！");
        }
        G.lastCrit = isCrit;

        // 技能/被動加成
        if (c.buffs.hedgeTurns > 0) { dmg += c.buffs.hedgeAtk; logMsg.push(`(對沖基金 +${c.buffs.hedgeAtk})`); c.buffs.hedgeTurns--; }
        if (c.buffs.chuunibyou > 0) { dmg += c.buffs.chuuniVal; c.buffs.chuunibyou--; logMsg.push("中二修正拳！"); }
        if (c.buffs.redbull > 0) { dmg = Math.floor(dmg * 1.3); c.buffs.redbull--; logMsg.push("Red Bull翼擊！"); }
        if (c.buffs.drift) { dmg = Math.floor(dmg * 1.2); c.buffs.drift--; }
        
        // 舞者加成
        if(c.buffs.dance === 'Greenteck') dmg = Math.floor(dmg * 1.2);
        if(c.buffs.dance === 'Pete') dmg = Math.floor(dmg * 1.1);
        if(c.buffs.dance === 'Hoan') dmg = Math.floor(dmg * 1.5);
        
        if (G.job.passive === 'truck_hit' && Math.random() < 0.05) { dmg = Math.floor(dmg * 1.5); logMsg.push("CyberTruck撞擊！"); }
        if (G.job.passive === 'dev_buff' && Math.random() < 0.15) { dmg += (getStat('s')*0.5); logMsg.push("工人助陣！"); }
        
        // 連擊 (Wing Chun)
        let multiHit = (G.job.passive === 'wing_chun' && Math.random() < 0.1) ? 2 : 1;
        dmg *= multiHit; 
        if(multiHit>1) logMsg.push(`${multiHit}連擊！`);
        
        // 華爾街吸血
        if(G.job.passive === 'olive_eat') {
            if(Math.random() < 0.5) { 
                let heal = Math.floor((G.maxHp - G.hp) * 0.1); 
                G.hp += heal; 
                logMsg.push(`量化寬鬆!恢復 +${heal}血`); 
            } else { 
                let suck = Math.floor(dmg * 0.3); 
                G.hp = Math.min(G.maxHp, G.hp + suck); 
                logMsg.push(`高額手續費! 抽取+${suck}血`); 
            }
        }
        
        // 機械師效果
        if(engSummon === 'dog') { c.buffs.bleed = 99; logMsg.push("機械狗咬傷流血！"); } 
        else if(engSummon === 'doraemon') {
            let tool = Math.random();
            if(tool<0.33) { c.buffs.shrink = 1; logMsg.push("縮小電筒！"); }
            else if(tool<0.66) { c.buffs.doraemon = 'copter'; logMsg.push("竹蜻蜓！"); }
            else { G.hp = Math.min(G.maxHp, G.hp + Math.floor(G.maxHp*0.2)); logMsg.push("吃豆沙包！"); }
        }

        // 命中判定
        let enemyDodge = c.dodge || 0;
        if (c.buffs.dodgeUp) enemyDodge += 30;
        if (c.buffs.sleep || c.isStunned || c.buffs.root) enemyDodge = 0;

        let myAcc = getStat('a') * 0.5;
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
            if (G.job.passive === 'flash_blind' && Math.random() < 0.1) { c.buffs.blind = 1; logMsg.push("致盲！"); }
            if (G.job.passive === 'sleep_hit' && Math.random() < 0.1) { c.buffs.sleep = 1; logMsg.push("催眠！"); }
            if (G.job.passive === 'bleed_hit' && Math.random() < 0.2) { c.buffs.bleed = 2; logMsg.push("流血！"); }
            if(G.job.passive === 'counter_block' && Math.random() < 0.15) { c.buffs.tempBlock = 0.8; logMsg.push("格擋反擊架勢！"); }
            if(G.job.passive === 'burn_proc' && Math.random() < 0.2) { c.buffs.burn = 2; logMsg.push("燃燒！"); }
        }

    } else if (act === 'skill') {
        G.activeSkillCD = SKILLS[G.job.sk].cd;
        let sk = G.job.sk;
        let s = getStat('s'), i = getStat('i'), w = getStat('w'), luck = getStat('luck');
        let dScale = 1 + (G.diff - 1) * 0.25;
        let sScale = 1 + (G.diff - 1) * 0.4;
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
            let h = Math.floor((G.maxHp - G.hp) * pct); 
            G.hp += h;
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
            c.playerShield = Math.floor(G.maxHp * sScale);
            logMsg.push(`風險管理：獲得鉅額護盾 (${c.playerShield})`);
        } 
        else if (sk === 'kungfu_panda') {
             let r = Math.random();
             if(r < 0.01 && !c.isBoss) { dmg = c.hp; logMsg.push("【無錫碎骨指】直接秒殺！"); }
             else if(r < 0.5) { 
                 let h = Math.floor((G.maxHp-G.hp)*0.5 * sScale); 
                 G.hp += h; logMsg.push(`【吞併Diliveroo】恢復了 ${h} 點生命`); 
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
            let hpCost = Math.floor(G.hp * 0.2);
            G.hp = Math.max(1, G.hp - hpCost);
            dmg = s * 8 * dScale; 
            let strBonus = s * (G.diff === 3 ? 12 : 6); 
            let shieldGain = Math.floor((hpCost * (G.diff === 3 ? 3 : 2)) + strBonus);
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
            let baseCost = (G.diff === 3) ? 60 : ((G.diff === 2) ? 40 : 20);
            if (G.money >= baseCost) {
                G.money -= baseCost;
                let rawDmg = (luck * 15) + (i * 5);
                dmg = Math.floor(rawDmg * dScale * (G.diff===3 ? 1.5 : 1)); 
                c.buffs.ignoreDef = 1;
                logMsg.push(`大撒幣：有錢使得鬼推磨 <span style="color:#ffd700">$${baseCost}</span> ！`);
            } else {
                dmg = (5 + s) * dScale;
                logMsg.push("大撒幣：沒錢了... ");
            }
        } 
        else if(sk === 'waterfall') {
            G.hp -= Math.floor(G.hp * 0.1); 
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
                if (G.san > cost) {
                    G.san -= cost;
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
            if (G.food >= 2) {
                G.food -= 2;
                
                // 1. 傷害：1.5倍 + 無視防禦 (音波穿透)
                dmg = baseAvg * 1.5 * dScale; 
                c.buffs.ignoreDef = 1; 

                // 2. 控制：Debuff 持續 3 回合
                c.buffs.atkDown = 3; 
                c.buffs.accDown = 3;

                // 3. ★★★ 新增：追星族的熱情，恢復少量 SAN 值 ★★★
                // 這樣阿孫越打越 high，符合人設
                let sanRec = 3;
                G.san = Math.min(100, G.san + sanRec);

                logMsg.push(`飆高音：<span style='color:#d0f'>高頻穿腦！</span>(SAN+${sanRec}) 無視防禦傷害，敵人攻命下降`);
            } else {
                logMsg.push("肚子太餓，丹田無力，唱不上去了...");
                dmg = 0; 
            }
        }

    } else if (act === 'defend') {
        G.isDefending = true; G.playerDefCD = 3; logMsg.push("🛡️ 防禦姿態");
    } else if (act === 'flee') {
        if (Math.random() < 0.5) { campPhase(); return true; }
        logMsg.push("🏃 逃跑失敗");
    }

    // 讀取武器特效
        let weapon = (act === 'melee') ? G.eq.melee : G.eq.ranged;
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
                G.money += Math.floor(fx.v);
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
                        G.hp -= thornsDmg;
                        logMsg.push(`<span style="color:#f44">⚡ 受到反傷 -${thornsDmg}</span>`);
                    }
                }

                let isCritFlavor = (dmg > getDmgEst(act) * 1.2); 
                let flavor = getCombatFlavor('你', c.n, act, realDmg, isCritFlavor, false);
                logMsg.push(`<div class="log-combat-h">${flavor}</div>`);

                G.lastDmg = realDmg;            
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
        if (G.hp <= 0) { checkCombatEnd(c, logMsg); return; }
        
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

// 提取敵人回合邏輯，避免函數過長和嵌套錯誤
function processEnemyTurn(c, logMsg) {
    
    // ★★★ 裝備免疫判定 ★★★
    // 冠軍腰帶 (grit)：免疫所有負面
    let isImmuneAll = (G.eq.body && G.eq.body.fx && G.eq.body.fx.t === 'grit');
    
    // 暴君頭盔 (stun_res)：免疫暈眩
    let isImmuneStun = isImmuneAll || (G.eq.head && G.eq.head.fx && G.eq.head.fx.t === 'stun_res');
    
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
        if(G.job.passive === 'welder_burn') { c.hp -= Math.floor(c.maxHp*0.01); } 
        if(G.job.passive === 'god_dot') { let d=Math.floor(c.hp*0.02); c.hp-=d; logMsg.push(`神聖灼燒 -${d}`); }
        
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
                        let drain = 10 + (G.diff * 2);
                        G.san -= drain;
                        logMsg.push(`<span style='color:#a0f'>精神受損 SAN -${drain}</span>`);
                    }
                }
                
                // ★★★ 處理純精神攻擊 (新增的第3招) ★★★
                if (skill.eff === 'san_dmg') { 
                    // 原有的 san_dmg 邏輯
                    if(isResisted) logMsg.push("<span style='color:#4f4'>堅定的意志抵擋了精神污染！</span>");
                    else { 
                        let drain = 15 + (G.diff * 5); // 傷害加強
                        G.san -= drain; 
                        logMsg.push(`<span style='color:#a0f'>精神受損 SAN -${drain}</span>`); 
                    }
                }
                else if (skill.eff === 'san_heavy') { 
                    if(isResisted) { G.san -= 15; logMsg.push(`<span style='color:#4f4'>意志減輕了精神重創 (SAN -15)</span>`); }
                    else { 
                        let drain = 40 + (G.diff * 10);
                        G.san -= drain; 
                        logMsg.push(`<strong style='color:#a0f'>精神崩潰！ SAN -${drain}</strong>`); 
                    }
                }
                else if (skill.eff === 'san_half') { 
                    if(isResisted) { G.san -= Math.floor(G.san * 0.2); logMsg.push("抵抗了理智斷線。"); }
                    else { 
                        let drain = Math.floor(G.san * 0.5);
                        G.san -= drain; 
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
         if (G.eq.head && G.eq.head.fx && G.eq.head.fx.t === 'gas_heal') {
             let heal = Math.floor(G.maxHp * 0.05);
             G.hp = Math.min(G.maxHp, G.hp + heal);
             logMsg.push(`<span style='color:#4f4'>☣️ 毒氣轉化為治療 (+${heal})</span>`);
         }
         // 瘟疫醫生面具 (poison_imm)：免疫中毒
         else if (isResisted || (G.eq.head && G.eq.head.fx && G.eq.head.fx.t === 'poison_imm') || isImmuneAll) {
             logMsg.push("<span style='color:#4f4'>免疫了毒素！</span>");
         }
         else {
             let pDmg = Math.floor(G.maxHp * 0.05);
             G.hp -= pDmg;
             logMsg.push(`中毒受到 ${pDmg} 傷害`);
         }
    }
                else if (effectType === 'hp_halve') { 
                    if(isResisted) { eDmg = Math.floor(G.hp * 0.25); logMsg.push("意志減輕了重力壓制"); }
                    else { eDmg = Math.floor(G.hp * 0.5); logMsg.push("生命被強制減半！"); }
                }
                else if (effectType === 'crit') { eDmg = Math.floor(eDmg * 1.5); logMsg.push("暴擊傷害！"); }
                else if (effectType === 'double_hit') { eDmg = Math.floor(eDmg * 0.8); c.buffs.doubleHit = true; }
                else if (effectType === 'aoe') { eDmg = Math.floor(eDmg * 1.2); }
                else if (effectType === 'heal_self') { let h = Math.floor(c.maxHp * 0.1); c.hp += h; logMsg.push(`恢復了 ${h} HP`); }
                else if (effectType === 'atk_up') { c.atk = Math.floor(c.atk * 1.2); logMsg.push("攻擊力提升！"); }
                else if (effectType === 'def_up') { c.buffs.defUp = 3; logMsg.push("防禦力提升！"); }
                else if (effectType === 'acc_up') { c.buffs.accUp = 3; logMsg.push("命中率提升！"); }
                else if (effectType === 'dodge_up') { c.buffs.dodgeUp = 3; logMsg.push("變得難以捉摸！"); }
                else if (effectType === 'kill' && !G.isDefending) { eDmg = 999; logMsg.push("即死攻擊！"); }
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
            if(G.isDefending) eDmg = Math.floor(eDmg*0.2);
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
                         let pDmg = Math.floor(G.maxHp * 0.05);
                         G.hp -= pDmg;
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
                        G.san -= sDmg;
                        logMsg.push(`<span style='color:#88f'>精神受損 SAN -${sDmg}</span>`);
                    }
                    if (c.prefixEff === 'execute' && G.hp < G.maxHp * 0.3) {
                        eDmg *= 2;
                        logMsg.push("<strong style='color:#f00'>處決一擊！</strong>");
                    }
                }

                if(G.job.passive === 'block_chance' && Math.random()<0.2) { eDmg = Math.floor(eDmg*0.5); logMsg.push("鐵壁格擋"); }
                if(c.buffs.dance === 'Hozin' && Math.random()<0.2) { eDmg=0; logMsg.push("Hozin格擋"); }

                let def = G.eq.body.val + G.eq.head.val;
                if (c.buffs.playerDefDown) def = 0;
                let take = Math.max(1, Math.floor((eDmg - def) * (1 - derived.dmgRed/100)));

                // ★★★ Kenboy (圍村村霸) 抑鬱減傷修復 ★★★
                // 必須放在 take 計算出來之後
                if (G.job.trait === '抑鬱霸王' && G.flags.depression) {
                    take = Math.floor(take * 0.5); // 傷害減半
                    logMsg.push("<span style='color:#88f'>(太抑鬱了...I don't give a shit.)</span>");
                }
                
                // === 新增：裝備受擊特效 (反傷/格擋/減傷) ===
                ['body','head','shoes','acc'].forEach(part => {
                    let item = G.eq[part];
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
                        if(f.t === 'dmg_red_low_hp' && G.hp < G.maxHp * 0.3) {
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
                        if(f.t === 'gold_shield' && G.money > 0) {
                            let absorb = Math.floor(take * f.v);
                            if(G.money >= absorb) {
                                G.money -= absorb;
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
                        if(G.job.passive === 'dmg_reduce' && Math.random()<0.5) take = Math.floor(take * 0.7);

                        G.hp -= take; 
                        logMsg.push(`玩家受到 ${Math.floor(take)} 傷害`);

                        // ★★★ 新增：受傷扣除 SAN 值邏輯 ★★★
                        let sanLoss = 0;
                        // 1. 重擊恐懼：如果單次受傷超過 10% 最大血量，SAN -3
                        if (take >= G.maxHp * 0.1) {
                            sanLoss = 3;
                        } 
                        // 2. 普通恐懼：每次受傷有 30% 機率 SAN -1
                        else if (Math.random() < 0.3) {
                            sanLoss = 1;
                        }

                        // 3. 噩夢難度額外懲罰
                        if (G.diff === 3 && sanLoss > 0) sanLoss += 1;

                        if (sanLoss > 0) {
                            G.san -= sanLoss;
                            logMsg.push(`<span style="color:var(--san-color); font-size:0.8em;">(痛楚 SAN -${sanLoss})</span>`);
                        }
                        // ======================================
                        
                        // 反傷
                        let reflect = 0;
                        if(G.eq.body.name === '法拉第籠') reflect += (c.isBoss ? 0.01 : 0.1);
                        if(G.job.passive === 'counter_block' && Math.random()<0.15) { reflect += 0.8; logMsg.push("圍棋反擊"); }
                        if(G.job.passive === 'money_shield' && Math.random()<0.1) { c.hp -= 20; logMsg.push("保鏢反擊"); }
                        
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
                            G.hp -= take;
                            logMsg.push(`連擊！再次受到 ${take} 傷害`);
                            c.buffs.doubleHit = false;
                        }

               } else if (isDodged) {
                let flavor = getCombatFlavor('你', c.n, 0, false, false);
                logMsg.push(`<div class="log-combat-h">${flavor}</div>`);
                
                // ★★★ 新增：閃避觸發特效 (如 Boogaloo 皮鞋) ★★★
                if(G.eq.shoes && G.eq.shoes.fx && G.eq.shoes.fx.t === 'dance_step') {
                    let danceDmg = Math.floor(getStat('a') * 0.5); // 反擊傷害 = 敏捷的一半
                    c.hp -= danceDmg;
                    logMsg.push(`<span style="color:#f4f">💃 霹靂一閃！對敵人造成 ${danceDmg} 傷害</span>`);
                }
                if(G.eq.body && G.eq.body.fx && G.eq.body.fx.t === 'dance_dodge') {
                     let heal = 10;
                     G.hp = Math.min(G.maxHp, G.hp + heal);
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

function checkCombatEnd(c, logMsg) {
    log('戰鬥', logMsg.join(' ')); updateUI();
    if(G.hp<=0) gameOver(`被 ${c.n} 殺死`);
    else if(c.hp<=0) { 
        log('戰鬥', '勝利！', 'c-gain'); 
        gainXp(c.xpVal || 1); 

        G.lastCombatLog = logMsg;   

        if(c.isBoss && c.n==="最終屍王") {
            gameOver("通關！");
        }
        // ★★★ 修改：Boss 戰勝利邏輯 ★★★
        else if(c.isBoss) { 
            // 1. 生成 Diablo 式掉落列表
            let loot = generateBossLoot(c.baseName, c.isQuest);
            
            // 2. 顯示新視窗
            showBossLootWindow(loot, () => {
                if(c.isQuest) {
                    completeQuest(); // 任務 Boss 撿完東西後，結算任務
                } else {
                    campPhase(); // 地點 Boss 撿完直接回營地
                }
            });
        }
        // 普通怪/精英怪 保持原有邏輯 (或也可以改用簡化版列表)
        else { 
            let t=['melee','ranged','head','body','acc','med','throwable'][Math.floor(Math.random()*7)];
            if(t==='med'||t==='throwable') t = (Math.random()<0.5)?'med':'throwable';
            showLootModal(createItem(t,'random',0), t, campPhase);
        }
    } else {
        c.usedItem = false; 
        renderCombat();
    }
}
function openCombatBag() {
    if(G.bag.length === 0) {
        openModal("背包", "背包是空的。", `<button onclick="closeModal()">關閉</button>`);
        return;
    }

    let html = `<div style="display:grid; gap:8px;">`;
    G.bag.forEach((item, idx) => {
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

function useCombatItem(idx) {
    let item = G.bag[idx];
    let c = G.combat;
    
    // 移除物品
    G.bag.splice(idx, 1);
    
    let logMsg = `使用 ${item.fullName}: `;
    
    if (item.type === 'med') {
        // 藥物效果
        if (item.stats.hp) {
            let heal = item.stats.hp;
            G.hp = Math.min(G.maxHp, G.hp + heal);
            logMsg += `HP +${heal} `;
        }
        if (item.stats.san) {
            G.san = Math.min(100, G.san + item.stats.san);
            logMsg += `SAN +${item.stats.san} `;
        }
        if (item.stats.s) { c.buffs.allUp = 3; logMsg += `力量提升 `; } 
        if (item.stats.eff) {
            if(item.stats.eff === 'bleed' && c.buffs.bleed) c.buffs.bleed=0;
        }
    } else if (item.type === 'throwable') {
        // 投擲物效果
        let dmg = item.val || 0;
        // 投擲物傷害隨天數成長
        dmg = Math.floor(dmg * (1 + G.day/60));
        
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
function showPlotDialog(day, callback) {
    let text = MAIN_PLOT[day] || "......";
    G.dialogCallback = callback;
    hideGameContainer();
    openModal(`📜 主線劇情 (Day ${day})`, `<div class="story-text main-story-text">${text}</div>`, `<button onclick="closePlotDialog()">繼續</button>`);
}
function closePlotDialog() { closeModal(); showGameContainer(); if(G.dialogCallback) G.dialogCallback(); }

function openModal(title, content, btns) {
    document.getElementById('m-title').innerHTML = title;
    document.getElementById('m-desc').innerHTML = content;
    document.getElementById('m-btns').innerHTML = btns;
    document.getElementById('screen-modal').style.display = 'flex';
}
function closeModal() { document.getElementById('screen-modal').style.display = 'none'; showGameContainer(); }
function log(t, m, c='') {
    let d = document.getElementById('log-area');
    d.innerHTML += `<div class="log-entry"><span style="color:#666">[D${G.day}]</span> [${t}] <span class="${c}">${m}</span></div>`;
    d.scrollTop = d.scrollHeight;
}
function updateUI() {
    document.getElementById('v-day').innerText = `${G.day}`;
    document.getElementById('v-hp').innerText = Math.floor(G.hp);
    document.getElementById('v-max-hp').innerText = Math.floor(G.maxHp);

    document.getElementById('v-san').innerText = Math.floor(G.san);
    // ★★★ 新增：顯示 SAN 狀態 ★★★
    let ss = getSanityState();
    let sanEl = document.getElementById('v-san');
    
    // 改變顏色與文字
    if(ss.state === 'calm') {
        sanEl.style.color = '#4f4'; // 綠色
        sanEl.innerText = `${Math.floor(G.san)} (冷靜)`;
    } else if (ss.state === 'madness') {
        sanEl.style.color = '#f44'; // 紅色
        sanEl.innerText = `${Math.floor(G.san)} (瘋狂)`;
    } else {
        sanEl.style.color = 'var(--san-color)'; // 藍色
    }
    // ============================
    document.getElementById('v-food').innerText = Math.floor(G.food);
    document.getElementById('v-water').innerText = Math.floor(G.water);
    document.getElementById('v-ammo').innerText = `(${G.ammo})`;
    document.getElementById('v-stats').innerText = "屬性";
    document.getElementById('v-lvl').innerText = `${G.level}`;
    document.getElementById('v-xp').innerText = `${G.xp}/20`;
    document.getElementById('v-job').innerText = G.job.n || '';
    document.getElementById('v-mbti').innerText = G.mbti ? G.mbti.id : '';
    document.getElementById('v-money').innerText = G.money; // 更新金錢
    
    let ex = document.getElementById('v-status-extra');
    ex.innerText = G.flags.depression ? '(抑鬱)' : '';
    ['melee','ranged','head','body','acc','shoes'].forEach(k => {
        let el = document.getElementById('eq-'+k);
        let item = G.eq[k];
        el.innerText = item.fullName;
        el.className = `eq-val q${item.rarity}`;
    });
}

// 計算當前 Tier (Day 0-29=1, 30-59=2, ..., 120+=5)
function getCurrentTier() {
    let t = Math.floor(G.day / 30) + 1;
    return Math.min(5, Math.max(1, t));
}

function getBagCapacity() {
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
    if(G.mbti.id === 'ISTJ') traitBonus += 2; // 物流師
    if(G.job.trait === '外送傳說') traitBonus += 3; // 外送員
    if(G.job.trait === '地產霸權') traitBonus += 2; // 地產商

    // 5. 硬上限 (Hard Cap) - 最重要的平衡修正
    // 基礎+成長 最高鎖死在 9 格。
    // 只有靠職業天賦才能突破 9 格。
    let total = base + tierBonus + strBonus;
    if(total > 9) total = 9;

    return total + traitBonus;
}

    // 將詞綴屬性合併到物品上
function applyAffix(item, affix) {
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
            item.stats.desc += ` [${affix.fx.desc}]`; 
            
            // 簡單實作：如果是同類型特效，疊加數值
            if (item.fx.t === affix.fx.t) {
                item.fx.v += affix.fx.v;
            }
        }
    }
}

// 物品生成工廠 (升級版)
function createItem(type, specificName, forcedTier, forceCommon = false) {
    let tier = forcedTier || getCurrentTier();
    if (G.day <= 10 && tier > 1) tier = 1;
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
    if(G.job && G.job.g && G.job.g[jobItemIndex]) {
        jobBaseName = G.job.g[jobItemIndex];
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
        if (!JOB_EXCLUSIVE_DB[type]) return { name: "錯誤", fullName: "DB錯誤", type: type, val: 1, tier: 1, rarity: 0, stats: {}, uid: Math.random() };
        let tpl = JOB_EXCLUSIVE_DB[type].find(x => x.n === jobBaseName);
        if (!tpl) tpl = { n: jobBaseName, v: 10 };
        
        baseItem = JSON.parse(JSON.stringify(tpl)); // 深拷貝

        // ★★★ 【修復點：插入這一行】 ★★★ 
        // 防止資料庫找不到物品時，fallback 物件沒有 stats 導致後續報錯
        if (!baseItem.stats) baseItem.stats = {}; 
        // ==================================

        // 專屬裝備數值隨 Tier 成長
        let mul = JOB_TIER_PREFIX[tier - 1].mul;
        baseItem.v = Math.floor(baseItem.v * mul * (1 + G.day/200));
        isNative = true;
    } else {
        if (!COMMON_DB[type]) return { name: "錯誤", fullName: "DB錯誤", type: type, val: 1, tier: 1, rarity: 0, stats: {}, uid: Math.random() };
        let pool = COMMON_DB[type][tier - 1] || COMMON_DB[type][0];
        let tpl = pool[Math.floor(Math.random() * pool.length)];
        if (specificName !== 'random') {
            let found = pool.find(x => x.n === specificName);
            if (found) tpl = found;
        }
        if (!tpl) tpl = {"n": "未知物品", "v": 1};
        
        baseItem = JSON.parse(JSON.stringify(tpl)); // 深拷貝
        if (!baseItem.stats) baseItem.stats = {};
        
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
        let chanceUncommon = 0.2 + (G.day * 0.002) + (luck * 0.005); 
        let chanceRare = 0.05 + (G.day * 0.001) + (luck * 0.002);
        let chanceEpic = 0.01 + (G.day * 0.0005) + (luck * 0.001);

        // Day 限制 (Hard Gate) - 這是為了防止第一天拿到太強的裝備
        if (G.day < 5) { chanceUncommon = 0.1; chanceRare = 0; chanceEpic = 0; }
        else if (G.day < 15) { chanceRare = 0.05; chanceEpic = 0; }
        else if (G.day < 30) { chanceEpic = 0; }

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
        let tierP = JOB_TIER_PREFIX[tier - 1].p;
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

// 輔助：隨機抽取詞綴 (限制等級版)
function getRandomAffix(category, currentTier) {
    let pool = AFFIX_DB[category];
    // 關鍵修正：只允許 tier <= currentTier 的詞綴
    // 絕對禁止 Day 1 (Tier 1) 抽到 Tier 2+ 的詞綴
    let validPool = pool.filter(a => a.tier <= currentTier);
    
    // 如果池子空了 (以防萬一)，保底用 T1
    if (validPool.length === 0) validPool = pool.filter(a => a.tier === 1);
    
    return validPool[Math.floor(Math.random() * validPool.length)];
}

	// 新增：獲取裝備實際數值 (含職業加成)
function getEquipVal(item) {
    if (!item) return 0;
    let v = item.val;
    if (item.isJobNative) {
        v = Math.floor(v * 1.1); // 10% 加成
    }
    return v;
}

// 修改 getStat，讓幸運值也能吃到飾品加成
function getStat(k) {
    let base = G.stats[k] || 0;
    if (k === 'luck') base = G.luck; 
    if (k === 'moral') return G.moral;
    if (k === 'luck' && G.eq.acc) {
    }

    if (G.job.passive === 'dealer_luck' && ['s','a','i','w','luck'].includes(k)) base += 5;
    if (G.job.passive === 'depress_stat' && ['s','a','i','w'].includes(k)) base = Math.floor(base * 1.5);
    if (G.job.passive === 'high_dodge' && ['s','a','i','w'].includes(k)) base = Math.floor(base * 0.5);

    if(G.flags.depression && ['s','a','i','w'].includes(k)) base = Math.floor(base/2);
    
    for(let slot in G.eq) {
        let item = G.eq[slot];
        if(item && item.stats && item.stats[k]) {
            let add = item.stats[k];
            if(item.isJobNative) add = Math.floor(add * 1.1);
            base += add;
        }
        if(item && item.stats && item.stats.all && ['s','a','i','w','luck'].includes(k)) {
             base += item.stats.all;
        }
    }
    
    if(G.combat && G.combat.buffs) {
        if(G.combat.buffs.allUp && ['s','a','i','w'].includes(k)) base = Math.floor(base * 1.5); 
        if(G.combat.buffs.dlss && k === 'a') base = Math.floor(base * 1.5);
        if(G.combat.buffs.redbull && k === 'a') base = Math.floor(base * 1.3);
        if(G.combat.buffs.dance === 'Pete' && ['s','a','i','w'].includes(k)) base = Math.floor(base * 1.1);
        if(G.combat.buffs.zombie === 'Green' && k === 's') base = Math.floor(base * 1.2);
        if(G.combat.buffs.zombie === 'Hair' && k === 's') base = Math.floor(base * 1.5);
        if(G.combat.buffs.zombie === 'Fly' && k === 's') base = Math.floor(base * 2.0);
        if(G.combat.buffs.zombie === 'Purple' && k === 's') base = Math.floor(base * 0.8);
        if(G.combat.buffs.zombie === 'White' && k === 's') base = Math.floor(base * 0.9);
        if(G.combat.buffs.taoistAtk && k === 's') base = Math.floor(base * (1 + G.combat.buffs.taoistAtk));
    }
    return base;
}

function equipLoot() { 
    let type = G.tempLoot.type;
    let newItem = G.tempLoot.item;
    let oldItem = G.eq[type]; // 獲取當前身上的裝備

    // 1. 裝備新物品
    G.eq[type] = newItem; 
    if(newItem.ammo) G.ammo += newItem.ammo; // 增加彈藥
    
    let msg = `裝備了 ${newItem.fullName}`;

    // 2. 處理舊物品 (如果不是"未裝備"狀態)
    // 這裡我們假設所有部位都有初始裝備(即使是破爛T恤)，所以直接處理
    if (oldItem) {
        // 檢查背包空間
        if (G.bag.length < getBagCapacity()) {
            // A. 背包有空位 -> 自動放入
            G.bag.push(oldItem);
            msg += `，舊裝備已放入背包。`;
        } else {
            // B. 背包已滿 -> 自動賣出
            let val = getItemValue(oldItem);
            let sellPrice = Math.max(1, Math.floor(val * 0.3));
            G.money += sellPrice;
            msg += `，背包已滿，舊裝備自動賣出獲得 $${sellPrice}。`;
        }
    }

    log('裝備', msg, 'c-gain');
    recalcMaxHp(); // 重新計算屬性
    updateUI();
    closeModal(); 
    if(G.tempLoot.cb) G.tempLoot.cb(); 
}

function discardLoot() { if(G.tempLoot.item.ammo)G.ammo+=G.tempLoot.item.ammo; closeModal(); if(G.tempLoot.cb)G.tempLoot.cb(); }
function gameOver(reason) { 
    G.alive = false;
    hideGameContainer();
    let btnHtml = `<button onclick="location.reload()" style="border-color:#f44; color:#f44; width:100%">💀 重新開始 (F5)</button>`;

    if (G.day >= 30) {
        let rewindDays = 30;
        let hpCost = 20;    // 預設代價高
        let statCost = 10;  // 預設代價高
        let label = "⏳ 時光倒流 (回溯30天)";
        let descText = "回到一個月前重新修練。";

        // 如果是打最終 Boss 死的，代價降低，時間縮短
        if (G.combat && G.combat.n === "最終屍王") {
            rewindDays = 7;
            hpCost = 10;    // Boss戰優惠
            statCost = 2;   // Boss戰優惠
            label = "⏳ 最後的意志 (回溯7天)";
            descText = "在決戰前一星期醒來，代價較小。";
        }

        // 計算下一次回溯後的預估血量上限
        let nextMaxHp = G.maxHp - hpCost;

        if (nextMaxHp <= 20) {
             reason += `<div style="margin-top:10px; font-size:0.85em; color:#888">
                (靈魂已殘破不堪，無法再次承受代價...)
            </div>`;
        } else {
            let desc = `<span style="color:#f44">代價：HP上限 -${hpCost}, 全屬性 -${statCost}</span><br>${descText}`;
            
            // ★★★ 修改：將 hpCost 和 statCost 傳遞給函數 ★★★
            btnHtml = `
                <div style="margin-bottom:10px; padding:10px; background:#222; border:1px solid #4f4; border-radius:5px;">
                    <div style="color:#4f4; font-weight:bold; margin-bottom:5px;">${label}</div>
                    <div style="font-size:0.85em; color:#ccc; margin-bottom:10px;">${desc}</div>
                    <button onclick="rewindTime(${rewindDays}, ${hpCost}, ${statCost})" style="border-color:#4f4; color:#4f4; width:100%">發動能力</button>
                </div>
                <hr style="border-color:#333; margin:10px 0;">
                ${btnHtml}
            `;
        }
    } else {
        reason += `<div style="margin-top:10px; font-size:0.8em; color:#888">
            (生存時間未滿 30 天，無法發動時光倒流)
        </div>`;
    }

    openModal("💔 你的旅途結束了", `<h1 style="color:#f44; margin-top:0">${reason}</h1>`, btnHtml); 
}	// ★★★ 修改：接收 days, hpCost, statCost 三個參數 ★★★
function rewindTime(daysToRewind, hpCost, statCost) {
    let targetDay = Math.max(1, G.day - daysToRewind);
    let actualRewind = G.day - targetDay;

    // 1. 執行血量上限懲罰
    G.hpPenalty = (G.hpPenalty || 0) + hpCost;

    // 2. 執行全屬性懲罰
    ['s', 'a', 'i', 'w'].forEach(key => {
        G.stats[key] = Math.max(1, G.stats[key] - statCost);
    });

    // 3. 恢復生存狀態
    G.alive = true;
    G.day = targetDay;
    
    recalcMaxHp(); // 重新計算 MaxHP
    
    G.hp = G.maxHp;   
    G.san = 100;      
    G.food = 100;     
    G.water = 100;
    
    // 4. 清除戰鬥狀態
    G.combat = null;
    G.activeSkillCD = 0;
    G.playerDefCD = 0;
    
    closeModal();
    document.getElementById('enemy-area').style.display = 'none';
    document.getElementById('enemy-area').innerHTML = '';

    // 5. 顯示日誌
    log('系統', `================================`, 'c-epic');
    log('系統', `⏳ 時光倒流！回到了 ${actualRewind} 天前。`, 'c-epic');
    log('系統', `💀 代價：HP上限 -${hpCost}, 全屬性 -${statCost}。`, 'c-loss');
    log('系統', `(當前 HP上限: ${G.maxHp})`, 'c-loss');
    log('系統', `================================`, 'c-epic');

    updateUI();
    renderCampActions();
}

function completeQuest() {
    let q = G.activeQuest; G.activeQuest = null;
    
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

function getItemValueLabel(type) {
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

function showItemDetail(type) {
    let i = G.eq[type];
    
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
            let name = STAT_MAP[k] || k;
            
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

function showLootModal(newItem, type, onCloseCallback) {
    G.tempLoot = { item: newItem, type: type, cb: onCloseCallback };
    
    // 計算回收價格
    let val = getItemValue(newItem);
    let sellPrice = Math.max(1, Math.floor(val * 0.3));

    // 戰鬥日誌顯示區
    let logHtml = '';
    if (G.lastCombatLog && G.lastCombatLog.length > 0) {
        let logs = G.lastCombatLog.map(l => `<div style="margin-bottom:3px;">${l}</div>`).join('');
        logHtml = `
        <div style="text-align:left; background:#000; padding:10px; border:1px dashed #444; border-radius:4px; margin-bottom:15px; font-size:0.85em; color:#ccc; max-height:120px; overflow-y:auto;">
            <div style="color:#666; font-size:0.8em; border-bottom:1px solid #333; margin-bottom:5px;">最後一擊回放:</div>
            ${logs}
            <div style="color:#ffd700; font-weight:bold; margin-top:8px; text-align:center;">🏆 戰鬥勝利！</div>
        </div>`;
        G.lastCombatLog = null; 
    }

    // === 判斷是否為消耗品或投擲物 ===
    if (type === 'med' || type === 'food' || type === 'water' || type === 'throwable') {
        let bagCap = getBagCapacity();
        let isFull = G.bag.length >= bagCap;
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
            <div style="font-size:0.9em">背包容量: ${G.bag.length} / ${bagCap}</div>
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
    let curr = G.eq[type];
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
    
    if(G.bag.length >= getBagCapacity()) {
         btns = `<button onclick="equipLoot()">裝備 (舊物自動賣出)</button>
                 <button onclick="showBagSwapUI()">整理背包</button>
                 <button onclick="recycleLoot()" style="border-color:#ffd700; color:#ffd700">回收 (+$${sellPrice})</button>
                 <button onclick="discardLoot()">丟棄</button>`;
    }

    openModal("獲得戰利品", html, btns);
}
function useLootItemDirectly() {
    if (!G.tempLoot || !G.tempLoot.item) return;
    let item = G.tempLoot.item;
    let msg = "";

    // 1. 食物/水
    if (item.type === 'food' || item.type === 'water') {
        let val = item.val;
        if (item.type === 'food') {
            G.food += val;
            msg = `飽食度 +${val}`;
        } else {
            G.water += val;
            msg = `水分 +${val}`;
        }
    }
    // 2. 藥品
    else if (item.type === 'med') {
        if (item.stats.hp) {
            let oldHp = G.hp;
            G.hp = Math.min(G.maxHp, G.hp + item.stats.hp);
            msg += `HP +${Math.floor(G.hp - oldHp)} `;
        }
        if (item.stats.san) {
            let oldSan = G.san;
            G.san = Math.min(100, G.san + item.stats.san);
            msg += `SAN +${Math.floor(G.san - oldSan)} `;
        }
    }

    log('使用', `直接使用了 ${item.fullName}: ${msg}`, 'c-gain');
    updateUI();
    closeModal();
    if (G.tempLoot.cb) G.tempLoot.cb();
}

// 新增：放入背包邏輯
function takeItemToBag() {
    if(G.bag.length < getBagCapacity()) {
        G.bag.push(G.tempLoot.item);
        log('搜刮', `獲得 ${G.tempLoot.item.fullName}`, 'c-gain');
        closeModal();
        if(G.tempLoot.cb) G.tempLoot.cb();
    } else {
        showBagSwapUI(); // 再次確保防呆
    }
}

// 新增：背包整理/替換 UI (當背包滿時)
function showBagSwapUI() {
    let html = `<div>背包已滿，請選擇一個物品<span style="color:#f44">丟棄</span>以騰出空間，或直接丟棄新物品。</div>
    <div style="display:grid; gap:5px; margin-top:10px; max-height:300px; overflow-y:auto;">`;
    
    G.bag.forEach((item, idx) => {
        html += `<div style="background:#222; padding:5px; border:1px solid #444; display:flex; justify-content:space-between; align-items:center;">
            <span>${item.fullName}</span>
            <button onclick="discardBagItem(${idx})" style="padding:2px 8px; width:auto; font-size:0.8em; background:#522;">丟棄此物</button>
        </div>`;
    });
    html += `</div>`;
    
    // 顯示新物品
    html += `<div style="margin-top:10px; border-top:1px solid #666; padding-top:5px;">
        待拾取：<strong class="q${G.tempLoot.item.rarity}">${G.tempLoot.item.fullName}</strong>
    </div>`;

    openModal("整理背包", html, `<button onclick="discardLoot()">放棄新物品</button>`);
}

// 新增：丟棄背包內物品並拾取新物品
function discardBagItem(idx) {
    let item = G.bag[idx];
    G.bag.splice(idx, 1); // 移除舊的
    G.bag.push(G.tempLoot.item); // 加入新的
    log('背包', `丟棄了 ${item.fullName}，獲得了 ${G.tempLoot.item.fullName}`);
    closeModal();
    if(G.tempLoot.cb) G.tempLoot.cb();
}

// ==================== 經濟與商店系統 ====================

// 1. 物品價值計算 (平衡核心)
function getItemValue(item) {
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

// 2. 營地商店按鈕 (請修改 renderCampActions 調用此處)
function openShop() {
    // 每日首次打開判定黑市 (2%)
    if (G.shop.lastDay !== G.day) {
        // 每週自動刷新商品 (或者第一天)
        if (Math.floor(G.day / 7) != Math.floor(G.shop.lastDay / 7) || G.shop.items.length === 0) {
            refreshShopItems(false); // 每週刷新重置為普通商店
        }
        
        // 每天第一次打開有 2% 機率突變為黑市 (如果還不是黑市)
        // 注意：如果剛好是週日刷新，這一步會覆蓋刷新，讓它變黑市
        if (Math.random() < 0.02) {
            activateBlackMarket();
        }
    }
    renderShopModal();
    G.shop.lastDay = G.day;
}

function activateBlackMarket() {
    G.shop.isBlackMarket = true;
    refreshShopItems(true); // 強制刷新為黑市商品
    log('商店', '你遇到了一位神秘的黑市商人...', 'c-epic');
}

// 3. 刷新商店商品
function refreshShopItems(forceBlackMarket) {
    G.shop.items = [];
    G.shop.isBlackMarket = forceBlackMarket;
    
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
            } else if (G.diff === 3) {
                // 噩夢難度：商店食物價格翻倍
                priceMult = 2.6; 
            }
        }
        let price = Math.floor(value * priceMult); 

        G.shop.items.push({ item: item, price: price, bought: false });
    }
}

// 4. 渲染商店介面
function renderShopModal() {
    let title = G.shop.isBlackMarket ? "🌑 地下黑市 (Tier +1)" : "⛺ 營地商店";
    let refreshCost = G.shop.isBlackMarket ? 500 : 100;
    let titleColor = G.shop.isBlackMarket ? "#a3f" : "#fff";

    let html = `<div style="text-align:center; margin-bottom:10px; color:${titleColor}">
        每天2%機率遭遇黑市。每週免費刷新。<br>當前金錢: <strong style="color:#ffd700">${G.money}</strong>
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">`;

    G.shop.items.forEach((slot, idx) => {
        if(slot.bought) {
            html += `<div class="comp-box" style="opacity:0.5; display:flex; align-items:center; justify-content:center;">已售出</div>`;
        } else {
            let item = slot.item;
            html += `<div class="comp-box" onclick="buyShopItem(${idx})" style="cursor:pointer; border-color:${G.money >= slot.price ? '#fa0' : '#444'}">
                <div style="margin-bottom:2px">${getItemTypeTag(item.type)}</div>
                <div class="q${item.rarity}" style="font-weight:bold">${item.fullName}</div>
                <div style="font-size:0.8em; color:#ccc">${getItemValueLabel(item.type)}: ${getEquipVal(item)}</div>
                <div style="margin-top:5px; color:${G.money >= slot.price ? '#ffd700' : '#f44'}">$${slot.price}</div>
            </div>`;
        }

    });
    html += `</div>`;
    
	// === 修改處：新增【背包出售區】 ===
    if (G.bag.length > 0) {
        html += `<div style="font-size:0.9em; color:#aaa; margin:15px 0 5px 0; border-top:1px solid #333; padding-top:10px;">💰 出售背包物品 (30%價格)</div>`;
        html += `<div style="display:grid; grid-template-columns: 1fr; gap:5px; max-height:150px; overflow-y:auto;">`;
        
        G.bag.forEach((item, idx) => {
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

// 5. 購買邏輯
function buyShopItem(idx) {
    let slot = G.shop.items[idx];
    if(!slot || slot.bought) return;

    if(G.money >= slot.price) {
        G.money -= slot.price;
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

function sellBagItem(idx) {
    if (idx < 0 || idx >= G.bag.length) return;
    
    let item = G.bag[idx];
    let val = getItemValue(item);
    let sellPrice = Math.max(1, Math.floor(val * 0.3));
    
    // 執行交易
    G.money += sellPrice;
    G.bag.splice(idx, 1); // 移除物品
    
    log('商店', `賣出了 ${item.fullName}，獲得 $${sellPrice}`, 'c-gain');
    updateUI();
    
    // 重新渲染商店介面以更新列表
    renderShopModal();
}

// 6. 手動刷新
function manualRefreshShop() {
    let cost = G.shop.isBlackMarket ? 500 : 100;
    if(G.money >= cost) {
        if(confirm(`確定要花費 $${cost} 刷新商品嗎？`)) {
            G.money -= cost;
            updateUI();
            refreshShopItems(G.shop.isBlackMarket); // 保持當前商店類型
            renderShopModal();
        }
    } else {
        alert("金錢不足以刷新！");
    }
}

// 7. 回收 (出售) 邏輯
function recycleLoot() {
    if(!G.tempLoot) return;
    let val = getItemValue(G.tempLoot.item);
    let sellPrice = Math.max(1, Math.floor(val * 0.3)); // 30% 回收價
    
    G.money += sellPrice;
    log('回收', `出售了 ${G.tempLoot.item.fullName}，獲得 $${sellPrice}`, 'c-gain');
    updateUI();
    closeModal();
    if(G.tempLoot.cb) G.tempLoot.cb();
}

function hideGameContainer(){
    document.getElementById('game-container').style.display = 'none';
}

function showGameContainer(){
    document.getElementById('game-container').style.display = 'flex';
}

function collapseStat(){
    const statBar = document.getElementById('stat-bar');
    const statBtn = document.getElementById('stat-btn');
    statBar.classList.toggle('collapsed');
    if (statBar.classList.contains('collapsed')) {
        statBtn.textContent = '▶️ 現在資訊';
    } else {
        statBtn.textContent = '🔽 現在資訊';
    }
}

function collapseEquip(){
    const equipContainer = document.getElementById('equip-container');
    const equipBtn = document.getElementById('equip-btn');
    equipContainer.classList.toggle('collapsed');

    if (equipContainer.classList.contains('collapsed')) {
        equipBtn.textContent = '▶️ 裝備';
    } else {
        equipBtn.textContent = '🔽 裝備';
    }
}

//使敵人受到的debuff顯示得更清晰//

function getStatDiffHtml(base, current, unit='') {
    let diff = current - base;
    let color = '#ccc'; // 預設灰色 (無變化)
    
    // 數值變大 (綠色)，數值變小 (紅色)
    // 註：對於敵人來說，攻擊力變高其實對玩家是壞事，但為了UI統一，通常「數值上升=綠/金」，「數值下降=紅」比較直觀
    if(diff > 0) color = '#4f4'; // Buff (Green)
    if(diff < 0) color = '#f44'; // Debuff (Red)

    let html = `<span style="color:${color}">${current}${unit}</span>`;
    
    // 如果有差異，顯示括號內的數值
    if(diff !== 0) {
        let sign = diff > 0 ? '+' : '';
        html += ` <span style="font-size:0.75em; color:${color}; margin-left:2px;">(${sign}${diff})</span>`;
    }
    return html;
}

//使敵人受到的debuff顯示得更清晰//
function debugCheat(){
    G.money += 99999;
    G.food = 99999;
    G.water = 99999;
    G.maxHp += 99999;
    G.hp = G.maxHp;
    G.san = 100;
    updateUI();
    log('系統', '作弊成功！獲得 $99999，99999食物, 99999水源, 99999 HP, 並恢復狀態。', 'c-epic');
}



// ==================== 全新動態難度平衡系統 (請貼在文件末尾) ====================

// 1. 計算裝備特效的隱藏權重 (Power Score) - 精細化計算 v3.1
function calcEquipmentPowerScore() {
    let score = 1.0; // 基礎權重 100%

    // 遍歷全身裝備
    for (let key in G.eq) {
        let item = G.eq[key];
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
    if (G.job.sk === 'kid_squad') score += 0.3; 
    if (G.job.sk === 'god_hand') score += 0.25; 
    if (G.job.sk === 'one_cue') score += 0.4;   
    if (G.job.sk === 'time_stop') score += 0.5; 

    return score;
}
// 2. 計算玩家綜合戰力 (DPS & EHP) - v4.0 修正版 (讓玩家享受神裝優勢)
function getPlayerCombatPower() {
    // A. 基礎面板
    let s = getStat('s'), a = getStat('a');
    let meleeRaw = getEquipVal(G.eq.melee) + s;
    let rangedRaw = getEquipVal(G.eq.ranged) + a;
    let baseAtk = Math.max(meleeRaw, rangedRaw);
    
    // B. 暴擊期望
    let derived = calcDerivedStats();
    let critChance = Math.min(100, derived.crit) / 100;
    let critDmgMult = (derived.critDmg || 150) / 100;
    let expAtk = baseAtk * (1 + (critChance * (critDmgMult - 1)));

    // C. 生存
    let def = getEquipVal(G.eq.head) + getEquipVal(G.eq.body);
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
        hp: G.maxHp, 
        reduc: reducPct,
        powerScore: rawScore // 傳遞原始分數備用，但不影響核心數值
    };
}

// 3. 核心：根據類型生成動態數值 (v4.0 - 移除懲罰)
function getDynamicEnemyStats(type) {
    let p = getPlayerCombatPower();
    let diff = G.diff; 

    let variance = 0.85 + Math.random() * 0.3; 

    // 目標節奏
    let target = { playerTurns: 2.5, enemyTurns: 10 }; 

    if (type === 'elite') {
        target.playerTurns = 6;
        target.enemyTurns = 7;
    } else if (type === 'boss') {
        target.playerTurns = 14; 
        target.enemyTurns = 5;   
    } else if (type === 'final_boss') {
        target.playerTurns = 20;
        target.enemyTurns = 4;
        variance = 1.0; 
    }

     // --- ★★★ 修改開始：階梯式難度係數 (Time Scaling) ★★★ ---
    let timeScale = 1.0;
    if (G.day <= 30) {
        timeScale = 0.6; // 新手保護期：怪物強度 60%
    } else if (G.day <= 60) {
        timeScale = 0.8; // 過渡期：怪物強度 80% (避免斷層)
    }
    // Day 60+ 恢復 100% 強度
    // -----------------------------------------------------
    
    let hpMult = 1.0;
    let atkMult = 1.0;

    if (diff === 2) { hpMult = 1.3; atkMult = 1.2; }
    else if (diff === 3) { hpMult = 1.8; atkMult = 1.5; }

    // ★★★ 關鍵修正：移除了針對高 PowerScore 的額外懲罰代碼 ★★★
    // 現在讓玩家盡情享受神裝帶來的數值碾壓感

    // 成長係數 (0.85) - 保持不變，確保基礎成長感
    let scalingFactor = 0.85; 
    let adjustedAtk = p.atk * scalingFactor;
    adjustedAtk += (G.day * 2.5); 

    // Day 30 前降低天數成長幅度，避免成長太快
    let dayGrowth = (G.day <= 30) ? (G.day * 1.5) : (G.day * 2.5);
    adjustedAtk += dayGrowth; 
    
     // 應用 timeScale
    let eHP = Math.floor(adjustedAtk * target.playerTurns * hpMult * variance * timeScale);
    
    // 計算敵人攻擊力
    let requiredNetDmg = p.hp / target.enemyTurns;
    
    // 依然保留對吸血/回血的輕微抵抗，否則玩家會無敵
    if (p.powerScore > 1.4) requiredNetDmg *= 1.1;

    let effectiveReduc = Math.max(0.1, 1 - p.reduc); 
    let rawDmgNeeded = requiredNetDmg / effectiveReduc;
    
    let eAtk = Math.floor((rawDmgNeeded + p.def) * atkMult * variance * timeScale);

    // 天數保底 (同樣應用 timeScale)
    let dayScale = 1 + (G.day * 0.15); 
    let minHP = 40 * dayScale * timeScale;
    let minAtk = 10 + (G.day * 0.7) * timeScale;
    
    if (type === 'boss' || type === 'elite') { minHP *= 4.5; minAtk *= 1.6; }
    if (type === 'final_boss') { minHP = 12000; minAtk = 280; } 

    eHP = Math.max(eHP, Math.floor(minHP));
    eAtk = Math.max(eAtk, Math.floor(minAtk));

    return { hp: eHP, atk: eAtk };
}

    function generateBossLoot(bossName, isQuest) {
    let lootList = [];
    
    // 1. 必掉：大量金錢 (Diablo的金幣堆)
    let moneyAmt = 50 + Math.floor(Math.random() * 100) + (G.day * 2);
    if (G.diff === 3) moneyAmt = Math.floor(moneyAmt * 0.6);
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

function showBossLootWindow(lootList, callback) {
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
        if(item.type === 'money') G.money += item.val;
    });
    updateUI();
}

// 單個拾取邏輯
function pickUpBossLoot(idx) {
    let item = window.currentBossLoot[idx];
    if(!item) return;

    if(G.bag.length >= getBagCapacity()) {
        alert("背包已滿！請先整理背包或丟棄其他物品。");
        // 這裡可以做更高級的：打開背包整理視窗，但為了避免UI疊加過於複雜，暫時用 alert
        return;
    }

    G.bag.push(item);
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

function closeBossLoot() {
    closeModal();
    if(window.bossLootCallback) window.bossLootCallback();
}

// 取得當前精神狀態及其加成
function getSanityState() {
    if (G.san >= 75) {
        return { 
            state: 'calm', 
            name: '🔵 冷靜', 
            desc: '專注力提升 (命中+20%, 閃避+10%, 防禦+10%)',
            buffs: { acc: 20, dodge: 10, defP: 0.1 } 
        };
    } else if (G.san < 30) {
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

// === 新技能系統核心 ===

function openSkillMenu() {
    if (!G.combat.skillCDs) G.combat.skillCDs = {};
    
    let html = `<div style="display:grid; gap:8px; max-height:60vh; overflow-y:auto;">`;
    
G.unlockedSkills.forEach(sid => {
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
        
        let cd = G.combat.skillCDs[sid] || 0;
        let costText = [];
        let canAfford = true;
        
        // 計算消耗顯示
        if (s.cost) {
            if (s.cost.hp) { 
                costText.push(`<span style="color:#f44">HP-${s.cost.hp}</span>`);
                if (G.hp <= s.cost.hp) canAfford = false;
            }
            if (s.cost.san) {
                costText.push(`<span style="color:#88f">SAN-${s.cost.san}</span>`);
                if (G.san < s.cost.san) canAfford = false;
            }
            if (s.cost.food) {
                costText.push(`<span style="color:#fa0">飽-${s.cost.food}</span>`);
                if (G.food < s.cost.food) canAfford = false;
            }
            if (s.cost.money) {
                costText.push(`<span style="color:#ffd700">$${s.cost.money}</span>`);
                if (G.money < s.cost.money) canAfford = false;
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

// 萬能技能解析器
// 優化版：支援詳細日誌與混合傷害的技能解析器
function performSkill(sid) {
    let s = SKILL_DB[sid];
    let c = G.combat;
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
        if (s.cost.hp) G.hp -= s.cost.hp;
        if (s.cost.san) G.san -= s.cost.san;
        if (s.cost.food) G.food -= s.cost.food;
        if (s.cost.money) G.money -= s.cost.money;
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
    
    // 4. 執行效果
    let totalDmg = 0;
    
    if (s.effects) {
        s.effects.forEach(eff => {
            // --- A. 傷害類 ---
            if (eff.t === 'dmg') {
                let base = power;
                if (eff.var) base *= (1 + (Math.random() * eff.var - (eff.var/2)));
                // 技能基礎傷害通常不加上武器傷害，除非是普攻類技能，但為了平衡初期體驗，這裡保留微量武器加成
                let weaponDmg = (getEquipVal(G.eq.melee) + getEquipVal(G.eq.ranged)) / 2;
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
                totalDmg += (G.day * (eff.factor || 1));
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
                G.hp = Math.min(G.maxHp, G.hp + amt);
                logMsg.push(`<span style="color:#4f4">HP +${amt}</span>`);
            }
            else if (eff.t === 'heal_san') {
                G.san = Math.min(100, G.san + eff.v);
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
            
            // --- D. Buff/Debuff (大幅優化顯示邏輯) ---
            else if (eff.t === 'buff') {
                c.buffs[eff.k] = (c.buffs[eff.k] || 0) + eff.v;
                let name = STAT_NAMES[eff.k] || eff.k;
                let desc = eff.desc ? `${eff.desc} (${name} +${eff.v})` : `${name}提升 (+${eff.v})`;
                logMsg.push(`<span style="color:#4f4">${desc}</span>`);
            }
            else if (eff.t === 'debuff') {
                // 特殊處理流血和燃燒
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
        });
    }
    
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



// Export all functions to window at once
const globalFunctions = {
    startGame,
    closeModal,
    manualRefreshShop,
    closePlotDialog,
    startJourney,
    triggerExplore,
    showItemDetail,
    recycleLoot,
    sellBagItem,
    buyShopItem,
    openShop,
    takeItemToBag,
    discardBagItem,
    useLootItemDirectly,
    equipLoot,
    useCombatItem,
    openCombatBag,
    combatRound,
    abandonQuest,
    acceptQuest,
    rewindTime,
    discardLoot,
    showQuestDetail,
    showStats,
    storyChoose,
    campAction,
    equipFromBag,
    discardCampItem,
    useCampItem,
    collapseStat,
    collapseEquip,
    renderCampActions,
    campPhase,
    nextStoryStep,
    openCampBag,
    renderJobs,
    renderJobIntro,
    debugCheat,
    triggerShake,
    pickUpBossLoot, 
    closeBossLoot, 
    openSkillMenu,
    performSkill,
};

Object.assign(window, globalFunctions);
window.G = G;
