// === 狀態變數 ===
let state = {
    money: 0,
    currentTool: null,
    gridData: {},
    // 遊戲模式設定 (從 MARKETS 載入)
    marketData: null,
    // 顧客系統
    customers: [],
    customerSpawnTimer: null,
    totalAttractiveness: 0, // 總吸引力 (攤位等級總和)
    mapSize: CONFIG.startGridSize,
    uiCategory: 'facility',
    marketName: "", // 預設顯示設施頁
};

let currentEditingKey = null;

// === 初始化 ===
window.onload = function() {
    initStartScreen();
};

// 1. 初始化選擇畫面
function initStartScreen() {
    const container = document.getElementById('market-selection');
    
    for (let key in MARKETS) {
        let m = MARKETS[key];
        let card = document.createElement('div');
        card.className = 'market-card';
        card.innerHTML = `
            <h3>${m.name}</h3>
            <span class="difficulty-tag diff-${m.difficulty}">${m.difficulty}</span>
            <p>${m.desc}</p>
            <ul style="text-align:left; font-size:0.9em; padding-left:20px; color:#ccc;">
                <li>租金: ${Math.round(m.buildCostMod * 100)}%</li>
                <li>獲利: ${Math.round(m.revenueMod * 100)}%</li>
                <li>人流: ${Math.round(m.trafficRate * 100)}%</li>
            </ul>
        `;
        card.onclick = () => startGame(key);
        container.appendChild(card);
    }
}

// 2. 開始遊戲邏輯
function startGame(marketKey) {

    const nameInput = document.getElementById('market-name-input');
    let customName = nameInput.value.trim();
    if (!customName) {
        alert("老闆，請先幫夜市取個名字吧！");
        return;
    }
    state.marketName = customName;

    state.marketData = MARKETS[marketKey];
    state.money = state.marketData.startMoney;
    state.mapSize = CONFIG.startGridSize;

    // UI 切換
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-wrapper').classList.remove('hidden');
    document.getElementById('night-market-title').innerText = `${state.marketName} `;

    initGrid();         
    generateMapLayout();
    initUI();
    updateMoneyDisplay();
    updateExpandCost();

    // 啟動顧客系統
    initCustomerSystem();

    // 綁定管理視窗事件
    bindManagerEvents();
    showStory(PROLOGUE.title, PROLOGUE.text, () => {
        // 劇情看完後，啟動隨機事件系統
        initEventSystem();
    });
    // 綁定擴建按鈕
    const expandBtn = document.getElementById('btn-expand-map');
    if(expandBtn) expandBtn.onclick = expandMap;
}
function initEventSystem() {
    // 每 45 秒嘗試觸發一次事件
    if (state.eventTimer) clearInterval(state.eventTimer);

    state.eventTimer = setInterval(() => {
        // 30% 機率觸發事件，避免太頻繁
        if (Math.random() > 0.3) return; 

        // 隨機選一個事件
        const event = EVENTS[Math.floor(Math.random() * EVENTS.length)];
        
        // 執行效果
        if (event.effect) {
            event.effect(state);
            updateMoneyDisplay();
        }

        // 顯示劇情框
        showStory(event.title, event.text);

    }, 45000); // 45000 ms = 45秒
}
function showStory(title, text, callback) {
    const modal = document.getElementById('story-modal');
    const titleEl = document.getElementById('story-title');
    const textEl = document.getElementById('story-text');
    const btn = document.getElementById('story-btn');

    titleEl.innerText = title;
    textEl.innerHTML = text; // 支援 HTML (例如 <br>)

    // 綁定按鈕事件
    btn.onclick = () => {
        modal.classList.add('hidden');
        if (callback) callback();
    };

    modal.classList.remove('hidden');
}
// === 新增：地圖擴充邏輯 ===
function expandMap() {
    const cost = getExpandCost();
    if (state.money >= cost) {
        if (state.mapSize >= CONFIG.maxGridSize) return;

        state.money -= cost;
        state.mapSize += 1;
        
        // 重新繪製網格狀態 (解鎖新區域)
        renderLockedArea();
        updateMoneyDisplay();
        updateExpandCost();
        
        alert(`擴建成功！目前大小: ${state.mapSize}x${state.mapSize}`);
    } else {
        alert("資金不足！");
    }
}

