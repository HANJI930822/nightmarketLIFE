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
    trafficMultiplier: 1.0, // 人流倍率
    activeEvents: [],       // 進行中的事件
    totalGarbage: 0,        // 目前場上垃圾總數
    customBuildings: {},     // 玩家自製的攤位
    inventory: {}, // 格式: { 'flour': 5, 'pork': 2 }
    unlockedStalls: [], // 已解鎖的攤位 ID
    adventureTimer: null,
    selectedIngredients: [] // 合成選中的兩個原料
};

let currentEditingKey = null;

// === 初始化 ===
window.onload = function() {
    initStartScreen();
};

// 1. 初始化選擇畫面
function initStartScreen() {
    const container = document.getElementById('market-selection');
    container.innerHTML = ""; // 清空

    // 新增：如果有存檔，顯示讀取按鈕
    if(localStorage.getItem('nightMarketSave')) {
        let loadBtn = document.createElement('button');
        loadBtn.className = 'action-btn';
        loadBtn.style.cssText = "width: 100%; margin-bottom: 20px; background: #27ae60; font-size: 1.2em;";
        loadBtn.innerText = "📂 讀取上次的進度";
        loadBtn.onclick = () => {
            if(loadGame()) {
                 document.getElementById('start-screen').style.display = 'none';
            }
        };
        document.querySelector('.naming-section').appendChild(loadBtn);
    }
    
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
    state.trafficMultiplier = 1.0;
    state.totalGarbage = 0;
    state.activeEvents = [];
    state.inventory = {};
    state.unlockedStalls = []; // 重置解鎖列表
    state.selectedIngredients = [];

    // UI 切換
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-wrapper').classList.remove('hidden');
    document.getElementById('night-market-title').innerText = `${state.marketName} `;

    initGrid();         
    generateMapLayout();
    initUI();
    updateMoneyDisplay();

    // 啟動顧客系統
    initCustomerSystem();

    // 綁定管理視窗事件
    bindManagerEvents();
    
    bindExtraButtons();
    // 綁定擴建按鈕
    const expandBtn = document.getElementById('btn-expand-map');
    if(expandBtn) expandBtn.onclick = expandMap;

    initTutorial();

    showStory(PROLOGUE.title, PROLOGUE.text, () => {
        // 劇情看完後，啟動隨機事件系統
        initEventSystem();
    });

    setInterval(() => {
        saveGame();
        // 如果不想一直跳出提示干擾，可以把 saveGame 裡的 showFloatingText 拿掉，或改用 console.log
        console.log("自動存檔完成");
    }, 60000);
}

