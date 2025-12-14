import * as Constant from './GameData.js';
import * as CampSystem from './CampSystem.js'
import * as Character from './Character.js'
import * as CombatSystem from './CombatSystem.js'
import * as ItemSystem from './ItemSystem.js'
import * as StorySystem from './StorySystem.js'
import * as UIManager from './UIManager.js'

document.addEventListener('alpine:init', () => {
    Alpine.data('Global', ()=>({
        updateLog:"12/10/25:新增角色|平衡難度|新增角色裝備|新藥品系統",
    }));


    Alpine.bind('startGame', (diff) => ({
        '@click'() {
            startGame(diff);
        },
  
    }));

    Alpine.bind('selectJob', (job, stat)=>({
        '@click'(){
            reactiveGameState.job = job; 
            reactiveGameState.stats = {...stat}; 
            showMbti();
        }
    }));

    Alpine.store('ui', {
        showStart:true,
        showJobSoslection:false,
        showJobsIntro: false,
        showJobs: false,
        jobColor: '#f44',
        showMBTI:false,
        showGameScreen:false,
        showCampAction:false,
        showModal:false,
        showEnemy:false,
        bagCapacity: "(0/4)",
        bagColor: '#aaa',
        weather: "☀️ 晴朗",
    });

    Alpine.store('data',{})
    Alpine.store('Game', {})
    Alpine.store('dialog',{
        title: "",
        class: "",
        content: "",
        buttonAction: "",
        buttonText:"繼續",
    })
    Alpine.store('enemy', {})
    Alpine.store('player', {})
 });

// ==================== 1. 遊戲核心變數 ====================
// 1. 替換 let G = { ... }
let GameState = { 
    day:0, maxDay:196, diff:1, hp:100, maxHp:100, san:100, food:100, water:100, ammo:0, 
    level:1, xp:0, nextLvl:20, money: 100, // 新增 money
    stats:{str:0,agi:0,int:0,wil:0}, 
    moral: 50, luck: 10, hpPenalty: 0,
    eq:{melee:null, ranged:null, head:null, body:null, acc:null}, 
    bag: [], // 新增 bag
    shop: { items: [], lastDay: -1, isBlackMarket: false }, // 新增 shop
    buffs:[], alive:true, job:{name:""}, mbti:null, flags:{depression:false}, 
    activeSkillCD:0, playerDefCD:0, storyOrder: [], activeQuest: null, tempLoot: null, dialogCallback: null,
    danceStyle: null, zombieCount: 0, isDefending: false, combat: null // combat 初始化
};
export let reactiveGameState;

// game main
// 2. 替換 startGame 函數 (確保重置所有數據)
function startGame(diff) {
    reactiveGameState = Alpine.reactive(GameState);
    Alpine.store('Game').State = reactiveGameState;
    reactiveGameState.job = {name:""};
    reactiveGameState.diff = diff;
    reactiveGameState.money = (diff === 3) ? 50 : 100; // 噩夢開局錢少
    // ------------------

    reactiveGameState.storyOrder = [...Array(Constant.EPIC_THEMES.length).keys()].sort(() => 0.5 - Math.random());
    reactiveGameState.activeQuest = null;

    Alpine.store('ui').showStart = false;
    Alpine.store('ui').showJobsIntro = true;
    Alpine.store('ui').showJobSelection = true;
}

// game main
function renderJobs(category) {
    Alpine.store('ui').showJobsIntro = false;
    Alpine.store('ui').showJobs = true;
    // 1. 處理按鈕高亮樣式 (UI回饋)
    const allTabs = ['warrior', 'berserker', 'ranger', 'mage', 'special'];
    allTabs.forEach(tab => {
        let btn = document.getElementById('tab-' + tab);
        if (btn) {
            if (tab === category) {
                // 選中
                btn.style.backgroundColor = Constant.RPG_CLASSES[tab].color;
                btn.style.color = '#000'; 
                btn.style.fontWeight = 'bold';
                btn.style.boxShadow = `0 0 10px ${Constant.RPG_CLASSES[tab].color}`;
                btn.style.opacity = '1';
            } else {
                // 未選中
                btn.style.backgroundColor = '#252525';
                btn.style.color = Constant.RPG_CLASSES[tab].color;
                btn.style.fontWeight = 'normal';
                btn.style.boxShadow = 'none';
                btn.style.opacity = '0.6'; // 未選中變暗
            }
        }
    });

    // 2. 獲取容器
    let container = document.getElementById('job-container');
    container.style.display = 'grid';
    container.style.flexDirection = 'unset';
    container.style.alignItems = 'unset';
    container.style.justifyContent = 'unset';
    
    const group = Constant.RPG_CLASSES[category];
    let pool = Constant.ALL_JOBS.filter(job => 
        group.jobs.some(targetName => job.name.includes(targetName)) && !job.name.includes('Lil Kid')
    );
    
    pool.forEach(job=>job.color = group.color);
    Alpine.store('data').jobs = pool;
    return;
}