function getExpandCost() {
    // 因為現在地圖等級(mapSize)數字很大(從10起跳)
    // 如果用舊公式 500 * mapSize 會太貴
    // 改為線性成長： 100 * mapSize
    return 100 * state.mapSize;
}

// === 優化後的擴充成本更新函式 ===
function updateExpandCost() {
    const btn = document.getElementById('btn-expand-map');
    const costSpan = document.getElementById('expand-cost');
    
    // 如果連按鈕都沒有，就直接跳過 (避免報錯)
    if (!btn) return;

    if (state.mapSize >= CONFIG.maxGridSize) {
        btn.innerText = "已達最大";
        btn.disabled = true;
    } else {
        const cost = getExpandCost();
        if (costSpan) {
            // 如果有 span，只更新數字
            costSpan.innerText = cost;
        } else {
            // 如果沒有 span，直接更新整個按鈕文字
            btn.innerText = `擴充地圖 ($${cost})`;
        }
    }
}

function bindManagerEvents() {
    // 1. 關閉按鈕 (靜態，通常都存在)
    const btnClose = document.getElementById('btn-close');
    if (btnClose) {
        btnClose.onclick = () => {
            document.getElementById('manager-modal').classList.add('hidden');
            currentEditingKey = null;
        };
    }

    // 2. 升級按鈕 (動態/靜態)
    const btnUpgrade = document.getElementById('btn-upgrade');
    if (btnUpgrade) {
        btnUpgrade.onclick = () => {
            if(!currentEditingKey) return;
            const data = state.gridData[currentEditingKey];
            const cost = Math.floor(BUILDINGS[data.type].price * data.level * 1.5);
            if (state.money >= cost) {
                state.money -= cost;
                data.level++;
                updateMoneyDisplay();
                openManager(currentEditingKey);
                alert("等級提升！獲利增加");
            } else alert("資金不足");
        };
    }

    // 3. 雇用按鈕 (動態，一開始可能不存在)
    const btnHire = document.getElementById('btn-hire');
    if (btnHire) {
        btnHire.onclick = () => {
            if(!currentEditingKey) return;
            const data = state.gridData[currentEditingKey];
            const hireCost = 500 * (data.staff + 1);
            
            if (state.money >= hireCost) {
                state.money -= hireCost;
                data.staff++;
                updateMoneyDisplay();
                openManager(currentEditingKey);
                alert("雇用成功！烹飪速度加快");
            } else alert("資金不足");
        };
    }

    // 4. 擴充按鈕 (動態，一開始可能不存在)
    const btnExpand = document.getElementById('btn-expand-stall');
    if (btnExpand) {
        btnExpand.onclick = () => {
            if(!currentEditingKey) return;
            const data = state.gridData[currentEditingKey];
            const expandCost = 1000 * (data.capacityLevel || 1);
            
            if (state.money >= expandCost) {
                state.money -= expandCost;
                data.capacityLevel = (data.capacityLevel || 1) + 1;
                data.maxQueue += 2;
                updateMoneyDisplay();
                openManager(currentEditingKey);
                alert("攤位擴充成功！可容納更多客人");
            } else alert("資金不足");
        };
    }

    // 5. 其他輸入框綁定
    const nameInput = document.getElementById('custom-name-input');
    if (nameInput) {
        nameInput.oninput = (e) => {
            if(!currentEditingKey) return;
            state.gridData[currentEditingKey].customName = e.target.value;
            document.getElementById('modal-title').innerText = e.target.value;
        };
    }
    
    // 價格滑桿 (如果有保留的話)
    const priceSlider = document.getElementById('price-slider');
    if (priceSlider) {
        priceSlider.oninput = (e) => {
            if(!currentEditingKey) return;
            // 這裡可以加入你想要的價格調整邏輯
        };
    }
}

// === 核心遊戲功能 ===

