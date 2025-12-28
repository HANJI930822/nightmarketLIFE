// === 遊戲全域設定 ===
const CONFIG = {
    startMoney: 3000,
    maxGridSize: 50, 
    startGridSize: 10,
};

// === 夜市類型設定 (注意 layoutType 是關鍵) ===
const MARKETS = {
    'school': {
        name: "🎓 學校旁夜市",
        desc: "學生很多。校門口呈現十字路口，人流從四面八方來。",
        startMoney: 1500,
        buildCostMod: 0.8, 
        revenueMod: 0.7,   
        trafficRate: 2.0,
        difficulty: "簡單",
        layoutType: "cross" // 關鍵設定：十字路口
    },
    'residential': {
        name: "🏠 社區型夜市",
        desc: "包圍著公園的住宅區，適合環狀動線。",
        startMoney: 2000,
        buildCostMod: 1.0,
        revenueMod: 1.0,
        trafficRate: 1.0,
        difficulty: "普通",
        layoutType: "ring" // 關鍵設定：環狀
    },
    'tourist': {
        name: "📸 觀光夜市",
        desc: "一條筆直的觀光大道，遊客喜歡一條路逛到底。",
        startMoney: 5000,
        buildCostMod: 2.5,
        revenueMod: 1.8,
        trafficRate: 1.5,
        difficulty: "困難",
        layoutType: "avenue" // 關鍵設定：大道
    },
    'remote': {
        name: "👻 荒郊野外",
        desc: "只有一條聯外道路，腹地狹小。",
        startMoney: 1000,
        buildCostMod: 0.5,
        revenueMod: 1.2,
        trafficRate: 0.2, 
        difficulty: "地獄",
        layoutType: "single" // 關鍵設定：單行道
    }
};

// === 攤位分類 ===
const CATEGORIES = {
    'food': '🍖 美食',
    'snack': '🍡 小吃',
    'drink': '🥤 飲料',
    'game': '🎯 娛樂',
    'facility': '🚧 設施'
};

// === 劇情文本 ===
const PROLOGUE = {
    title: "傳承的開始",
    text: "這是一塊荒廢已久的空地...<br><br>你的爺爺曾是這裡叱吒風雲的夜市大亨，臨終前他將這塊地交給了你。<br>「年輕人，台灣的夜市精神不能斷！」<br><br>手裡握著僅存的創業基金，你看著這片雜草叢生的土地，決心要讓這裡重現當年的繁華光景！"
};

// === 隨機事件庫 ===
const EVENTS = [
    {
        title: "📸 百萬YouTuber探店",
        text: "知名網紅『千千進食中』突然出現在你的夜市！粉絲們聞風而至！<br><b>(效果：人氣爆發，獲得 $2000 贊助)</b>",
        type: 'good',
        effect: (state) => { state.money += 2000; }
    },
    {
        title: "⛈️ 午後雷陣雨",
        text: "天空突然下起傾盆大雨，遊客紛紛躲避，生意大受影響。<br><b>(效果：損失 $500 清潔費)</b>",
        type: 'bad',
        effect: (state) => { state.money -= 500; }
    },
    {
        title: "👮 衛生局稽查",
        text: "衛生局突擊檢查！還好你的攤販平常都有戴口罩。<br>但也因為配合檢查，暫停營業了一陣子。<br><b>(效果：損失 $300)</b>",
        type: 'bad',
        effect: (state) => { state.money -= 300; }
    },
    {
        title: "🐶 流浪狗大隊",
        text: "一群可愛的流浪狗跑進夜市，雖然很萌，但偷吃了幾根香腸。<br><b>(效果：食材損失 $100)</b>",
        type: 'info',
        effect: (state) => { state.money -= 100; }
    },
    {
        title: "🎆 慶典活動",
        text: "附近的廟宇舉辦建醮大典，人潮溢出到夜市來了！<br><b>(效果：獲得香油錢回饋 $1500)</b>",
        type: 'good',
        effect: (state) => { state.money += 1500; }
    },
    {
        title: "💡 變電箱爆炸",
        text: "碰！一聲巨響，夜市一半陷入黑暗。雖然緊急修好了，但嚇跑了不少客人。<br><b>(效果：維修費 $800)</b>",
        type: 'bad',
        effect: (state) => { state.money -= 800; }
    }
];