function initEventSystem() {
    if (state.eventTimer) clearInterval(state.eventTimer);

    // 檢查過期事件 (每秒檢查一次)
    setInterval(() => {
        // 如果有 traffic 倍率改變，且時間到了，要還原嗎？
        // 這裡簡化處理：事件只是一次性的，但如果是有持續時間的(duration)，需要還原邏輯
        // 為了簡單，我們讓事件的 effect 直接設定 setTimeout 來還原
    }, 1000);

    // 觸發新事件
    state.eventTimer = setInterval(() => {
        if (Math.random() > 0.3) return; 

        const event = EVENTS[Math.floor(Math.random() * EVENTS.length)];
        
        // 執行效果
        if (event.effect) {
            event.effect(state);
            
            // 如果有持續時間，設定定時器還原
            if (event.duration && event.type === 'good') {
                setTimeout(() => {
                    state.trafficMultiplier = 1.0; // 還原
                    // showFloatingText(document.body, "人潮恢復正常", "#fff");
                }, event.duration);
            }
            if (event.duration && event.type === 'bad') {
                setTimeout(() => {
                    state.trafficMultiplier = 1.0; 
                }, event.duration);
            }
            
            updateMoneyDisplay();
        }
        showStory(event.title, event.text);
    }, 45000);
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
function bindExtraButtons() {
    // 1. 【主畫面】打開選單按鈕
    const btnMenu = document.getElementById('btn-main-menu');
    if (btnMenu) {
        btnMenu.onclick = () => {
            // 更新選單內的擴充價格
            const cost = getExpandCost();
            const costEl = document.getElementById('menu-expand-cost');
            if (costEl) {
                if (state.mapSize >= CONFIG.maxGridSize) costEl.innerText = "(已最大)";
                else costEl.innerText = `$${cost}`;
            }
            document.getElementById('main-menu-modal').classList.remove('hidden');
        };
    }

    // === 2. 【選單內部】九宮格按鈕 ===

    // A. 研發
    const menuResearch = document.getElementById('menu-research');
    if (menuResearch) {
        menuResearch.onclick = () => {
            document.getElementById('main-menu-modal').classList.add('hidden');
            document.getElementById('creator-modal').classList.remove('hidden');
            updateCreatorPreview();
        };
    }

    // B. 擴充地圖
    const menuExpand = document.getElementById('menu-expand');
    if (menuExpand) {
        menuExpand.onclick = expandMap;
    }

    // C. 環境清潔
    const menuClean = document.getElementById('menu-clean');
    if (menuClean) {
        menuClean.onclick = () => {
            if (state.money >= 500) {
                state.money -= 500;
                let cleaned = 0;
                for (let key in state.gridData) {
                    if (state.gridData[key].garbage > 0) {
                        state.gridData[key].garbage = 0;
                        updateCellVisual(state.gridData[key]);
                        cleaned++;
                    }
                }
                state.totalGarbage = 0;
                updateMoneyDisplay();
                updateAttractiveness();
                alert(`🧹 大掃除完成！清理了 ${cleaned} 處垃圾，人氣回升！`);
                document.getElementById('main-menu-modal').classList.add('hidden');
            } else {
                alert("資金不足 $500");
            }
        };
    }

    // D. 外出冒險 (對應舊的 bindAdventureButtons)
    const menuAdventure = document.getElementById('menu-adventure');
    if (menuAdventure) {
        menuAdventure.onclick = () => {
            document.getElementById('main-menu-modal').classList.add('hidden');
            renderLocations();
            document.getElementById('adventure-modal').classList.remove('hidden');
        };
    }

    // E. 料理合成 (對應舊的 bindAdventureButtons)
    const menuKitchen = document.getElementById('menu-kitchen');
    if (menuKitchen) {
        menuKitchen.onclick = () => {
            document.getElementById('main-menu-modal').classList.add('hidden');
            state.selectedIngredients = [];
            renderInventory();
            updateCraftingUI();
            document.getElementById('kitchen-modal').classList.remove('hidden');
        };
    }

    // F. 系統存檔
    const menuSystem = document.getElementById('menu-system');
    if (menuSystem) {
        menuSystem.onclick = () => {
            document.getElementById('main-menu-modal').classList.add('hidden');
            document.getElementById('system-modal').classList.remove('hidden');
        };
    }

    // === 3. 【各個子視窗】內部按鈕 ===
    
    // 研發確認
    const btnConfirmCreate = document.getElementById('btn-confirm-create');
    if (btnConfirmCreate) btnConfirmCreate.onclick = createCustomStall;
    
    // 合成確認
    const btnCraft = document.getElementById('btn-craft');
    if (btnCraft) btnCraft.onclick = executeCraft;

    // 手動存檔
    const btnManualSave = document.getElementById('btn-manual-save');
    if (btnManualSave) {
        btnManualSave.onclick = () => {
            saveGame();
            document.getElementById('system-modal').classList.add('hidden');
        };
    }

    // 刪除存檔
    const btnResetSave = document.getElementById('btn-reset-save');
    if (btnResetSave) {
        btnResetSave.onclick = () => {
            if (confirm("確定要重玩嗎？")) {
                localStorage.removeItem('nightMarketSave');
                location.reload();
            }
        };
    }
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
// === 5. 自製攤位 (Custom Stall) ===

function updateCreatorPreview() {
    const level = parseInt(document.getElementById('new-stall-price').value);
    const cat = document.getElementById('new-stall-category').value;
    
    // 計算公式
    let baseRev = 20;
    let baseCost = 5;
    
    if (cat === 'food') { baseRev = 50; baseCost = 20; }
    if (cat === 'drink') { baseRev = 40; baseCost = 10; }
    
    // 等級越高，利潤越高，但成本也越高
    let revenue = baseRev * level;
    let cost = baseCost * level;
    
    document.getElementById('preview-price').innerText = revenue;
    document.getElementById('preview-cost').innerText = cost;
}

function createCustomStall() {
    if (state.money < 5000) {
        alert("資金不足 $5000");
        return;
    }

    const name = document.getElementById('new-stall-name').value;
    const icon = document.getElementById('new-stall-icon').value;
    const cat = document.getElementById('new-stall-category').value;
    const level = parseInt(document.getElementById('new-stall-price').value);

    if (!name) { alert("請輸入名稱"); return; }

    // 扣錢
    state.money -= 5000;
    updateMoneyDisplay();

    // 產生 ID
    const id = 'custom_' + Date.now();
    
    // 計算數值
    let baseRev = 20, baseCost = 5, time = 2000;
    if (cat === 'food') { baseRev=50; baseCost=20; time=4000; }
    if (cat === 'snack') { baseRev=30; baseCost=10; time=2000; }
    if (cat === 'drink') { baseRev=40; baseCost=10; time=1500; }

    const newBuilding = {
        name: name,
        price: 500 * level, // 造價
        icon: icon,
        color: "#e056fd", // 自製攤位統一紫色，或可讓玩家選
        category: cat,
        revenue: baseRev * level,
        cost: baseCost * level,
        cookTime: time,
        baseCapacity: 2 + Math.floor(level/2)
    };

    // 加入資料庫
    BUILDINGS[id] = newBuilding;
    
    // 重新渲染 UI 以顯示新按鈕
    initUI();
    
    // 關閉視窗
    document.getElementById('creator-modal').classList.add('hidden');
    alert(`研發成功！【${name}】上市了！`);
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
        if (data.isLocked && !state.unlockedStalls.includes(key)) continue;
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
    
    // 1. UI 按鈕樣式更新
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`btn-${key}`);
    if (btn) btn.classList.add('active');

    // 2. 更新資訊面板 (Info Panel)
    const infoPanel = document.getElementById('stall-info-panel');
    const data = BUILDINGS[key];

    if (data) {
        infoPanel.classList.remove('hidden');
        
        // 基本資訊
        document.getElementById('info-icon').innerText = data.icon || "ℹ️";
        document.getElementById('info-name').innerText = data.name;
        document.getElementById('info-desc').innerText = data.desc || "暫無描述";

        const statsDiv = document.getElementById('info-stats');
        
        // 只有「非道路」且「非拆除」且「非裝飾」的建築才顯示經營數值
        // 判斷依據：有造價且不是路
        if (data.price > 0 && !data.isRoad && key !== 'floor') {
            statsDiv.classList.remove('hidden');
            
            // 計算實際造價
            let realPrice = Math.floor(data.price * state.marketData.buildCostMod);
            
            // 更新數值
            document.getElementById('info-price').innerText = realPrice;
            document.getElementById('info-revenue').innerText = data.revenue || 0;
            
            // 顯示製作時間 (毫秒轉秒)
            let timeSec = (data.cookTime ? data.cookTime / 1000 : 0);
            document.getElementById('info-time').innerText = timeSec;

            // 顯示座位 (baseCapacity)
            let seats = data.baseCapacity || 0;
            if (data.category === 'facility' && !data.baseCapacity) seats = '-'; // 設施(如垃圾桶)沒座位
            document.getElementById('info-capacity').innerText = seats;

        } else {
            // 如果是道路或拆除工具，隱藏數值區塊
            statsDiv.classList.add('hidden');
        }
    } else {
        infoPanel.classList.add('hidden');
    }
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
        if (data.type === 'trash_can') {
         // 垃圾桶不需要排隊，它的邏輯是每隔一段時間清理周圍
         if (data.timerId) clearInterval(data.timerId);
         data.timerId = setInterval(() => {
             cleanNearbyGarbage(data.x, data.y, 2); // 範圍 2
         }, 5000); // 每 5 秒清理一次
         return; // 垃圾桶不執行後面的烹飪邏輯
    }
    }, 100); 
}