function initGrid() {
    const grid = document.getElementById('grid');
    const size = CONFIG.maxGridSize; // 渲染時總是渲染最大尺寸 (10x10)

    grid.style.gridTemplateColumns = `repeat(${size}, 12px)`;
    grid.style.gridTemplateRows = `repeat(${size}, 12px)`;
    grid.innerHTML = "";

    for (let i = 0; i < size * size; i++) {
        let cell = document.createElement('div');
        cell.classList.add('cell');
        cell.classList.add('grass'); 
        
        cell.dataset.x = i % size;
        cell.dataset.y = Math.floor(i / size);
        cell.onclick = () => handleCellClick(cell);
        grid.appendChild(cell);
    }
    renderLockedArea();
}

function renderLockedArea() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        const x = parseInt(cell.dataset.x);
        const y = parseInt(cell.dataset.y);
        
        if (x < state.mapSize && y < state.mapSize) {
            cell.classList.remove('locked');
        } else {
            cell.classList.add('locked');
        }
    });
}

function initUI() {
    const panel = document.getElementById('ui-panel');
    panel.innerHTML = "";
    
    const tabsDiv = document.createElement('div');
    tabsDiv.id = 'category-tabs';

    for (let catKey in CATEGORIES) {
        let tab = document.createElement('button');
        tab.className = 'tab-btn';
        if (state.uiCategory === catKey) tab.classList.add('active');
        tab.innerText = CATEGORIES[catKey];
        
        tab.onclick = () => {
            state.uiCategory = catKey;
            initUI(); // 重新渲染
        };
        tabsDiv.appendChild(tab);
    }
    panel.appendChild(tabsDiv);

    // 2. 建立工具按鈕容器
    const toolsDiv = document.createElement('div');
    toolsDiv.id = 'tools-container';
    
    // 3. 根據目前分類篩選按鈕
    for (let key in BUILDINGS) {
        let data = BUILDINGS[key];
        
        // 只顯示符合當前分類的按鈕
        if (data.category !== state.uiCategory) continue;
        
        let btn = document.createElement('button');
        btn.classList.add('tool-btn');
        btn.id = `btn-${key}`;
        
        // 顯示價格 (計算地價倍率)
        let realPrice = Math.floor(data.price * state.marketData.buildCostMod);
        
        // 道路和拆除不需要顯示價格或獲利
        let info = `<small>$${realPrice}</small>`;
        if (data.category === 'facility' && data.price === 0) info = "<small>免費</small>";
        
        // 顯示圖示與名稱
        let iconDisplay = data.icon ? data.icon : "🛣️"; // 道路預設圖示
        if (key === 'road') iconDisplay = "🛣️";
        if (key === 'floor') iconDisplay = "🧹";

        btn.innerHTML = `
            <div style="font-size:18px;">${iconDisplay}</div>
            <div style="font-weight:bold;">${data.name}</div>
            ${info}
        `;
        
        // 保持選取狀態
        if (state.currentTool === key) btn.classList.add('active');

        btn.onclick = () => selectTool(key);
        
        toolsDiv.appendChild(btn);
    }
    panel.appendChild(toolsDiv);
}

function selectTool(key) {
    state.currentTool = key;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`btn-${key}`);
    if (btn) btn.classList.add('active');
}

function handleCellClick(cell) {
    // 鎖住的格子不能點
    if (cell.classList.contains('locked')) return;

    const x = parseInt(cell.dataset.x);
    const y = parseInt(cell.dataset.y);
    const key = `${x},${y}`;

    if (state.currentTool === 'floor') {
        demolish(cell, key);
        return;
    }

    // 道路也可以被拆除或覆蓋
    if (state.gridData[key]) {
        // 如果是道路且點擊的是商店工具，提示需先拆除? 
        // 這裡簡化：點擊已存在的建築一律視為管理或無效(若是道路)
        if (state.gridData[key].type === 'road') {
             // 道路沒有管理介面，可以直接覆蓋嗎？
             // 為了避免誤觸，我們規定要有東西就不能直接蓋，除了拆除
             // 除非打開管理視窗(如果未來道路有升級)
             return; 
        }
        openManager(key);
        return;
    }

    if (state.currentTool) {
        build(cell, key, state.currentTool);
    }
}