// game main
function showMbti() {
    Alpine.store('ui').showJobSelection = false;
    Alpine.store('ui').showMBTI = true;
    let choices = Constant.MBTI_TYPES.sort(()=>0.5-Math.random()).slice(0, 2);
    choices.forEach(m => {
        let bonusText = [];
        for(let k in m.bonus) {
            let val = m.bonus[k];
            let label = Constant.STAT_MAP[k] || k;
            if(val < 1 && val > -1) val = Math.floor(val*100) + '%';
            bonusText.push(`${label} +${val}`);
        }
        m.bonusText = bonusText.join(', ');
    });
    Alpine.store('data').mbtis = choices;
}

// game main
function finishSetup(mbti) {
    reactiveGameState.mbti = mbti;
    for(let k in mbti.bonus) {
        if(['s','a','i','w'].includes(k)) reactiveGameState.stats[k] += m.bonus[k];
        if(k==='luck') reactiveGameState.luck += m.bonus.luck;
        if(k==='moral') reactiveGameState.moral += m.bonus.moral;
    
    }

    let equip = reactiveGameState.job.equip; // g[0]=melee name, g[1]=ranged name...
    // 強制生成 Tier 1 的職業裝備
    reactiveGameState.eq.melee = ItemSystem.createItem('melee', equip[0], 1, false); 
    reactiveGameState.eq.ranged = ItemSystem.createItem('ranged', equip[1], 1, false); 
    reactiveGameState.eq.head = ItemSystem.createItem('head', equip[2], 1, false);
    reactiveGameState.eq.body = ItemSystem.createItem('body', equip[3], 1, false);
    reactiveGameState.eq.acc = ItemSystem.createItem('acc', equip[4], 1, false);
    reactiveGameState.eq.shoes = ItemSystem.createItem('shoes', equip[5] || '破爛球鞋', 1, false); 
    
    if(reactiveGameState.eq.ranged.name !== '無') 
        reactiveGameState.ammo += (reactiveGameState.eq.ranged.ammo || 5);

    if(reactiveGameState.diff===2) { 
        reactiveGameState.food=80;
        reactiveGameState.water=80;
    }
    if(reactiveGameState.diff===3) {
        reactiveGameState.food=50;
        reactiveGameState.water=50;
        reactiveGameState.hp=80; 
    }
    
    // =========== ★★★ 請在這裡插入代碼 ★★★ ===========
    reactiveGameState.unlockedSkills = [];
    
    // 初始化技能：如果職業有 skill_tree，解鎖第一招
    if (reactiveGameState.job.skill_tree && reactiveGameState.job.skill_tree.length > 0) {
        reactiveGameState.unlockedSkills.push(reactiveGameState.job.skill_tree[0]);
    }
    // =================================================

    // document.getElementById('screen-mbti').style.display = 'none';
    Alpine.store('ui').showMBTI = false;
    Character.recalcMaxHp(); 
    reactiveGameState.hp = reactiveGameState.maxHp; 
    // UIManager.updateUI();
    UIManager.showPlotDialog(1, showJobIntro);
}

// game main
function showJobIntro() {
    let modal ={
        showGameScreen: true,
        title: `職業背景：${reactiveGameState.job.name}`,
        content: reactiveGameState.job.background,
        class: "story-text",
        style: "'border-color':var(--r-legend)",
        buttonAction: startJourney,
        buttonText: "開始旅程",
    }
    UIManager.openModal(modal);

    // let html = `<div class="story-text" style="border-color:var(--r-legend)">${reactiveGameState.job.back}</div>`;
    // openModal(`職業背景：${reactiveGameState.job.n}`, html, `<button onclick="startJourney()">開始旅程</button>`);
}

// game main
function startJourney() {
    closeModal();
    reactiveGameState.day = 1; 
    log('系統', '旅程開始。', 'c-story');
    // updateUI();
    renderCampActions(); 
}

// GameMain
export function log(t, m, c='') {
    let d = document.getElementById('log-area');
    d.innerHTML += `<div class="log-entry"><span style="color:#666">[D${reactiveGameState.day}]</span> [${t}] <span class="${c}">${m}</span></div>`;
    d.scrollTop = d.scrollHeight;
}

