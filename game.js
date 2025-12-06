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
import LOC_EVENT_DB from './data/LOCATIONS.json' with  { type: "json" };

const STAT_MAP = { 
    s:'力量',
    a:'敏捷',
    i:'智力',
    w:'意志',
    moral:'道德',
    luck:'幸運',
    loot:'掉寶',
    heal:'回血',
    san:'回SAN',
    hp:'生命',
    melee:'近戰武器',
    ranged:'遠程武器',
    acc:'飾品',
    med:'醫療',
    head:'頭盔',
    body:'護甲',
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

// ==================== 怪物資料庫擴充 ====================

// 1. 普通怪物庫 (50種, 10 per Tier)
// 結構: { n:名字, hp:基數, atk:基數, desc:描述, tier:等級 }
const NORMAL_ENEMIES = {
    1: [
        {n:'流浪餓犬', hp:30, atk:8}, {n:'蹣跚感染者', hp:35, atk:10}, {n:'拾荒暴徒', hp:40, atk:12}, 
        {n:'失智老人', hp:25, atk:8}, {n:'變異老鼠', hp:20, atk:15}, {n:'剛變異的鄰居', hp:35, atk:10},
        {n:'發狂的醉漢', hp:45, atk:14}, {n:'腐爛的鴿群', hp:25, atk:12}, {n:'迷路的遊客', hp:30, atk:9}, {n:'超市搶匪', hp:40, atk:13}
    ],
    2: [
        {n:'下水道爬行者', hp:60, atk:20}, {n:'尖刺狂奔者', hp:55, atk:25}, {n:'腫脹屍', hp:80, atk:18},
        {n:'雙頭犬', hp:65, atk:22}, {n:'持棍暴徒', hp:70, atk:20}, {n:'孢子感染者', hp:60, atk:15},
        {n:'變異警衛', hp:75, atk:22}, {n:'酸液吐者', hp:50, atk:28}, {n:'利爪喪屍', hp:65, atk:26}, {n:'硬皮喪屍', hp:90, atk:15}
    ],
    3: [
        {n:'防暴喪屍', hp:120, atk:30}, {n:'骨刃獵手', hp:100, atk:40}, {n:'武裝掠奪者', hp:110, atk:35},
        {n:'變異大猩猩', hp:150, atk:45}, {n:'共生體喪屍', hp:130, atk:32}, {n:'信號干擾者', hp:90, atk:25},
        {n:'狂暴騎手', hp:110, atk:38}, {n:'隱形潛伏者', hp:80, atk:50}, {n:'重甲傭兵', hp:140, atk:35}, {n:'鏈鋸狂人', hp:125, atk:42}
    ],
    4: [
        {n:'半機械喪屍', hp:200, atk:55}, {n:'等離子幽靈', hp:160, atk:70}, {n:'納米感染體', hp:180, atk:60},
        {n:'輻射巨獸', hp:250, atk:65}, {n:'虛空之影', hp:150, atk:80}, {n:'心靈控制者', hp:140, atk:50},
        {n:'重力扭曲者', hp:170, atk:65}, {n:'生化改造兵', hp:220, atk:58}, {n:'水晶外殼屍', hp:300, atk:45}, {n:'音波尖嘯者', hp:160, atk:75}
    ],
    5: [
        {n:'崩壞裂解者', hp:350, atk:90}, {n:'維度吞噬者', hp:400, atk:100}, {n:'恆星之子', hp:380, atk:110},
        {n:'熵增熵減', hp:360, atk:95}, {n:'時間錯位體', hp:320, atk:120}, {n:'反物質幽靈', hp:300, atk:130},
        {n:'規則破壞者', hp:450, atk:85}, {n:'終焉使徒', hp:420, atk:105}, {n:'黑洞寄生體', hp:500, atk:90}, {n:'神之棄子', hp:480, atk:100}
    ]
};

// 2. 精英怪物庫 (20種, 4 per Tier) - 具備獨特技能
const ELITE_ENEMIES = {
    1: [
        {n:'垃圾山之王', hp:80, atk:15, sks:[{n:'垃圾投擲', eff:'stun', rate:0.3}]},
        {n:'午夜嚎叫者', hp:60, atk:25, sks:[{n:'恐懼尖叫', eff:'atk_down', rate:0.4}]},
        {n:'霓虹飛車黨', hp:70, atk:20, sks:[{n:'高速撞擊', eff:'double_hit', rate:0.3}]},
        {n:'人肉屠夫', hp:90, atk:18, sks:[{n:'剁肉', eff:'bleed', rate:0.4}]}
    ],
    2: [
        {n:'孢子母體', hp:150, atk:25, sks:[{n:'毒霧擴散', eff:'poison', rate:0.4}]},
        {n:'高壓電工', hp:120, atk:35, sks:[{n:'過載電擊', eff:'stun', rate:0.3}]},
        {n:'水泥巨像', hp:200, atk:20, sks:[{n:'硬化防禦', eff:'def_up', rate:0.5}]},
        {n:'鏡中人', hp:100, atk:40, sks:[{n:'鏡像複製', eff:'dodge_up', rate:0.4}]}
    ],
    3: [
        {n:'數據幽靈', hp:220, atk:45, sks:[{n:'防火牆', eff:'shield', rate:0.3}]},
        {n:'精準外科醫', hp:180, atk:60, sks:[{n:'手術刀暴擊', eff:'crit', rate:0.4}]},
        {n:'痛苦收割者', hp:250, atk:50, sks:[{n:'靈魂收割', eff:'heal_self', rate:0.3}]},
        {n:'重力操控師', hp:200, atk:55, sks:[{n:'重力壓制', eff:'acc_down', rate:0.4}]}
    ],
    4: [
        {n:'核心反應堆', hp:400, atk:70, sks:[{n:'輻射脈衝', eff:'burn', rate:0.5}]},
        {n:'時空跳躍者', hp:300, atk:90, sks:[{n:'時間回溯', eff:'heal_self', rate:0.2}]},
        {n:'納米雲團', hp:350, atk:60, sks:[{n:'分解', eff:'def_down', rate:0.5}]},
        {n:'絕對沉默者', hp:320, atk:100, sks:[{n:'靜默', eff:'silence', rate:1.0}]} // 必中封印
    ],
    5: [
        {n:'熵之騎士', hp:600, atk:120, sks:[{n:'無序打擊', eff:'random_debuff', rate:0.4}]},
        {n:'黑洞化身', hp:800, atk:150, sks:[{n:'視界吞噬', eff:'hp_halve', rate:0.2}]}, // 血量減半
        {n:'代碼篡改者', hp:500, atk:110, sks:[{n:'GM權限', eff:'stun', rate:0.5}]},
        {n:'被遺忘的古神', hp:999, atk:100, sks:[{n:'精神污染', eff:'san_dmg', rate:0.4}]}
    ]
};

// 3. 地點專屬 Boss (12地點 x 5 Tier = 60 Bosses)
// 每個 Boss 至少 2 個技能
const LOCATION_BOSSES = {
    "廢棄超市": [
        {t:1, n:'過期食品管理員', hp:150, atk:20, sks:[{n:'腐爛投擲', eff:'poison'}, {n:'推倒貨架', eff:'stun'}]},
        {t:2, n:'冷凍庫巨怪', hp:300, atk:40, sks:[{n:'極寒吐息', eff:'stun'}, {n:'冰甲', eff:'def_up'}]},
        {t:3, n:'貪食者', hp:600, atk:70, sks:[{n:'吞噬', eff:'heal_self'}, {n:'胃酸噴射', eff:'burn'}]},
        {t:4, n:'條碼掃描機甲', hp:1000, atk:110, sks:[{n:'雷射掃描', eff:'crit'}, {n:'價格計算', eff:'def_down'}]},
        {t:5, n:'消費主義之神', hp:2000, atk:180, sks:[{n:'清倉大拍賣', eff:'aoe'}, {n:'通脹', eff:'hp_halve'}]}
    ],
    "五金店": [
        {t:1, n:'瘋狂裝修工', hp:160, atk:22, sks:[{n:'釘槍連射', eff:'bleed'}, {n:'大鎚碎顱', eff:'crit'}]},
        {t:2, n:'電鋸殺人狂', hp:320, atk:45, sks:[{n:'肢解', eff:'bleed'}, {n:'燃油補充', eff:'atk_up'}]},
        {t:3, n:'鋼鐵魔像', hp:700, atk:60, sks:[{n:'鐵壁', eff:'shield'}, {n:'地震波', eff:'stun'}]},
        {t:4, n:'自動化砲台王', hp:1100, atk:100, sks:[{n:'鎖定目標', eff:'acc_up'}, {n:'彈幕', eff:'double_hit'}]},
        {t:5, n:'萬機之父', hp:2200, atk:170, sks:[{n:'重組', eff:'heal_self'}, {n:'機械降神', eff:'kill'}]}
    ],
    "診所": [
        {t:1, n:'實習醫生', hp:140, atk:18, sks:[{n:'錯誤處方', eff:'poison'}, {n:'鎮靜劑', eff:'sleep'}]},
        {t:2, n:'染血護士長', hp:280, atk:38, sks:[{n:'抽血', eff:'heal_self'}, {n:'巨大的針筒', eff:'crit'}]},
        {t:3, n:'外科屠夫', hp:650, atk:65, sks:[{n:'麻醉氣體', eff:'sleep'}, {n:'精準切割', eff:'bleed'}]},
        {t:4, n:'生化實驗體0號', hp:1200, atk:90, sks:[{n:'病毒爆發', eff:'poison_aoe'}, {n:'再生', eff:'heal_self'}]},
        {t:5, n:'院長 (病毒本體)', hp:2100, atk:160, sks:[{n:'基因改寫', eff:'random_debuff'}, {n:'生命汲取', eff:'hp_halve'}]}
    ],
    "民居": [
        {t:1, n:'家暴男', hp:130, atk:25, sks:[{n:'摔酒瓶', eff:'bleed'}, {n:'狂怒', eff:'atk_up'}]},
        {t:2, n:'閣樓的怨靈', hp:260, atk:40, sks:[{n:'尖嘯', eff:'san_dmg'}, {n:'穿牆', eff:'dodge_up'}]},
        {t:3, n:'囤積癖巨人', hp:600, atk:60, sks:[{n:'垃圾雪崩', eff:'stun'}, {n:'雜物盾', eff:'shield'}]},
        {t:4, n:'智能管家(失控)', hp:1000, atk:95, sks:[{n:'關閉氧氣', eff:'poison'}, {n:'防盜電擊', eff:'stun'}]},
        {t:5, n:'孤獨死集合體', hp:2000, atk:150, sks:[{n:'絕望靈氣', eff:'san_dmg'}, {n:'同化', eff:'stun'}]}
    ],
    "警局分局": [
        {t:1, n:'腐敗菜鳥', hp:160, atk:20, sks:[{n:'警棍重擊', eff:'stun'}, {n:'呼叫支援', eff:'def_up'}]},
        {t:2, n:'K9警犬王', hp:300, atk:50, sks:[{n:'撕咬喉嚨', eff:'bleed'}, {n:'追蹤', eff:'acc_up'}]},
        {t:3, n:'SWAT隊長', hp:700, atk:70, sks:[{n:'震撼彈', eff:'stun'}, {n:'戰術掃射', eff:'double_hit'}]},
        {t:4, n:'鎮暴機甲', hp:1300, atk:100, sks:[{n:'催淚瓦斯', eff:'blind'}, {n:'高壓水炮', eff:'stun'}]},
        {t:5, n:'鐵腕局長', hp:2400, atk:190, sks:[{n:'戒嚴令', eff:'def_up'}, {n:'就地正法', eff:'crit'}]}
    ],
    "服裝店": [
        {t:1, n:'無頭模特', hp:140, atk:18, sks:[{n:'塑料重擊', eff:'stun'}, {n:'假人偽裝', eff:'dodge_up'}]},
        {t:2, n:'瘋狂裁縫', hp:280, atk:35, sks:[{n:'剪刀衝刺', eff:'bleed'}, {n:'針線縫合', eff:'stun'}]},
        {t:3, n:'皮革臉', hp:600, atk:65, sks:[{n:'人皮面具', eff:'san_dmg'}, {n:'電鋸狂舞', eff:'aoe'}]},
        {t:4, n:'鏡像魔女', hp:1000, atk:90, sks:[{n:'鏡像分身', eff:'dodge_up'}, {n:'破碎玻璃', eff:'bleed'}]},
        {t:5, n:'時尚女魔頭', hp:2000, atk:160, sks:[{n:'致命潮流', eff:'crit'}, {n:'高級定製', eff:'shield'}]}
    ],
    "公園": [
        {t:1, n:'流浪漢皇帝', hp:140, atk:15, sks:[{n:'丟石頭', eff:'stun'}, {n:'惡臭', eff:'poison'}]},
        {t:2, n:'變異棕熊', hp:350, atk:55, sks:[{n:'熊抱', eff:'stun'}, {n:'撕裂', eff:'bleed'}]},
        {t:3, n:'植物女王', hp:650, atk:60, sks:[{n:'藤蔓纏繞', eff:'stun'}, {n:'花粉', eff:'sleep'}]},
        {t:4, n:'噴水池海怪', hp:1100, atk:95, sks:[{n:'水壓衝擊', eff:'stun'}, {n:'觸手鞭打', eff:'double_hit'}]},
        {t:5, n:'蓋亞化身', hp:2300, atk:170, sks:[{n:'自然復仇', eff:'aoe'}, {n:'大地之盾', eff:'heal_self'}]}
    ],
    "銀行": [
        {t:1, n:'ATM破壞者', hp:160, atk:22, sks:[{n:'鈔票夾擊', eff:'stun'}, {n:'鐵拳', eff:'crit'}]},
        {t:2, n:'蒙面搶匪首領', hp:320, atk:45, sks:[{n:'霰彈槍轟擊', eff:'aoe'}, {n:'人質盾牌', eff:'def_up'}]},
        {t:3, n:'高利貸吸血鬼', hp:680, atk:70, sks:[{n:'利滾利', eff:'atk_up'}, {n:'吸血', eff:'heal_self'}]},
        {t:4, n:'金庫守護者', hp:1400, atk:100, sks:[{n:'鈦合金裝甲', eff:'shield'}, {n:'激光防禦', eff:'burn'}]},
        {t:5, n:'資本巨鱷', hp:2500, atk:200, sks:[{n:'金融海嘯', eff:'hp_halve'}, {n:'破產清算', eff:'kill'}]}
    ],
    "下水道": [
        {t:1, n:'巨大蟑螂', hp:130, atk:15, sks:[{n:'飛行衝撞', eff:'acc_down'}, {n:'頑強生命', eff:'heal_self'}]},
        {t:2, n:'污泥怪', hp:300, atk:35, sks:[{n:'包裹', eff:'stun'}, {n:'酸性腐蝕', eff:'def_down'}]},
        {t:3, n:'鱷魚王', hp:700, atk:65, sks:[{n:'死亡翻滾', eff:'crit'}, {n:'堅硬鱗甲', eff:'def_up'}]},
        {t:4, n:'鼠疫領主', hp:1100, atk:90, sks:[{n:'黑死病', eff:'poison_aoe'}, {n:'召喚鼠群', eff:'double_hit'}]},
        {t:5, n:'深淵之物', hp:2200, atk:160, sks:[{n:'凝視深淵', eff:'san_dmg'}, {n:'觸手絞殺', eff:'kill'}]}
    ],
    "電子城": [
        {t:1, n:'漏電的機器人', hp:150, atk:20, sks:[{n:'電火花', eff:'stun'}, {n:'自爆程序', eff:'aoe'}]},
        {t:2, n:'無人機蜂群', hp:280, atk:40, sks:[{n:'蜂群掃射', eff:'double_hit'}, {n:'空中優勢', eff:'dodge_up'}]},
        {t:3, n:'VR腦控者', hp:600, atk:75, sks:[{n:'虛擬現實', eff:'sleep'}, {n:'精神衝擊', eff:'san_dmg'}]},
        {t:4, n:'挖礦機巨獸', hp:1200, atk:100, sks:[{n:'算力過載', eff:'burn'}, {n:'顯卡散熱', eff:'acc_down'}]},
        {t:5, n:'AI 奇點', hp:2400, atk:190, sks:[{n:'格式化', eff:'hp_halve'}, {n:'天網啟動', eff:'aoe'}]}
    ],
    "健身房": [
        {t:1, n:'跑步機受害者', hp:140, atk:25, sks:[{n:'失控衝撞', eff:'stun'}, {n:'絆倒', eff:'acc_down'}]},
        {t:2, n:'類固醇狂人', hp:350, atk:50, sks:[{n:'藥物狂暴', eff:'atk_up'}, {n:'重拳', eff:'stun'}]},
        {t:3, n:'瑜伽大師', hp:650, atk:60, sks:[{n:'極限閃避', eff:'dodge_up'}, {n:'關節技', eff:'stun'}]},
        {t:4, n:'鐵塊巨人', hp:1300, atk:110, sks:[{n:'槓鈴投擲', eff:'crit'}, {n:'金屬皮膚', eff:'def_up'}]},
        {t:5, n:'完美肉體', hp:2300, atk:180, sks:[{n:'究極生物', eff:'heal_self'}, {n:'認真一拳', eff:'kill'}]}
    ],
    "學校": [
        {t:1, n:'變異留級生', hp:140, atk:20, sks:[{n:'勒索', eff:'stun'}, {n:'棒球棍', eff:'crit'}]},
        {t:2, n:'瘋狂校工', hp:300, atk:40, sks:[{n:'拖把橫掃', eff:'acc_down'}, {n:'強酸清潔劑', eff:'poison'}]},
        {t:3, n:'化學老師', hp:650, atk:70, sks:[{n:'爆炸試劑', eff:'burn'}, {n:'毒氣雲', eff:'poison_aoe'}]},
        {t:4, n:'四分衛隊長', hp:1200, atk:100, sks:[{n:'野蠻衝撞', eff:'stun'}, {n:'團隊精神', eff:'def_up'}]},
        {t:5, n:'魔鬼校長', hp:2100, atk:170, sks:[{n:'開除學籍', eff:'kill'}, {n:'廣播洗腦', eff:'san_dmg'}]}
    ]
};

const SKILLS = {
    chuunibyou: {n:'中二病', cd:4, desc:'攻擊力提升1-100%持續3回合'},
    snipe: {n:'精準狙擊', cd:3, desc:'200%傷害, 可暴擊'},
    first_aid: {n:'急救', cd:4, desc:'恢復50%已損生命'},
    fate_throw: {n:'命運一擲', cd:3, desc:'50%-400%傷害, 可暴擊'},
    weakness_scan: {n:'弱點分析', cd:4, desc:'敵人防禦降30%'},
    risk_manage: {n:'風險管理', cd:3, desc:'獲得100%最大血量護盾'},
    kungfu_panda: {n:'功夫熊貓', cd:3, desc:'秒殺/回血/暈眩傷害'},
    flash_bang: {n:'閃光彈', cd:4, desc:'敵人降攻與命中'},
    rage: {n:'狂暴', cd:5, desc:'消耗HP大幅提升攻擊'},
    god_hand: {n:'神之一手', cd:4, desc:'防禦100%且必暴擊反擊'},
    tree_strike: {n:'含家鏟泥來種樹', cd:4, desc:'150%傷害+定身2回合'},
    risk_hedge: {n:'風險對沖', cd:3, desc:'免疫傷害轉為未來兩次攻擊加成'},
    dictionary: {n:'查字典', cd:3, desc:'隨機: 攻/防/善/惡'},
    dlss: {n:'DLSS加速', cd:4, desc:'提升50%敏捷閃避'},
    bullseye: {n:'紅心鎖定', cd:3, desc:'無視防禦必中, 可暴擊'},
    creatine: {n:'Creatine', cd:4, desc:'全屬性攻防+50%'},
    hypnosis: {n:'催眠', cd:5, desc:'敵人睡眠2回合'},
    shave: {n:'剃光頭', cd:3, desc:'敵降攻防命中各20%'},
    tesla_coil: {n:'特斯拉線圈', cd:4, desc:'200%傷+降防, 機率持續'},
    pi_strike: {n:'圓周率', cd:3, desc:'1-200 x PI 傷害'},
    kid_squad: {n:'媽的貢丸忍刀五人眾', cd:5, desc:'召喚朋友助陣5回合'},
    money_rain: {n:'大撒幣', cd:4, desc:'幸運與智力加成傷害'},
    waterfall: {n:'Kim Setup', cd:4, desc:'110%-500%傷害'},
    drift: {n:'東京漂移', cd:3, desc:'連擊機率提升'},
    matrix: {n:'Matrix World', cd:4, desc:'閃避提升50%'},
    one_cue: {n:'一Q清檯', cd:4, desc:'機率秒殺或200%傷'},
    holy_chant: {n:'聖靈吟唱', cd:4, desc:'扣敵血量百分比並反傷'},
    talisman: {n:'天師符', cd:3, desc:'定身並召喚殭屍, 2回合轉化'},
    welding: {n:'全身焊接', cd:3, desc:'敵命中降50%降防'},
    raptor: {n:'速龍突襲', cd:3, desc:'200%傷, 機率直接逮捕'},
    redbull: {n:'Red Bull BC ONE', cd:4, desc:'攻閃+30%'},
    high_pitch: {n:'飆高音', cd:3, desc:'受傷但降敵攻命'}
};

const MAIN_PLOT = {
    1: "【末蝕降臨】<br>天空被血紅色的日蝕吞沒，刺耳的防空警報聲在尖叫了三小時後終於沉寂，取而代之的是街道上無休止的嘶吼與咀嚼聲。你從昏迷中醒來，空氣中瀰漫著鐵鏽與腐肉混合的腥味。手機螢幕亮著最後一條緊急通告：「不要相信任何人，不要發出聲音。」你看著窗外燃燒的城市，握緊了手中唯一的武器。舊世界已經死了，從今天起，活下去是唯一的法律。",
    
    10: "【適應與絕望】<br>十天過去了，救援隊沒有來，廣播頻段也只剩下一片死寂的白噪音。你學會了在睡覺時睜著一隻眼，學會了分辨風聲與喪屍拖行腳步聲的區別。街道上的屍體開始腫脹、腐爛，但更可怕的是那些活著的人。昨天你看見有人為了一罐過期的貓罐頭，用磚頭砸爛了同伴的腦袋。你意識到，比起那些嗜血的怪物，飢餓和恐懼才是更致命的毒藥。",
    
    20: "【進化的徵兆】<br>情況正在惡化。你在外出搜尋物資時，遇到了一隻與眾不同的喪屍。它的肌肉呈現出異常的灰白色，行動速度遠超常人，甚至懂得躲避你的攻擊。日蝕帶來的輻射似乎正在催化某種變異。在它的屍體旁，你發現了一本染血的筆記，上面潦草地寫著：「它們在學習……它們在進化……蝕刻病毒不是自然產物。」這行字讓你背脊發涼。",
    
    30: "【暗夜低語】<br>最近的夜晚變得格外漫長。紅色的月光下，你總能聽到城市深處傳來低沉的轟鳴聲，像是某種巨大的心臟在跳動。你的精神狀態開始變得不穩定，幻聽越來越頻繁。有時候，你會覺得那些喪屍在呼喚你的名字。你必須時刻盯著自己的SAN值，在這個瘋狂的世界裡，保持理智比保持健康更難。你告訴自己：那只是風聲，那只是風聲。",
    
    40: "【倖存者據點】<br>你收到了一個斷斷續續的無線電信號，坐標指向市中心的廣播塔。當你冒死趕到時，只看到了一片廢墟和滿地的彈殼。據點被攻破了，牆上用血寫著巨大的「叛徒」。這裡曾發生過一場激烈的內鬥。你在屍堆中找到了一張地圖，上面圈出了幾個紅色的危險區域，並標註著「巢穴」。看來，有組織的屍群正在形成，而人類依然在自相殘殺。",
    
    50: "【血色滿月】<br>今天是「血月」之夜。天空中的日蝕光環變得鮮紅欲滴，所有的喪屍都陷入了狂暴狀態。它們不再漫無目的地遊蕩，而是像潮水一樣向著同一個方向湧去——城市的中央區。你在高處用望遠鏡觀察，看到了一個令人絕望的景象：無數的喪屍正在堆疊在一起，似乎在建造某種祭壇。這不再是單純的病毒爆發，這是某種邪惡儀式的開端。",
    
    60: "【變異核心】<br>為了尋找更強力的裝備，你深入了地圖上標記的「重度污染區」。這裡的植物都變成了紫黑色，會主動纏繞過往的生物。你在一間地下實驗室裡發現了驚人的真相：這次末日並非天災，而是「永生計劃」的失敗品。最初的病毒是為了修復人體細胞，卻在日蝕的引力波下發生了不可逆的突變。你是唯一的知情者，這份真相沉重得讓你喘不過氣。",
    
    70: "【獵殺者出現】<br>你感覺自己被盯上了。一種穿著破爛風衣、手持電鋸的巨型喪屍開始頻繁出現在你的活動區域。它似乎擁有一定的智力，專門獵殺其他倖存者並收集他們的裝備。這是「暴君」級別的變異體。在一次遭遇戰中，你勉強逃脫，但你的手臂上留下了深可見骨的傷痕。你知道，這場貓鼠遊戲不會持續太久，你要麼殺了它，要麼成為它的戰利品。",
    
    80: "【孤獨的信號】<br>無線電再次響起，這次是一個清晰的男聲，自稱是「方舟」基地的科學家。他說他們研發出了能暫時抑制病毒的血清，但需要有人將關鍵的數據芯片送到城市邊緣的發射井。這聽起來像是一個陷阱，或者是最後的希望。你看著日益枯竭的物資和窗外越來越密集的屍群，決定賭一把。反正，留在這裡也只是等死。",
    
    90: "【屍潮圍城】<br>前往發射井的路被屍潮徹底堵死了。成千上萬的喪屍擠滿了街道，如同黑色的河流。你被迫躲進一棟堅固的銀行大樓。接下來的三天是地獄般的煎熬，你利用狹窄的樓道和自製的陷阱，擊退了一波又一波的進攻。彈藥耗盡了，你只能用消防斧肉搏。當最後一隻喪屍倒下時，你全身都被黑色的血漿覆蓋，分不清是自己的還是怪物的。",
    
    100: "【百日餘生】<br>活過一百天，這本身就是一個奇蹟。你的眼神變得像野獸一樣冷酷，你的肌肉記憶裡刻滿了殺戮的技巧。你不再是那個在辦公室裡敲鍵盤的普通人，你是廢土上的獵人。你找到了一面鏡子，幾乎認不出裡面的自己。長髮凌亂，滿臉鬍渣，眼神中透著一股令人膽寒的殺氣。你活下來了，但你的人性還剩下多少？",
    
    120: "【基因鎖解除】<br>在長期的戰鬥和輕微的病毒感染下，你的身體似乎也發生了某種變化。你的力量、反應速度都遠超常人，傷口的癒合速度也變快了。科學家稱之為「適應性進化」。你開始能使用一些常人無法想像的重型武器，甚至能感知到周圍喪屍的腦電波波動。這是一份禮物，還是一份詛咒？你正在慢慢變成你所對抗的怪物嗎？",
    
    140: "【通往地獄的車票】<br>你終於接近了城市的核心區——那個巨大的黑色尖塔所在的位置。那裡曾是这座城市最高的摩天大樓，現在卻被無數的血肉藤蔓包裹，成為了連接天與地的魔塔。周圍的引力場異常混亂，車輛懸浮在半空，建築物扭曲變形。每前進一步，你的大腦都像被針扎一樣劇痛。最終的審判之地就在眼前。",
    
    160: "【最後的通牒】<br>「方舟」的科學家再次聯繫了你，聲音急促而絕望。他們說，日蝕即將進入「全食」階段，屆時尖塔將釋放覆蓋全球的衝擊波，徹底重寫地球生態。人類將徹底滅絕，取而代之的是新的硅基-血肉混合生命體。你必須在第 196 天之前攻入塔頂，摧毀那個被稱為「屍王」的核心載體。你是全人類最後的希望。",
    
    180: "【決戰前夕】<br>你將所有的資源都拿了出來，最好的槍械，最鋒利的刀刃，還有那一支珍貴的腎上腺素。你坐在營火旁，仔細地擦拭著武器。回想起這 180 天的旅程，那些死去的朋友，那些失去的人性，所有的痛苦和犧牲都將在接下來的戰鬥中得到終結。你沒有恐懼，只有燃燒的怒火。明天，太陽將會升起，或者是永遠的黑暗。",
    
    196: "【終焉之刻】<br>你站在了黑色尖塔的頂端。狂風呼嘯，血紅色的天空彷彿觸手可及。在你面前的，是那個引發了一切災難的源頭——最終屍王。它懸浮在半空，身後連接著無數的血管與電纜，宛如一尊墮落的神明。它緩緩睜開了眼睛，那雙眼睛裡沒有瞳孔，只有無盡的虛空。「你來遲了，凡人。」它發出震耳欲聾的咆哮。拔出你的武器吧，為了人類的黎明，斬殺神明！"
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
    
    let c = document.getElementById('job-container');
    c.innerHTML = '';
    let pool = [...ALL_JOBS].sort(()=>0.5-Math.random()).slice(0, 9);
    
    pool.forEach(j => {
        let div = document.createElement('div');
        div.className = 'comp-box'; div.style.cursor='pointer';
        div.innerHTML = `<strong class="q3">${j.n}</strong><br><span style="font-size:0.8em;color:#aaa">力${j.s.s} 敏${j.s.a} 智${j.s.i} 意${j.s.w}</span><div style="font-size:0.8em;margin-top:5px;color:#888">${j.desc}</div>`;
        div.onclick = () => { G.job = j; G.stats = {...j.s}; showMbti(); };
        c.appendChild(div);
    });
    document.getElementById('screen-jobs').style.display = 'flex';
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
    
    if(G.eq.ranged.name !== '無') G.ammo += (G.eq.ranged.ammo || 5);

    if(G.diff===2) { G.food=80; G.water=80; }
    if(G.diff===3) { G.food=50; G.water=50; G.hp=80; }
    
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
    
    // --- 修改處：移除 G.activeSkillCD 的相關代碼 ---
    // G.activeSkillCD = Math.max(0, G.activeSkillCD - 1); (已刪除)
    G.playerDefCD = Math.max(0, G.playerDefCD - 1); // 防禦CD如果是回合制也可移走，這裡暫時保留或視需求改動
    
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
    
      // === 消耗平衡 (大幅上調) ===
    // 舊版: 10 / 15 / 20 (太少)
    // 新版:
    // 正常: 20 (標準消耗，搜刮一次夠吃2天)
    // 困難: 30 (壓力增大)
    // 噩夢: 40 (極度飢渴，搜刮一次僅夠1天，稍微臉黑就會斷糧)
    let baseCost = 20;
    if(G.diff === 2) baseCost = 30;
    if(G.diff === 3) baseCost = 40;

    if(G.job.passive === 'dev_buff') baseCost = Math.floor(baseCost * 0.6);  // Kim 地產霸權

    G.food -= baseCost; G.water -= baseCost;

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
        // 舊版: 15 / 30
        // 新版: 20 / 50 (噩夢斷糧=半條命沒了)
        // 這會迫使玩家在斷糧前即使只有 10 HP 也要硬著頭皮去搜刮
        let starveDmg = (G.diff === 3) ? 50 : 20;
        G.hp -= starveDmg; 
        log('生存', `嚴重飢渴受傷 -${starveDmg}`, 'c-loss'); 
    }
    
    // === 自然回血 ===
    let heal = 0;
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
        'throwable': { t: '💣 投擲', c: 'tag-melee' } // 投擲歸類為攻擊色
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
        else if (['melee', 'ranged', 'head', 'body', 'acc'].includes(item.type)) {
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
        G.food-=20; G.hp=Math.min(G.maxHp, G.hp+30); G.san=Math.min(100, G.san+20);
        log('休息','體力恢復','c-gain');
    } else if(act==='water') {
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
    renderStoryModal();
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
    </div>`;
    
   let shuffledOpts = [...stepData.opts].sort(() => 0.5 - Math.random());
    let btns = '';
    shuffledOpts.forEach(opt => {
        // 修改這裡：根據是否是 Boss 選項傳遞不同參數
        if (opt.boss) {
             btns += `<button class="opt-btn" onclick="storyChoose('${opt.type}', 'luck', true, '${opt.bossName}', ${opt.isQuest})">➤ ${opt.t}</button>`;
        } else {
             btns += `<button class="opt-btn" onclick="storyChoose('${opt.type}', '${opt.stat||'luck'}', false)">➤ ${opt.t}</button>`;
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
        let s=['s','a','i','w'][Math.floor(Math.random()*4)]; G.stats[s]++;
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
    let roll = Math.random() * 100;
    
    let pCritS = 5;
    let pSuccess = type === 'good' ? 66 : 24;
    
    let statVal = getStat(statKey);
    let difficulty = 10 + (G.day * 0.2); 
    let statMod = (statVal - difficulty) * 0.5; 
    statMod = Math.max(-10, Math.min(10, statMod)); 

    let luckMod = (getStat('luck') - 10) * 0.5;
    luckMod = Math.max(-5, Math.min(5, luckMod));

    let moralMod = 0;
    if(type === 'good') { if(G.moral > 50) moralMod = (G.moral - 50) * 0.2; } 
    else { if(G.moral < 50) moralMod = (50 - G.moral) * 0.2; }
    
    let threshCritS = pCritS + (luckMod > 0 ? 1 : 0);
    let effectiveSuccessRate = pSuccess + statMod + luckMod + moralMod;
    let threshSuccess = threshCritS + effectiveSuccessRate;
    let threshFail = 95; 

    if (roll < threshCritS) return 'crit_success';
    if (roll < threshSuccess) return 'success';
    if (roll < threshFail) return 'fail';
    return 'crit_fail';
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

    // 5. 最終上限判定 (Hard Cap 70%)
     let maxDodge = G.job.passive === 'high_dodge' ? 85 : 70;
    let finalDodge = Math.floor(dodgeBase);
    if (finalDodge > maxDodge) finalDodge = maxDodge;
    
    let critBase = (i * 0.5) + (l * 0.5); 
    if(G.job.passive === 'high_acc_crit') critBase += 30;
    if(G.job.passive === 'high_reflex') critBase += 10;
    if(G.job.passive === 'dealer_luck') critBase += 2;
    if(G.combat?.buffs?.dance === 'Hoan') critBase += 20;
    for(let k in G.eq) if(G.eq[k]?.stats?.crit) critBase += G.eq[k].stats.crit;

    let dmgRed = w * 0.25; 
    for(let k in G.eq) {
        if(G.eq[k] && G.eq[k].stats && G.eq[k].stats.defP) {
            let bonus = G.eq[k].stats.defP;
            if(G.eq[k].isJobNative) bonus *= 1.1; 
            dmgRed += (bonus * 100);
        }
    }
    if(G.combat?.buffs?.dance === 'Pete') dmgRed += 10;

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
        log('搜刮', `觸發陷阱 (-${dmg} HP)`, 'c-loss'); 
        
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
    let diffMult = 1 + (G.diff - 1) * 0.5; // 1.0, 1.5, 2.0
    let hp = Math.floor((500 + G.day * 10) * diffMult); 
    let atk = Math.floor((35 + G.day * 0.5) * (1 + (G.diff-1)*0.2)); 
    // 戰鬥開始 CD 歸零
    G.activeSkillCD = 0; 
    G.combat = { n:name, maxHp:hp, hp:hp, atk:atk, sk:'終極毀滅', isBoss:true, isQuest:isQuest, turnCount:0, buffs:{}, enemySkillCD:0, cloneTurns:0, xpVal:10, isStunned: false, playerShield: 0, usedItem: false };
    G.playerDefCD = 0; renderCombat();
}

function triggerCombat(enemyTemplate, danger) { 
    // === 修正開始：動態敵人生成邏輯 ===
    let tier = getCurrentTier();
    let enemy = null;
    let isElite = false;
    let isBoss = false;
    let locationName = G.activeQuest ? G.activeQuest.loc : (window.currentLocName || "民居"); // 需要在 explore 中記錄 currentLocName

    // 1. 決定敵人等級
    // 危險度(Danger) 越高，遇到 Elite/Boss 機率越高
    let bossChance = 0.02 * danger; 
    let eliteChance = 0.1 * danger; 
    
    // 如果是任務地點，必定Boss (這部分由 triggerBossFight 處理，這裡處理隨機遭遇)
    
    // Tier 限制 (避免 Tier 1 出現 Tier 5 怪，但高危區可以越級)
    let spawnTier = tier;
    if(danger >= 4 && Math.random() < 0.3) spawnTier = Math.min(5, tier + 1);

    if (Math.random() < bossChance && LOCATION_BOSSES[locationName]) {
        // 遭遇地點 Boss (稀有)
        let bosses = LOCATION_BOSSES[locationName];
        // 找對應 Tier 的 Boss，如果沒有就找最近的
        enemy = bosses.find(b => b.t === spawnTier) || bosses[0];
        isBoss = true;
    } else if (Math.random() < eliteChance) {
        // 遭遇 Elite
        let pool = ELITE_ENEMIES[spawnTier] || ELITE_ENEMIES[1];
        enemy = pool[Math.floor(Math.random() * pool.length)];
        isElite = true;
    } else {
        // 普通怪
        let pool = NORMAL_ENEMIES[spawnTier] || NORMAL_ENEMIES[1];
        enemy = pool[Math.floor(Math.random() * pool.length)];
    }
	
	// === 新增點：全敵人動態閃避計算 ===
    // 基礎閃避：Tier 1 = 0~5%, Tier 5 = 20~25%
    let baseDodge = (spawnTier - 1) * 5;

    // 2. 數值計算
    let hpMult = (1 + G.day/40) * G.diff;
    let atkMult = (1 + G.day/50) * (1 + (G.diff-1)*0.3);

    // Boss 和 Elite 會有額外加成
    if (isBoss) { hpMult *= 1.5; atkMult *= 1.2;baseDodge += 10; }
    else if (isElite) { hpMult *= 1.2; atkMult *= 1.1; baseDodge += 5;}

    let hp = Math.floor(enemy.hp * hpMult); 
    let atk = Math.floor(enemy.atk * atkMult);
    let xp = Math.max(1, Math.floor((danger || 1) * (isBoss ? 5 : isElite ? 2 : 1)));
	
	
	let finalDodge = Math.max(0, Math.min(60, baseDodge));

    G.activeSkillCD = 0;
    
    // 初始化 Combat 物件，包含技能列表
    G.combat = { 
        n: enemy.n, 
        maxHp: hp, 
        hp: hp, 
        atk: atk, 
	dodge: finalDodge,
        isBoss: isBoss, 
        isElite: isElite,
        sks: enemy.sks || [], // 載入技能
        turnCount: 0, 
        buffs: {}, 
        enemySkillCD: 0, 
        xpVal: xp, 
        isStunned: false, 
        playerShield: 0, 
        usedItem: false 
    };

    if(!G.combat.sk) G.combat.sk = '普通攻擊'; // 用於UI顯示
    G.playerDefCD = 0; 
    renderCombat();
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
function getCombatFlavor(attacker, target, action, dmg, isCrit, isKill) {
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
            let popup = document.createElement('div');
            popup.className = 'dmg-popup';
            popup.innerHTML = `-${damage}`;
            if(G.lastCrit) popup.style.color = '#ff0';
            el.appendChild(popup);
            setTimeout(() => popup.remove(), 1000);
        }
    }
}

// ==================== 極度昇華版 renderCombat ====================
function renderCombat() {
    let c = G.combat;
    
    // === 顯示並渲染敵人區域 (上方) ===
    let eArea = document.getElementById('enemy-area');
    eArea.style.display = 'block';

    // 計算敵人顯示數據
    let eDef = Math.floor(c.maxHp * 0.05);
    if(c.buffs.defDown) eDef = Math.floor(eDef * 0.5);
    if(c.buffs.defUp) eDef = Math.floor(eDef * 1.5);
    let eDefColor = c.buffs.defUp ? '#4f4' : (c.buffs.defDown ? '#f44' : '#ccc');

    let eDodge = 5;
    if(c.buffs.dodgeUp) eDodge += 40;
    if(c.buffs.accDown) eDodge += 25;
    if(c.isStunned || c.buffs.sleep) eDodge = 0;
    let eDodgeColor = eDodge > 5 ? '#fa0' : '#ccc';

    let eAtk = c.atk;
    let eAtkColor = c.buffs.atkUp ? '#f44' : (c.buffs.atkDown ? '#888' : '#ccc');

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

    // ★★★ 渲染敵人面板 ★★★
    eArea.innerHTML = `
    <div class="enemy-visual">
        <div class="enemy-avatar">${avatar}</div>
    </div>
    
    <div class="enemy-hud">
        <div class="hud-row">
            <span style="font-size:1.2em; font-weight:bold; color:#f66; text-shadow:0 0 5px #500">${c.isBoss ? '👑 ' : ''}${c.n}</span>
            <span style="font-family:'Consolas'; color:#fff">${c.hp} <span style="color:#666">/ ${c.maxHp}</span></span>
        </div>
        
        <div class="hp-bar-container">
            <div class="hp-bar-fill" style="width: ${hpPercent}%"></div>
        </div>

        <div class="stat-grid-compact" style="background:rgba(0,0,0,0.5); margin-top:5px;">
            <div>⚔️ <span style="color:${eAtkColor}">${eAtk}</span></div>
            <div>🛡️ <span style="color:${eDefColor}">${eDef}</span></div>
            <div>💨 <span style="color:${eDodgeColor}">${eDodge}%</span></div>
        </div>
        
        <div class="buff-row">${enemyBuffs.length ? enemyBuffs.join('') : '<span style="color:#444;font-size:0.8em">無狀態</span>'}</div>
        ${skillHtml}
    </div>`;

    // === 2. 渲染玩家與操作區域 (下方) ===
    let skillData = SKILLS[G.job.sk];
    if(!skillData) skillData = {n:'無技能', desc:'', cd:99};
    let isSilenced = c.playerDebuffs && c.playerDebuffs.silence > 0;
    
    let skillBtnText = `<div style="font-weight:bold">${skillData.n}</div>`;
    if(isSilenced) skillBtnText += `<div style="font-size:0.75em;color:#d0f">⛔沉默(${c.playerDebuffs.silence})</div>`;
    else if(G.activeSkillCD > 0) skillBtnText += `<div style="font-size:0.75em;color:#f44">CD:${G.activeSkillCD}</div>`;
    else skillBtnText += `<div style="font-size:0.75em;color:#4f4">就緒</div>`;

    let pStun = (c.playerDebuffs && c.playerDebuffs.stun > 0);
    let disableAll = pStun ? 'disabled style="filter:grayscale(100%); opacity:0.6"' : '';
    let pStatus = [];
    if(pStun) pStatus.push(`<span class="buff-badge" style="color:#fa0;border-color:#fa0">⚡暈眩(${c.playerDebuffs.stun})</span>`);
    if(c.playerShield > 0) pStatus.push(`<span class="buff-badge" style="color:#4f4;border-color:#4f4">🛡️盾${c.playerShield}</span>`);

    let statsBar = `<div style="background:#161616; padding:8px; border-radius:4px; border:1px solid #333; margin-bottom:10px;">
        <div style="font-size:0.9em; color:#ddd; margin-bottom:5px; display:flex; justify-content:space-between">
            <span>👤 ${G.job.n} (Lv.${G.level})</span>
            <span>${pStatus.join(' ')}</span>
        </div>
        <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:8px; font-size:0.85em; text-align:center;">
            <div style="background:#222; padding:3px; border-radius:3px;">近戰: ${getEquipVal(G.eq.melee) + getStat('s')}</div>
            <div style="background:#222; padding:3px; border-radius:3px;">遠程: ${getEquipVal(G.eq.ranged) + getStat('a')}</div>
        </div>
    </div>`;

    let html = `
        ${statsBar}
        <div class="combat-grid">
            <button onclick="combatRound('melee')" ${disableAll}>⚔️ 近戰<br><small style="color:#888">預估: ${getDmgEst('melee')}</small></button>
            <button onclick="combatRound('ranged')" ${disableAll} ${G.ammo>0?'':'disabled'}>🔫 射擊 (${G.ammo})<br><small style="color:#888">預估: ${getDmgEst('ranged')}</small></button>
            <button onclick="combatRound('skill')" ${disableAll} ${(G.activeSkillCD>0 || isSilenced)?'disabled':''}>${skillBtnText}</button>
            <button onclick="combatRound('defend')" ${disableAll} ${G.playerDefCD>0?'disabled':''} style="border-color:#55aaff">🛡️ 防禦 (CD:${G.playerDefCD})</button>
            <button class="combat-full-width" onclick="openCombatBag()" ${(c.usedItem || pStun)?'disabled style="opacity:0.5"':''}>🎒 戰鬥物品 (${G.bag.length})</button>
            <button class="combat-full-width" onclick="combatRound('flee')" ${disableAll}>🏃 逃跑</button>
        </div>`;
        
    document.getElementById('action-area').innerHTML = html;
}

// 修改 getDmgEst (傷害預估)
function getDmgEst(type) { 
    return (type==='melee' ? getEquipVal(G.eq.melee) : getEquipVal(G.eq.ranged)) + (type==='melee' ? getStat('s') : getStat('a')); 
}

// ==================== 戰鬥邏輯核心 (完整修復版) ====================
// ==================== 戰鬥邏輯核心 (修復版) ====================
function combatRound(act) {
    let c = G.combat; 
    let logMsg = []; 
    c.turnCount++; 
    G.isDefending = false;

    // 初始化狀態結構
    if(!c.playerDebuffs) c.playerDebuffs = { stun:0, silence:0, blind:0 };
    if(!c.enemyShield) c.enemyShield = 0;
    if(!c.buffs) c.buffs = {};

    // --- 1. 玩家回合前狀態結算 ---
    if (act !== 'skill' && G.activeSkillCD > 0) G.activeSkillCD--;
    if (act !== 'defend' && G.playerDefCD > 0) G.playerDefCD--;
    if (c.playerDebuffs.silence > 0) c.playerDebuffs.silence--;

    // 檢查暈眩
    if (c.playerDebuffs.stun > 0) {
        logMsg.push(`<span style="color:#fa0">你處於暈眩狀態，無法行動！(剩餘 ${c.playerDebuffs.stun} 回合)</span>`);
        c.playerDebuffs.stun--;
        // 暈眩時直接跳到敵人行動
        processEnemyTurn(c, logMsg);
        return;
    }

    // --- 2. 玩家行動結算 ---
    let dmg = 0;

    // 被動：黑客紅藍藥丸
    if(G.job.passive === 'pills') {
        if(Math.random() < 0.33) {
            if(Math.random() < 0.5) {
                let h = Math.floor(G.maxHp * 0.1); G.hp = Math.max(1, G.hp - h);
                logMsg.push(`<span style="color:#f44">吞下Red Pill: HP -${h}</span>`);
            } else {
                let h = Math.floor((G.maxHp - G.hp) * 0.5); G.hp += h;
                logMsg.push(`<span style="color:#4f4">吞下Blue Pill: HP +${h}</span>`);
            }
        }
    }
    // 被動：Popper舞風切換
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
    // 被動：南丁格爾
    if(G.job.passive === 'nurse_buff') {
        let h = Math.floor(G.maxHp * 0.02); G.hp = Math.min(G.maxHp, G.hp+h);
    }
    // 被動：諾貝爾獎
    if(G.job.passive === 'random_buff') {
        let stat = ['s','a','i','w','luck'][Math.floor(Math.random()*5)];
        G.stats[stat] = Math.floor((G.stats[stat]||0) * 1.1);
        logMsg.push(`諾貝爾獎: ${STAT_MAP[stat]}提升`);
    }

    // 處理近戰/遠程攻擊
    if(act === 'melee' || act === 'ranged') {
        if(act==='ranged') G.ammo--;

        // 機械師召喚
        let engSummon = '';
        if(G.job.passive === 'eng_summon' && (act === 'melee' || act === 'ranged') && Math.random() < 0.1) {
            let r = Math.random();
            if(r < 0.33) engSummon = 'dog';
            else if(r < 0.66) engSummon = 'doraemon';
            else engSummon = 'terminator';
        }
     
        // 玻璃大炮
        if(G.job.passive === 'weapon_break' && Math.random() < 0.015) {
            logMsg.push("糟糕！武器承受不住你的中二之力而損壞了！"); 
        }

        dmg = getDmgEst(act);
        let derived = calcDerivedStats();

        // 暴擊
        if((Math.random()*100 < derived.crit) || (c.buffs.sleep > 0)) { 
            dmg = Math.floor(dmg * (derived.critDmg/100)); 
            logMsg.push("暴擊！");
        }

        // 技能加成結算
        if(c.buffs.hedgeTurns > 0) { dmg += c.buffs.hedgeAtk; logMsg.push(`(對沖基金 +${c.buffs.hedgeAtk})`); c.buffs.hedgeTurns--; }
        if(c.buffs.chuunibyou > 0) { dmg += c.buffs.chuuniVal; c.buffs.chuunibyou--; logMsg.push("中二修正拳！"); }
        if(c.buffs.redbull > 0) { dmg = Math.floor(dmg * 1.3); c.buffs.redbull--; logMsg.push("Red Bull翼擊！"); }
        
        // 舞者加成
        if(c.buffs.dance === 'Greenteck') dmg = Math.floor(dmg * 1.2);
        if(c.buffs.dance === 'Pete') dmg = Math.floor(dmg * 1.1);
        if(c.buffs.dance === 'Hoan') dmg = Math.floor(dmg * 1.5);

        // 華爾街吸血
        if(G.job.passive === 'olive_eat') {
            if(Math.random() < 0.5) { 
                let heal = Math.floor((G.maxHp - G.hp) * 0.1); // 先計算回血量
                G.hp += heal; 
                logMsg.push(`量化寬鬆!恢復 +${heal}血`); // 顯示數值
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

        // 被動特效
        if(G.job.passive === 'counter_block' && Math.random() < 0.15) { c.buffs.tempBlock = 0.8; logMsg.push("格擋反擊架勢！"); }
        if(G.job.passive === 'flash_blind' && Math.random() < 0.1) { c.buffs.blind = 1; logMsg.push("致盲！"); }
        if(G.job.passive === 'sleep_hit' && Math.random() < 0.1) { c.buffs.sleep = 1; logMsg.push("敵人睡著了！"); }
        if(G.job.passive === 'bleed_hit' && Math.random() < 0.2) { c.buffs.bleed = 2; logMsg.push("流血！"); }
        if(G.job.passive === 'truck_hit' && Math.random() < 0.05) { dmg += (dmg*1.5); logMsg.push("CyberTruck撞擊！"); }
        if(G.job.passive === 'dev_buff' && Math.random() < 0.15) { dmg += (getStat('s')*0.5); logMsg.push("工人助陣！"); }
        if(G.job.passive === 'burn_proc' && Math.random() < 0.2) { c.buffs.burn = 2; logMsg.push("燃燒！"); }

        // 連擊
        let multiHit = (G.job.passive === 'wing_chun' && Math.random() < 0.1) ? 2 : 1;
        if(c.buffs.drift) {
            if(Math.random() < 0.33) { multiHit++; if(Math.random()<0.33) multiHit++; }
            c.buffs.drift--;
        }
        dmg *= multiHit; 
        if(multiHit>1) logMsg.push(`${multiHit}連擊！`);

        // 敵人閃避/減傷計算
        let enemyBaseDodge = c.dodge || 0; // 獲取敵人基礎閃避

        if(c.buffs.dodgeUp > 0) enemyBaseDodge += 30; // 閃避Buff
        if(c.buffs.accDown) enemyBaseDodge += 25;     // 玩家被致盲/命中下降 -> 等同敵人閃避提升
        if(c.buffs.sleep || c.isStunned || c.buffs.root) enemyBaseDodge = 0; // 被控時無法閃避

        let ignoreDodge = (c.buffs.ignoreDef > 0); // 必中技能
        
        if(!ignoreDodge && Math.random() * 100 < enemyBaseDodge) {
            dmg = 0;
            logMsg.push(`<span style="color:#aaa">攻擊被 ${c.n} 靈活地閃避了！(${Math.floor(enemyBaseDodge)}%機率)</span>`);
        } else {
            let dmgReduction = 0;
            if(c.buffs.defUp > 0) { dmgReduction = 0.5; logMsg.push("敵方防禦力提升中，傷害減半"); }
            dmg = Math.floor(dmg * (1 - dmgReduction));

            let enemyDef = Math.floor(c.maxHp * 0.05); 
            if(c.buffs.defDown) enemyDef = Math.floor(enemyDef * 0.5); 
            if(c.buffs.ignoreDef) enemyDef = 0;
            
            dmg = Math.max(1, dmg - enemyDef);

            // 護盾抵扣
            if(c.enemyShield > 0) {
                if(c.enemyShield >= dmg) {
                    c.enemyShield -= dmg; logMsg.push(`敵方護盾抵擋了所有傷害`); dmg = 0;
                } else {
                    dmg -= c.enemyShield; logMsg.push(`擊破敵方護盾！`); c.enemyShield = 0;
                }
            }
        }

    } else if (act === 'defend') { 
        G.isDefending = true; G.playerDefCD=3; logMsg.push("防禦姿態"); 

    } else if (act === 'skill') { 
        G.activeSkillCD = SKILLS[G.job.sk].cd; 
        let sk = G.job.sk;
        let s = getStat('s'), baseDmg = (getDmgEst('melee') + getDmgEst('ranged')) / 2;
        let derived = calcDerivedStats();
        
        // 技能列表
        if(sk === 'chuunibyou') {
            c.buffs.chuunibyou = 3; c.buffs.chuuniVal = Math.floor(baseDmg * Math.random()); dmg = baseDmg + c.buffs.chuuniVal;
            logMsg.push(`中二病發作！攻擊力波動上升！`);
        } else if(sk === 'snipe') {
            dmg = baseDmg * 2; if(Math.random()*100 < derived.crit) dmg *= (derived.critDmg/100);
            logMsg.push("狙擊模式：鎖定目標！");
        } else if(sk === 'first_aid') {
            let h = Math.floor((G.maxHp - G.hp) * 0.5); G.hp += h;
            logMsg.push(`急救處理：恢復了 ${h} 點生命`);
        } else if(sk === 'fate_throw') {
            let mult = 0.5 + Math.random() * 3.5; dmg = baseDmg * mult; if(Math.random()*100 < derived.crit) dmg *= (derived.critDmg/100);
            logMsg.push("命運一擲！");
        } else if(sk === 'weakness_scan') {
            c.buffs.defDown = 3;
            logMsg.push("弱點分析：敵人防禦力大幅下降 (3回合)");
        } else if(sk === 'risk_manage') {
            c.playerShield = G.maxHp;
            logMsg.push(`風險管理：獲得鉅額護盾 (${G.maxHp})`);
        } else if(sk === 'kungfu_panda') {
            let r = Math.random();
            if(r < 0.01 && !c.isBoss) { dmg = c.hp; logMsg.push("【無錫碎骨指】直接秒殺！"); }
            else if(r < 0.5) { let h = Math.floor((G.maxHp-G.hp)*0.5); G.hp += h; logMsg.push(`【吞併Diliveroo】恢復了 ${h} 點生命`); }
            else { c.isStunned = true; c.buffs.stun = 2; dmg = baseDmg * 1.5; logMsg.push("【衝擊Keeta】造成傷害並暈眩敵人！"); }
        } else if(sk === 'flash_bang') {
            c.buffs.blind = 3; c.buffs.atkDown = 3;
            logMsg.push("投擲閃光彈！敵人致盲並攻擊下降");
        } else if(sk === 'rage') {
            G.hp = Math.floor(G.hp * 0.8); dmg = s * 5; 
            logMsg.push("狂暴：犧牲生命換取毀滅一擊！");
        } else if(sk === 'god_hand') {
            c.buffs.godBlock = 1; 
            logMsg.push("神之一手：絕對防禦架勢！(下回合必反擊)");
        } else if(sk === 'tree_strike') {
            dmg = baseDmg * 1.5; c.buffs.root = 2; c.isStunned = true;
            logMsg.push("鏟泥種樹：敵人被樹根纏繞定身！");
        } else if(sk === 'risk_hedge') {
            c.buffs.hedge = 1; c.buffs.hedgeAtk = c.atk; c.buffs.hedgeTurns = 2;
            logMsg.push(`風險對沖: <strong>免疫本回合傷害</strong>，並將敵攻轉化為下回合加成`);
        } else if(sk === 'dictionary') {
            let r = Math.random();
            if(r < 0.25) { dmg = baseDmg * 5; logMsg.push("【習相遠】：習帝之擊！造成五倍傷害！"); } 
            else if(r < 0.5) { c.playerShield = getStat('w') * 5; logMsg.push(`【性相近】：獲得聖賢護盾 (${c.playerShield})`); } 
            else if(r < 0.75) { c.buffs.atkDown = 3; logMsg.push("【人之初】：嘮叨說教，敵人攻擊力下降"); } 
            else { c.buffs.atkDown=2; c.buffs.defDown=2; logMsg.push("【性本善】：精神污染，敵人攻防同時下降"); }
        } else if(sk === 'dlss') {
            c.buffs.dlss = 3;
            logMsg.push("DLSS 開啟：敏捷與閃避大幅提升！");
        } else if(sk === 'bullseye') {
            dmg = baseDmg; c.buffs.ignoreDef = 1; if(Math.random()*100 < derived.crit) dmg *= (derived.critDmg/100);
            logMsg.push("紅心鎖定：無視防禦的一擊！");
        } else if(sk === 'creatine') {
            c.buffs.allUp = 2;
            logMsg.push("喝下肌酸：全屬性爆發提升！");
        } else if(sk === 'hypnosis') {
            c.buffs.sleep = 2;
            logMsg.push("催眠術：敵人陷入睡眠 (下次受傷必定暴擊)");
        } else if(sk === 'shave') {
            c.buffs.atkDown = 3; c.buffs.defDown = 3; c.buffs.accDown = 3;
            logMsg.push("剃光頭：敵人全能力大幅削弱！");
        } else if(sk === 'tesla_coil') {
            dmg = baseDmg * 2; c.buffs.defDown = (1 + Math.floor(Math.random()*3));
            logMsg.push("特斯拉線圈：電擊並融化敵人護甲");
        } else if(sk === 'pi_strike') {
            dmg = (1 + Math.random()*200) * 3.14159;
            logMsg.push("祖沖之之怒：計算出圓周率傷害！");
        } else if(sk === 'kid_squad') {
            c.cloneTurns = 5; c.buffs.kidClones = true;
            logMsg.push("忍刀五人眾：召喚分身助陣 (增加攻擊與閃避)");
       } else if(sk === 'money_rain') {
            // 1. 重新平衡消耗 (上調正常難度的消耗，避免濫用)
            // 正常: $20 (原本$10太便宜，現在需要權衡)
            // 困難: $40
            // 噩夢: $60 (絕境手段)
            let baseCost = 20;
            if (G.diff === 2) baseCost = 40;
            if (G.diff === 3) baseCost = 60;

            if (G.money >= baseCost) {
                G.money -= baseCost;

                // 2. 重新平衡傷害公式
                // 舊版: Luck * 50 (太強，隨便都破千)
                // 新版: Luck * 15 + Int * 5 (基礎約 250-400，強力但合理)
                
                let luck = getStat('luck');
                let baseDmg = (luck * 15) + (getStat('i') * 5);
                
                // 3. 難度補償 (付費越多，基礎傷害倍率越高)
                // 噩夢模式付出了 $60 (半條命)，傷害必須爆炸
                let diffMult = 1.0;
                if (G.diff === 2) diffMult = 1.5;
                if (G.diff === 3) diffMult = 2.5;
                
                // 4. 莊家賭運 (Jackpot 系統)
                // 幸運越高，越容易觸發 200% 傷害
                // 20 Luck = 40% 機率
                let isJackpot = Math.random() < (luck * 0.02); 
                let jackpotMult = isJackpot ? 2.0 : 1.0;

                dmg = Math.floor(baseDmg * diffMult * jackpotMult);

                let prefix = isJackpot ? "🎰 <span style='color:#ffd700'>JACKPOT!</span> " : "";
                logMsg.push(`大撒幣：${prefix}揮霍 <span style="color:#ffd700">$${baseCost}</span> 砸人！`);
            } else {
                // 沒錢時的懲罰
                dmg = 5 + getStat('s'); 
                logMsg.push("大撒幣：摸遍口袋發現沒錢了... 只能丟出幾枚銅板 ");
            }
        } else if(sk === 'waterfall') {
            G.hp -= Math.floor(G.hp * 0.1); dmg = (1.1 + Math.random()*3.9) * baseDmg;
            logMsg.push("Kim Setup：高風險高回報一擊！");
        } else if(sk === 'drift') {
            c.buffs.drift = 5;
            logMsg.push("東京漂移：進入連擊狀態！");
        } else if(sk === 'matrix') {
            c.buffs.matrix = 3;
            logMsg.push("Matrix：看穿代碼，閃避極限提升！");
        } else if(sk === 'one_cue') {
            if(!c.isBoss && Math.random() < 0.15) { dmg = c.hp; logMsg.push("一Q清檯：直接將敵人打入黑洞！"); }
            else { dmg = baseDmg * 2; logMsg.push("一Q清檯：強力撞擊！"); }
        } else if(sk === 'holy_chant') {
            if(c.isBoss) { dmg = 0; logMsg.push("聖靈吟唱：Boss 對百分比傷害免疫..."); } 
            else { let pct = 0.2 + Math.random()*0.4; dmg = Math.floor(c.hp * pct); G.hp -= Math.floor(dmg * 0.3); logMsg.push(`聖靈吟唱：獻祭自身，削減敵人 ${Math.floor(pct*100)}% 生命`); }
        } else if(sk === 'talisman') {
            c.isStunned = true; c.buffs.zombieCountdown = 3; logMsg.push("急急如律令！貼符定身，<strong style='color:#fa0'>3回合後</strong>轉化敵人");
        } else if(sk === 'welding') {
            c.buffs.accDown = 5; c.buffs.defDown = 5;
            logMsg.push("全身焊接：封死敵人關節，命中防禦下降");
        } else if(sk === 'raptor') {
            dmg = baseDmg * 2; if(Math.random() < 0.05) { dmg = c.hp; logMsg.push("速龍突襲：當場逮捕！"); }
            else logMsg.push("速龍突襲：強力撕咬！");
        } else if(sk === 'redbull') {
            c.buffs.redbull = 3;
            logMsg.push("Red Bull：送你一對翼！閃避與攻擊提升");
        } else if(sk === 'high_pitch') {
            G.hp -= Math.floor(G.hp * 0.1); c.buffs.atkDown = 2; c.buffs.accDown = 2;
            logMsg.push("飆高音：震破耳膜！敵人攻擊命中下降");
        }

    } else if (act === 'flee') { 
        let fleeChance = 0.4 + (getStat('a') * 0.02);
        if(G.job.passive === 'super_run') fleeChance = 0.75;
        if(Math.random() < fleeChance) { campPhase(); return; } 
        logMsg.push("逃跑失敗"); 
    }

    // --- 4. 傷害結算 (玩家打敵人) ---
    if(dmg > 0) {
        // Lil Kid 分身
        if(c.cloneTurns > 0 && c.buffs.kidClones) {
            let clones = 4; let hit = 0;
            for(let k=0; k<clones; k++) if(Math.random() < 0.3) hit++;
            dmg += hit * getDmgEst('ranged');
            logMsg.push(`分身命中 ${hit} 次`);
            c.cloneTurns--;
        }
        
        // 敵人護盾與防禦結算
        let enemyDef = Math.floor(c.maxHp * 0.05); 
        if(c.buffs.defDown) enemyDef = Math.floor(enemyDef * 0.5); 
        if(c.buffs.ignoreDef) enemyDef = 0;

        // 優先扣除敵人護盾
        if(c.enemyShield > 0) {
            if(c.enemyShield >= dmg) { 
                c.enemyShield -= dmg; dmg = 0; logMsg.push("技能被護盾完全抵擋"); 
            } else { 
                dmg -= c.enemyShield; c.enemyShield = 0; logMsg.push("技能擊穿了護盾！");
            }
        }

        let finalDmg = Math.max(1, Math.floor(dmg - enemyDef));
        c.hp -= finalDmg; 
        logMsg.push(`造成 ${finalDmg} 技能傷害`);
	// ★★★ 昇華點：使用描述生成器 ★★★
        let isCrit = (dmg > getDmgEst(act) * 1.2); // 簡單判定是否暴擊
        let flavor = getCombatFlavor('你', c.n, act, finalDmg, isCrit, false);
        
        let styleClass = isCrit ? 'log-combat-c' : 'log-combat-d';
        logMsg.push(`<div class="log-combat-h">${flavor}</div>`);
        
        // 設置全局變量供動畫使用
        G.lastDmg = finalDmg;
        G.lastCrit = isCrit;
        triggerShake(); // 觸發震動動畫

    }

    // 處理敵人回合邏輯
    processEnemyTurn(c, logMsg);
}

// 提取敵人回合邏輯，避免函數過長和嵌套錯誤
function processEnemyTurn(c, logMsg) {
    // --- 5. 敵人狀態結算 (DoT) ---
    if(c.hp > 0) {
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
            let eDmg = c.atk;
            let usedSkill = null;

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
                
                if (skill.eff === 'stun') { 
                    if(isResisted) logMsg.push("<span style='color:#4f4'>你的意志抵抗了暈眩！</span>");
                    else c.buffs.nextStunPlayer = true; 
                } 
                else if (skill.eff === 'def_down') { 
                    if(isResisted) logMsg.push("<span style='color:#4f4'>抵抗了破甲效果！</span>");
                    else c.buffs.playerDefDown = true; 
                }
                else if (skill.eff === 'acc_down') { 
                    if(isResisted) logMsg.push("<span style='color:#4f4'>抵抗了致盲效果！</span>");
                    else c.buffs.playerAccDown = true; 
                }
                else if (skill.eff === 'poison' || skill.eff === 'poison_aoe') {
                     if(isResisted) logMsg.push("<span style='color:#4f4'>免疫了毒素！</span>");
                     else {
                         let pDmg = Math.floor(G.maxHp * 0.05);
                         G.hp -= pDmg;
                         logMsg.push(`中毒受到 ${pDmg} 傷害`);
                     }
                }
                else if (skill.eff === 'san_dmg') { 
                    if(isResisted) logMsg.push("<span style='color:#4f4'>堅定的意志抵擋了精神污染！</span>");
                    else { G.san -= 10; logMsg.push("SAN值受損！"); }
                }
                else if (skill.eff === 'hp_halve') { 
                    // 生命減半是大招，意志可以減免部分效果而不是完全免疫
                    if(isResisted) { eDmg = Math.floor(G.hp * 0.25); logMsg.push("意志減輕了重力壓制 (傷害減半)"); }
                    else { eDmg = Math.floor(G.hp * 0.5); logMsg.push("生命被強制減半！"); }
                }
                else if (skill.eff === 'crit') { eDmg = Math.floor(eDmg * 1.5); logMsg.push("暴擊傷害！"); }
                else if (skill.eff === 'double_hit') { eDmg = Math.floor(eDmg * 0.8); c.buffs.doubleHit = true; }
                else if (skill.eff === 'aoe') { eDmg = Math.floor(eDmg * 1.2); }
                else if (skill.eff === 'heal_self') { let h = Math.floor(c.maxHp * 0.1); c.hp += h; logMsg.push(`恢復了 ${h} HP`); }
                else if (skill.eff === 'atk_up') { c.atk = Math.floor(c.atk * 1.2); logMsg.push("攻擊力提升！"); }
                else if (skill.eff === 'def_up') { c.buffs.defUp = 3; logMsg.push("防禦力提升！"); }
                else if (skill.eff === 'def_down') { c.buffs.playerDefDown = true; }
                else if (skill.eff === 'acc_down') { c.buffs.playerAccDown = true; }
                else if (skill.eff === 'hp_halve') { eDmg = Math.floor(G.hp * 0.5); logMsg.push("生命減半！"); }
                else if (skill.eff === 'san_dmg') { G.san -= 10; logMsg.push("SAN值受損！"); }
                else if (skill.eff === 'kill' && !G.isDefending) { eDmg = 999; logMsg.push("即死攻擊！"); }
                else if (skill.eff === 'dodge_up') { c.buffs.dodgeUp = 3; logMsg.push("變得難以捉摸！"); }
                else if (skill.eff === 'shield') { c.enemyShield += 100; logMsg.push("獲得護盾！"); }
            } else if (c.enemySkillCD > 0) {
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
                if(G.job.passive === 'block_chance' && Math.random()<0.2) { eDmg = Math.floor(eDmg*0.5); logMsg.push("鐵壁格擋"); }
                if(c.buffs.dance === 'Hozin' && Math.random()<0.2) { eDmg=0; logMsg.push("Hozin格擋"); }

                let def = G.eq.body.val + G.eq.head.val;
                if (c.buffs.playerDefDown) def = 0;
                let take = Math.max(1, Math.floor((eDmg - def) * (1 - derived.dmgRed/100)));
                
                // 玩家護盾抵扣
                if(c.playerShield > 0) {
                     if(c.playerShield >= take) { c.playerShield -= take; take = 0; logMsg.push("護盾抵擋"); } 
                     else { take -= c.playerShield; c.playerShield = 0; }
                }

                if(take > 0) {
                    // 小弟擋刀
                    if(G.job.passive === 'money_shield' && Math.random()<0.1) { take=0; logMsg.push("小弟擋刀"); }

                    if(take > 0) {
                        if(G.job.passive === 'dmg_reduce' && Math.random()<0.5) take = Math.floor(take * 0.7);

                        G.hp -= take; 
                        logMsg.push(`受到 ${Math.floor(take)} 傷害`);
                        
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
                    }
                } 
            } else if (isDodged) {
        let flavor = getCombatFlavor('你', c.n, act, 0, false, false);
        logMsg.push(`<div class="log-combat-h">${flavor}</div>`);
    }
        }
    }
    checkCombatEnd(c, logMsg);
}

function checkCombatEnd(c, logMsg) {
    log('戰鬥', logMsg.join(' ')); updateUI();
    if(G.hp<=0) gameOver(`被 ${c.n} 殺死`);
    else if(c.hp<=0) { 
        log('戰鬥', '勝利！', 'c-gain'); 
        gainXp(c.xpVal || 1); 

	// ★★★ 修改處：將最後的戰鬥記錄暫存起來，供 Loot 畫面顯示 ★★★
        G.lastCombatLog = logMsg; 	

        if(c.isBoss && c.n==="最終屍王") gameOver("通關！");
        else if(c.isQuest) { completeQuest(); return; }
        else { let t=['melee','ranged','head','body','acc'][Math.floor(Math.random()*5)]; showLootModal(createItem(t,'random',1), t, campPhase); }
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
    openModal(`📜 主線劇情 (Day ${day})`, `<div class="story-text main-story-text">${text}</div>`, `<button onclick="closePlotDialog()">繼續</button>`);
}
function closePlotDialog() { closeModal(); if(G.dialogCallback) G.dialogCallback(); }

function openModal(title, content, btns) {
    document.getElementById('m-title').innerHTML = title;
    document.getElementById('m-desc').innerHTML = content;
    document.getElementById('m-btns').innerHTML = btns;
    document.getElementById('screen-modal').style.display = 'flex';
}
function closeModal() { document.getElementById('screen-modal').style.display = 'none'; }
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
    ['melee','ranged','head','body','acc'].forEach(k => {
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

// 物品生成工廠
function createItem(type, specificName, forcedTier, forceCommon = false) {
    let tier = forcedTier || getCurrentTier();
    let isJobItem = false;
    let finalName = "";
    
    // 檢查是否為職業專屬裝備
    let jobHasItem = false;
    let jobItemIndex = -1;
    
    // 對應 ALL_JOBS 中 g 數組的順序: 0:melee, 1:ranged, 2:head, 3:body, 4:acc
    if (type === 'melee') jobItemIndex = 0;
    else if (type === 'ranged') jobItemIndex = 1;
    else if (type === 'head') jobItemIndex = 2;
    else if (type === 'body') jobItemIndex = 3;
    else if (type === 'acc') jobItemIndex = 4;

    let jobBaseName = (G.job.g && G.job.g[jobItemIndex]) ? G.job.g[jobItemIndex] : '無';
    if (jobBaseName !== '無') jobHasItem = true;

    // 判定邏輯：是否生成職業專屬
    // 如果指定名稱包含職業裝備名，或指定 random 且非強制 common (30%機率)
    if (!forceCommon && jobHasItem) {
        if (specificName === 'random') {
            if (Math.random() < 0.3) isJobItem = true; 
        } else if (specificName && specificName.includes(jobBaseName)) {
            isJobItem = true;
        }
    }

    let itemData = {};

	// --- 新增：食物與水生成邏輯 ---
    if (type === 'food' || type === 'water') {
        let isFood = (type === 'food');
        let names = isFood ? 
            ['壓縮餅乾', '午餐肉罐頭', '軍用口糧', '能量棒', '脫水蔬菜'] : 
            ['過濾水', '瓶裝水', '運動飲料', '蒸餾水', '維生素水'];
        
        let name = names[Math.floor(Math.random() * names.length)];
        // 數值隨 Tier 成長: T1=30, T5=70
        let val = 20 + (tier * 10) + Math.floor(Math.random()*10);
        
        itemData = {
            name: name,
            fullName: name, // 食物通常沒有前綴
            type: type,
            val: val, // 這裡 val 代表恢復量
            tier: tier,
            isJobNative: false,
            rarity: 1,
            stats: { desc: isFood ? '恢復飽食度' : '恢復水分' }
        };
        // 賦予唯一ID
        itemData.uid = Math.random();
        return itemData;
    }
    
    if (isJobItem) {
        // --- 生成職業專屬裝備 (Tier 1-5) ---
        // 從 JOB_EXCLUSIVE_DB 查找基礎屬性
        let baseTpl = JOB_EXCLUSIVE_DB[type].find(x => x.n === jobBaseName);
        
        // 萬一找不到 (防呆)，給一個默認值
        if (!baseTpl) baseTpl = { n: jobBaseName, v: 10 };

        // 根據 Tier 決定前綴與倍率
        let prefixData = JOB_TIER_PREFIX[tier - 1];
        finalName = prefixData.p + jobBaseName;
        let multiplier = prefixData.mul;

        // 計算數值：基礎值 * Tier倍率 * (少量天數成長)
        let val = Math.floor(baseTpl.v * multiplier * (1 + G.day/200));

        // 複製額外屬性 (如 crit, luck 等) 並進行 Tier 強化
        let stats = { ...baseTpl };
        delete stats.n; delete stats.v; delete stats.desc;
        
        // 將所有額外屬性也乘上倍率 (稍微降低倍率以免數值崩壞)
        for (let key in stats) {
            if (typeof stats[key] === 'number') {
                stats[key] = Math.floor(stats[key] * (1 + (tier-1)*0.5)); // 每級+50%效果
            }
        }
        
        // 添加職業專屬說明
        stats.desc = "職業專屬 (裝備後屬性+10%)";

        itemData = {
            name: jobBaseName, 
            fullName: finalName,
            type: type,
            val: val,
            tier: tier,
            isJobNative: true,
            rarity: tier >= 4 ? 3 : (tier >= 2 ? 2 : 1),
            stats: stats
        };
        
        if(type === 'ranged') itemData.ammo = (baseTpl.ammo || 5) + (tier * 5);

    } else {
        // --- 生成共通裝備 ---
        let pool = COMMON_DB[type][tier - 1]; 
        let tpl = pool[Math.floor(Math.random() * pool.length)]; 
        
        if(specificName !== 'random') {
            let found = pool.find(x => x.n === specificName);
            if(found) tpl = found;
        }

        finalName = tpl.n;
        let val = tpl.v;
        let stats = {...tpl}; 
        delete stats.n; delete stats.v; delete stats.desc;

        itemData = {
            name: tpl.n,
            fullName: finalName,
            type: type,
            val: val,
            tier: tier,
            isJobNative: false,
            rarity: 1, 
            stats: stats
        };
        
        if(tier >= 4) itemData.rarity = 2;
        if(tier >= 5) itemData.rarity = 3;
    }

    itemData.uid = Math.random();
    return itemData;
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
        let i = createItem(q.reward.type, BASE_DB[q.reward.type][0].n, q.reward.tier);
        i.val = Math.floor(i.val*1.5); 
        i.fullName = `傳說的 ${i.fullName}`;
        showLootModal(i, q.reward.type, campPhase);
    } 
    // 如果是其他類型 (如果有設定的話)
    else { 
        // 修正：增加 closeModal()
        openModal("任務完成", "獲得資源獎勵", `<button onclick="closeModal(); campPhase()">確認</button>`); 
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
    return "✨ 數值";
}

function showItemDetail(type) {
    let i = G.eq[type];
    let lbl = getItemValueLabel(type);
    let jobTag = i.isJobNative ? `<span style="color:var(--skill-color);font-weight:bold;font-size:0.8em;border:1px solid var(--skill-color);padding:0 2px;border-radius:2px">職業專屬</span>` : "";
    let statsStr = JSON.stringify(i.stats).replace(/[{"}]/g,'').replace(/,/g,', ');
    
    openModal(i.fullName, 
        `Tier: ${i.tier} ${jobTag}<br>${lbl}: ${getEquipVal(i)} ${i.isJobNative?'<span style="color:#4f4">(+10%)</span>':''}<br>原始數值: ${i.val}<br>屬性: <span style="color:#aaa">${statsStr}</span>`, 
        `<button onclick="closeModal()">關閉</button>`
    );
}

function showLootModal(newItem, type, onCloseCallback) {
    G.tempLoot = { item: newItem, type: type, cb: onCloseCallback };
    
	// 計算回收價格
    let val = getItemValue(newItem);
    let sellPrice = Math.max(1, Math.floor(val * 0.3));

	 // ★★★ 新增：生成戰鬥日誌區塊 ★★★
    let logHtml = '';
    if (G.lastCombatLog && G.lastCombatLog.length > 0) {
        let logs = G.lastCombatLog.map(l => `<div style="margin-bottom:3px;">${l}</div>`).join('');
        logHtml = `
        <div style="text-align:left; background:#000; padding:10px; border:1px dashed #444; border-radius:4px; margin-bottom:15px; font-size:0.85em; color:#ccc; max-height:120px; overflow-y:auto;">
            <div style="color:#666; font-size:0.8em; border-bottom:1px solid #333; margin-bottom:5px;">最後一擊回放:</div>
            ${logs}
            <div style="color:#ffd700; font-weight:bold; margin-top:8px; text-align:center;">🏆 戰鬥勝利！</div>
        </div>`;
        
        // 清除記錄，避免搜刮非戰鬥物品時也顯示
        G.lastCombatLog = null; 
    }
    // ===================================

     // === 修改處：消耗品介面增加「直接使用」 ===
    if (type === 'med' || type === 'food' || type === 'water') {
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
        } else {
            valInfo = `水分 +${newItem.val}`;
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
        
        let btns = `<button onclick="useLootItemDirectly()" style="border-color:#4f4; color:#4f4">✨ 直接使用</button>
                    <button onclick="takeItemToBag()">放入背包</button>
                    <button onclick="recycleLoot()" style="border-color:#ffd700; color:#ffd700">回收 (+$${sellPrice})</button>
                    <button onclick="discardLoot()">丟棄</button>`;
        
        if(isFull) {
            html += `<div style="color:#f44; margin-top:5px">背包已滿！放入需整理背包。</div>`;
            btns = `<button onclick="useLootItemDirectly()" style="border-color:#4f4; color:#4f4">✨ 直接使用</button>
                    <button onclick="showBagSwapUI()">整理背包</button>
                    <button onclick="recycleLoot()" style="border-color:#ffd700; color:#ffd700">回收 (+$${sellPrice})</button>
                    <button onclick="discardLoot()">丟棄</button>`;
        }
        
        openModal("發現物資", html, btns);
        return;
    }

    // --- 以下為原本的裝備比對邏輯 (保持不變) ---
    let curr = G.eq[type];
    let lbl = getItemValueLabel(type);
    let ammoText = newItem.ammo ? `<br><span style="color:#aaa;font-size:0.8em">附帶彈藥: ${newItem.ammo}</span>` : '';
    
    let newVal = getEquipVal(newItem);
    let currVal = getEquipVal(curr);
    let diff = newVal - currVal;
    
    let jobTag = newItem.isJobNative ? `<br><span style="color:var(--skill-color);font-size:0.8em">★ 職業專屬 (+10% 屬性)</span>` : "";

    // === 修復點：補上了 let html = ` ===
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

    // 裝備按鈕邏輯不用變，因為 equipLoot 會處理自動交換/賣出
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
        G.shop.lastDay = G.day;
        // 每週自動刷新商品 (或者第一天)
        if (G.day % 7 === 0 || G.shop.items.length === 0) {
            refreshShopItems(false); // 每週刷新重置為普通商店
        }
        
        // 每天第一次打開有 2% 機率突變為黑市 (如果還不是黑市)
        // 注意：如果剛好是週日刷新，這一步會覆蓋刷新，讓它變黑市
        if (Math.random() < 0.02) {
            activateBlackMarket();
        }
    }
    renderShopModal();
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
        let types = ['melee','ranged','head','body','acc','med','med','food','food','water'];
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
};

Object.assign(window, globalFunctions);