function build(cell, key, toolId) {
    const baseConfig = BUILDINGS[toolId];
    if (state.money >= baseConfig.price) {
        state.money -= baseConfig.price;
        
        cell.className = 'cell'; 
        cell.style.backgroundColor = baseConfig.color;
        
        if (baseConfig.isRoad) {
            cell.classList.add('road-cell');
        } else {
            cell.innerHTML = `<div class="cell-content">${baseConfig.icon}</div>`;
        }
        
        state.gridData[key] = {
            type: toolId,
            level: 1,
            priceMultiplier: 1.0,
            customName: baseConfig.name,
            cellElement: cell,
            x: parseInt(cell.dataset.x), 
            y: parseInt(cell.dataset.y),
            isRoad: baseConfig.isRoad || false,
            
            // === 新增經營參數 ===
            staff: 0,          // 員工數量
            queue: [],         // 排隊中的客人 (Array of objects)
            maxQueue: baseConfig.baseCapacity || 2,
            capacityLevel: 1,
            cookingProgress: 0, // 0~100
            currentOrder: null, // 當前正在做的訂單
            status: 'idle'      // idle, cooking
        };

        if (!baseConfig.isRoad) startOperation(key); // 改用新的運作函式
        updateMoneyDisplay();
    }
}

function demolish(cell, key) {
    if (state.gridData[key]) {
        clearInterval(state.gridData[key].timerId);
        delete state.gridData[key];
        
        cell.innerHTML = '';
        cell.className = 'cell grass'; // 變回草地
        cell.style.backgroundColor = ''; // 移除 inline style 讓 css 生效
        
        updateAttractiveness();
    }
}

function startOperation(key) {
    const data = state.gridData[key];
    const baseConfig = BUILDINGS[data.type];
    
    // 使用高頻率計時器 (每 100ms 檢查一次狀態)
    // 這樣才能實現進度條和即時反應
    if (data.timerId) clearInterval(data.timerId);

    data.timerId = setInterval(() => {
        // 1. 檢查是否需要開始烹飪
        if (data.status === 'idle' && data.queue.length > 0) {
            data.currentOrder = data.queue[0]; // 取出第一位客人
            data.status = 'cooking';
            data.cookingProgress = 0;
            updateStallVisual(data, "🔥"); // 顯示烹飪中
        }

        // 2. 烹飪過程
        if (data.status === 'cooking') {
            // 計算烹飪速度：基礎速度 + 員工加成 (每位員工加快 30%)
            let speedBonus = 1 + (data.staff * 0.3);
            // 每次 tick 增加的進度 (100ms)
            let progressPerTick = (100 / (baseConfig.cookTime / 100)) * speedBonus;
            
            data.cookingProgress += progressPerTick;

            // 3. 烹飪完成
            if (data.cookingProgress >= 100) {
                completeOrder(data, baseConfig);
            }
        } else {
            // 閒置時顯示排隊人數
            if(data.queue.length > 0) updateStallVisual(data, `🧍${data.queue.length}`);
            else updateStallVisual(data, baseConfig.icon);
        }

    }, 100); 
}
function completeOrder(data, config) {
    let customer = data.queue.shift(); // 移除隊列第一人
    
    // 計算收支
    let revenue = Math.floor(config.revenue * data.level * data.priceMultiplier);
    let cost = config.cost; // 扣除成本
    let profit = revenue - cost;

    state.money += profit;
    
    // 視覺回饋
    showFloatingText(data.cellElement, `+$${profit}`, "#f1c40f");
    updateMoneyDisplay();

    // 讓客人離開 (變成吃東西狀態)
    if (customer) {
        customer.state = 'eating';
        customer.eatingTimer = 20; // 吃 20 個 tick
        // 讓客人重新出現在地圖上 (原本排隊時是隱藏的或疊在店裡)
        customer.el.style.display = 'block';
        customer.el.style.left = (data.x * 12 + 4) + 'px'; // 從店門口出來
        customer.el.style.top = (data.y * 12 + 4) + 'px';
        customer.gx = data.x;
        customer.gy = data.y;
    }

    // 重置攤位狀態
    data.status = 'idle';
    data.cookingProgress = 0;
    data.currentOrder = null;
}

