// ==================== Boss 專屬掉落庫 (Diablo Style) ====================
const BOSS_LOOT_DB = {
    // === 任務 Boss 套裝 (Quest Sets) ===
    "縫合怪": [ // 醫院任務
        { n: "瘟疫醫生面具", type: "head", val: 35, rarity: 3, stats: { i: 10, san: 20 }, fx: { t: "poison_imm", desc: "免疫中毒" } },
        { n: "染血手術袍", type: "body", val: 60, rarity: 3, stats: { hp: 100, heal: 20 }, fx: { t: "regen", v: 15, desc: "每回合回15血" } },
        { n: "截肢骨鋸", type: "melee", val: 55, rarity: 3, stats: { s: 10, crit: 15 }, fx: { t: "bleed_hit", v: 0.5, desc: "50%造成流血" } }
    ],
    "SWAT暴君": [ // 警局任務 - 暴徒鎮壓套裝
        { n: "暴君戰術盔", type: "head", val: 45, rarity: 3, stats: { defP: 0.05, w: 10 }, fx: { t: "stun_res", desc: "免疫暈眩" } },
        { n: "重型防爆甲", type: "body", val: 90, rarity: 3, stats: { hp: 150, a: -5 }, fx: { t: "tough_skin", v: 20, desc: "固定減傷-20" } },
        { n: "執法者散彈槍", type: "ranged", val: 75, rarity: 3, stats: { s: 10, a: 5 }, fx: { t: "aoe_splash", v: 0.3, desc: "30%擴散傷害" }, ammo: 20 }
    ],
    "小丑皇": [ // 遊樂園任務 - 瘋狂小丑套裝
        { n: "小丑的笑臉", type: "head", val: 20, rarity: 3, stats: { san: -50, luck: 30 }, fx: { t: "fear_aura", desc: "敵人開場機率膽怯" } },
        { n: "魔術師燕尾服", type: "body", val: 40, rarity: 3, stats: { dodge: 20, i: 15 }, fx: { t: "card_shield", desc: "受擊時機率掉落金錢抵傷" } },
        { n: "浸毒飛刀", type: "ranged", val: 60, rarity: 3, stats: { crit: 25, a: 20 }, fx: { t: "poison_hit", v: 0.5, desc: "50%劇毒" }, ammo: 50 }
    ],
    "毒液巨獸": [ // 化工廠任務 - 生化套裝
        { n: "生化呼吸器", type: "head", val: 30, rarity: 3, stats: { hp: 50, w: 10 }, fx: { t: "gas_heal", desc: "中毒反而回血" } },
        { n: "突變幾丁質甲", type: "body", val: 80, rarity: 3, stats: { s: 15, defP: 0.1 }, fx: { t: "thorns", v: 0.2, desc: "反彈20%傷害" } }
    ],
    // ... 其他任務 Boss 可依此類推 ...

    // === 地點專屬 Boss 單件紅裝 (Location Uniques) ===
    // 確保部位多樣化，不要全是武器
    "消費主義之神": [ // 超市 T5
        { n: "無盡貪婪之袋", type: "acc", val: 10, rarity: 3, stats: { loot: 1.0, luck: 20 }, fx: { t: "bag_size", v: 5, desc: "背包容量+5" } }
    ],
    "萬機之父": [ // 五金店 T5
        { n: "機械降神臂", type: "melee", val: 100, rarity: 3, stats: { s: 30, i: 10 }, fx: { t: "stun_hit", v: 0.4, desc: "40%暈眩敵人" } }
    ],
    "院長 (病毒本體)": [ // 診所 T5
        { n: "潘朵拉針筒", type: "med", val: 999, rarity: 3, stats: { hp: 999, san: 999 }, fx: { t: "revive", desc: "持有時抵擋一次死亡(消耗)" } } // 消耗品紅裝
    ],
    "孤獨死集合體": [ // 民居 T5
        { n: "死寂拖鞋", type: "shoes", val: 20, rarity: 3, stats: { dodge: 30, a: 10 }, fx: { t: "stealth", v: 0.5, desc: "探索遇敵率減半" } }
    ],
    "鐵腕局長": [ // 警局 T5
        { n: "局長的左輪", type: "ranged", val: 120, rarity: 3, stats: { crit: 40, acc: 20 }, fx: { t: "execute", v: 1.0, desc: "血量低於50%直接斬殺" }, ammo: 6 }
    ],
    "時尚女魔頭": [ // 服裝店 T5
        { n: "魅惑皮草", type: "body", val: 70, rarity: 3, stats: { luck: 20, money: 50 }, fx: { t: "charm", v: 0.5, desc: "商店半價" } }
    ],
    "蓋亞化身": [ // 公園 T5
        { n: "自然之怒", type: "acc", val: 20, rarity: 3, stats: { s: 10, a: 10, i: 10, w: 10 }, fx: { t: "regen", v: 20, desc: "每回合回20血" } }
    ],
    "資本巨鱷": [ // 銀行 T5
        { n: "金錢權杖", type: "melee", val: 88, rarity: 3, stats: { luck: 50 }, fx: { t: "gold_hit", v: 50, desc: "攻擊掉落 $50" } }
    ],
    "深淵之物": [ // 下水道 T5
        { n: "深淵凝視", type: "head", val: 60, rarity: 3, stats: { san: -20, i: 40 }, fx: { t: "mana_burn", desc: "技能CD恆定為 1" } }
    ],
    "AI 奇點": [ // 電子城 T5
        { n: "量子計算晶片", type: "acc", val: 30, rarity: 3, stats: { i: 50, dodge: 20 }, fx: { t: "auto_aim", desc: "攻擊必中且必暴擊" } }
    ],
    "完美肉體": [ // 健身房 T5
        { n: "冠軍腰帶", type: "body", val: 150, rarity: 3, stats: { hp: 500, s: 30 }, fx: { t: "grit", v: 1, desc: "免疫所有負面狀態" } }
    ],
    "魔鬼校長": [ // 學校 T5
        { n: "洗腦廣播", type: "acc", val: 10, rarity: 3, stats: { w: 30 }, fx: { t: "hypnosis", desc: "戰鬥開始敵人睡眠3回合" } }
    ],
    
    // === 通用 Boss 掉落 (如果上面的沒隨機到) ===
    "generic": [
        { n: "Boss的私房錢", type: "money", val: 200, rarity: 2, fullName: "大量金錢" },
        { n: "急救大補包", type: "med", val: 100, rarity: 2, stats:{hp:100}, fullName: "軍用急救包" }
    ]
};