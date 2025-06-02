console.log("🐕 NovaPet Content Script Loaded");

// ================ 0. OpenAI API Key (可選功能) ================
const OPENAI_API_KEY = ""; // 可以留空，如果沒有就使用預設對話

// ================ 0.1 狗狗對話生成 ================
async function generateDogDialogue(personality, dogName, action = "") {
  let dialogue;
  
  if (OPENAI_API_KEY) {
    try {
      dialogue = getDefaultDialogue(action);
    } catch (err) {
      console.error("OpenAI API Error:", err);
      dialogue = getDefaultDialogue(action);
    }
  } else {
    dialogue = getDefaultDialogue(action);
  }
  
  return dialogue;
}

// 預設對話庫
function getDefaultDialogue(action) {
  const dialogues = {
    walk: ["汪汪！散步好開心～", "我要出去玩囉！", "汪！外面好好玩", "散步時間到～汪！"],
    feed: ["謝謝主人！好好吃", "汪汪！我吃飽了", "好香的食物～", "主人最棒了！"],
    treat: ["零食耶！汪汪", "好開心～謝謝", "我最愛零食了", "汪！超好吃的"],
    toy: ["玩具！我要玩", "汪汪！好好玩", "陪我玩嘛～", "這個玩具好棒"],
    pet: ["好舒服～", "摸摸我～汪", "我喜歡被摸", "再摸一下"],
    follow: ["我跟著你走", "汪！跟上", "主人在哪裡", "我來了"],
    stay: ["我會乖乖的", "汪！我不動", "我在這裡等", "好的主人"],
    home: ["我要回家了", "汪汪再見", "家最溫暖", "拜拜～"],
    click: ["汪？你叫我嗎", "什麼事～", "我在這裡", "汪汪！"],
    default: ["汪汪～", "我好開心", "主人～陪我玩", "汪！愛你喔", "今天天氣真好", "我是乖狗狗"]
  };
  
  const category = action ? action : 'default';
  const selectedDialogues = dialogues[category] || dialogues.default;
  return selectedDialogues[Math.floor(Math.random() * selectedDialogues.length)];
}

// ================ 1. 同步移動狗狗管理系統 ================
class DogManager {
  constructor() {
    this.dogContainer = null;
    this.dogDialog = null;
    this.dogHouse = null;
    this.controlPanel = null;
    this.moveInterval = null;
    this.syncInterval = null; // 新增：同步監控間隔
    this.isDragging = false;
    this.isFollowing = false;
    this.controlPanelVisible = false;
    this.panelOffset = { x: 120, y: 0 }; // 固定相對位置：狗狗右邊120px
    this.dogData = {
      name: 'NovaPet',
      personality: '活潑友善'
    };
  }

  // 初始化狗狗
  async initializeDog(dogName, personality) {
    if (this.dogContainer) {
      this.removeDog();
    }

    this.dogData.name = dogName || 'NovaPet';
    this.dogData.personality = personality || '活潑友善';

    await this.createDogElements();
    this.createControlPanel();
    this.setupEventListeners();
    this.startAutoMovement();
    this.startSyncMonitor(); // 新增：啟動同步監控
    
    console.log(`🐕 ${this.dogData.name} 已經出現在桌面上！點擊狗狗顯示控制面板`);
  }

  // 新增：同步監控系統
  startSyncMonitor() {
    // 每 100ms 檢查一次位置同步
    this.syncInterval = setInterval(() => {
      if (this.controlPanelVisible && !this.isDragging) {
        this.updateControlPanelPosition();
      }
    }, 100);
  }