function updateStallVisual(data, text) {
    // 為了效能，只有內容改變時才更新 DOM
    if (data.lastVisualText !== text) {
        data.cellElement.innerHTML = `<div class="cell-content">${text}</div>`;
        
        // 如果正在烹飪，加個背景色變化
        if (data.status === 'cooking') {
            let p = Math.min(data.cookingProgress, 100);
            data.cellElement.style.background = `linear-gradient(to top, ${BUILDINGS[data.type].color} ${p}%, #444 ${p}%)`;
        } else {
            data.cellElement.style.background = BUILDINGS[data.type].color;
        }
        data.lastVisualText = text;
    }
}


function findCustomerNear(shopX, shopY) {
    // 取得攤位四周座標
    const neighbors = [
        {x: shopX, y: shopY - 1},
        {x: shopX, y: shopY + 1},
        {x: shopX - 1, y: shopY},
        {x: shopX + 1, y: shopY}
    ];

    // 在所有客人中搜尋
    // 注意：這裡只會回傳「第一個」找到的客人，代表老闆一次只能服務一位
    for (let c of state.customers) {
        // 如果客人正在吃東西，他不會買新的
        if (c.eatingTime > 0) continue;

        // 檢查客人的座標是否在鄰近格子
        for (let n of neighbors) {
            if (c.gx === n.x && c.gy === n.y) {
                return c;
            }
        }
    }
    return null;
}

function checkRoadConnection(x, y) {
    const neighbors = [
        {dx: 0, dy: 1}, {dx: 0, dy: -1},
        {dx: 1, dy: 0}, {dx: -1, dy: 0}
    ];
    
    for (let n of neighbors) {
        let nx = x + n.dx;
        let ny = y + n.dy;
        let key = `${nx},${ny}`;
        if (state.gridData[key] && state.gridData[key].isRoad) {
            return true;
        }
    }
    return false;
}

function generateMapLayout() {
    const type = state.marketData.layoutType || 'cross'; 
    const size = state.mapSize; 
    const roadConfig = BUILDINGS['road'];

    // 定義畫路的輔助函式
    const drawRoad = (x, y) => {
        // 邊界檢查
        if (x < 0 || x >= CONFIG.maxGridSize || y < 0 || y >= CONFIG.maxGridSize) return;

        let key = `${x},${y}`;
        // 取得該格子的 DOM
        // 注意：我們沒有儲存 DOM 的二維陣列，所以用 querySelector 或直接計算 index
        // 為了效能，我們在 initGrid 時可以在 dataset 找，或者這裡簡單算一下 index
        // 因為 initGrid 剛跑完，DOM 是乾淨的，直接用 querySelector 找 data-attr
        let cell = document.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
        
        if (cell) {
            // 寫入資料
            state.gridData[key] = {
                type: 'road',
                level: 1,
                priceMultiplier: 1.0,
                customName: "道路",
                cellElement: cell,
                x: x, 
                y: y,
                isRoad: true,
                // 道路不需要排隊/員工等屬性
            };
            
            // 寫入樣式
            cell.className = 'cell road-cell'; // 加上 road class
            cell.style.backgroundColor = roadConfig.color;
            cell.classList.remove('grass');
        }
    };

    // 根據類型畫路 (以 10x10 為基準設計)
    if (type === 'cross') {
        // 十字型：中間畫橫線與直線
        let mid = Math.floor(size / 2); // 5
        for (let i = 0; i < size; i++) {
            drawRoad(i, mid); // 橫線
            drawRoad(mid, i); // 直線
        }
    } 
    else if (type === 'ring') {
        // 口字型：外圍一圈
        // 保留最外層 1 格邊界，路畫在 index 2 和 7
        let start = 2;
        let end = size - 3;
        for (let i = start; i <= end; i++) {
            drawRoad(i, start); // 上
            drawRoad(i, end);   // 下
            drawRoad(start, i); // 左
            drawRoad(end, i);   // 右
        }
        // 連接外部的入口 (不然客人進不來)
        drawRoad(midX(), start-1);
        drawRoad(midX(), start-2);
        drawRoad(midX(), end+1);
        drawRoad(midX(), end+2);
    }
    else if (type === 'avenue') {
        // 大道型：中間兩條寬馬路
        let mid = Math.floor(size / 2);
        for (let i = 0; i < size; i++) {
            drawRoad(i, mid);
            drawRoad(i, mid - 1); // 雙線道
        }
    }
    else if (type === 'single') {
        // 單行道：只有一條直直的死路
        let mid = Math.floor(size / 2);
        for (let i = 0; i < size - 2; i++) { // 沒通到底
            drawRoad(mid, i);
        }
    }
}

