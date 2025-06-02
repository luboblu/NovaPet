console.log("🚀 NovaPet popup.js has started");

// 🤖 OpenAI 配置
const OPENAI_API_KEY = ''; // 請替換成你的 API Key
const OPENAI_MODEL = 'gpt-4o-mini'; // 或使用 'gpt-3.5-turbo'

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
const db = firebase.firestore();

// 2️⃣ 工具函式
function showView(id) {
  // 先隱藏所有視圖
  document.querySelectorAll('.view').forEach(v => {
    v.classList.remove('active');
  });
  
  // 短暫延遲後顯示目標視圖，確保過渡效果
  setTimeout(() => {
    document.getElementById(id).classList.add('active');
  }, 50);
}

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function showAlert(message) {
  alert(message);
}

function setButtonLoading(buttonId, isLoading) {
  const btn = document.getElementById(buttonId);
  if (isLoading) {
    btn.disabled = true;
    btn.style.opacity = '0.6';
  } else {
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

// 2.5️⃣ 強化版與 content script 通信函式
async function sendMessageToContentScript(action, data = {}) {
  try {
    // 獲取當前活躍的標籤頁
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error('找不到當前標籤頁');
    }

    console.log(`🎯 準備發送 ${action} 到標籤頁 ${tab.id}`);

    // 方法1: 直接嘗試發送消息
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action, ...data });
      console.log(`✅ 消息發送成功:`, response);
      return response;
    } catch (firstError) {
      console.log(`📋 第一次嘗試失敗，準備注入 content script`);
      
      // 方法2: 注入 content script 後重試
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        
        console.log('✅ Content script 已注入，等待初始化...');
        
        // 等待 content script 初始化
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 重新嘗試發送消息
        const response = await chrome.tabs.sendMessage(tab.id, { action, ...data });
        console.log(`✅ 重試成功:`, response);
        return response;
        
      } catch (injectionError) {
        console.error('❌ 注入失敗:', injectionError);
        throw new Error('無法注入 content script');
      }
    }
    
  } catch (error) {
    console.error(`❌ 發送 ${action} 消息失敗:`, error);
    
    // 友善的錯誤處理
    if (error.message.includes('Cannot access') || error.message.includes('chrome://')) {
      showAlert('⚠️ 無法在此頁面運行狗狗功能！\n\n請在一般網頁（如 Google、YouTube）上使用。\n\n系統頁面不支援此功能。');
    } else if (error.message.includes('Receiving end does not exist')) {
      showAlert('🔄 請重新整理網頁後再試一次！\n\n狗狗需要重新準備一下 🐕');
    } else {
      showAlert(`❌ 發生錯誤: ${error.message}\n\n建議:\n1. 重新整理網頁\n2. 在一般網頁上使用\n3. 重新載入擴充功能`);
    }
    
    return null;
  }
}

// 2.6️⃣ 檢查頁面是否適用
async function checkPageCompatibility() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return false;
    
    // 檢查是否為受限制的頁面
    const restrictedPages = [
      'chrome://',
      'chrome-extension://',
      'moz-extension://',
      'edge://',
      'opera://',
      'about:',
      'file://'
    ];
    
    return !restrictedPages.some(prefix => tab.url.startsWith(prefix));
  } catch (error) {
    return false;
  }
}