  stopSyncMonitor() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // 創建狗狗相關元素
  async createDogElements() {
    // 1. 建立狗狗容器
    this.dogContainer = document.createElement('div');
    this.dogContainer.style.position = 'fixed';
    this.dogContainer.style.width = '100px';
    this.dogContainer.style.height = 'auto';
    this.dogContainer.style.zIndex = '10000';
    this.dogContainer.style.pointerEvents = 'auto';
    this.dogContainer.style.cursor = 'pointer';
    this.dogContainer.style.transition = 'none';
    
    // 隨機初始位置
    this.dogContainer.style.left = Math.random() * (window.innerWidth - 100) + 'px';
    this.dogContainer.style.top = Math.random() * (window.innerHeight - 100) + 'px';
    
    document.body.appendChild(this.dogContainer);

    // 2. 建立狗狗圖片
    const dog = document.createElement('img');
    dog.src = chrome.runtime.getURL('images/dog.gif');
    dog.style.width = '100%';
    dog.style.height = 'auto';
    dog.style.borderRadius = '10px';
    dog.style.transition = 'transform 0.3s ease';
    dog.onerror = () => {
      dog.style.display = 'none';
      const dogEmoji = document.createElement('div');
      dogEmoji.innerHTML = '🐕';
      dogEmoji.style.fontSize = '80px';
      dogEmoji.style.textAlign = 'center';
      dogEmoji.style.transition = 'transform 0.3s ease';
      this.dogContainer.appendChild(dogEmoji);
    };
    this.dogContainer.appendChild(dog);

    // 3. 建立對話框
    this.dogDialog = document.createElement('div');
    this.dogDialog.style.position = 'absolute';
    this.dogDialog.style.left = '110px';
    this.dogDialog.style.top = '0px';
    this.dogDialog.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    this.dogDialog.style.border = '2px solid #a855f7';
    this.dogDialog.style.borderRadius = '15px';
    this.dogDialog.style.padding = '8px 12px';
    this.dogDialog.style.transition = 'opacity 0.5s ease';
    this.dogDialog.style.opacity = '0';
    this.dogDialog.style.pointerEvents = 'none';
    this.dogDialog.style.whiteSpace = 'nowrap';
    this.dogDialog.style.display = 'inline-block';
    this.dogDialog.style.maxWidth = 'none';
    this.dogDialog.style.fontSize = '14px';
    this.dogDialog.style.fontWeight = 'bold';
    this.dogDialog.style.color = '#333';
    this.dogDialog.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    this.dogContainer.appendChild(this.dogDialog);

    // 4. 建立狗屋 (簡化版，隱藏)
    this.dogHouse = document.createElement('div');
    this.dogHouse.innerHTML = '🏠';
    this.dogHouse.style.position = 'fixed';
    this.dogHouse.style.fontSize = '60px';
    this.dogHouse.style.right = '20px';
    this.dogHouse.style.top = '20px';
    this.dogHouse.style.zIndex = '9999';
    this.dogHouse.style.opacity = '0.3';
    this.dogHouse.style.pointerEvents = 'none';
    document.body.appendChild(this.dogHouse);

    // 顯示歡迎對話
    await this.showDogDialogue("walk");
  }

  // 創建控制面板（初始隱藏）
  createControlPanel() {
    this.controlPanel = document.createElement('div');
    this.controlPanel.style.position = 'fixed';
    this.controlPanel.style.width = '280px';
    this.controlPanel.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
    this.controlPanel.style.borderRadius = '20px';
    this.controlPanel.style.padding = '20px';
    this.controlPanel.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.2)';
    this.controlPanel.style.zIndex = '10001';
    this.controlPanel.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    this.controlPanel.style.border = '1px solid rgba(168, 85, 247, 0.2)';
    
    // 初始隱藏
    this.controlPanel.style.opacity = '0';
    this.controlPanel.style.pointerEvents = 'none';
    this.controlPanel.style.transform = 'scale(0.8)';
    this.controlPanel.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';

    this.controlPanel.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 15px;">
        <div style="flex: 1;">
          <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 4px;">
            ${this.dogData.name} 控制台
          </div>
          <div style="font-size: 12px; color: #666;">
            虛擬寵物控制面板
          </div>
        </div>
        <div style="width: 50px; height: 50px; background: #f0f0f0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px;">
          🐕
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px;">
        <button data-action="feed" style="background: linear-gradient(135deg, #ff6b9d, #ff8cc8); color: white; border: none; padding: 10px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">
          🍖 Feed
        </button>
        <button data-action="treat" style="background: linear-gradient(135deg, #ff6b9d, #ff8cc8); color: white; border: none; padding: 10px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">
          🦴 Treat
        </button>
        <button data-action="pet" style="background: linear-gradient(135deg, #ff6b9d, #ff8cc8); color: white; border: none; padding: 10px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">
          🤲 Pet
        </button>
        <button data-action="toy" style="background: linear-gradient(135deg, #ff6b9d, #ff8cc8); color: white; border: none; padding: 10px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">
          🎾 Toy
        </button>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px;">
        <button data-action="follow" style="background: linear-gradient(135deg, #ff6b9d, #ff8cc8); color: white; border: none; padding: 10px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">
          👣 Follow
        </button>
        <button data-action="stay" style="background: linear-gradient(135deg, #9ca3af, #6b7280); color: white; border: none; padding: 10px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">
          ✋ Stay
        </button>
      </div>
      
      <button data-action="home" style="width: 100%; background: linear-gradient(135deg, #a855f7, #8b5cf6); color: white; border: none; padding: 12px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; margin-top: 5px;">
        🏠 Go back home
      </button>
      