// 輔助：取得中間值
function midX() { return Math.floor(state.mapSize / 2); }

// === 顧客系統 (Customer Mechanism) ===
function initCustomerSystem() {
    setInterval(updateCustomers, 500); 
}

function updateAttractiveness() {
    let total = 0;
    for(let key in state.gridData) {
        let item = state.gridData[key];
        if (BUILDINGS[item.type].revenue > 0) { // 只有商店加分
            total += item.level;
        }
    }
    state.totalAttractiveness = total;
}

function updateCustomers() {
    const layer = document.getElementById('customer-layer');
    
    // 1. 建立人潮密度地圖
    let densityMap = {};
    state.customers.forEach(c => {
        let key = `${c.gx},${c.gy}`;
        densityMap[key] = (densityMap[key] || 0) + 1;
    });

    // 2. 更新人數
    let targetCount = Math.floor((5 + state.totalAttractiveness) * state.marketData.trafficRate);
    if (targetCount > 100) targetCount = 100;
    document.getElementById('people-display').innerText = state.customers.length;

    // 3. 生成新顧客 (加入耐心設定)
    if (state.customers.length < targetCount) {
        let spawnPoints = findSpawnPoints();
        spawnPoints.sort(() => Math.random() - 0.5);

        if (spawnPoints.length > 0) {
            for (let pt of spawnPoints) {
                let key = `${pt.x},${pt.y}`;
                if (densityMap[key] && densityMap[key] > 0) continue;

                let cDiv = document.createElement('div');
                cDiv.className = 'customer';
                cDiv.style.left = (pt.x * 12 + 4) + 'px';
                cDiv.style.top = (pt.y * 12 + 4) + 'px';
                layer.appendChild(cDiv);

                state.customers.push({
                    el: cDiv,
                    gx: pt.x, gy: pt.y, 
                    lastGx: -1, lastGy: -1,
                    state: 'walking',
                    moveCooldown: 0,
                    // === 新增：耐心值 (約 100 秒) ===
                    // 如果一直找不到店，時間到就走人
                    patience: 500 
                });
                break; 
            }
        }
    }

    // 4. 移動與狀態更新
    for (let i = state.customers.length - 1; i >= 0; i--) {
        let c = state.customers[i];

        // 狀態 A: 排隊 (排隊時也會消耗耐心，但比較慢，以免排太久生氣)
        if (c.state === 'queueing') {
            c.el.style.display = 'none';
            // 這裡可以選擇要不要讓排隊也會不耐煩離開，目前先暫停
            return;
        }

        // 狀態 B: 吃東西 (回血? 或單純暫停)
        if (c.state === 'eating') {
            c.el.style.display = 'block';
            c.eatingTimer--;
            if (c.eatingTimer <= 0) {
                c.state = 'walking';
                c.patience = 500; // 吃飽了！心情變好，耐心重置
                c.el.style.backgroundColor = 'white';
            } else {
                c.el.style.backgroundColor = '#f1c40f'; // 黃色：吃東西
            }
            continue; 
        }

        // 狀態 C: 走路
        if (c.state === 'walking') {
            c.el.style.display = 'block';

            // === 核心修改：耐心機制 ===
            c.patience--;

            // 1. 視覺警告：快沒耐心變紅色
            if (c.patience < 150) {
                c.el.style.backgroundColor = '#e74c3c'; // 紅色
            } else {
                c.el.style.backgroundColor = 'white';
            }

            // 2. 時間到：離開遊戲
            if (c.patience <= 0) {
                showTextAt(c.gx, c.gy, "😡餓!");
                c.el.remove();
                state.customers.splice(i, 1);
                continue; // 直接處理下一個，跳過移動邏輯
            }
            // ========================

            // 檢查店家
            let shop = findShopAvailable(c.gx, c.gy);
            if (shop) {
                shop.queue.push(c);
                c.state = 'queueing';
                continue;
            }

            // 移動冷卻
            if (c.moveCooldown > 0) {
                c.moveCooldown--;
                continue;
            }

            // 尋路
            let nextMove = getNextStep(c.gx, c.gy, c.lastGx, c.lastGy);
            
            if (nextMove) {
                let cost = calculateMoveCost(nextMove.x, nextMove.y, densityMap);
                if (c.lastGx === -1) cost = 0; // 新手保護

                c.moveCooldown = cost;
                c.lastGx = c.gx; c.lastGy = c.gy;
                c.gx = nextMove.x; c.gy = nextMove.y;
                
                c.el.style.left = (c.gx * 12 + 4) + 'px';
                c.el.style.top = (c.gy * 12 + 4) + 'px';
            } else {
                // 死路移除
                if (c.lastGx !== -1 && Math.random() > 0.9) {
                    c.el.remove();
                    state.customers.splice(i, 1);
                } else {
                    c.lastGx = -1; c.lastGy = -1;
                }
            }
        }
    }
}