function cleanNearbyGarbage(cx, cy, range) {
    let cleaned = 0;
    for (let x = cx - range; x <= cx + range; x++) {
        for (let y = cy - range; y <= cy + range; y++) {
            let key = `${x},${y}`;
            if (state.gridData[key] && state.gridData[key].garbage > 0) {
                state.gridData[key].garbage = 0;
                state.totalGarbage--;
                updateCellVisual(state.gridData[key]);
                cleaned++;
            }
        }
    }
    // 垃圾桶維護費：每清一個垃圾扣 $1 (可選)
    if(cleaned > 0) showFloatingText(state.gridData[`${cx},${cy}`].cellElement, "🧹", "#3498db");
}

function checkCombo(key) {
    const me = state.gridData[key];
    if(!me) return 1.0;
    
    let bonus = 0;
    const neighbors = [
        {x: me.x, y: me.y - 1}, {x: me.x, y: me.y + 1},
        {x: me.x - 1, y: me.y}, {x: me.x + 1, y: me.y}
    ];

    // 檢查周圍鄰居
    neighbors.forEach(n => {
        let nKey = `${n.x},${n.y}`;
        let neighbor = state.gridData[nKey];
        if(neighbor) {
            // 檢查是否形成 Combo
            COMBOS.forEach(combo => {
                // 如果我是 A，鄰居是 B；或我是 B，鄰居是 A
                if((combo.targets[0] === me.type && combo.targets[1] === neighbor.type) ||
                   (combo.targets[1] === me.type && combo.targets[0] === neighbor.type)) {
                    bonus += combo.bonus;
                    // 偶爾顯示連動特效
                    if(Math.random() > 0.95) showFloatingText(me.cellElement, combo.msg, "#ff9ff3");
                }
            });
        }
    });
    return 1.0 + bonus;
}