      <div style="text-align: center; margin-top: 10px; font-size: 12px; color: #999;">
        點擊狗狗關閉面板
      </div>
    `;

    document.body.appendChild(this.controlPanel);

    // 為按鈕添加懸停效果
    const buttons = this.controlPanel.querySelectorAll('button[data-action]');
    buttons.forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-2px)';
        btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = 'none';
      });
    });

    this.setupControlPanelEvents();
  }

  // 新增：強制同步更新控制面板位置
  updateControlPanelPosition(transition = '') {
    if (!this.dogContainer || !this.controlPanel || !this.controlPanelVisible) return;

    // 使用 requestAnimationFrame 確保獲取正確的位置
    requestAnimationFrame(() => {
      const dogStyle = this.dogContainer.style;
      const dogLeft = parseInt(dogStyle.left) || 0;
      const dogTop = parseInt(dogStyle.top) || 0;
      
      const panelWidth = 280;
      const margin = 20;

      // 基於狗狗的 style 位置計算，而不是 getBoundingClientRect
      let targetX = dogLeft + this.panelOffset.x;
      let targetY = dogTop + this.panelOffset.y;

      // 檢查邊界並調整
      if (targetX + panelWidth > window.innerWidth) {
        targetX = dogLeft - panelWidth - margin;
        this.panelOffset.x = -panelWidth - margin;
      } else if (targetX < 0) {
        targetX = dogLeft + 120;
        this.panelOffset.x = 120;
      }

      if (targetY < 0) {
        targetY = 0;
      } else if (targetY + 300 > window.innerHeight) {
        targetY = window.innerHeight - 300;
      }

      // 設置過渡效果
      if (transition) {
        this.controlPanel.style.transition = transition;
      }

      // 強制同步位置
      this.controlPanel.style.left = targetX + 'px';
      this.controlPanel.style.top = targetY + 'px';
    });
  }

  // 切換控制面板顯示
  toggleControlPanel() {
    this.controlPanelVisible = !this.controlPanelVisible;
    
    if (this.controlPanelVisible) {
      // 顯示控制面板時立即同步位置
      this.controlPanel.style.opacity = '1';
      this.controlPanel.style.pointerEvents = 'auto';
      this.controlPanel.style.transform = 'scale(1)';
      
      // 強制立即更新位置
      setTimeout(() => {
        this.updateControlPanelPosition();
      }, 0);
      
      // 狗狗說話
      this.showDogDialogue("click");
    } else {
      // 隱藏控制面板
      this.controlPanel.style.opacity = '0';
      this.controlPanel.style.pointerEvents = 'none';
      this.controlPanel.style.transform = 'scale(0.8)';
    }
  }

  // 設置控制面板事件
  setupControlPanelEvents() {
    this.controlPanel.addEventListener('click', async (e) => {
      const action = e.target.dataset.action;
      if (!action) return;

      // 執行動作後隱藏控制面板
      this.controlPanelVisible = true;
      this.toggleControlPanel();

      switch(action) {
        case 'feed':
          await this.showDogDialogue("feed");
          this.addHappinessEffect('🍖');
          break;
          
        case 'treat':
          await this.showDogDialogue("treat");
          this.addHappinessEffect('🦴');
          break;
          
        case 'pet':
          await this.showDogDialogue("pet");
          this.addHappinessEffect('💝');
          break;
          
        case 'toy':
          await this.showDogDialogue("toy");
          this.addHappinessEffect('🎾');
          break;
          
        case 'follow':
          this.toggleFollowMode();
          break;
          
        case 'stay':
          this.stayMode();
          break;
          
        case 'home':
          await this.goHomeAnimation();
          break;
      }
    });
  }

  // 回家動畫
  async goHomeAnimation() {
    await this.showDogDialogue("home");
    
    // 停止所有移動
    this.stopAutoMovement();
    this.isFollowing = false;
    
    // 移動到右上角
    this.dogContainer.style.transition = 'all 2s ease-in-out';
    this.updateControlPanelPosition('all 2s ease-in-out'); // 控制面板同步移動
    
    this.dogContainer.style.right = '20px';
    this.dogContainer.style.top = '20px';
    this.dogContainer.style.left = 'auto';
    
    // 2秒後開始淡出
    setTimeout(() => {
      this.dogContainer.style.opacity = '0';
      this.dogContainer.style.transform = 'scale(0.8)';
      if (this.controlPanelVisible) {
        this.controlPanel.style.opacity = '0';
        this.controlPanel.style.transform = 'scale(0.8)';
      }
      
      // 3秒後完全移除
      setTimeout(() => {
        this.removeDog();
        console.log(`🏠 ${this.dogData.name} 回家囉！`);
      }, 1000);
    }, 2000);
  }

  // 跟隨模式切換
  toggleFollowMode() {
    this.isFollowing = !this.isFollowing;
    
    if (this.isFollowing) {
      this.stopAutoMovement();
      this.startFollowMode();
      this.showDogDialogue("follow");
    } else {
      this.stopFollowMode();
      this.startAutoMovement();
      this.showDogDialogue("我自由了～");
    }
  }

  startFollowMode() {
    document.addEventListener('mousemove', this.followMouse.bind(this));
  }

  stopFollowMode() {
    document.removeEventListener('mousemove', this.followMouse.bind(this));
  }

  followMouse(e) {
    if (!this.isFollowing || this.isDragging) return;
    
    const targetX = e.clientX - 50;
    const targetY = e.clientY - 50;
    
    // 同步移動狗狗和控制面板
    this.dogContainer.style.transition = 'all 0.8s ease-out';
    this.dogContainer.style.left = Math.max(0, Math.min(window.innerWidth - 100, targetX)) + 'px';
    this.dogContainer.style.top = Math.max(0, Math.min(window.innerHeight - 100, targetY)) + 'px';

    // 立即同步控制面板位置
    this.updateControlPanelPosition('all 0.8s ease-out');
  }

  // 停留模式
  stayMode() {
    this.stopAutoMovement();
    this.isFollowing = false;
    this.showDogDialogue("stay");
    
    setTimeout(() => {
      if (!this.isFollowing) {
        this.startAutoMovement();
      }
    }, 3000);
  }

  // 設定事件監聽器
  setupEventListeners() {
    let offsetX = 0;
    let offsetY = 0;
    let clickTimer = null;

    // 狗狗點擊事件
    this.dogContainer.addEventListener('mousedown', (e) => {
      clickTimer = setTimeout(() => {
        // 這是拖曳
        this.isDragging = true;
        this.dogContainer.style.transition = 'none';
        this.dogContainer.style.cursor = 'grabbing';

        const rect = this.dogContainer.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
      }, 150);
    });

    this.dogContainer.addEventListener('mouseup', (e) => {
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        
        if (!this.isDragging) {
          // 這是點擊
          e.stopPropagation();
          this.toggleControlPanel();
        }
      }
      
      if (this.isDragging) {
        this.isDragging = false;
        this.dogContainer.style.cursor = 'pointer';
      }
    });

    // 拖曳移動
    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      e.preventDefault();

      let x = e.clientX - offsetX;
      let y = e.clientY - offsetY;

      x = Math.max(0, Math.min(window.innerWidth - this.dogContainer.offsetWidth, x));
      y = Math.max(0, Math.min(window.innerHeight - this.dogContainer.offsetHeight, y));

      // 同步移動狗狗和控制面板
      this.dogContainer.style.left = x + 'px';
      this.dogContainer.style.top = y + 'px';

      // 控制面板即時跟隨（無動畫）
      this.updateControlPanelPosition('none');
    });

    // 點擊其他地方隱藏控制面板
    document.addEventListener('click', (e) => {
      if (this.controlPanelVisible && 
          !this.controlPanel.contains(e.target) && 
          !this.dogContainer.contains(e.target)) {
        this.controlPanelVisible = true;
        this.toggleControlPanel();
      }
    });

    // 狗狗懸停效果
    this.dogContainer.addEventListener('mouseenter', () => {
      if (!this.isDragging) {
        this.dogContainer.querySelector('img, div').style.transform = 'scale(1.1)';
      }
    });

    this.dogContainer.addEventListener('mouseleave', () => {
      if (!this.isDragging) {
        this.dogContainer.querySelector('img, div').style.transform = 'scale(1)';
      }
    });
  }

  // 自動移動
  startAutoMovement() {
    if (this.moveInterval) return;
    
    this.moveInterval = setInterval(() => {
      if (!this.isFollowing) {
        this.moveDogRandomly();
      }
    }, 6000);
  }

  stopAutoMovement() {
    if (this.moveInterval) {
      clearInterval(this.moveInterval);
      this.moveInterval = null;
    }
  }

  async moveDogRandomly() {
    if (this.isDragging || this.dogContainer.style.display === 'none' || this.isFollowing) return;

    // 同步移動狗狗和控制面板
    this.dogContainer.style.transition = 'all 4s linear';
    
    const x = Math.random() * (window.innerWidth - this.dogContainer.offsetWidth);
    const y = Math.random() * (window.innerHeight - this.dogContainer.offsetHeight);
    
    this.dogContainer.style.left = x + 'px';
    this.dogContainer.style.top = y + 'px';

    // 立即同步控制面板位置
    this.updateControlPanelPosition('all 4s linear');

    setTimeout(async () => {
      await this.showDogDialogue();
    }, 4000);
  }

  // 顯示對話
  async showDogDialogue(action = "") {
    if (!this.dogDialog) return;
    
    const dialogue = await generateDogDialogue(this.dogData.personality, this.dogData.name, action);
    
    this.dogDialog.textContent = dialogue;
    this.dogDialog.style.opacity = '1';

    setTimeout(() => {
      if (this.dogDialog) {
        this.dogDialog.style.opacity = '0';
      }
    }, 3000);
  }

  // 執行特定動作
  async performAction(action, data = {}) {
    if (!this.dogContainer) return;

    switch(action) {
      case 'START_WALKING':
        await this.showDogDialogue("walk");
        break;
        
      case 'FEED_DOG':
        await this.showDogDialogue("feed");
        this.addHappinessEffect('🍖');
        break;
        
      case 'GIVE_TREAT':
        await this.showDogDialogue("treat");
        this.addHappinessEffect('🦴');
        break;
        
      case 'PLAY_TOY':
        await this.showDogDialogue("toy");
        this.addHappinessEffect('🎾');
        break;
        
      case 'GO_TO_PARK':
        this.parkMode();
        break;
    }
  }

  // 添加開心效果
  addHappinessEffect(emoji) {
    const effect = document.createElement('div');
    effect.innerHTML = emoji;
    effect.style.position = 'absolute';
    effect.style.top = '-30px';
    effect.style.left = '50%';
    effect.style.transform = 'translateX(-50%)';
    effect.style.fontSize = '24px';
    effect.style.zIndex = '10001';
    effect.style.transition = 'all 2s ease';
    effect.style.pointerEvents = 'none';
    
    this.dogContainer.appendChild(effect);
    
    setTimeout(() => {
      effect.style.top = '-60px';
      effect.style.opacity = '0';
    }, 100);
    
    setTimeout(() => {
      if (effect.parentNode) {
        effect.parentNode.removeChild(effect);
      }
    }, 2100);
  }

  // 公園模式
  async parkMode() {
    this.stopAutoMovement();
    this.isFollowing = false;
    
    await this.showDogDialogue("我要在公園跑步～");
    
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.moveDogRandomly();
      }, i * 2000);
    }
    
    setTimeout(() => {
      if (!this.isFollowing) {
        this.startAutoMovement();
      }
    }, 6000);
  }

  // 移除狗狗
  removeDog() {
    this.stopAutoMovement();
    this.stopFollowMode();
    this.stopSyncMonitor(); // 停止同步監控
    
    if (this.dogContainer) {
      this.dogContainer.remove();
      this.dogContainer = null;
    }
    if (this.dogHouse) {
      this.dogHouse.remove();
      this.dogHouse = null;
    }
    if (this.controlPanel) {
      this.controlPanel.remove();
      this.controlPanel = null;
    }
    
    console.log("🐕 狗狗已離開桌面");
  }
}

// ================ 2. 全局狗狗管理器 ================
const dogManager = new DogManager();

// ================ 3. 監聽來自 popup 的消息 ================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("📨 收到來自 popup 的消息:", message);
  
  const { action, dogName, personality } = message;
  
  switch(action) {
    case 'START_WALKING':
      dogManager.initializeDog(dogName, personality);
      sendResponse({ success: true, message: `${dogName} 開始散步！點擊狗狗顯示控制面板` });
      break;
      
    case 'FEED_DOG':
    case 'GIVE_TREAT':
    case 'PLAY_TOY':
    case 'GO_TO_PARK':
      dogManager.performAction(action, message);
      sendResponse({ success: true, message: `${dogName} 執行了 ${action}` });
      break;
      
    case 'REMOVE_DOG':
      dogManager.removeDog();
      sendResponse({ success: true, message: '狗狗已離開' });
      break;
      
    default:
      sendResponse({ success: false, message: '未知的動作' });
  }
  
  return true;
});

// ================ 4. 頁面載入完成後的初始化 ================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log("🎯 NovaPet Content Script Ready");
  });
} else {
  console.log("🎯 NovaPet Content Script Ready");
}

console.log("✅ NovaPet Content Script 載入完成！等待來自 popup 的指令...");