function showTextAt(gx, gy, text) {
    const layer = document.getElementById('customer-layer');
    let floatEl = document.createElement('div');
    floatEl.innerText = text;
    floatEl.style.position = 'absolute';
    // 轉換 grid 座標到像素座標
    floatEl.style.left = (gx * 12) + 'px';
    floatEl.style.top = (gy * 12 - 10) + 'px'; // 稍微往上浮
    
    floatEl.style.fontSize = '10px';
    floatEl.style.color = '#e74c3c'; // 紅字
    floatEl.style.fontWeight = 'bold';
    floatEl.style.pointerEvents = 'none';
    floatEl.style.transition = 'all 1s ease-out';
    floatEl.style.zIndex = '100';
    floatEl.style.whiteSpace = 'nowrap'; // 防止換行

    layer.appendChild(floatEl);

    // 動畫效果：往上飄並消失
    setTimeout(() => {
        floatEl.style.top = (gy * 12 - 30) + 'px';
        floatEl.style.opacity = '0';
    }, 50);

    setTimeout(() => {
        floatEl.remove();
    }, 1000);
}

function calculateMoveCost(targetX, targetY, densityMap) {
    let baseSpeed = 0;
    let key = `${targetX},${targetY}`;
    let cellData = state.gridData[key];

    // 地形速度
    if (cellData) {
        if (cellData.isRoad) baseSpeed = 0; // 道路極快
        else baseSpeed = 4; // 穿越攤位較慢
    } else {
        baseSpeed = 2; // 草地普通
    }

    // 擁擠懲罰
    let peopleCount = densityMap[key] || 0;
    // 限制最大擁擠懲罰，避免無限卡死
    // 即使前面有 100 個人，也頂多延遲 5 tick
    let penalty = Math.min(peopleCount * 2, 5); 

    return baseSpeed + penalty;
}

// === 尋找邊緣道路 (生成點) ===
function findSpawnPoints() {
    let points = [];
    for (let key in state.gridData) {
        let tile = state.gridData[key];
        // 必須是道路
        if (tile.isRoad) {
            // 必須在目前地圖的邊緣
            if (tile.x === 0 || tile.y === 0 || 
                tile.x === state.mapSize - 1 || tile.y === state.mapSize - 1) {
                points.push({x: tile.x, y: tile.y});
            }
        }
    }
    return points;
}


function findShopAvailable(cx, cy) {
    const neighbors = [
        {x: cx, y: cy - 1}, {x: cx, y: cy + 1},
        {x: cx - 1, y: cy}, {x: cx + 1, y: cy}
    ];

    for (let n of neighbors) {
        let key = `${n.x},${n.y}`;
        let cell = state.gridData[key];
        // 判斷：是建築 + 不是道路 + 有佇列屬性 + 佇列沒滿
        if (cell && !cell.isRoad && cell.queue && cell.queue.length < cell.maxQueue) {
            return cell;
        }
    }
    return null;
}

