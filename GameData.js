import MBTI_TYPES from './data/MBTI_TYPES.json' with  { type: "json" };
import COMMON_DB from './data/COMMON_DB.json' with  { type: "json" };
import JOB_EXCLUSIVE_DB from './data/JOB_EXCLUSIVE_DB.json' with  { type: "json" };
import ALL_JOBS from './data/ALL_JOBS.json' with  { type: "json" };
import QUEST_DB from './data/QUEST_DB.json' with  { type: "json" };
import LOCATIONS from './data/LOCATIONS.json' with  { type: "json" };
import LOC_EVENT_DB from './data/LOC_EVENT_DB.json' with { type: "json" };
import AFFIX_DB from './data/AFFIX_DB.json' with { type: "json" };
import BOSS_LOOT_DB from './data/BOSS_LOOT_DB.json' with { type: "json" };
import SKILL_DB from './data/SKILL_DB.json' with { type: "json" };
import ENEMY_PREFIXES from './data/ENEMY_PREFIXES.json' with { type: "json" };
import NORMAL_ENEMIES from './data/NORMAL_ENEMIES.json' with  { type: "json" };
import ELITE_ENEMIES from './data/ELITE_ENEMIES.json' with  { type: "json" };
import LOCATION_BOSSES from './data/LOCATION_BOSSES.json' with  { type: "json" };
import SKILLS from './data/SKILLS.json' with  { type: "json" };
import MAIN_PLOT from './data/MAIN_PLOT.json' with  { type: "json" };

export{
    MBTI_TYPES,
    COMMON_DB,
    JOB_EXCLUSIVE_DB,
    ALL_JOBS,
    QUEST_DB,
    LOCATIONS,
    LOC_EVENT_DB,
    AFFIX_DB,
    BOSS_LOOT_DB,
    SKILL_DB,
    ENEMY_PREFIXES,
    NORMAL_ENEMIES,
    ELITE_ENEMIES,
    LOCATION_BOSSES,
    SKILLS,
    MAIN_PLOT,
}

export const STAT_MAP = { 
    str:'力量',
    agi:'敏捷',
    int:'智力',
    wil:'意志',
    moral:'道德',
    luck:'幸運',
    loot:'掉寶率',
    heal:'回復',
    san:'SAN',
    hp:'生命',
    crit: '暴擊率',
    dodge: '閃避率',
    defP: '物理減傷',
    acc: '命中率',
    melee:'近戰武器',
    ranged:'遠程武器',
    acc_slot:'飾品',
    med:'醫療',
    head:'頭盔',
    body:'護甲',
    shoes:'足部',
};

export const JOB_TIER_PREFIX = [
    { prefix: "", mul: 1.0 },
    { prefix: "改良的 ", mul: 1.5 },
    { prefix: "精工 ", mul: 2.2 },
    { prefix: "史詩級 ", mul: 3.5 },
    { prefix: "覺醒·", mul: 5.5 },
];

export const EPIC_THEMES = [
    "🏥 廢棄綜合醫院",
    "🏫 寂靜的私立高中",
    "🏢 崩塌的證券交易所",
    "🎡 鏽蝕的遊樂園",
    "🕍 古老的山中修道院",
    "🏭 洩漏的化工廠",
    "🚉 地下鐵總站",
    "🛳️ 擱淺的豪華郵輪",
    "🏰 歷史博物館",
    "🏟️ 奧林匹克體育場", 
    "🚓 警察總部大樓",
    "🏨 豪華度假酒店",
    "📡 軍事通訊塔",
    "🏗️ 未完工的摩天樓",
    "🌲 變異森林深處"
];

// === 新增：職業分類數據 ===
export const RPG_CLASSES = {
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
        jobs: ['機械師', '小學生', '莊家', '賭場荷官', '精算師', '園藝師', '追星族', '電商大佬']
    }
};

// 定義地點的預設獎勵類型
export const LOC_REWARDS = {
    "廢棄超市": "food", "民居": "food", "下水道": "random",
    "五金店": "melee", "健身房": "melee",
    "警局分局": "ranged", "服裝店": "body",
    "診所": "med", "公園": "water",
    "銀行": "acc", "電子城": "acc", "學校": "acc"
};

export const MODAL = {
    story: 1,
    loot: 2,
    stats:3,
}

export const ACTION = {
    camp: 0,
    explore: 1,
    combat: 2,
}
