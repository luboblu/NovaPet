console.log("🐕 NovaPet Content Script Loaded");

// ================ 0. OpenAI API Key (可選功能) ================
const OPENAI_API_KEY = ""; // 如要開啟 AI 回應，可填入您的 API Key

// ================ 0.1 預設狗狗對話生成 ================
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
  const arr = dialogues[category] || dialogues.default;
  return arr[Math.floor(Math.random() * arr.length)];
}

// ================ 1. 狗狗管理器 ================
class DogManager {
  constructor() {
    this.dogContainer = null;        // 外層固定定位的容器
    this.dogDialog = null;           // 對話氣泡
    this.dogHouse = null;            // 狗屋圖示
    this.controlPanel = null;        // 控制面板（絕對定位，相對於 dogContainer）
    this.moveInterval = null;        // 隨機移動計時器
    this.isDragging = false;         // 拖曳狀態
    this.isFollowing = false;        // 跟隨滑鼠狀態
    this.controlPanelVisible = false;// 面板開關狀態

    // panelHorizontalMargin: 面板和狗狗之間的水平間距
    // 當面板放左側時，會從 dogContainer 的左邊 -panelWidth - margin
    // 如果放右側，會放在 dogWidth + margin 位置
    this.panelHorizontalMargin = 10;

    this.dogData = { name: 'NovaPet', personality: '活潑友善' };
    this.dogType = 'dog1'; // 預設狗種，晚點從 storage 覆蓋
  }

  // 從 chrome.storage.local 讀 dogType
  loadDogTypeFromStorage() {
    return new Promise(resolve => {
      chrome.storage.local.get(['dogType'], data => {
        this.dogType = data.dogType || 'dog1';
        resolve();
      });
    });
  }

  // 初始化狗狗
  async initializeDog(dogName, personality) {
    if (this.dogContainer) {
      this.removeDog();
    }
    this.dogData.name = dogName || 'NovaPet';
    this.dogData.personality = personality || '活潑友善';
    await this.loadDogTypeFromStorage();

    await this.createDogElements();
    this.createControlPanel();
    this.setupEventListeners();
    this.startAutoMovement();

    console.log(`🐕 ${this.dogData.name} 已經出現在頁面上！點擊狗狗顯示控制面板`);
  }

  // 建立狗狗及相關元素
  async createDogElements() {
    // 1. 建立外層 dogContainer（固定定位）
    this.dogContainer = document.createElement('div');
    Object.assign(this.dogContainer.style, {
      position: 'fixed',
      width: '100px',
      height: 'auto',
      zIndex: '10000',
      pointerEvents: 'auto',
      cursor: 'pointer',
      transition: 'none',
      // 隨機初始位置
      left: `${Math.random() * (window.innerWidth - 100)}px`,
      top: `${Math.random() * (window.innerHeight - 100)}px`
    });
    document.body.appendChild(this.dogContainer);

    // 2. 放置狗狗圖片
    const dogImg = document.createElement('img');
    let imgPath = 'images/dog.gif';
    if (this.dogType === 'dog1') {
      imgPath = 'images/white.png';
    } else if (this.dogType === 'dog2') {
      imgPath = 'images/golden.png';
    }
    dogImg.src = chrome.runtime.getURL(imgPath);
    Object.assign(dogImg.style, {
      width: '100%',
      height: 'auto',
      borderRadius: '10px',
      transition: 'transform 0.3s ease'
    });
    dogImg.onerror = () => {
      dogImg.style.display = 'none';
      const dogEmoji = document.createElement('div');
      dogEmoji.textContent = '🐕';
      Object.assign(dogEmoji.style, {
        fontSize: '80px',
        textAlign: 'center',
        transition: 'transform 0.3s ease'
      });
      this.dogContainer.appendChild(dogEmoji);
    };
    this.dogContainer.appendChild(dogImg);

    // 3. 建立對話氣泡（相對定位於 dogContainer）
    this.dogDialog = document.createElement('div');
    Object.assign(this.dogDialog.style, {
      position: 'absolute',
      left: '110px',
      top: '0px',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      border: '2px solid #a855f7',
      borderRadius: '15px',
      padding: '8px 12px',
      transition: 'opacity 0.3s ease',
      opacity: '0',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      fontSize: '14px',
      fontWeight: 'bold',
      color: '#333',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
    });
    this.dogContainer.appendChild(this.dogDialog);

    // 4. 建立狗屋圖示 (固定在螢幕右上方)
    this.dogHouse = document.createElement('div');
    this.dogHouse.textContent = '🏠';
    Object.assign(this.dogHouse.style, {
      position: 'fixed',
      fontSize: '60px',
      right: '20px',
      top: '20px',
      zIndex: '9999',
      opacity: '0.3',
      pointerEvents: 'none'
    });
    document.body.appendChild(this.dogHouse);

    // 顯示第一句「散步」對話
    await this.showDogDialogue("walk");
  }