function completeOrder(data, config) {
    let customer = data.queue.shift();
    
    let revenue = Math.floor(config.revenue * data.level * data.priceMultiplier);
    state.money += revenue - config.cost;
    showFloatingText(data.cellElement, `+$${revenue - config.cost}`, "#f1c40f");
    updateMoneyDisplay();

    if (customer) {
        // 1. 重新顯示
        customer.el.style.display = 'block';
        
        // 決定狀態 (邊走邊吃 或 原地吃)
        if (Math.random() < 0.5) {
            customer.state = 'walking_eating';
            customer.eatingTimer = 20; 
            customer.el.style.backgroundColor = '#f1c40f';
        } else {
            customer.state = 'eating';
            customer.eatingTimer = 4;
            customer.el.style.backgroundColor = '#f1c40f';
        }

        // 設定為離場
        customer.isLeaving = true; 

        // 找附近的道路
        let safePlace = findNearbyRoad(data.x, data.y);
        customer.gx = safePlace.x;
        customer.gy = safePlace.y;

        // 重置參數
        customer.lastGx = -1; customer.lastGy = -1;
        customer.moveCooldown = 0;

        // === 關鍵修改：瞬移處理 ===
        // 1. 先暫時移除過渡效果 (瞬移)
        customer.el.style.transition = 'none';

        // 2. 計算新位置
        let randX = Math.random() * 8 + 2;
        let randY = Math.random() * 8 + 2;
        customer.offsetX = randX; customer.offsetY = randY;
        
        let pixelX = customer.gx * 12 + randX;
        let pixelY = customer.gy * 12 + randY;
        
        // 3. 設定新座標 (因為沒 transition，會瞬間到達)
        customer.el.style.transform = `translate3d(${pixelX}px, ${pixelY}px, 0)`;

        // 4. 強制瀏覽器重繪 (Reflow)，確保上面的設定生效
        void customer.el.offsetWidth; 

        // 5. 加回過渡效果 (讓之後的移動變回平滑)
        customer.el.style.transition = 'transform 0.5s linear';
    }

    data.status = 'idle';
    data.cookingProgress = 0;
    data.currentOrder = null;
}

// === 新增輔助函式：尋找附近的道路 ===
function findNearbyRoad(cx, cy) {
    const neighbors = [
        {x: cx, y: cy + 1}, {x: cx, y: cy - 1},
        {x: cx + 1, y: cy}, {x: cx - 1, y: cy}
    ];
    
    // 優先找是道路的格子
    for (let n of neighbors) {
        let key = `${n.x},${n.y}`;
        if (state.gridData[key] && state.gridData[key].isRoad) {
            return n;
        }
    }
    // 如果四周都沒路(被包圍)，只好留在原地
    return {x: cx, y: cy};
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
    let totalLevels = 0;
    let varietySet = new Set(); 

    // 統計場上建築
    for(let key in state.gridData) {
        let item = state.gridData[key];
        // 只有「會賺錢」或「設施」才算人氣 (道路不算)
        if (BUILDINGS[item.type] && (BUILDINGS[item.type].revenue > 0 || BUILDINGS[item.type].category === 'facility')) {
            totalLevels += item.level;
            varietySet.add(item.type);
        }
    }
    
    // 垃圾嚴重扣分 (開羅遊戲很重視環境)
    let garbagePenalty = state.totalGarbage * 5; 

    // === 開羅式公式：多樣性是關鍵 ===
    // 基礎分 = 總等級
    // 多樣性加成 = 種類數 ^ 1.5 * 10
    // 這樣鼓勵玩家蓋不同種類的店
    let rawScore = totalLevels + Math.floor(Math.pow(varietySet.size, 1.5) * 10);
    
    let finalScore = rawScore - garbagePenalty;
    if(finalScore < 0) finalScore = 0;
    
    // 如果人氣有變化，顯示飄字特效 (僅當數值增加時)
    if (finalScore > state.totalAttractiveness) {
        showFloatingText(document.body, `❤️ 人氣上升!`, "#e84393");
    } else if (finalScore < state.totalAttractiveness) {
        // showFloatingText(document.body, `💔 人氣下降...`, "#7f8c8d");
    }

    state.totalAttractiveness = finalScore;
    
    // 更新介面
    document.getElementById('people-display').innerText = state.totalAttractiveness;
}