// === 攤位資料庫 ===
const BUILDINGS = {
    // === 設施 ===
    'road': { name: "道路", price: 20, color: "#555", isRoad: true, category: 'facility' },
    'floor': { name: "拆除/草地", price: 0, icon: "🌱", color: "#2ecc71", category: 'facility' },

    // === 美食 (主食/肉類) ===
    'sausage': {
        name: "烤香腸", price: 200, icon: "🌭", color: "#e74c3c", category: 'food',
        revenue: 35, cost: 10, cookTime: 2000, baseCapacity: 2
    },
    'chicken_fillet': {
        name: "大雞排", price: 500, icon: "🍗", color: "#d35400", category: 'food',
        revenue: 80, cost: 30, cookTime: 3000, baseCapacity: 2
    },
    'steak': {
        name: "夜市牛排", price: 800, icon: "🥩", color: "#c0392b", category: 'food',
        revenue: 150, cost: 60, cookTime: 5000, baseCapacity: 4
    },
    'braised_pork': {
        name: "滷肉飯", price: 300, icon: "🍚", color: "#8e44ad", category: 'food',
        revenue: 40, cost: 10, cookTime: 1000, baseCapacity: 3
    },
    'oyster_omelet': {
        name: "蚵仔煎", price: 450, icon: "🍳", color: "#27ae60", category: 'food',
        revenue: 70, cost: 25, cookTime: 3500, baseCapacity: 2
    },
    'teppanyaki': {
        name: "鐵板燒", price: 1000, icon: "🥘", color: "#2c3e50", category: 'food',
        revenue: 200, cost: 80, cookTime: 6000, baseCapacity: 5
    },

    // === 小吃 (點心類) ===
    'stinky_tofu': {
        name: "臭豆腐", price: 500, icon: "🍲", color: "#9b59b6", category: 'snack',
        revenue: 60, cost: 20, cookTime: 4000, baseCapacity: 2
    },
    'sweet_potato': {
        name: "地瓜球", price: 250, icon: "🍠", color: "#f39c12", category: 'snack',
        revenue: 30, cost: 5, cookTime: 1500, baseCapacity: 2
    },
    'takoyaki': {
        name: "章魚燒", price: 400, icon: "🐙", color: "#e67e22", category: 'snack',
        revenue: 50, cost: 15, cookTime: 2500, baseCapacity: 3
    },
    'wheel_pie': {
        name: "車輪餅", price: 200, icon: "🥯", color: "#f1c40f", category: 'snack',
        revenue: 20, cost: 5, cookTime: 1200, baseCapacity: 2
    },
    'scallion_pancake': {
        name: "蔥抓餅", price: 300, icon: "🌯", color: "#16a085", category: 'snack',
        revenue: 45, cost: 12, cookTime: 2000, baseCapacity: 2
    },
    'grilled_corn': {
        name: "烤玉米", price: 350, icon: "🌽", color: "#f1c40f", category: 'snack',
        revenue: 60, cost: 15, cookTime: 4500, baseCapacity: 1
    },
    'tanghulu': {
        name: "糖葫蘆", price: 150, icon: "🍢", color: "#e74c3c", category: 'snack',
        revenue: 30, cost: 8, cookTime: 1000, baseCapacity: 2
    },
    'shaved_ice': {
        name: "芒果冰", price: 400, icon: "🍧", color: "#3498db", category: 'snack',
        revenue: 100, cost: 30, cookTime: 3000, baseCapacity: 3
    },

    // === 飲料 ===
    'bubble_tea': {
        name: "珍奶攤", price: 350, icon: "🧋", color: "#f1c40f", category: 'drink',
        revenue: 55, cost: 15, cookTime: 1500, baseCapacity: 3
    },
    'papaya_milk': {
        name: "木瓜牛奶", price: 300, icon: "🥛", color: "#e67e22", category: 'drink',
        revenue: 50, cost: 20, cookTime: 1200, baseCapacity: 2
    },
    'watermelon_juice': {
        name: "西瓜汁", price: 250, icon: "🍉", color: "#e74c3c", category: 'drink',
        revenue: 40, cost: 10, cookTime: 1000, baseCapacity: 2
    },
    'lemon_tea': {
        name: "凍檸茶", price: 200, icon: "🍋", color: "#f1c40f", category: 'drink',
        revenue: 35, cost: 8, cookTime: 1000, baseCapacity: 3
    },

    // === 娛樂 ===
    'shooting': {
        name: "射氣球", price: 600, icon: "🎈", color: "#9b59b6", category: 'game',
        revenue: 100, cost: 5, cookTime: 5000, baseCapacity: 1
    },
    'ring_toss': {
        name: "套圈圈", price: 500, icon: "⭕", color: "#34495e", category: 'game',
        revenue: 80, cost: 5, cookTime: 4000, baseCapacity: 4
    },
    'claw_machine': {
        name: "夾娃娃", price: 1200, icon: "👾", color: "#ff9ff3", category: 'game',
        revenue: 20, cost: 0, cookTime: 800, baseCapacity: 2
    },
    'pinball': {
        name: "彈珠台", price: 400, icon: "🎰", color: "#2ecc71", category: 'game',
        revenue: 50, cost: 2, cookTime: 3000, baseCapacity: 3
    },
    'mahjong': {
        name: "麻將賓果", price: 700, icon: "🀄", color: "#27ae60", category: 'game',
        revenue: 150, cost: 10, cookTime: 6000, baseCapacity: 2
    }
};