  // 建立控制面板：改為「絕對定位」並 append 到 dogContainer 裡
  createControlPanel() {
    this.controlPanel = document.createElement('div');
    Object.assign(this.controlPanel.style, {
      position: 'absolute',        // 改成相對於 dogContainer
      width: '280px',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '20px',
      padding: '20px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
      zIndex: '10001',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      border: '1px solid rgba(168, 85, 247, 0.2)',

      // 初始隱藏
      opacity: '0',
      pointerEvents: 'none',
      transform: 'scale(0.8)',   // 縮到 0.8
      transition: 'opacity 0.1s ease, transform 0.1s ease'
    });

    // 面板的 inner HTML
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
        <button data-action="feed" style="background: linear-gradient(135deg, #ff6b9d, #ff8cc8); color: white; border: none; padding: 10px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">🍖 Feed</button>
        <button data-action="treat" style="background: linear-gradient(135deg, #ff6b9d, #ff8cc8); color: white; border: none; padding: 10px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">🦴 Treat</button>
        <button data-action="pet" style="background: linear-gradient(135deg, #ff6b9d, #ff8cc8); color: white; border: none; padding: 10px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">🤲 Pet</button>
        <button data-action="toy" style="background: linear-gradient(135deg, #ff6b9d, #ff8cc8); color: white; border: none; padding: 10px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">🎾 Toy</button>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px;">
        <button data-action="follow" style="background: linear-gradient(135deg, #ff6b9d, #ff8cc8); color: white; border: none; padding: 10px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">👣 Follow</button>
        <button data-action="stay" style="background: linear-gradient(135deg, #9ca3af, #6b7280); color: white; border: none; padding: 10px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">✋ Stay</button>
      </div>
      
      <button data-action="home" style="width: 100%; background: linear-gradient(135deg, #a855f7, #8b5cf6); color: white; border: none; padding: 12px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; margin-top: 5px;">🏠 Go back home</button>
      
      <div style="text-align: center; margin-top: 10px; font-size: 12px; color: #999;">點擊狗狗關閉面板</div>
    `;

    // 把 panel 放到 dogContainer 裡
    this.dogContainer.appendChild(this.controlPanel);

    // 按鈕懸停效果
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

  /**
   * updateControlPanelPosition(transition)
   *
   * 這裡不再操作 document.body 的 left/top，而是計算「相對於 dogContainer 的偏移」：
   *  1. 先拿 dogContainer 在整個視窗的 left、top、width。
   *  2. 計算 panelWidth、panelHeight。 margin 用 this.panelHorizontalMargin。
   *  3. 先試放「左側」：panelLeftRelative = -(panelWidth + margin)。
   *     ⇨ 若 dogContainer 的 dogLeft - (panelWidth + margin) < 0，就改放「右側」：
   *     panelLeftRelative = dogWidth + margin
   *  4. panelTopRelative = 0（與狗狗頂部對齊），若 dogTop + panelHeight 超出螢幕下邊，就 clamp：
   *     panelTopRelative = Math.min(0, window.innerHeight - panelHeight - dogTop)
   *  5. 最後設定 this.controlPanel.style.left/top（相對於 dogContainer）
   */
  updateControlPanelPosition(transition = '') {
    if (!this.dogContainer || !this.controlPanel) return;

    const dogRect = this.dogContainer.getBoundingClientRect();
    const dogLeft = dogRect.left;
    const dogTop = dogRect.top;
    const dogWidth = dogRect.width;

    // 取得面板尺寸
    const panelWidth = this.controlPanel.offsetWidth || 280;
    const panelHeight = this.controlPanel.offsetHeight || 300;
    const margin = this.panelHorizontalMargin;

    // 先計算狗狗「左側」應該放的相對位置：-(panelWidth + margin)
    let relLeft = -(panelWidth + margin);

    // 若放左側會跑出螢幕（dogLeft - panelWidth - margin < 0），就改放狗狗「右側」
    if (dogLeft - (panelWidth + margin) < 0) {
      relLeft = dogWidth + margin;
    }

    // 垂直位置先設定跟狗一樣頂端對齊
    let relTop = 0;

    // 如果 dogTop + 0 + panelHeight > 視窗高度，就 clamp relTop：
    if (dogTop + panelHeight > window.innerHeight) {
      // 讓面板下緣剛好貼近視窗底部：relTop = window.innerHeight - panelHeight - dogTop
      relTop = window.innerHeight - panelHeight - dogTop;
      // 若仍 < 0 (面板比螢幕還高)，就強制 relTop = 0
      if (relTop < 0) relTop = 0;
    }

    // 如果有傳 transition，就先套用到 panel
    if (transition) {
      this.controlPanel.style.transition = transition;
    }

    // 設定相對於 dogContainer 的定位
    this.controlPanel.style.left = `${relLeft}px`;
    this.controlPanel.style.top = `${relTop}px`;
  }

  // 切換控制面板顯示/隱藏
  toggleControlPanel() {
    this.controlPanelVisible = !this.controlPanelVisible;

    if (this.controlPanelVisible) {
      // 放大 & 淡入
      this.controlPanel.style.transition = 'opacity 0.1s ease, transform 0.1s ease';
      this.controlPanel.style.opacity = '1';
      this.controlPanel.style.pointerEvents = 'auto';
      this.controlPanel.style.transform = 'scale(1)';
      // 立刻更新位置（因為 dogContainer 可能動到邊界，所以要重新計算左右）
      this.updateControlPanelPosition();
      this.showDogDialogue("click");
    } else {
      // 縮小 & 淡出
      this.controlPanel.style.transition = 'opacity 0.1s ease, transform 0.1s ease';
      this.controlPanel.style.opacity = '0';
      this.controlPanel.style.transform = 'scale(0.8)';
      this.controlPanel.style.pointerEvents = 'none';
    }
  }

  // 綁定面板按鈕事件
  setupControlPanelEvents() {
    this.controlPanel.addEventListener('click', async (e) => {
      const action = e.target.dataset.action;
      if (!action) return;
      // 點擊後先收起面板
      this.controlPanelVisible = true;
      this.toggleControlPanel();

      switch (action) {
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

  // 回家動畫：狗與面板一起平滑移動
  async goHomeAnimation() {
    await this.showDogDialogue("home");
    this.stopAutoMovement();
    this.isFollowing = false;

    // 先設定相同 transition 給 dogContainer，panel 只要在 dogContainer 裡，就會自動跟著移動
    this.dogContainer.style.transition = 'all 2s ease-in-out';

    // 狗狗移到右上角（簡單用 top=20 + right=20）
    this.dogContainer.style.top = '20px';
    this.dogContainer.style.left = 'auto';
    this.dogContainer.style.right = '20px';

    // 反白提示要將 panel 從絕對左/右兩邊重新計算
    // 由於 dogContainer 已移到右上方，updateControlPanelPosition() 會自動把 panel 放到狗的左側（因為右側擺不下）
    this.updateControlPanelPosition('all 2s ease-in-out');

    setTimeout(() => {
      // 淡出效果
      this.dogContainer.style.opacity = '0';
      this.dogContainer.style.transform = 'scale(0.8)';
      if (this.controlPanelVisible) {
        this.controlPanel.style.opacity = '0';
        this.controlPanel.style.transform = 'scale(0.8)';
      }
      setTimeout(() => {
        this.removeDog();
        console.log(`🏠 ${this.dogData.name} 回家囉！`);
      }, 1000);
    }, 2000);
  }

  // 切換跟隨滑鼠模式
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

  // 跟隨滑鼠：狗與面板同時做 0.8s 緩動
  followMouse(e) {
    if (!this.isFollowing || this.isDragging) return;
    const targetX = e.clientX - 50;
    const targetY = e.clientY - 50;

    // 設定 dogContainer 的平滑移動
    this.dogContainer.style.transition = 'all 0.8s ease-out';
    this.dogContainer.style.left = `${Math.max(0, Math.min(window.innerWidth - 100, targetX))}px`;
    this.dogContainer.style.top = `${Math.max(0, Math.min(window.innerHeight - 100, targetY))}px`;

    // panel 會跟著 container 自動移動，但要重新計算左右
    this.updateControlPanelPosition('all 0.8s ease-out');
  }

  // 停留模式：暫停隨機移動
  stayMode() {
    this.stopAutoMovement();
    this.isFollowing = false;
    this.showDogDialogue("stay");
    setTimeout(() => {
      if (!this.isFollowing) this.startAutoMovement();
    }, 3000);
  }

  // 綁定狗狗的各項事件：點擊、拖曳、放開、懸停
  setupEventListeners() {
    let offsetX = 0, offsetY = 0, clickTimer = null;

    // 按下時判斷是否拖曳
    this.dogContainer.addEventListener('mousedown', (e) => {
      clickTimer = setTimeout(() => {
        this.isDragging = true;
        // 拖曳期間取消所有 transition
        this.dogContainer.style.transition = 'none';
        this.controlPanel.style.transition = 'none';
        this.dogContainer.style.cursor = 'grabbing';
        const rect = this.dogContainer.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
      }, 150);
    });

    // 放開時若沒有拖曳，就算點擊；若拖曳中，就結束拖曳
    this.dogContainer.addEventListener('mouseup', (e) => {
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        if (!this.isDragging) {
          e.stopPropagation();
          this.toggleControlPanel();
        }
      }
      if (this.isDragging) {
        this.isDragging = false;
        this.dogContainer.style.cursor = 'pointer';
      }
    });

    // 拖曳過程：即時更新 dogContainer 與 panel 位置，無 transition
    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      e.preventDefault();
      let x = e.clientX - offsetX;
      let y = e.clientY - offsetY;
      x = Math.max(0, Math.min(window.innerWidth - this.dogContainer.offsetWidth, x));
      y = Math.max(0, Math.min(window.innerHeight - this.dogContainer.offsetHeight, y));
      // 更新狗的位置
      this.dogContainer.style.left = `${x}px`;
      this.dogContainer.style.top = `${y}px`;
      // 透過無 transition 模式，讓 panel 緊貼
      this.updateControlPanelPosition('none');
    });

    // 點擊到其他地方：如果 panel 是開啟，就把它關閉
    document.addEventListener('click', (e) => {
      if (
        this.controlPanelVisible &&
        !this.controlPanel.contains(e.target) &&
        !this.dogContainer.contains(e.target)
      ) {
        this.controlPanelVisible = true;
        this.toggleControlPanel();
      }
    });

    // 懸停狗狗時放大
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

  // 隨機移動：dogContainer 用 4s 線性動畫，panel 跟著 container 本身移動
  startAutoMovement() {
    if (this.moveInterval) return;
    this.moveInterval = setInterval(() => {
      if (!this.isFollowing) this.moveDogRandomly();
    }, 6000);
  }

  stopAutoMovement() {
    if (this.moveInterval) {
      clearInterval(this.moveInterval);
      this.moveInterval = null;
    }
  }

  async moveDogRandomly() {
    if (this.isDragging || !this.dogContainer || this.isFollowing) return;
    this.dogContainer.style.transition = 'all 4s linear';

    const x = Math.random() * (window.innerWidth - this.dogContainer.offsetWidth);
    const y = Math.random() * (window.innerHeight - this.dogContainer.offsetHeight);
    // 先設定狗狗目標位置
    this.dogContainer.style.left = `${x}px`;
    this.dogContainer.style.top = `${y}px`;

    // 由於 panel 是 dogContainer 的子元素，它會自動跟著移動
    // 但要重新計算「左側或右側」，這裡也同步做一個無 transition 切換，
    // 讓 panel 緊貼狗狗容器。如果放左側已經超出螢幕，就會切到右側。
    this.updateControlPanelPosition('none');

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
      if (this.dogDialog) this.dogDialog.style.opacity = '0';
    }, 3000);
  }

  // 處理 popup.js 傳來的指令
  async performAction(action, data = {}) {
    if (!this.dogContainer) return;
    switch (action) {
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

  // 飛行表情動畫
  addHappinessEffect(emoji) {
    const effect = document.createElement('div');
    effect.innerHTML = emoji;
    Object.assign(effect.style, {
      position: 'absolute',
      top: '-30px',
      left: '50%',
      transform: 'translateX(-50%)',
      fontSize: '24px',
      zIndex: '10001',
      transition: 'all 2s ease',
      pointerEvents: 'none'
    });
    this.dogContainer.appendChild(effect);
    setTimeout(() => {
      effect.style.top = '-60px';
      effect.style.opacity = '0';
    }, 100);
    setTimeout(() => {
      if (effect.parentNode) effect.parentNode.removeChild(effect);
    }, 2100);
  }

  // 公園模式
  async parkMode() {
    this.stopAutoMovement();
    this.isFollowing = false;
    await this.showDogDialogue("park");
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.moveDogRandomly();
      }, i * 2000);
    }
    setTimeout(() => {
      if (!this.isFollowing) this.startAutoMovement();
    }, 6000);
  }

  // 移除所有元素
  removeDog() {
    this.stopAutoMovement();
    this.stopFollowMode();
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
    console.log("🐕 狗狗已離開頁面");
  }
}

// ================ 2. 全域 DogManager 實例 ================
const dogManager = new DogManager();

// ================ 3. 監聽 Popup 發送的訊息 ================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("📨 收到來自 popup 的消息:", message);
  const { action, dogName, personality } = message;
  switch (action) {
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
      sendResponse({ success: true, message: '狗狗已離開頁面' });
      break;
    default:
      sendResponse({ success: false, message: '未知的動作' });
  }
  return true;
});

// ================ 4. DOMContentLoaded 後 ================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log("🎯 NovaPet Content Script Ready");
  });
} else {
  console.log("🎯 NovaPet Content Script Ready");
}

console.log("✅ NovaPet Content Script 載入完成！等待來自 popup 的指令...");