// === 修改後的顧客移動邏輯 (平滑 + 隨機偏移版) ===
function updateCustomers() {
    const layer = document.getElementById('customer-layer');
    
    // 1. 建立密度地圖 (用於計算擁擠程度)
    let densityMap = {};
    state.customers.forEach(c => {
        let key = `${c.gx},${c.gy}`;
        densityMap[key] = (densityMap[key] || 0) + 1;
    });

    // 2. 計算目標人數 (非線性成長公式)
    // 公式： (總等級 ^ 0.6) * 5 * 流量倍率
    // 這讓遊戲後期人數不會無限暴增，維持效能
    let baseCount = 5 + state.totalAttractiveness;
    // 確保至少有 5 人，且不超過 150 人 (避免瀏覽器卡死)
    let maxLimit = 150; 
    let targetCount = Math.min(maxLimit, baseCount);
    
    // 套用倍率 (例如隨機事件)
targetCount = Math.floor(targetCount * state.marketData.trafficRate * state.trafficMultiplier);    
    // 更新介面顯示
    document.getElementById('people-display').innerText = state.customers.length;

    // 3. 自動補人機制：如果目前人數 < 目標人數，就生成新客人
    if (state.customers.length < targetCount) {
        let spawnPoints = findSpawnPoints();
        
        // 隨機打亂生成點，避免大家都從同一個洞出來
        if (spawnPoints.length > 0) {
            // 每次嘗試生成 1~2 人，避免瞬間爆量
            let spawnLimit = 2;
            
            while (spawnLimit > 0 && state.customers.length < targetCount) {
                let pt = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
                let key = `${pt.x},${pt.y}`;
                
                // 如果入口太擠 (超過3人) 就不生了，稍微等一下
                if (densityMap[key] && densityMap[key] > 3) break;

                // 建立 DOM
                let cDiv = document.createElement('div');
                cDiv.className = 'customer';
                
                let randX = Math.random() * 6; 
                let randY = Math.random() * 6;
                let pixelX = pt.x * 12 + randX;
                let pixelY = pt.y * 12 + randY;
                cDiv.style.transform = `translate3d(${pixelX}px, ${pixelY}px, 0)`;
                
                layer.appendChild(cDiv);

                // 加入資料結構
                state.customers.push({
                    el: cDiv,
                    gx: pt.x, gy: pt.y, 
                    lastGx: -1, lastGy: -1,
                    state: 'walking',
                    moveCooldown: 0,
                    patience: 500,        // 耐心
                    offsetX: randX,
                    offsetY: randY,
                    shoppingCooldown: 0,  // 購物冷卻
                    isLeaving: false,     // 是否準備離場
                    eatingTimer: 0
                });
                
                spawnLimit--;
            }
        }
    }

    // 4. 處理所有顧客的邏輯 (倒序迴圈，方便移除陣列元素)
    for (let i = state.customers.length - 1; i >= 0; i--) {
        let c = state.customers[i];

        // --- 狀態 A: 排隊中 (隱藏) ---
        if (c.state === 'queueing') {
            c.el.style.display = 'none';
            continue;
        }

        // --- 狀態 B: 原地吃東西 ---
        if (c.state === 'eating') {
            c.el.style.display = 'block';
            c.eatingTimer--;
            
            if (c.eatingTimer <= 0) {
                // 吃完了
                c.el.style.backgroundColor = 'white';
                tryDropGarbage(c.gx, c.gy);
                
                // 判斷下一步：離場 或是 繼續逛
                if (c.isLeaving) c.state = 'leaving';
                else c.state = 'walking';
            } else {
                c.el.style.backgroundColor = '#f1c40f'; // 黃色
            }
            continue; // 原地吃，不移動
        }

        // --- 狀態 C: 邊走邊吃 ---
        if (c.state === 'walking_eating') {
            c.el.style.display = 'block';
            c.eatingTimer--;
            
            if (c.eatingTimer <= 0) {
                c.el.style.backgroundColor = 'white';
                tryDropGarbage(c.gx, c.gy);
                
                if (c.isLeaving) c.state = 'leaving';
                else c.state = 'walking';
            }
            // 這裡不 continue，因為他要邊走邊吃
        }

        // --- 狀態 D: 走路 / 離場 / 邊走邊吃 ---
        
        // 1. 離場檢測
        if (c.state === 'leaving') {
            c.el.style.backgroundColor = '#95a5a6'; // 變成灰色
            
            // 檢查是否到達地圖邊緣
            let limit = state.mapSize - 1;
            // 寬容度設為 <=1 和 >= limit-1，避免卡在最後一步
            if (c.gx <= 0 || c.gy <= 0 || c.gx >= limit || c.gy >= limit) {
                c.el.remove();              // 移除 DOM
                state.customers.splice(i, 1); // 移除資料
                continue;
            }
        }

        // 2. 移動冷卻 (沒冷卻才能動)
        if (c.moveCooldown > 0) {
            c.moveCooldown--;
            continue;
        }

        // 3. 決定下一步要去哪
        let nextMove = null;

        if (c.state === 'leaving') {
            // 如果要離場，呼叫離場導航
            nextMove = getExitStep(c.gx, c.gy, c.lastGx, c.lastGy);
        } else {
            // 正常逛街
            
            // 減少購物冷卻
            if (c.shoppingCooldown > 0) c.shoppingCooldown--;
            
            // 減少耐心
            c.patience--;
            if (c.patience <= 0) {
                // 耐心沒了，強制離場
                c.state = 'leaving';
                c.isLeaving = true;
                showTextAt(c.gx, c.gy, "😡");
                continue;
            }

            // 嘗試進店 (只有沒冷卻且不是邊走邊吃時)
            if (c.shoppingCooldown <= 0 && c.state !== 'walking_eating') {
                let shop = findShopAvailable(c.gx, c.gy);
                if (shop) {
                    shop.queue.push(c);
                    c.state = 'queueing';
                    continue;
                }
            }

            // 呼叫一般導航
            nextMove = getNextStep(c.gx, c.gy, c.lastGx, c.lastGy);
        }

        // 4. 執行移動
        if (nextMove) {
            // 計算移動成本 (速度)
            let cost = calculateMoveCost(nextMove.x, nextMove.y, densityMap);
            
            // 特殊狀態速度調整
            if (c.state === 'walking_eating') cost = Math.max(cost, 2) * 4; // 邊走邊吃：極慢
            if (c.state === 'leaving') cost = Math.floor(cost / 2);         // 離場：快步離開

            c.moveCooldown = cost;
            c.lastGx = c.gx; c.lastGy = c.gy;
            c.gx = nextMove.x; c.gy = nextMove.y;
            
            // 更新畫面 (使用 transform)
            let pixelX = c.gx * 12 + c.offsetX;
            let pixelY = c.gy * 12 + c.offsetY;
            c.el.style.transform = `translate3d(${pixelX}px, ${pixelY}px, 0)`;
            
        } else {
            // 沒路走 (死路)，重置上一步記憶，試著回頭
            c.lastGx = -1; 
            c.lastGy = -1;
        }
    }
}