// 🤖 GPT 相關功能
// 調用 OpenAI API 生成狗狗回應
async function generateDogResponse(userMessage, dogName, personality = '活潑友善') {
  // 如果沒有 API Key，使用預設回應
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
    return getDefaultDogResponse();
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: `你是一隻名叫 ${dogName} 的虛擬寵物狗。你的個性是${personality}。
請用可愛的狗狗口吻回應，要表現得像真正的狗狗一樣：
- 偶爾使用狗狗的叫聲如"汪汪"、"嗚嗚"、"汪"
- 表現出對主人的愛和忠誠
- 保持活潑可愛的語氣
- 可以提到狗狗喜歡的事物（散步、玩具、零食等）
- 回應要簡短且充滿感情（不超過50字）
- 可以使用表情符號和動作描述如 *搖尾巴*、*舔舔*`
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        temperature: 0.8,
        max_tokens: 100,
        presence_penalty: 0.6,
        frequency_penalty: 0.5
      })
    });

    if (!response.ok) {
      throw new Error(`API 錯誤: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;

  } catch (error) {
    console.error('❌ OpenAI API 錯誤:', error);
    // 發生錯誤時使用預設回應
    return getDefaultDogResponse();
  }
}

// 預設的狗狗回應（當 API 失敗時使用）
function getDefaultDogResponse() {
  const dogResponses = [
    'Woof! That sounds interesting!',
    'Arf arf! I love hearing from you!',
    'Woof woof! You\'re the best!',
    '*wags tail* Tell me more!',
    'Bark! That makes me happy!',
    '*excited barking* I understand!',
    'Woof! Thanks for sharing with me!',
    '汪汪！我好愛你喔！',
    '*搖尾巴* 真的嗎？好棒喔！',
    '嗚嗚～我會一直陪著你的！'
  ];
  
  return dogResponses[Math.floor(Math.random() * dogResponses.length)];
}

// 創建輸入中提示
function createTypingIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'message typing-indicator';
  indicator.innerHTML = `
    <div class="dog-avatar-small"></div>
    <div class="message-content">
      <span class="typing-dots">
        <span>.</span><span>.</span><span>.</span>
      </span>
    </div>
  `;
  return indicator;
}

// 新增對話記憶功能（可選）
async function getConversationContext(roomCode, limit = 5) {
  try {
    const snapshot = await db.collection('chats')
      .doc(roomCode)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(limit * 2) // 獲取用戶和狗狗的對話
      .get();
    
    const messages = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      messages.unshift({
        role: data.sender === 'user' ? 'user' : 'assistant',
        content: data.text
      });
    });
    
    return messages;
  } catch (error) {
    console.error('獲取對話歷史失敗:', error);
    return [];
  }
}

// 進階版：帶有對話記憶的 AI 回應
async function generateDogResponseWithContext(userMessage, dogName, roomCode) {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
    return getDefaultDogResponse();
  }

  try {
    // 獲取最近的對話歷史
    const conversationHistory = await getConversationContext(roomCode, 3);
    
    const messages = [
      {
        role: 'system',
        content: `你是一隻名叫 ${dogName} 的虛擬寵物狗。你的個性是活潑友善、充滿愛心。
請用可愛的狗狗口吻回應，要表現得像真正的狗狗一樣：
- 偶爾使用狗狗的叫聲如"汪汪"、"嗚嗚"、"汪"
- 表現出對主人的愛和忠誠
- 保持活潑可愛的語氣
- 可以提到狗狗喜歡的事物（散步、玩具、零食等）
- 回應要簡短且充滿感情（不超過50字）
- 記住之前的對話內容並作出相關回應`
      },
      ...conversationHistory, // 加入歷史對話
      {
        role: 'user',
        content: userMessage
      }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: messages,
        temperature: 0.8,
        max_tokens: 100,
        presence_penalty: 0.6,
        frequency_penalty: 0.5
      })
    });

    if (!response.ok) {
      throw new Error(`API 錯誤: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;

  } catch (error) {
    console.error('❌ OpenAI API 錯誤:', error);
    return getDefaultDogResponse();
  }
}