// game main
function gameOver(reason) { 
    reactiveGameState.alive = false;
    hideGameContainer();
    let btnHtml = `<button onclick="location.reload()" style="border-color:#f44; color:#f44; width:100%">💀 重新開始 (F5)</button>`;

    if (reactiveGameState.day >= 30) {
        let rewindDays = 30;
        let hpCost = 20;    // 預設代價高
        let statCost = 10;  // 預設代價高
        let label = "⏳ 時光倒流 (回溯30天)";
        let descText = "回到一個月前重新修練。";

        // 如果是打最終 Boss 死的，代價降低，時間縮短
        if (reactiveGameState.combat && reactiveGameState.combat.n === "最終屍王") {
            rewindDays = 7;
            hpCost = 10;    // Boss戰優惠
            statCost = 2;   // Boss戰優惠
            label = "⏳ 最後的意志 (回溯7天)";
            descText = "在決戰前一星期醒來，代價較小。";
        }

        // 計算下一次回溯後的預估血量上限
        let nextMaxHp = reactiveGameState.maxHp - hpCost;

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
}	

// game main
// ★★★ 修改：接收 days, hpCost, statCost 三個參數 ★★★
function rewindTime(daysToRewind, hpCost, statCost) {
    let targetDay = Math.max(1, reactiveGameState.day - daysToRewind);
    let actualRewind = reactiveGameState.day - targetDay;

    // 1. 執行血量上限懲罰
    reactiveGameState.hpPenalty = (reactiveGameState.hpPenalty || 0) + hpCost;

    // 2. 執行全屬性懲罰
    ['s', 'a', 'i', 'w'].forEach(key => {
        reactiveGameState.stats[key] = Math.max(1, reactiveGameState.stats[key] - statCost);
    });

    // 3. 恢復生存狀態
    reactiveGameState.alive = true;
    reactiveGameState.day = targetDay;
    
    
    reactiveGameState.hp = reactiveGameState.maxHp;   
    reactiveGameState.san = 100;      
    reactiveGameState.food = 100;     
    reactiveGameState.water = 100;
    
    // 4. 清除戰鬥狀態
    reactiveGameState.combat = null;
    reactiveGameState.activeSkillCD = 0;
    reactiveGameState.playerDefCD = 0;
    
    closeModal();
    document.getElementById('enemy-area').style.display = 'none';
    document.getElementById('enemy-area').innerHTML = '';
    
    // 5. 顯示日誌
    log('系統', `================================`, 'c-epic');
    log('系統', `⏳ 時光倒流！回到了 ${actualRewind} 天前。`, 'c-epic');
    log('系統', `💀 代價：HP上限 -${hpCost}, 全屬性 -${statCost}。`, 'c-loss');
    log('系統', `(當前 HP上限: ${reactiveGameState.maxHp})`, 'c-loss');
    log('系統', `================================`, 'c-epic');
    
    recalcMaxHp(); // 重新計算 MaxHP
    // updateUI();
    renderCampActions();
}

//使敵人受到的debuff顯示得更清晰//
function debugCheat(){
    reactiveGameState.money += 99999;
    reactiveGameState.food = 99999;
    reactiveGameState.water = 99999;
    reactiveGameState.maxHp += 99999;
    reactiveGameState.hp = reactiveGameState.maxHp;
    reactiveGameState.san = 100;
    updateUI();
    log('系統', '作弊成功！獲得 $99999，99999食物, 99999水源, 99999 HP, 並恢復狀態。', 'c-epic');
}

// 將其加入全局導出，防止報錯
// window.continueExploration = continueExploration;


// Export all functions to window at once
const globalFunctions = {
    startGame,
    closeModal: UIManager.closeModal,
    manualRefreshShop: CampSystem.manualRefreshShop,
    closePlotDialog: UIManager.closePlotDialog,
    startJourney,
    triggerExplore: CampSystem.triggerExplore,
    showItemDetail: ItemSystem.showItemDetail,
    recycleLoot: ItemSystem.recycleLoot,
    sellBagItem: CampSystem.sellBagItem,
    buyShopItem: CampSystem.buyShopItem,
    openShop: CampSystem.openShop,
    takeItemToBag: ItemSystem.takeItemToBag,
    discardBagItem: ItemSystem.discardBagItem,
    useLootItemDirectly: ItemSystem.useLootItemDirectly,
    equipLoot: ItemSystem.equipLoot,
    useCombatItem: CombatSystem.useCombatItem,
    openCombatBag: UIManager.openCombatBag,
    combatRound: CombatSystem.combatRound,
    abandonQuest: StorySystem.abandonQuest,
    acceptQuest: StorySystem.acceptQuest,
    rewindTime,
    discardLoot: ItemSystem.discardLoot,
    showQuestDetail: StorySystem.showQuestDetail,
    showStats: UIManager.showStats,
    storyChoose: StorySystem.storyChoose,
    campAction: CampSystem.campAction,
    equipFromBag: ItemSystem.equipFromBag,
    discardCampItem: ItemSystem.discardCampItem,
    useCampItem: ItemSystem.useCampItem,
    collapseStat: UIManager.collapseStat,
    collapseEquip: UIManager.collapseEquip,
    renderCampActions: UIManager.renderCampActions,
    campPhase: CampSystem.campPhase,
    nextStoryStep: StorySystem.nextStoryStep,
    openCampBag: ItemSystem.openCampBag,
    renderJobs,
    // renderJobIntro,
    debugCheat,
    triggerShake: UIManager.triggerShake,
    pickUpBossLoot: ItemSystem.pickUpBossLoot, 
    closeBossLoot: UIManager.closeBossLoot, 
    openSkillMenu: UIManager.openSkillMenu,
    performSkill: CombatSystem.performSkill,
    finishSetup,
    continueExploration: CampSystem.continueExploration,
    exploreSetup: CampSystem.exploreSetup
};

Object.assign(window, globalFunctions);