function getExitStep(currX, currY, lastX, lastY) {
    const limit = state.mapSize - 1;
    const neighbors = [
        {x: currX, y: currY - 1}, 
        {x: currX, y: currY + 1}, 
        {x: currX - 1, y: currY}, 
        {x: currX + 1, y: currY} 
    ];

    // 目標：找到距離「最近邊界」更近的格子
    // 邊界距離公式： min(x, y, limit-x, limit-y)
    
    let currentDist = Math.min(currX, currY, limit - currX, limit - currY);
    
    // 隨機打亂，避免所有人走同一條路線
    neighbors.sort(() => Math.random() - 0.5);

    for (let n of neighbors) {
        // 邊界檢查
        if (n.x < 0 || n.y < 0 || n.x > limit || n.y > limit) continue;

        let key = `${n.x},${n.y}`;
        let cell = state.gridData[key];
        
        // 只能走道路 (或是還沒解鎖的空地，視為可通行以便逃生)
        if (cell && !cell.isRoad) continue; 

        // 不走回頭路 (除非死路)
        if (n.x === lastX && n.y === lastY) continue;

        let dist = Math.min(n.x, n.y, limit - n.x, limit - n.y);
        
        // 如果這一格比現在更近 (或等於，允許平行移動)，就走這一步
        if (dist <= currentDist) {
            return n;
        }
    }
    
    // 真的無路可走，只好回頭
    return {x: lastX, y: lastY};
}