// 🆕 聊天相關功能
// 顯示聊天訊息到 UI
function displayMessage(text, sender, senderName, timestamp = null) {
  const messagesContainer = document.getElementById('chatMessages');
  const messageElement = document.createElement('div');
  
  if (sender === 'user') {
    messageElement.className = 'message user-typing';
    messageElement.innerHTML = `
      <div class="dog-avatar-small"></div>
      <div class="message-content">
        <span class="user-name">You</span> ${text}
      </div>
    `;
  } else {
    messageElement.className = 'message';
    messageElement.innerHTML = `
      <div class="dog-avatar-small"></div>
      <div class="message-content">
        <span class="pet-name-small">*${senderName || 'Pet'}*</span> ${text}
      </div>
    `;
  }
  
  messagesContainer.appendChild(messageElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 儲存訊息到 Firebase
async function saveMessageToFirebase(text, sender, senderName) {
  const roomCode = document.getElementById('roomCode')?.textContent;
  if (!roomCode) return;
  
  try {
    await db.collection('chats')
      .doc(roomCode)
      .collection('messages')
      .add({
        text: text,
        sender: sender,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        senderName: senderName
      });
    console.log('✅ 訊息已儲存到 Firebase');
  } catch (error) {
    console.error('❌ 儲存訊息失敗:', error);
  }
}

// 載入聊天歷史記錄
async function loadChatHistory() {
  const roomCode = document.getElementById('roomCode')?.textContent;
  if (!roomCode) return;
  
  const messagesContainer = document.getElementById('chatMessages');
  messagesContainer.innerHTML = ''; // 清空現有訊息
  
  try {
    const snapshot = await db.collection('chats')
      .doc(roomCode)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .limit(50)
      .get();
    
    if (snapshot.empty) {
      console.log('📭 沒有歷史訊息');
      // 顯示歡迎訊息
      displayMessage('Woof! 我好想你！快來跟我聊天吧！', 'dog', document.getElementById('userName')?.textContent || 'Pet');
    } else {
      snapshot.forEach(doc => {
        const data = doc.data();
        displayMessage(data.text, data.sender, data.senderName);
      });
      console.log(`✅ 載入了 ${snapshot.size} 條歷史訊息`);
    }
  } catch (error) {
    console.error('❌ 載入聊天記錄失敗:', error);
  }
}

// 監聽即時訊息更新
let chatListener = null;

function startChatListener() {
  const roomCode = document.getElementById('roomCode')?.textContent;
  if (!roomCode) return;
  
  // 停止之前的監聽器
  if (chatListener) {
    chatListener();
    chatListener = null;
  }
  
  // 建立新的監聽器
  chatListener = db.collection('chats')
    .doc(roomCode)
    .collection('messages')
    .orderBy('timestamp', 'desc')
    .limit(1)
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          // 避免重複顯示已經在畫面上的訊息
          const lastMessage = document.querySelector('#chatMessages .message:last-child');
          if (lastMessage) {
            const lastMessageText = lastMessage.querySelector('.message-content').textContent;
            if (lastMessageText.includes(data.text)) {
              return; // 訊息已存在，跳過
            }
          }
          displayMessage(data.text, data.sender, data.senderName);
        }
      });
    }, (error) => {
      console.error('❌ 訊息監聽錯誤:', error);
    });
}

// 停止聊天監聽器
function stopChatListener() {
  if (chatListener) {
    chatListener();
    chatListener = null;
  }
}

// 修改後的發送訊息功能（支援 AI 回應）
async function sendMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  
  if (!message) return;
  
  const userName = document.getElementById('userName')?.textContent || 'User';
  const dogName = userName; // 狗狗的名字與主人相同
  const roomCode = document.getElementById('roomCode')?.textContent;
  
  // 顯示用戶訊息
  displayMessage(message, 'user', 'You');
  input.value = '';
  
  // 儲存用戶訊息到 Firebase
  await saveMessageToFirebase(message, 'user', userName);
  
  // 顯示輸入中的提示
  const typingIndicator = createTypingIndicator();
  const messagesContainer = document.getElementById('chatMessages');
  messagesContainer.appendChild(typingIndicator);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  try {
    // 使用帶有記憶的 AI 生成狗狗的回應
    const aiResponse = await generateDogResponseWithContext(message, dogName, roomCode);
    
    // 移除輸入提示
    typingIndicator.remove();
    
    // 顯示並儲存狗狗的回應
    displayMessage(aiResponse, 'dog', dogName);
    await saveMessageToFirebase(aiResponse, 'dog', dogName);
    
  } catch (error) {
    console.error('生成回應時發生錯誤:', error);
    
    // 如果 AI 失敗，使用預設回應
    typingIndicator.remove();
    const defaultResponse = getDefaultDogResponse();
    displayMessage(defaultResponse, 'dog', dogName);
    await saveMessageToFirebase(defaultResponse, 'dog', dogName);
  }
}

