console.log("🚀 popup.js has started");

// 1️⃣ Firebase 初始化
const firebaseConfig = {
  apiKey: "AIzaSyAtCmjIEUK0tH4LI1mdCYAxRu9eqgKOWP4",
  authDomain: "novapet-2b869.firebaseapp.com",
  projectId: "novapet-2b869",
  storageBucket: "novapet-2b869.firebasestorage.app",
  messagingSenderId: "543837261919",
  appId: "1:543837261919:web:0a0f279066b10006950bea",
  measurementId: "G-HBNGMMDKCL"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// 2️⃣ 全域變數
let currentUser = null;
let currentRoomCode = null;
let petStatusUpdateInterval = null;

// 3️⃣ 幫你包好的畫面切換與工具函式
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// 4️⃣ 寵物狀態管理
const defaultPetStatus = {
  hunger: 50,
  happiness: 70,
  health: 80,
  coins: 100,
  experience: 0,
  level: 1,
  lastInteraction: new Date(),
  lastFeed: new Date(),
  mood: "content"
};

// 5️⃣ 更新寵物狀態到UI
function updatePetUI(petData) {
  // 更新寵物名字和狀態描述
  const statusElement = document.getElementById('petStatusText');
  if (statusElement) {
    const userName = document.getElementById('userName').textContent || 'Guest';
    let moodText = getPetMoodText(petData);
    statusElement.textContent = `${userName}'s pet ${moodText}`;
  }

  // 更新資源數值
  updateResourceUI('coins', petData.coins || 0);
  updateResourceUI('experience', petData.experience || 0);
  updateResourceUI('level', petData.level || 1);

  // 更新情緒條
  updateMoodBar(petData.happiness || 50);

  // 更新寵物動畫狀態
  updatePetAnimation(petData);
}

function getPetMoodText(petData) {
  const hunger = petData.hunger || 50;
  const happiness = petData.happiness || 50;
  
  if (hunger < 20) return "is starving and needs food!";
  if (hunger < 40) return "is hungry, looking for food";
  if (happiness < 30) return "seems sad and needs attention";
  if (happiness > 80) return "is very happy and playful!";
  return "is doing well";
}

function updateResourceUI(type, value) {
  const element = document.getElementById(`resource-${type}`);
  if (element) {
    element.textContent = value;
  }
}

function updateMoodBar(happiness) {
  const moodProgress = document.querySelector('.mood-progress');
  if (moodProgress) {
    moodProgress.style.width = happiness + '%';
  }
}

function updatePetAnimation(petData) {
  const petCharacter = document.querySelector('.pet-character');
  if (!petCharacter) return;

  // 根據寵物狀態改變動畫和濾鏡效果
  petCharacter.className = 'pet-character';
  
  if (petData.hunger < 20) {
    petCharacter.classList.add('hungry');
  } else if (petData.happiness > 80) {
    petCharacter.classList.add('happy');
  } else if (petData.happiness < 30) {
    petCharacter.classList.add('sad');
  }
  
  // 可以根據寵物等級或特殊狀態切換不同圖片
  // 例如：if (petData.level > 5) petCharacter.src = './images/dog_evolved.png';
}

// 新增：載入當前寵物狀態的函式
async function loadCurrentPetStatus() {
  if (!currentRoomCode) return;
  
  try {
    const roomRef = db.collection('rooms').doc(currentRoomCode);
    const roomDoc = await roomRef.get();
    
    if (roomDoc.exists) {
      const data = roomDoc.data();
      const petStatus = data.petStatus || defaultPetStatus;
      updatePetUI(petStatus);
      console.log('✅ 寵物狀態載入成功:', petStatus);
    } else {
      console.log('⚠️ 房間不存在，使用預設狀態');
      updatePetUI(defaultPetStatus);
    }
  } catch (error) {
    console.error('❌ 載入寵物狀態失敗:', error);
    updatePetUI(defaultPetStatus);
  }
}

// 6️⃣ 寵物互動功能（添加更多錯誤檢查）
async function performPetAction(action) {
  console.log('🎮 執行動作:', action);
  console.log('🏠 當前房間:', currentRoomCode);
  console.log('👤 當前用戶:', currentUser ? currentUser.uid : 'null');
  
  if (!currentRoomCode) {
    alert('錯誤：房間碼不存在，請重新加入房間');
    return;
  }
  
  if (!currentUser) {
    console.log('🔄 用戶未登入，嘗試重新登入...');
    try {
      const cred = await auth.signInAnonymously();
      currentUser = cred.user;
      console.log('✅ 重新登入成功');
    } catch (error) {
      console.error('❌ 登入失敗:', error);
      alert('登入失敗，請重新開啟擴充功能');
      return;
    }
  }

  try {
    const roomRef = db.collection('rooms').doc(currentRoomCode);
    const roomDoc = await roomRef.get();
    
    let currentPetData;
    if (!roomDoc.exists) {
      console.log('🏠 房間不存在，創建新的寵物狀態');
      // 如果房間不存在，創建基本房間資料
      await roomRef.set({
        owner: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        petStatus: defaultPetStatus
      });
      currentPetData = defaultPetStatus;
    } else {
      currentPetData = roomDoc.data().petStatus || defaultPetStatus;
    }
    
    const newPetData = { ...currentPetData };
    
    // 根據不同動作更新寵物狀態
    switch (action) {
      case 'feed':
        newPetData.hunger = Math.min(100, newPetData.hunger + 30);
        newPetData.happiness = Math.min(100, newPetData.happiness + 10);
        newPetData.coins = Math.max(0, newPetData.coins - 5);
        break;
        
      case 'treat':
        newPetData.happiness = Math.min(100, newPetData.happiness + 20);
        newPetData.hunger = Math.min(100, newPetData.hunger + 10);
        newPetData.coins = Math.max(0, newPetData.coins - 10);
        break;
        
      case 'toy':
        newPetData.happiness = Math.min(100, newPetData.happiness + 25);
        newPetData.experience += 5;
        break;
        
      case 'walk':
        newPetData.health = Math.min(100, newPetData.health + 15);
        newPetData.happiness = Math.min(100, newPetData.happiness + 15);
        newPetData.hunger = Math.max(0, newPetData.hunger - 20);
        newPetData.experience += 10;
        break;
        
      case 'park':
        newPetData.happiness = Math.min(100, newPetData.happiness + 30);
        newPetData.health = Math.min(100, newPetData.health + 10);
        newPetData.experience += 15;
        break;
        
      case 'daycare':
        newPetData.happiness = Math.min(100, newPetData.happiness + 20);
        newPetData.health = Math.min(100, newPetData.health + 20);
        newPetData.coins = Math.max(0, newPetData.coins - 20);
        break;
    }

    // 更新最後互動時間
    newPetData.lastInteraction = firebase.firestore.FieldValue.serverTimestamp();
    
    // 檢查升級
    if (newPetData.experience >= newPetData.level * 100) {
      newPetData.level += 1;
      newPetData.coins += 50; // 升級獎勵
      alert(`恭喜！你的寵物升級到 Level ${newPetData.level}！`);
    }

    // 更新到 Firebase
    await roomRef.update({
      petStatus: newPetData
    });

    // 更新UI
    updatePetUI(newPetData);
    
    // 顯示動作回饋
    showActionFeedback(action);

  } catch (error) {
    console.error('執行寵物動作失敗:', error);
    alert('動作執行失敗，請稍後再試');
  }
}

function showActionFeedback(action) {
  const feedbackTexts = {
    'feed': '🍽️ 餵食完成！',
    'treat': '🍖 零食時間！',
    'toy': '🧸 一起玩耍！',
    'walk': '🚶‍♂️ 散步完成！',
    'park': '🏞️ 公園玩耍！',
    'daycare': '🏫 託兒所時光！'
  };
  
  // 你可以在這裡加入更炫的回饋效果
  const feedback = feedbackTexts[action] || '動作完成！';
  
  // 簡單的彈出提示
  const toast = document.createElement('div');
  toast.textContent = feedback;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #4CAF50;
    color: white;
    padding: 10px 20px;
    border-radius: 20px;
    z-index: 1000;
    animation: fadeInOut 2s ease-in-out;
  `;
  
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// 7️⃣ 監聽寵物狀態變化
function startPetStatusListener() {
  if (!currentRoomCode) return;
  
  const roomRef = db.collection('rooms').doc(currentRoomCode);
  
  // 即時監聽房間狀態變化
  roomRef.onSnapshot((doc) => {
    if (doc.exists) {
      const data = doc.data();
      if (data.petStatus) {
        updatePetUI(data.petStatus);
      }
    }
  });
}

// 8️⃣ 自動衰減系統（可選）
function startPetDecaySystem() {
  petStatusUpdateInterval = setInterval(async () => {
    if (!currentRoomCode) return;
    
    try {
      const roomRef = db.collection('rooms').doc(currentRoomCode);
      const roomDoc = await roomRef.get();
      
      if (roomDoc.exists) {
        const currentPetData = roomDoc.data().petStatus || defaultPetStatus;
        const now = new Date();
        const lastInteraction = currentPetData.lastInteraction?.toDate() || now;
        const minutesSinceInteraction = (now - lastInteraction) / (1000 * 60);
        
        // 每30分鐘衰減一點
        if (minutesSinceInteraction >= 30) {
          const newPetData = { ...currentPetData };
          newPetData.hunger = Math.max(0, newPetData.hunger - 1);
          newPetData.happiness = Math.max(0, newPetData.happiness - 1);
          
          await roomRef.update({
            petStatus: newPetData
          });
        }
      }
    } catch (error) {
      console.error('寵物狀態衰減失敗:', error);
    }
  }, 60000); // 每分鐘檢查一次
}

// 9️⃣ 初始化寵物介面事件監聽（添加更好的回饋）
function initPetInterface() {
  // 互動按鈕事件
  const actionButtons = {
    'btn-feed': 'feed',
    'btn-treat': 'treat', 
    'btn-toy': 'toy',
    'btn-walk': 'walk',
    'btn-park': 'park',
    'btn-daycare': 'daycare'
  };

  Object.entries(actionButtons).forEach(([btnId, action]) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', async () => {
        // 視覺回饋：按鈕按下效果
        btn.style.transform = 'scale(0.95)';
        btn.style.opacity = '0.7';
        
        try {
          await performPetAction(action);
        } finally {
          // 恢復按鈕狀態
          setTimeout(() => {
            btn.style.transform = '';
            btn.style.opacity = '';
          }, 150);
        }
      });
    }
  });

  // 大小調整按鈕
  const sizeButtons = ['small', 'medium', 'large'];
  sizeButtons.forEach(size => {
    const btn = document.getElementById(`size-${size}`);
    if (btn) {
      btn.addEventListener('click', () => {
        changePetContainerSize(size);
      });
    }
  });

  // Chat 按鈕 (之後可以實作聊天功能)
  const chatBtn = document.getElementById('btn-chat');
  if (chatBtn) {
    chatBtn.addEventListener('click', () => {
      alert('聊天功能開發中...');
    });
  }

  // Memories 按鈕
  const memoriesBtn = document.getElementById('btn-memories');
  if (memoriesBtn) {
    memoriesBtn.addEventListener('click', () => {
      alert('回憶功能開發中...');
    });
  }
  
  console.log('✅ 寵物介面初始化完成');
  
  // 處理寵物圖片載入錯誤
  const petImg = document.querySelector('.pet-character');
  if (petImg) {
    petImg.addEventListener('error', function() {
      console.log('⚠️ 寵物圖片載入失敗，使用預設圖示');
      this.style.background = 'linear-gradient(45deg, #666, #888)';
      this.style.position = 'relative';
      this.innerHTML = '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 40px;">🐕</div>';
    });
    
    petImg.addEventListener('load', function() {
      console.log('✅ 寵物圖片載入成功');
    });
  }
}

// 新增：大小調整功能
function changePetContainerSize(size) {
  const container = document.getElementById('view-pet');
  if (!container) return;
  
  // 移除所有大小類別
  container.classList.remove('size-small', 'size-medium', 'size-large');
  
  // 加入新的大小類別
  container.classList.add(`size-${size}`);
  
  // 更新按鈕的active狀態
  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(`size-${size}`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }
  
  // 保存用戶偏好
  chrome.storage.local.set({ petContainerSize: size });
  
  // 視覺回饋
  showActionFeedback(`調整大小: ${size.toUpperCase()}`);
  
  console.log(`📏 調整寵物介面大小: ${size}`);
}

// 🔟 一開始先從 storage 撈有沒有上次的 roomCode
chrome.storage.local.get(['roomCode','userName', 'petContainerSize'], async (data) => {
  if (data.roomCode) {
    currentRoomCode = data.roomCode;
    
    // 重要：重新登入 Firebase 以取得 currentUser
    try {
      const cred = await auth.signInAnonymously();
      currentUser = cred.user;
      console.log('✅ Firebase 重新登入成功:', currentUser.uid);
    } catch (error) {
      console.error('❌ Firebase 登入失敗:', error);
    }
    
    // 🚪 有存，直接顯示寵物互動頁面
    document.getElementById('roomCode').textContent = data.roomCode;
    document.getElementById('userName').textContent = data.userName || 'Guest';
    showView('view-pet'); // 改為顯示寵物介面而不是簡單的房間頁
    
    // 恢復用戶偏好的大小
    if (data.petContainerSize) {
      changePetContainerSize(data.petContainerSize);
    } else {
      // 預設為small並設置active狀態，這樣介面更緊湊
      changePetContainerSize('small');
    }
    
    // 初始化寵物相關功能
    initPetInterface();
    startPetStatusListener();
    startPetDecaySystem();
    
    // 載入並顯示當前寵物狀態
    loadCurrentPetStatus();
  } else {
    // 🏠 沒存，顯示【初始選單】
    showView('view-init');
  }
});

// 1️⃣1️⃣ 領養新狗
document.getElementById('btnAdopt').addEventListener('click', async () => {
  const name = document.getElementById('adoptName').value.trim();
  if (!name) return alert('請輸入名字');

  const code = genCode();
  currentRoomCode = code;
  document.getElementById('userName').textContent = name;
  document.getElementById('roomCode').textContent = code;

  try {
    const cred = await auth.signInAnonymously();
    currentUser = cred.user;
    
    await db.collection('rooms').doc(code).set({
      owner: cred.user.uid,
      name,
      personality: '活潑友善',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      petStatus: defaultPetStatus // 初始化寵物狀態
    });
  } catch (e) {
    console.error(e);
    return alert('建立房間失敗');
  }

  // 存 session，下次打開直接回到寵物頁
  chrome.storage.local.set({ roomCode: code, userName: name });
  showView('view-pet'); // 顯示寵物互動介面
  
  // 初始化寵物功能
  initPetInterface();
  startPetStatusListener();
  startPetDecaySystem();
});

// 1️⃣2️⃣ Exit space：清掉 storage，回到初始選單
document.getElementById('btnExit').addEventListener('click', () => {
  const code = document.getElementById('roomCode').textContent;
  if (confirm(`Are you sure? You will need the space name to come back.\n${code}`)) {
    // 清理定時器
    if (petStatusUpdateInterval) {
      clearInterval(petStatusUpdateInterval);
      petStatusUpdateInterval = null;
    }
    
    chrome.storage.local.remove(['roomCode','userName'], () => {
      currentRoomCode = null;
      currentUser = null;
      showView('view-init');
    });
  }
});

// 1️⃣3️⃣ Get a new dog（清除舊 session）  
document.getElementById('btnNew').addEventListener('click', () => {
  // 清理定時器
  if (petStatusUpdateInterval) {
    clearInterval(petStatusUpdateInterval);
    petStatusUpdateInterval = null;
  }
  
  chrome.storage.local.remove(['roomCode','userName']);
  document.getElementById('adoptName').value = '';
  currentRoomCode = null;
  currentUser = null;
  showView('view-adopt');
});

// 1️⃣4️⃣ Take care of an existing dog  
document.getElementById('btnExisting').addEventListener('click', () => {
  document.getElementById('enterCode').value = '';
  showView('view-enter');
});

// 1️⃣5️⃣ Enter space  
document.getElementById('btnEnter').addEventListener('click', async () => {
  const code = document.getElementById('enterCode').value.trim();
  if (!code) return alert('請輸入房間碼');

  currentRoomCode = code;
  document.getElementById('roomCode').textContent = code;
  document.getElementById('userName').textContent = 'Guest';

  try {
    const cred = await auth.signInAnonymously();
    currentUser = cred.user;
    
    // 檢查房間是否存在
    const roomDoc = await db.collection('rooms').doc(code).get();
    if (!roomDoc.exists) {
      alert('房間不存在，請檢查房間碼');
      return;
    }
    
    await db.collection('users').doc(cred.user.uid).set({
      room: code,
      joinedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.error(e);
    alert('加入房間失敗');
    return;
  }

  chrome.storage.local.set({ roomCode: code, userName: 'Guest' });
  showView('view-pet'); // 顯示寵物互動介面
  
  // 初始化寵物功能
  initPetInterface();
  startPetStatusListener();
  startPetDecaySystem();
});

// 1️⃣6️⃣ 添加CSS動畫樣式
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    50% { opacity: 1; transform: translateX(-50%) translateY(0); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
  }
  
  .pet-character.hungry {
    animation: shake 0.5s infinite;
  }
  
  .pet-character.happy {
    animation: bounce 1s infinite ease-in-out;
  }
  
  .pet-character.sad {
    animation: none;
    opacity: 0.7;
  }
  
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
`;
document.head.appendChild(style);