function tryDropGarbage(x, y) {
    // 30% 機率亂丟垃圾
    if (Math.random() < 0.3) {
        let key = `${x},${y}`;
        // 確保該格子存在且是道路或空地 (不丟在別人攤位上)
        if (state.gridData[key]) {
            let cellData = state.gridData[key];
            // 增加垃圾量
            cellData.garbage = (cellData.garbage || 0) + 1;
            state.totalGarbage++;
            updateCellVisual(cellData);
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
    // 目前解鎖的地圖大小
    const currentSize = state.mapSize;

    for (let key in state.gridData) {
        let tile = state.gridData[key];
        
        // 1. 必須是道路
        if (!tile.isRoad) continue;

        // 2. 嚴格檢查：必須在目前解鎖範圍內
        // 如果座標大於等於 currentSize，代表在鎖定區域，跳過
        if (tile.x >= currentSize || tile.y >= currentSize) continue;

        // 3. 找出「邊緣」道路作為入口
        // 邊緣定義：X或Y 是 0，或者 X或Y 是目前的邊界-1
        if (tile.x === 0 || tile.y === 0 || 
            tile.x === currentSize - 1 || tile.y === currentSize - 1) {
            points.push({x: tile.x, y: tile.y});
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
    // 目前解鎖邊界
    const limit = state.mapSize; 

    for (let n of neighbors) {
        let nx = currX + n.dx;
        let ny = currY + n.dy;
        
        // === 關鍵修正 ===
        // 邊界檢查：不能小於 0，也「不能大於等於」目前解鎖的大小 (limit)
        // 這樣他們就不會走進鎖定的黑色區域了
        if (nx < 0 || ny < 0 || nx >= limit || ny >= limit) continue;

        // 規則：不能回頭 (除非只有回頭路)
        if (nx !== lastX || ny !== lastY) {
            validMoves.push({x: nx, y: ny});
        }
    }

    // 死路處理：如果沒路可走 (validMoves 為空)，允許回頭
    if (validMoves.length === 0) {
        if (lastX === -1) return null; 
        return {x: lastX, y: lastY};
    }

    // --- 以下邏輯保持不變 (隨機亂鑽與道路優先) ---
    
    // 1. 找出所有是「道路」的選項
    let roadMoves = validMoves.filter(m => {
        let k = `${m.x},${m.y}`;
        // 確保該格資料存在且是道路
        return state.gridData[k] && state.gridData[k].isRoad;
    });

    // 2. 40% 機率乖乖走道路，60% 機率亂鑽
    if (roadMoves.length > 0 && Math.random() < 0.4) {
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
function saveGame() {
    // 過濾掉不能存的 DOM 物件 (如 cellElement, timerId, queue裡的DOM)
    const saveData = {
        money: state.money,
        mapSize: state.mapSize,
        marketName: state.marketName,
        marketKey: state.marketData ? findMarketKey(state.marketData) : 'school', // 需反查 key
        gridData: {}
    };

    // 只存關鍵數據
    for(let key in state.gridData) {
        let item = state.gridData[key];
        saveData.gridData[key] = {
            type: item.type,
            level: item.level,
            x: item.x,
            y: item.y,
            staff: item.staff,
            capacityLevel: item.capacityLevel,
            customName: item.customName
        };
    }

    localStorage.setItem('nightMarketSave', JSON.stringify(saveData));
    showFloatingText(document.body, "💾 遊戲已儲存！");
}

function loadGame() {
    const json = localStorage.getItem('nightMarketSave');
    if(!json) return false;

    try {
        const saved = JSON.parse(json);
        
        // 恢復基礎設定
        startGame(saved.marketKey); // 這會重置 grid，所以要接著覆蓋
        state.money = saved.money;
        state.mapSize = saved.mapSize;
        state.marketName = saved.marketName;
        document.getElementById('night-market-title').innerText = `${state.marketName} `;
        
        // 恢復地圖與擴充按鈕
        renderLockedArea();
        updateExpandCost();

        // 恢復建築
        for(let key in saved.gridData) {
            let item = saved.gridData[key];
            // 找回格子 DOM
            let cell = document.querySelector(`.cell[data-x="${item.x}"][data-y="${item.y}"]`);
            if(cell) {
                // 呼叫建造函式 (但要把錢補回來，因為 build 會扣錢)
                let cost = BUILDINGS[item.type].price; // 簡易估算
                state.money += cost; // 補錢
                build(cell, key, item.type); // 蓋回去
                
                // 恢復等級與員工
                let newData = state.gridData[key];
                newData.level = item.level;
                newData.staff = item.staff;
                newData.capacityLevel = item.capacityLevel;
                newData.customName = item.customName;
                newData.maxQueue += (item.capacityLevel - 1) * 2;
            }
        }
        updateMoneyDisplay();
        return true;
    } catch(e) {
        console.error("讀取失敗", e);
        return false;
    }
}

// 輔助：反查 Market Key
function findMarketKey(dataObj) {
    for(let k in MARKETS) {
        if(MARKETS[k] === dataObj) return k;
    }
    return 'school';
}

// --- 冒險邏輯 ---
function renderLocations() {
    const list = document.getElementById('location-list');
    list.innerHTML = "";
    
    for (let key in LOCATIONS) {
        let loc = LOCATIONS[key];
        let div = document.createElement('div');
        div.className = 'location-card';
        div.innerHTML = `
            <div style="font-size:30px;">🏔️</div>
            <h4>${loc.name}</h4>
            <small>$${loc.cost} / ${(loc.time/1000)}秒</small>
            <p style="font-size:12px; color:#aaa;">${loc.desc}</p>
        `;
        div.onclick = () => goAdventure(key);
        list.appendChild(div);
    }
}
function goAdventure(locKey) {
    if (state.adventureTimer) { alert("隊伍正在冒險中，請稍候！"); return; }
    
    const loc = LOCATIONS[locKey];
    if (state.money < loc.cost) { alert("旅費不足！"); return; }
    
    state.money -= loc.cost;
    updateMoneyDisplay();
    
    const statusEl = document.getElementById('adventure-status');
    statusEl.innerText = `🚀 前往【${loc.name}】中...`;
    
    // 開始計時
    state.adventureTimer = setTimeout(() => {
        // 冒險結束
        state.adventureTimer = null;
        statusEl.innerText = "狀態: 閒置中";
        
        // 計算掉落 (簡單機率：必定掉落 1~2 個東西)
        let drops = [];
        let dropCount = 1 + Math.floor(Math.random() * 2); // 1 或 2 個
        
        for(let i=0; i<dropCount; i++) {
            if (Math.random() < loc.dropRate) {
                let itemKey = loc.drops[Math.floor(Math.random() * loc.drops.length)];
                addItemToInventory(itemKey);
                drops.push(ITEMS[itemKey].name);
            }
        }
        
        if (drops.length > 0) {
            alert(`🎉 冒險歸來！獲得了：${drops.join(', ')}`);
        } else {
            alert("💸 這趟旅程什麼都沒找到...");
        }
    }, loc.time);
}

// --- 背包與合成邏輯 ---
function addItemToInventory(key) {
    state.inventory[key] = (state.inventory[key] || 0) + 1;
}

function renderInventory() {
    const grid = document.getElementById('inventory-grid');
    grid.innerHTML = "";
    
    // 如果背包是空的
    if (Object.keys(state.inventory).length === 0) {
        grid.innerHTML = "<p style='color:#666;'>背包空空如也，去冒險吧！</p>";
        return;
    }

    for (let key in state.inventory) {
        if (state.inventory[key] <= 0) continue;
        
        let item = ITEMS[key];
        let slot = document.createElement('div');
        slot.className = 'item-slot';
        if (state.selectedIngredients.includes(key)) slot.classList.add('selected');
        
        slot.innerHTML = `
            <div style="font-size:24px;">${item.icon}</div>
            <div style="font-size:12px;">${item.name}</div>
            <span class="item-count">x${state.inventory[key]}</span>
        `;
        
        slot.onclick = () => toggleIngredient(key);
        grid.appendChild(slot);
    }
}

function toggleIngredient(key) {
    const idx = state.selectedIngredients.indexOf(key);
    if (idx >= 0) {
        // 取消選取
        state.selectedIngredients.splice(idx, 1);
    } else {
        // 加入選取 (最多選 2 個)
        if (state.selectedIngredients.length < 2) {
            state.selectedIngredients.push(key);
        }
    }
    renderInventory();
    updateCraftingUI();
}

function updateCraftingUI() {
    const s1 = document.getElementById('slot-1');
    const s2 = document.getElementById('slot-2');
    const btn = document.getElementById('btn-craft');
    
    // 更新 Slot 1
    if (state.selectedIngredients[0]) {
        let item = ITEMS[state.selectedIngredients[0]];
        s1.innerText = item.icon;
        s1.classList.remove('empty');
    } else {
        s1.innerText = "➕";
        s1.classList.add('empty');
    }

    // 更新 Slot 2
    if (state.selectedIngredients[1]) {
        let item = ITEMS[state.selectedIngredients[1]];
        s2.innerText = item.icon;
        s2.classList.remove('empty');
    } else {
        s2.innerText = "➕";
        s2.classList.add('empty');
    }
    
    // 按鈕狀態
    btn.disabled = state.selectedIngredients.length !== 2;
}

function executeCraft() {
    const [ing1, ing2] = state.selectedIngredients;
    
    // 檢查配方
    let matchRecipe = RECIPES.find(r => {
        return (r.inputs.includes(ing1) && r.inputs.includes(ing2));
    });

    // 扣除原料
    state.inventory[ing1]--;
    state.inventory[ing2]--;
    
    if (matchRecipe) {
        const buildingKey = matchRecipe.result;
        const building = BUILDINGS[buildingKey];
        
        // 檢查是否已經解鎖過
        if (state.unlockedStalls.includes(buildingKey)) {
            alert(`🤔 你已經研發過【${building.name}】了！原料浪費了...`);
        } else {
            // 成功解鎖！
            state.unlockedStalls.push(buildingKey);
            alert(`✨ 研發大成功！\n\n新攤位【${building.name}】解鎖了！\n快去建造列表看看！`);
            
            // 強制切換到該分類並刷新 UI，讓玩家立刻看到
            state.uiCategory = building.category;
            initUI(); 
        }
    } else {
        alert("💥 碰！實驗失敗，變成了一堆黑暗料理...");
        addItemToInventory('trash'); // 給垃圾當安慰獎
    }
    
    // 重置介面
    state.selectedIngredients = [];
    renderInventory();
    updateCraftingUI();
}

let tutorialStep = 0;
const TUTORIAL_STEPS = [
    {
        title: "歡迎來到夜市！",
        text: "這是一片荒地，但你將把它變成黃金地段！<br>點擊「下一步」開始學習如何經營。",
        targetId: null
    },
    {
        title: "1. 鋪設道路",
        text: "客人需要路才進得來。<br>請切換到「設施」分類，選擇「道路」，並確保連通外部入口。",
        targetId: "category-tabs" // 高亮分類標籤
    },
    {
        title: "2. 建造攤位",
        text: "選擇一個小吃攤位（如大雞排），蓋在道路旁邊。<br>客人會自動排隊購買。",
        targetId: "tools-container" // 高亮工具列
    },
    {
        title: "3. 擴充地圖",
        text: "當生意變好時，記得點擊上方的「擴充地圖」來解鎖更多土地！",
        targetId: "btn-expand-map" // 高亮擴充按鈕
    },
    {
        title: "開始賺錢吧！",
        text: "注意垃圾清潔與資金周轉，祝你發大財！",
        targetId: null
    }
];

function initTutorial() {
    // 檢查是否第一次玩 (這裡簡單用 localStorage 判斷，或者每次開新局都顯示)
    // if (localStorage.getItem('hasPlayed')) return; 
    
    tutorialStep = 0;
    showTutorialStep();
}

function showTutorialStep() {
    const step = TUTORIAL_STEPS[tutorialStep];
    const overlay = document.getElementById('tutorial-overlay');
    const box = document.getElementById('tutorial-box');
    
    // 移除舊的高亮
    document.querySelectorAll('.highlight-element').forEach(el => el.classList.remove('highlight-element'));

    if (!step) {
        overlay.classList.add('hidden'); // 結束教學
        // localStorage.setItem('hasPlayed', 'true');
        return;
    }

    overlay.classList.remove('hidden');
    document.getElementById('tut-title').innerText = step.title;
    document.getElementById('tut-text').innerHTML = step.text;

    // 高亮目標元素
    if (step.targetId) {
        const target = document.getElementById(step.targetId);
        if (target) target.classList.add('highlight-element');
    }

    // 按鈕事件
    document.getElementById('tut-next-btn').onclick = () => {
        tutorialStep++;
        showTutorialStep();
    };
}