// 3️⃣ 導航按鈕事件
document.getElementById('btnNew')?.addEventListener('click', () => {
  chrome.storage.local.remove(['roomCode', 'userName']);
  document.getElementById('adoptName').value = '';
  showView('view-adopt');
});

document.getElementById('btnExisting')?.addEventListener('click', () => {
  document.getElementById('enterCode').value = '';
  showView('view-enter');
});

document.getElementById('btnBackFromAdopt')?.addEventListener('click', () => {
  showView('view-init');
});

document.getElementById('btnBackFromEnter')?.addEventListener('click', () => {
  showView('view-init');
});

document.getElementById('btnChat')?.addEventListener('click', async () => {
  showView('view-chat');
  await loadChatHistory(); // 載入歷史記錄
  startChatListener(); // 開始監聽新訊息
});

document.getElementById('btnCloseChat')?.addEventListener('click', () => {
  stopChatListener(); // 停止監聽
  showView('view-room');
});

document.getElementById('btnSend')?.addEventListener('click', sendMessage);
document.getElementById('chatInput')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

// 4️⃣ 領養新狗狗
document.getElementById('btnAdopt')?.addEventListener('click', async () => {
  const name = document.getElementById('adoptName').value.trim();
  if (!name) {
    showAlert('請輸入你的名字');
    return;
  }

  setButtonLoading('btnAdopt', true);
  const code = genCode();

  try {
    const cred = await auth.signInAnonymously();
    
    await db.collection('rooms').doc(code).set({
      owner: cred.user.uid,
      name: name,
      personality: '活潑友善',
      happiness: 30,
      stars: 152,
      notifications: 4,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    document.getElementById('userName').textContent = name;
    document.getElementById('roomCode').textContent = code;

    chrome.storage.local.set({ 
      roomCode: code, 
      userName: name 
    });

    showView('view-room');
    console.log('✅ 房間創建成功:', code);
    
  } catch (error) {
    console.error('❌ 創建房間失敗:', error);
    showAlert('創建房間失敗，請稍後再試');
  } finally {
    setButtonLoading('btnAdopt', false);
  }
});

// 5️⃣ 加入現有房間
document.getElementById('btnEnter')?.addEventListener('click', async () => {
  const code = document.getElementById('enterCode').value.trim().toUpperCase();
  if (!code) {
    showAlert('請輸入房間碼');
    return;
  }

  setButtonLoading('btnEnter', true);

  try {
    const cred = await auth.signInAnonymously();
    const roomDoc = await db.collection('rooms').doc(code).get();
    
    if (!roomDoc.exists) {
      showAlert('房間不存在，請檢查房間碼');
      setButtonLoading('btnEnter', false);
      return;
    }

    await db.collection('users').doc(cred.user.uid).set({
      room: code,
      joinedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    const roomData = roomDoc.data();
    
    document.getElementById('roomCode').textContent = code;
    document.getElementById('userName').textContent = roomData.name || 'Guest';

    chrome.storage.local.set({ 
      roomCode: code, 
      userName: roomData.name || 'Guest'
    });

    showView('view-room');
    console.log('✅ 成功加入房間:', code);
    
  } catch (error) {
    console.error('❌ 加入房間失敗:', error);
    showAlert('加入房間失敗，請稍後再試');
  } finally {
    setButtonLoading('btnEnter', false);
  }
});

// 6️⃣ 退出房間
document.getElementById('btnExit')?.addEventListener('click', () => {
  const code = document.getElementById('roomCode')?.textContent;
  const confirmMessage = `Are you sure? You will need the space name to come back.\n\nSpace code: ${code}`;
  
  if (confirm(confirmMessage)) {
    stopChatListener(); // 停止聊天監聽
    chrome.storage.local.remove(['roomCode', 'userName'], () => {
      console.log('✅ 已退出房間');
      showView('view-init');
    });
  }
});

// 7️⃣ 改進的狗狗動作處理函式
async function handleDogAction(action) {
  const userName = document.getElementById('userName')?.textContent || 'Pet';
  
  console.log(`🐕 執行動作: ${action} for ${userName}`);
  
  // 先檢查頁面相容性
  const isCompatible = await checkPageCompatibility();
  if (!isCompatible) {
    showAlert('⚠️ 此頁面不支援狗狗功能！\n\n請在一般網頁（如 Google、YouTube）上使用此功能。');
    return;
  }
  
  switch(action) {
    case 'Go out for a walk & poop':
      console.log('🐕 狗狗要出去散步囉！');
      
      const result = await sendMessageToContentScript('START_WALKING', { 
        dogName: userName,
        personality: '活潑友善，喜歡散步' 
      });
      
      if (result) {
        showAlert(`${userName} 出去散步囉！狗狗已經出現在桌面上~`);
      }
      break;
      
    case 'Dog park':
      console.log('🏞️ 前往狗狗公園');
      const parkResult = await sendMessageToContentScript('GO_TO_PARK', { dogName: userName });
      if (parkResult) {
        showAlert(`帶 ${userName} 去狗狗公園玩耍！`);
      }
      break;
      
    case 'Send to daycare':
      console.log('🏢 送去托兒所');
      showAlert(`${userName} 去托兒所交朋友囉！`);
      break;
      
    case 'Feed':
      console.log('🍖 餵食狗狗');
      const feedResult = await sendMessageToContentScript('FEED_DOG', { dogName: userName });
      if (feedResult) {
        showAlert(`${userName} 吃飽飽了！心情變好了！`);
      }
      break;
      
    case 'Treat':
      console.log('🦴 給予零食');
      const treatResult = await sendMessageToContentScript('GIVE_TREAT', { dogName: userName });
      if (treatResult) {
        showAlert(`${userName} 收到好吃的零食，超開心！`);
      }
      break;
      
    case 'Toy':
      console.log('🎾 玩玩具');
      const toyResult = await sendMessageToContentScript('PLAY_TOY', { dogName: userName });
      if (toyResult) {
        showAlert(`${userName} 正在開心地玩玩具！`);
      }
      break;
      
    default:
      showAlert(`${action} 功能開發中...`);
  }
}

// 8️⃣ 所有 DOM 相關的初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎯 DOM 載入完成');
  
  setTimeout(() => {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }
    document.body.classList.remove('loading');
  }, 200);

  chrome.storage.local.get(['roomCode', 'userName'], data => {
    if (data.roomCode) {
      const roomCodeEl = document.getElementById('roomCode');
      const userNameEl = document.getElementById('userName');
      
      if (roomCodeEl) roomCodeEl.textContent = data.roomCode;
      if (userNameEl) userNameEl.textContent = data.userName || 'Guest';
      
      showView('view-room');
    } else {
      showView('view-init');
    }
  });

  const actionButtons = document.querySelectorAll('.action-btn:not(#btnChat)');
  actionButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.textContent.trim();
      await handleDogAction(action);
    });
  });

  const inviteBtn = document.querySelector('.header-btn:not(#btnExit)');
  if (inviteBtn) {
    inviteBtn.addEventListener('click', () => {
      const roomCode = document.getElementById('roomCode')?.textContent;
      const message = `Join my NovaPet space!\nRoom code: ${roomCode}`;
      
      if (navigator.clipboard) {
        navigator.clipboard.writeText(roomCode).then(() => {
          showAlert('房間碼已複製到剪貼板！');
        }).catch(() => {
          showAlert(message);
        });
      } else {
        showAlert(message);
      }
    });
  }
});

// 9️⃣ 錯誤處理
window.addEventListener('error', (event) => {
  console.error('❌ 全局錯誤:', event.error);
});

// 在頁面卸載時停止監聽器
window.addEventListener('beforeunload', () => {
  stopChatListener();
});

// 🔟 Firebase 連接狀態監聽
firebase.firestore().enableNetwork().then(() => {
  console.log('✅ Firebase 連接成功');
}).catch((error) => {
  console.error('❌ Firebase 連接失敗:', error);
});