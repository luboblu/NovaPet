console.log("🐕 NovaPet Content Script Loaded");
// 監聽 storage 變化，自動移除寵物
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.roomCode) {
    if (!changes.roomCode.newValue && changes.roomCode.oldValue) {
      console.log('🔔 偵測到退出房間，自動移除寵物');
      dogManager.removeDog();
    }
  }
});

// 監聽擴充功能的連接狀態
chrome.runtime.onConnect.addListener((port) => {
  console.log('🔌 擴充功能連接建立');
  port.onDisconnect.addListener(() => {
    console.log('🔌 擴充功能斷開連接，移除寵物');
    dogManager.removeDog();
  });
});
// ================ 0. OpenAI API Key (可選功能) ================
const OPENAI_API_KEY = "";

// ================ 0.1 預設寵物對話生成 ================
async function generatePetDialogue(personality, petName, action = "") { // Renamed from generateDogDialogue
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
    return getDefaultDialogue(action);
  }
  
  try {
    const actionContexts = {
      walk: "You are excited about going for a walk",
      feed: "You just got fed and are happy",
      treat: "You received a delicious treat",
      toy: "You are playing with your favorite toy",
      pet: "You are being petted and feeling loved",
      follow: "You are following your owner",
      stay: "You are being told to stay and wait",
      home: "You are going back home",
      click: "Your owner just clicked on you to get your attention",
      park: "You are at the dog park/cat cafe having fun", // Generic fun place
      default: "You are just being a happy pet"
    };
    
    const context = actionContexts[action] || actionContexts.default;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a virtual pet named ${petName}. Your personality is: ${personality}.
            
IMPORTANT RULES:
- Respond in a cute, playful pet manner (dog-like or cat-like as appropriate).
- Use sounds like "woof", "arf", "meow", "purr" naturally.
- Keep responses VERY short (under 15 words).
- Show your unique personality traits in every response.
- Use simple actions in asterisks like *wags tail*, *rubs leg*, *jumps*, *tilts head*.
- Be emotional and expressive.
- NEVER use complex sentences.
- Respond in English only.

Current situation: ${context}`
          },
          {
            role: 'user',
            content: 'React to this situation as a pet would'
          }
        ],
        temperature: 0.9,
        max_tokens: 30,
        presence_penalty: 0.6,
        frequency_penalty: 0.5
      })
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content.trim();
    
  } catch (error) {
    console.error('❌ OpenAI API Error:', error);
    return getDefaultDialogue(action);
  }
}

function getDefaultDialogue(action) {
  const dialogues = { // Generic, or could be split by pet type if needed
    walk: ["Woof! Walk time!", "Yay! Outside!", "Meow! Let's explore!", "Adventure time!"],
    feed: ["Yum yum! Thank you!", "So tasty! *licks lips*", "Purrrr... delicious!", "More please!"],
    treat: ["Treats! Woof woof!", "*does happy dance*", "Mrow! My favorite!", "So yummy!"],
    toy: ["Play time! *wags tail*", "My toy! Mine!", "Pounce! So much fun!", "Bat bat!"],
    pet: ["*happy wiggling*", "Love you too!", "More pets please!", "*leans into hand*", "Purrrrr..."],
    follow: ["Following you!", "Where we going?", "Right behind you!", "*trots along*"],
    stay: ["I'll be good", "*sits patiently*", "Waiting here!", "Okay... *whimpers softly*"],
    home: ["Home sweet home!", "Bye bye! *waves paw*", "See you later!", "Time to go!"],
    click: ["You called? *tilts head*", "What's up?", "Mrow?", "Yes? *perks ears*"],
    park: ["Park! Park! *spins*", "Friends everywhere!", "Best day ever!", "So many smells!"],
    default: ["*wags tail*", "Woof!", "Meow!", "Love you!", "*happy bounce*", "Hi there!", "Pet me!"]
  };
  
  const category = dialogues[action] || dialogues.default;
  return category[Math.floor(Math.random() * category.length)];
}

// ================ 1. 寵物管理器 (PetManager) ================
class PetManager  { // Renamed from DogManager
  constructor() {
    this.petContainer = null;        // Renamed from dogContainer
    this.petDialog = null;           // Renamed from dogDialog
    this.petHouse = null;            // Renamed from dogHouse
    this.controlPanel = null;
    this.moveInterval = null;
    this.isDragging = false;
    this.isFollowing = false;
    this.controlPanelVisible = false;
    this.panelHorizontalMargin = 10;

    this.petData = { name: 'NovaPet', personality: '活潑友善' }; // Renamed from dogData
    this.petType = 'dog1'; // Default, will be overridden by loadPetTypeFromStorage
    
    this.dog1MoodImages = [ 
      'images/Dog_calm.png', 'images/Dog_confuse.png', 'images/Dog_excited.png',
      'images/Dog_happy.png', 'images/Dog_sad.png', 'images/Dog_sleepy.png' 
    ];
    this.cat1MoodImages = [ 
      'images/Cat_calm.png', 'images/Cat_confuse.png', 'images/Cat_excited.png',
      'images/Cat_happy.png', 'images/Cat_sad.png', 'images/Cat_sleepy.png'
    ];
    this.currentPetImageElement = null; // Renamed from currentDogImageElement
  }

  loadPetTypeFromStorage() {
    return new Promise(resolve => {
      chrome.storage.local.get(['petType'], data => {
        console.log('[Content] Data from storage for petType:', data);
        this.petType = data.petType || 'dog1';
        console.log('[Content] Set this.petType to:', this.petType);
        resolve();
      });
    });
  }

  async initializePet(petNameFromPopup, personalityFromPopup) { // Renamed from initializeDog
    if (this.petContainer) {
      this.removePet(); // Renamed from removeDog
    }
    this.petData.name = petNameFromPopup || 'NovaPet';
    this.petData.personality = personalityFromPopup || 'playful and friendly';

    await this.loadPetTypeFromStorage(); 
    
    console.log(`[Content] Initializing pet. Name: ${this.petData.name}, Type: ${this.petType}, Personality: ${this.petData.personality}`);
    
    await this.createPetElements(); // Renamed
    this.createControlPanel();
    this.setupEventListeners();
    this.startAutoMovement();

    console.log(`🐾 ${this.petData.name} (Type: ${this.petType}) 已經出現在頁面上！點擊寵物顯示控制面板`);
  }

  async createPetElements() { // Renamed
    this.petContainer = document.createElement('div');
    Object.assign(this.petContainer.style, {
      position: 'fixed', width: '100px', height: 'auto', zIndex: '10000',
      pointerEvents: 'auto', cursor: 'pointer', transition: 'none',
      left: `${Math.random() * (window.innerWidth - 100)}px`,
      top: `${Math.random() * (window.innerHeight - 100)}px`
    });
    document.body.appendChild(this.petContainer);

    const petImgElement = document.createElement('img');
    this.currentPetImageElement = petImgElement;

    let initialImgPath;
    if (this.petType === 'dog1') {
      initialImgPath = this.dog1MoodImages[Math.floor(Math.random() * this.dog1MoodImages.length)];
    } else if (this.petType === 'cat1') {
      initialImgPath = this.cat1MoodImages[Math.floor(Math.random() * this.cat1MoodImages.length)];
    } else {
      initialImgPath = 'images/dog.gif'; 
    }

    petImgElement.src = chrome.runtime.getURL(initialImgPath);
    Object.assign(petImgElement.style, {
      width: '100%', height: 'auto', borderRadius: '10px',
      transition: 'transform 0.3s ease, opacity 0.5s ease'
    });
    petImgElement.onerror = () => {
      console.error(`圖片載入失敗: ${petImgElement.src}`);
      if(petImgElement.style) petImgElement.style.display = 'none';
      const fallbackEmoji = document.createElement('div');
      fallbackEmoji.textContent = this.petType === 'cat1' ? '😿' : '🐕';
      Object.assign(fallbackEmoji.style, {
        fontSize: '80px', textAlign: 'center', transition: 'transform 0.3s ease'
      });
      this.petContainer.appendChild(fallbackEmoji);
      this.currentPetImageElement = fallbackEmoji; 
    };
    this.petContainer.appendChild(petImgElement);

    this.petDialog = document.createElement('div');
    Object.assign(this.petDialog.style, {
      position: 'absolute', left: '110px', top: '0px',
      backgroundColor: 'rgba(255, 255, 255, 0.9)', border: '2px solid #a855f7',
      borderRadius: '15px', padding: '8px 12px', transition: 'opacity 0.3s ease',
      opacity: '0', pointerEvents: 'none', whiteSpace: 'nowrap',
      fontSize: '14px', fontWeight: 'bold', color: '#333',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
    });
    this.petContainer.appendChild(this.petDialog);

    this.petHouse = document.createElement('div');
    this.petHouse.textContent = this.petType === 'cat1' ? 'ᓚᘏᗢ' : '🏠';
    Object.assign(this.petHouse.style, {
      position: 'fixed', fontSize: '60px', right: '20px', top: '20px',
      zIndex: '9999', opacity: '0.3', pointerEvents: 'none'
    });
    document.body.appendChild(this.petHouse);

    await this.showPetDialogue("walk"); // Renamed
  }
  
  updatePetImageRandomly() {
    if (this.petType === 'cat1') {
        this.petHouse.textContent = 'ᓚᘏᗢ';
    } else {
        this.petHouse.textContent = '🏠';
    }

    if (!this.currentPetImageElement || this.currentPetImageElement.tagName !== 'IMG') {
        console.warn("[Content] Cannot update image, current element is not an IMG tag or is null.");
        return;
    }

    let imageList;
    if (this.petType === 'dog1') {
        imageList = this.dog1MoodImages;
    } else if (this.petType === 'cat1') {
        imageList = this.cat1MoodImages;
    } else {
        console.warn("[Content] Unknown petType for image update:", this.petType);
        return;
    }
    
    if (!imageList || imageList.length === 0) {
        console.warn("[Content] Image list is empty for petType:", this.petType);
        return;
    }

    const newImgPath = imageList[Math.floor(Math.random() * imageList.length)];
    
    // Avoid continuously picking the same image if possible
    if (this.currentPetImageElement.src.endsWith(newImgPath) && imageList.length > 1) {
        this.updatePetImageRandomly(); 
        return;
    }

    this.currentPetImageElement.style.opacity = '0';
    setTimeout(() => {
      if (this.currentPetImageElement && this.currentPetImageElement.tagName === 'IMG') { 
        this.currentPetImageElement.src = chrome.runtime.getURL(newImgPath);
        this.currentPetImageElement.style.opacity = '1';
      }
    }, 500); 
  }
  
  createControlPanel() {
    this.controlPanel = document.createElement('div');
    Object.assign(this.controlPanel.style, {
      position: 'absolute', width: '280px', backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '20px', padding: '20px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
      zIndex: '10001', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      border: '1px solid rgba(168, 85, 247, 0.2)', opacity: '0',
      pointerEvents: 'none', transform: 'scale(0.8)',   
      transition: 'opacity 0.1s ease, transform 0.1s ease'
    });

    console.log('[Content] Creating control panel. this.petType is:', this.petType);
    const panelEmoji = this.petType === 'cat1' ? '😺' : '🐕';
    console.log('[Content] Emoji for panel will be:', panelEmoji);

    this.controlPanel.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 15px;">
        <div style="flex: 1;">
          <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 4px;">
            ${this.petData.name} 控制台
          </div>
          <div style="font-size: 12px; color: #666;">
            虛擬寵物控制面板
          </div>
        </div>
        <div style="width: 50px; height: 50px; background: #f0f0f0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px;">
          ${panelEmoji}
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
      
      <div style="text-align: center; margin-top: 10px; font-size: 12px; color: #999;">點擊寵物關閉面板</div>
    `;

    this.petContainer.appendChild(this.controlPanel);

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

  updateControlPanelPosition(transition = '') {
    if (!this.petContainer || !this.controlPanel) return;

    const petRect = this.petContainer.getBoundingClientRect(); // Use petContainer
    const petLeft = petRect.left;
    const petTop = petRect.top;
    const petWidth = petRect.width;

    const panelWidth = this.controlPanel.offsetWidth || 280;
    const panelHeight = this.controlPanel.offsetHeight || 300; // Estimate if not rendered
    const margin = this.panelHorizontalMargin;

    let relLeft = -(panelWidth + margin);
    if (petLeft - (panelWidth + margin) < 0) {
      relLeft = petWidth + margin;
    }

    let relTop = 0;
    if (petTop + panelHeight > window.innerHeight) {
      relTop = window.innerHeight - panelHeight - petTop;
      if (relTop < 0) relTop = 0; 
    }

    if (transition) this.controlPanel.style.transition = transition;
    this.controlPanel.style.left = `${relLeft}px`;
    this.controlPanel.style.top = `${relTop}px`;
  }

  toggleControlPanel() {
    this.controlPanelVisible = !this.controlPanelVisible;
    if (this.controlPanelVisible) {
      this.controlPanel.style.transition = 'opacity 0.1s ease, transform 0.1s ease';
      this.controlPanel.style.opacity = '1';
      this.controlPanel.style.pointerEvents = 'auto';
      this.controlPanel.style.transform = 'scale(1)';
      this.updateControlPanelPosition();
      this.showPetDialogue("click"); // Renamed
    } else {
      this.controlPanel.style.transition = 'opacity 0.1s ease, transform 0.1s ease';
      this.controlPanel.style.opacity = '0';
      this.controlPanel.style.transform = 'scale(0.8)';
      this.controlPanel.style.pointerEvents = 'none';
    }
  }

  setupControlPanelEvents() {
    this.controlPanel.addEventListener('click', async (e) => {
      const action = e.target.dataset.action;
      if (!action) return;
      this.controlPanelVisible = true; 
      this.toggleControlPanel();

      switch (action) {
        case 'feed': await this.showPetDialogue("feed"); this.addHappinessEffect('🍖'); break;
        case 'treat': await this.showPetDialogue("treat"); this.addHappinessEffect('🦴'); break;
        case 'pet': await this.showPetDialogue("pet"); this.addHappinessEffect('💝'); break;
        case 'toy': await this.showPetDialogue("toy"); this.addHappinessEffect('🎾'); break;
        case 'follow': this.toggleFollowMode(); break;
        case 'stay': this.stayMode(); break;
        case 'home': await this.goHomeAnimation(); break;
      }
    });
  }

  async goHomeAnimation() {
    await this.showPetDialogue("home");
    this.stopAutoMovement();
    this.isFollowing = false;

    this.petContainer.style.transition = 'all 2s ease-in-out';
    this.petContainer.style.top = '20px';
    this.petContainer.style.left = 'auto';
    this.petContainer.style.right = '20px';
    this.updateControlPanelPosition('all 2s ease-in-out');

    setTimeout(() => {
      if (this.petContainer) { // Check if still exists
        this.petContainer.style.opacity = '0';
        this.petContainer.style.transform = 'scale(0.8)';
      }
      if (this.controlPanelVisible && this.controlPanel) {
        this.controlPanel.style.opacity = '0';
        this.controlPanel.style.transform = 'scale(0.8)';
      }
      setTimeout(() => {
        this.removePet(); // Renamed
        console.log(`🏠 ${this.petData.name} 回家囉！`);
      }, 1000);
    }, 2000);
  }

  toggleFollowMode() {
    this.isFollowing = !this.isFollowing;
    if (this.isFollowing) {
      this.stopAutoMovement();
      this.startFollowMode();
      this.showPetDialogue("follow");
    } else {
      this.stopFollowMode();
      this.startAutoMovement();
      this.showPetDialogue(this.petType === 'cat1' ? "Hmph, fine." : "我自由了～"); // Cat might be more aloof
    }
  }

  startFollowMode() { document.addEventListener('mousemove', this.followMouseHandler); }
  stopFollowMode() { document.removeEventListener('mousemove', this.followMouseHandler); }
  
  // Store bound handler to remove it correctly
  followMouseHandler = this.followMouse.bind(this);

  followMouse(e) {
    if (!this.isFollowing || this.isDragging || !this.petContainer) return;
    const targetX = e.clientX - 50;
    const targetY = e.clientY - 50;

    this.petContainer.style.transition = 'all 0.8s ease-out';
    this.petContainer.style.left = `${Math.max(0, Math.min(window.innerWidth - 100, targetX))}px`;
    this.petContainer.style.top = `${Math.max(0, Math.min(window.innerHeight - 100, targetY))}px`;
    this.updateControlPanelPosition('all 0.8s ease-out');
  }

  stayMode() {
    this.stopAutoMovement();
    this.isFollowing = false;
    this.showPetDialogue("stay");
    setTimeout(() => {
      if (!this.isFollowing && this.petContainer) this.startAutoMovement(); // Check petContainer exists
    }, 3000);
  }

  setupEventListeners() {
    let offsetX = 0, offsetY = 0, clickTimer = null;

    this.petContainer.addEventListener('mousedown', (e) => {
      clickTimer = setTimeout(() => {
        this.isDragging = true;
        this.petContainer.style.transition = 'none';
        if(this.controlPanel) this.controlPanel.style.transition = 'none';
        this.petContainer.style.cursor = 'grabbing';
        const rect = this.petContainer.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
      }, 150);
    });

    this.petContainer.addEventListener('mouseup', (e) => {
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        if (!this.isDragging) {
          e.stopPropagation(); // Prevent document click handler from closing panel immediately
          this.toggleControlPanel();
        }
      }
      if (this.isDragging) {
        this.isDragging = false;
        this.petContainer.style.cursor = 'pointer';
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging || !this.petContainer) return;
      e.preventDefault();
      let x = e.clientX - offsetX;
      let y = e.clientY - offsetY;
      x = Math.max(0, Math.min(window.innerWidth - this.petContainer.offsetWidth, x));
      y = Math.max(0, Math.min(window.innerHeight - this.petContainer.offsetHeight, y));
      this.petContainer.style.left = `${x}px`;
      this.petContainer.style.top = `${y}px`;
      this.updateControlPanelPosition('none');
    });

    document.addEventListener('click', (e) => {
      if ( this.controlPanelVisible && this.controlPanel && 
           !this.controlPanel.contains(e.target) && 
           this.petContainer && !this.petContainer.contains(e.target) ) {
        this.controlPanelVisible = true; // Set to true to force toggle to close
        this.toggleControlPanel();
      }
    });

    this.petContainer.addEventListener('mouseenter', () => {
      if (!this.isDragging && this.currentPetImageElement) {
        this.currentPetImageElement.style.transform = 'scale(1.1)';
      }
    });
    this.petContainer.addEventListener('mouseleave', () => {
      if (!this.isDragging && this.currentPetImageElement) {
        this.currentPetImageElement.style.transform = 'scale(1)';
      }
    });
  }

  startAutoMovement() {
    if (this.moveInterval) return;
    this.moveInterval = setInterval(() => {
      if (!this.isFollowing && this.petContainer) this.movePetRandomly();
    }, 6000);
  }

  stopAutoMovement() {
    if (this.moveInterval) {
      clearInterval(this.moveInterval);
      this.moveInterval = null;
    }
  }

  async movePetRandomly() {
    if (this.isDragging || !this.petContainer || this.isFollowing) return;
    this.petContainer.style.transition = 'all 4s linear';

    const x = Math.random() * (window.innerWidth - this.petContainer.offsetWidth);
    const y = Math.random() * (window.innerHeight - this.petContainer.offsetHeight);
    this.petContainer.style.left = `${x}px`;
    this.petContainer.style.top = `${y}px`;
    this.updateControlPanelPosition('none'); 

    setTimeout(async () => {
      if (this.petContainer) { // Check if still exists
         this.updatePetImageRandomly();
         await this.showPetDialogue(); 
      }
    }, 4000);
  }

  async showPetDialogue(action = "") { // Renamed
    if (!this.petDialog) return;
    const dialogue = await generatePetDialogue(this.petData.personality, this.petData.name, action);
    this.petDialog.textContent = dialogue;
    this.petDialog.style.opacity = '1';
    setTimeout(() => {
      if (this.petDialog) this.petDialog.style.opacity = '0';
    }, 3000);
  }

  async performAction(action, data = {}) {
    if (!this.petContainer) return; 
    console.log(`[Content] Performing action: ${action} for petType: ${this.petType}`);
    switch (action) {
      case 'START_WALKING': // Usually handled by initializePet
        await this.showPetDialogue("walk");
        break;
      case 'FEED_DOG': // Action names from popup are still 'DOG' specific
        await this.showPetDialogue("feed");
        this.addHappinessEffect('🍖'); // Could make emoji type-specific
        this.updatePetImageRandomly(); 
        break;
      case 'GIVE_TREAT':
        await this.showPetDialogue("treat");
        this.addHappinessEffect('🦴'); // Could make emoji type-specific
        this.updatePetImageRandomly(); 
        break;
      case 'PLAY_TOY':
        await this.showPetDialogue("toy");
        this.addHappinessEffect('🎾');
        break;
      case 'GO_TO_PARK':
        await this.showPetDialogue("park");
        this.parkMode();
        break;
    }
  }

  addHappinessEffect(emoji) {
    if (!this.petContainer) return;
    const effect = document.createElement('div');
    effect.innerHTML = emoji;
    Object.assign(effect.style, {
      position: 'absolute', top: '-30px', left: '50%', transform: 'translateX(-50%)',
      fontSize: '24px', zIndex: '10001', transition: 'all 2s ease', pointerEvents: 'none'
    });
    this.petContainer.appendChild(effect);
    setTimeout(() => { effect.style.top = '-60px'; effect.style.opacity = '0'; }, 100);
    setTimeout(() => { if (effect.parentNode) effect.parentNode.removeChild(effect); }, 2100);
  }

  async parkMode() {
    this.stopAutoMovement();
    this.isFollowing = false;
    await this.showPetDialogue("park");
    for (let i = 0; i < 3; i++) {
      setTimeout(() => { if(this.petContainer) this.movePetRandomly(); }, i * 2000);
    }
    setTimeout(() => { if (!this.isFollowing && this.petContainer) this.startAutoMovement(); }, 6000);
  }

  removePet() { // Renamed
    console.log("🔴 開始執行 removePet...");
    this.stopAutoMovement();
    this.stopFollowMode();
    this.isDragging = false;
    this.isFollowing = false;
    this.controlPanelVisible = false;
    
    if (this.petContainer) { this.petContainer.remove(); this.petContainer = null; }
    if (this.petHouse) { this.petHouse.remove(); this.petHouse = null; }
    
    this.petDialog = null;
    this.controlPanel = null;
    this.currentPetImageElement = null;
    
    console.log("✅ 寵物已完全離開頁面");
  }
}