function getNextStep(currX, currY, lastX, lastY) {
    const neighbors = [
        {dx: 0, dy: 1}, {dx: 0, dy: -1},
        {dx: 1, dy: 0}, {dx: -1, dy: 0}
    ];
    
    let validMoves = [];

    for (let n of neighbors) {
        let nx = currX + n.dx;
        let ny = currY + n.dy;
        
        // 邊界檢查
        if (nx < 0 || ny < 0 || nx >= CONFIG.maxGridSize || ny >= CONFIG.maxGridSize) continue;
        if (nx >= state.mapSize || ny >= state.mapSize) continue; // 未解鎖區域

        // 規則：不能回頭 (除非只有回頭路)
        if (nx !== lastX || ny !== lastY) {
            validMoves.push({x: nx, y: ny});
        }
    }

    // 如果是死路 (沒有 validMoves)，則允許回頭
    if (validMoves.length === 0) {
        // 如果連回頭路都沒有 (卡在單格孤島)，回傳 null
        if (lastX === -1) return null; 
        return {x: lastX, y: lastY};
    }

    // 優先權邏輯：
    // 1. 找出所有是「道路」的選項
    let roadMoves = validMoves.filter(m => {
        let k = `${m.x},${m.y}`;
        return state.gridData[k] && state.gridData[k].isRoad;
    });

    // 2. 高機率走道路 (90%)，低機率亂鑽 (10%)
    if (roadMoves.length > 0 && Math.random() < 0.9) {
        return roadMoves[Math.floor(Math.random() * roadMoves.length)];
    }

    // 3. 隨機選一個
    return validMoves[Math.floor(Math.random() * validMoves.length)];
}

// === 管理視窗 UI (部分微調) ===
function openManager(key) {
    currentEditingKey = key;
    const data = state.gridData[key];
    const modal = document.getElementById('manager-modal');
    const config = BUILDINGS[data.type];
    
    // 設定標題與輸入框
    document.getElementById('modal-title').innerText = data.customName;
    document.getElementById('custom-name-input').value = data.customName;
    
    // [已刪除] document.getElementById('lvl-display').innerText = data.level; <--- 這行就是報錯的原因
    
    // 動態插入新的數據資訊
    const statsBox = document.querySelector('.stats-box');
    statsBox.innerHTML = `
        <p>等級: ${data.level} (售價 x${data.level})</p>
        <p>員工: ${data.staff} 人</p>
        <p>排隊: ${data.queue.length} / ${data.maxQueue} 人</p>
        <p>製作: ${(config.cookTime / 1000).toFixed(1)}秒/份</p>
        <p>成本: $${config.cost}/份</p>
    `;

    // 動態插入按鈕
    const btnGroup = document.querySelector('.btn-group');
    btnGroup.innerHTML = `
        <button id="btn-upgrade" class="action-btn upgrade">⬆️ 升級口味 ($${Math.floor(config.price * data.level * 1.5)})</button>
        <button id="btn-hire" class="action-btn" style="background:#3498db;color:white;margin-bottom:5px;">👨‍🍳 雇用工讀生 ($${500 * (data.staff + 1)})</button>
        <button id="btn-expand-stall" class="action-btn" style="background:#9b59b6;color:white;margin-bottom:5px;">⛺ 擴充座位 ($${1000 * (data.capacityLevel || 1)})</button>
        <button id="btn-close" class="action-btn">關閉</button>
    `;

    bindManagerEvents(); // 重新綁定事件
    modal.classList.remove('hidden');
}

function updateMoneyDisplay() {
    const el = document.getElementById('money-display');
    if (el) el.innerText = state.money;
}

function showFloatingText(cell, text) {
    let floatEl = document.createElement('div');
    floatEl.innerText = text;
    floatEl.style.position = 'absolute';
    floatEl.style.top = '0';
    floatEl.style.left = '0';
    floatEl.style.width = '100%';
    floatEl.style.color = text.includes('+') ? '#2ecc71' : '#e74c3c'; // 賺錢綠色，賠錢紅色
    floatEl.style.fontWeight = 'bold';
    floatEl.style.textShadow = '1px 1px 1px black';
    floatEl.style.pointerEvents = 'none';
    floatEl.style.transition = 'all 1s ease-out';
    floatEl.style.zIndex = '10';

    cell.appendChild(floatEl);
    setTimeout(() => {
        floatEl.style.top = '-30px';
        floatEl.style.opacity = '0';
    }, 50);
    setTimeout(() => { floatEl.remove(); }, 1000);
}