// ================ 2. 全域 PetManager 實例 ================
const dogManager = new PetManager(); // Instance name can remain dogManager for now, or change to petManager

// ================ 3. 監聽 Popup 發送的訊息 ================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("📨 [Content] 收到來自 popup 的消息:", message);
  // 'dogName' from popup is actually the user's name, used as pet's name.
  // 'personality' is correctly fetched based on petType in popup.
  const { action, dogName, personality } = message; 
  
  switch (action) {
    case 'START_WALKING':
      // initializePet will internally call loadPetTypeFromStorage to get the correct petType
      dogManager.initializePet(dogName, personality); 
      sendResponse({ success: true, message: `${dogName} 的寵物開始散步！點擊寵物顯示控制面板` });
      break;
    // Action names like 'FEED_DOG' are coming from popup.js button text/logic
    case 'FEED_DOG': 
    case 'GIVE_TREAT':
    case 'PLAY_TOY':
    case 'GO_TO_PARK':
      dogManager.performAction(action, message);
      sendResponse({ success: true, message: `${dogName} 的寵物執行了 ${action}` });
      break;
    case 'REMOVE_DOG': // Action name from popup
      dogManager.removePet(); // Call renamed method
      sendResponse({ success: true, message: '寵物已離開頁面' });
      break;
    default:
      sendResponse({ success: false, message: '未知的動作' });
  }
  return true; 
});

// ================ 4. DOMContentLoaded 後 ================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log("🎯 NovaPet Content Script DOMContentLoaded");
  });
} else {
  console.log("🎯 NovaPet Content Script Ready (already loaded)");
}

console.log("✅ NovaPet Content Script 載入完成！等待來自 popup 的指令...");
// 定期檢查房間狀態
setInterval(() => {
  chrome.storage.local.get(['roomCode'], (data) => {
    if (!data.roomCode && dogManager.petContainer) { // Check petContainer
      console.log('🔍 偵測到房間已關閉但寵物仍在，執行清理');
      dogManager.removePet(); // Call renamed method
    }
  });
}, 5000);