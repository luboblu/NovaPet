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

/** selectedDogType 用來記錄目前使用者點選的是哪隻狗，預設為 "dog1"（白毛狗）。 */
let selectedDogType = "dog1";

// 2️⃣ 工具函式
function showView(id) {
  // 隱藏所有 view
  document.querySelectorAll('.view').forEach(v => {
    v.classList.remove('active');
  });
  // 延遲後顯示目標 view
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
  if (btn) {
    if (isLoading) {
      btn.disabled = true;
      btn.style.opacity = '0.6';
    } else {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  }
}

/**
 * selectDogOption(dogType)
 *  1. 更新全域變數 selectedDogType
 *  2. 更新隱藏 input #selectedDogType 的值
 *  3. 為對應 .dog-option 加上 .selected 樣式，移除其他選項的 .selected
 */
function selectDogOption(dogType) {
  selectedDogType = dogType;

  // 同步更新隱藏欄位
  const hiddenInput = document.getElementById("selectedDogType");
  if (hiddenInput) {
    hiddenInput.value = dogType;
  }

  // 更新畫面上 .dog-option 的選中樣式
  const dogOptions = document.querySelectorAll(".dog-option");
  dogOptions.forEach((opt) => {
    if (opt.getAttribute("data-dog-type") === dogType) {
      opt.classList.add("selected");
    } else {
      opt.classList.remove("selected");
    }
  });
}

// 2.5️⃣ 與 content script 通信
async function sendMessageToContentScript(action, data = {}) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error('找不到當前標籤頁');
    }
    console.log(`🎯 準備發送 ${action} 到標籤頁 ${tab.id}`);

    // 嘗試直接送訊息
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action, ...data });
      console.log(`✅ 消息發送成功:`, response);
      return response;
    } catch (firstError) {
      console.log(`📋 第一次嘗試失敗，準備注入 content script`);
      // 注入 content.js 後重試
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        console.log('✅ Content script 已注入，等待初始化...');
        await new Promise(resolve => setTimeout(resolve, 1000));
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
    // 友善提示
    if (error.message.includes('Cannot access') || error.message.includes('chrome://')) {
      showAlert('⚠️ 無法在此頁面運行狗狗功能！\n\n請在一般網頁（如 Google、YouTube）上使用。本系統頁面不支援此功能。');
    } else if (error.message.includes('Receiving end does not exist')) {
      showAlert('🔄 請重新整理網頁後再試一次！\n\n狗狗需要重新準備一下 🐕');
    } else {
      showAlert(`❌ 發生錯誤: ${error.message}\n\n建議:\n1. 重新整理網頁\n2. 在一般網頁上使用\n3. 重新載入擴充功能`);
    }
    return null;
  }
}

// 2.6️⃣ 檢查當前頁面是否相容（非 chrome://、edge:// 等系統頁面）
async function checkPageCompatibility() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return false;
    const restrictedPrefixes = [
      'chrome://',
      'chrome-extension://',
      'moz-extension://',
      'edge://',
      'opera://',
      'about:',
      'file://'
    ];
    return !restrictedPrefixes.some(prefix => tab.url.startsWith(prefix));
  } catch (error) {
    return false;
  }
}

// 🤖 GPT 相關功能
async function generateDogResponse(userMessage, dogName, personality = '活潑友善') {
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
            content: `你是一隻名叫 ${dogName} 的虛擬寵物狗。你的個性是${personality}。請用可愛的狗狗口吻回應，要表現像真正的狗狗：偶爾使用"汪汪"、"嗚嗚"等，保持活潑可愛的語氣，不超過50字，可以用表情與動作描述。`
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
    return getDefaultDogResponse();
  }
}

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

async function getConversationContext(roomCode, limit = 5) {
  try {
    const snapshot = await db.collection('chats')
      .doc(roomCode)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(limit * 2)
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

async function generateDogResponseWithContext(userMessage, dogName, roomCode) {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
    return getDefaultDogResponse();
  }
  try {
    const conversationHistory = await getConversationContext(roomCode, 3);
    const messages = [
      {
        role: 'system',
        content: `你是一隻名叫 ${dogName} 的虛擬寵物狗。你的個性是活潑友善、充滿愛心。請記住之前的對話。`
      },
      ...conversationHistory,
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

// 🆕 聊天相關函式
function displayMessage(text, sender, senderName) {
  const messagesContainer = document.getElementById('chatMessages');
  const msgEl = document.createElement('div');
  if (sender === 'user') {
    msgEl.className = 'message user-typing';
    msgEl.innerHTML = `
      <div class="dog-avatar-small"></div>
      <div class="message-content">
        <span class="user-name">You</span> ${text}
      </div>
    `;
  } else {
    msgEl.className = 'message';
    msgEl.innerHTML = `
      <div class="dog-avatar-small"></div>
      <div class="message-content">
        <span class="pet-name-small">*${senderName || 'Pet'}*</span> ${text}
      </div>
    `;
  }
  messagesContainer.appendChild(msgEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

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

async function loadChatHistory() {
  const roomCode = document.getElementById('roomCode')?.textContent;
  if (!roomCode) return;
  const messagesContainer = document.getElementById('chatMessages');
  messagesContainer.innerHTML = '';
  try {
    const snapshot = await db.collection('chats')
      .doc(roomCode)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .limit(50)
      .get();
    if (snapshot.empty) {
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

let chatListener = null;
function startChatListener() {
  const roomCode = document.getElementById('roomCode')?.textContent;
  if (!roomCode) return;
  if (chatListener) {
    chatListener();
    chatListener = null;
  }
  chatListener = db.collection('chats')
    .doc(roomCode)
    .collection('messages')
    .orderBy('timestamp', 'desc')
    .limit(1)
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const lastMsg = document.querySelector('#chatMessages .message:last-child');
          if (lastMsg) {
            const lastText = lastMsg.querySelector('.message-content').textContent;
            if (lastText.includes(data.text)) return;
          }
          displayMessage(data.text, data.sender, data.senderName);
        }
      });
    }, (error) => {
      console.error('❌ 訊息監聽錯誤:', error);
    });
}

function stopChatListener() {
  if (chatListener) {
    chatListener();
    chatListener = null;
  }
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;
  const userName = document.getElementById('userName')?.textContent || 'User';
  const dogName = userName;
  const roomCode = document.getElementById('roomCode')?.textContent;

  displayMessage(message, 'user', 'You');
  input.value = '';
  await saveMessageToFirebase(message, 'user', userName);

  const typingIndicator = createTypingIndicator();
  const messagesContainer = document.getElementById('chatMessages');
  messagesContainer.appendChild(typingIndicator);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    const aiResponse = await generateDogResponseWithContext(message, dogName, roomCode);
    typingIndicator.remove();
    displayMessage(aiResponse, 'dog', dogName);
    await saveMessageToFirebase(aiResponse, 'dog', dogName);
  } catch (error) {
    console.error('生成回應時發生錯誤:', error);
    typingIndicator.remove();
    const defaultResponse = getDefaultDogResponse();
    displayMessage(defaultResponse, 'dog', dogName);
    await saveMessageToFirebase(defaultResponse, 'dog', dogName);
  }
}

// 3️⃣ DOMContentLoaded 中綁定所有事件
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎯 DOM 載入完成');

  // 綁定 「領養畫面」的狗狗選項──搬來這裡以確保 DOM 完成後才綁定
  const dogOptions = document.querySelectorAll(".dog-option");
  dogOptions.forEach((opt) => {
    opt.addEventListener("click", () => {
      const dt = opt.getAttribute("data-dog-type");
      selectDogOption(dt);
    });
  });

  // 領養畫面進入時，預設先選取 dog1
  if (document.getElementById('view-adopt').classList.contains('active')) {
    selectDogOption('dog1');
  }

  // 隱藏 loading overlay
  setTimeout(() => {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }
    document.body.classList.remove('loading');
  }, 200);

  // 如果 localStorage 有 roomCode，就自動切到「房間畫面」
  chrome.storage.local.get(['roomCode', 'userName', 'dogType'], data => {
    if (data.roomCode) {
      const roomCodeEl = document.getElementById('roomCode');
      const userNameEl = document.getElementById('userName');
      const dogTypeFromStorage = data.dogType || 'dog1';
      if (roomCodeEl) roomCodeEl.textContent = data.roomCode;
      if (userNameEl) userNameEl.textContent = data.userName || 'Guest';

      // （可選）將房間畫面的狗狗頭貼換成對應的圖片
      // e.g. const petAvatarEl = document.getElementById('petAvatar');
      // if (petAvatarEl) {
      //   petAvatarEl.src = (dogTypeFromStorage === 'dog1')
      //     ? 'images/white.png'
      //     : 'images/golden.png';
      // }

      showView('view-room');
    } else {
      showView('view-init');
    }
  });

  // 導覽按鈕事件
  document.getElementById('btnNew')?.addEventListener('click', () => {
    // 進入「領養畫面」前先清掉 localStorage
    chrome.storage.local.remove(['roomCode', 'userName', 'dogType']);
    document.getElementById('adoptName').value = '';
    selectDogOption('dog1');
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
    await loadChatHistory();
    startChatListener();
  });

  document.getElementById('btnCloseChat')?.addEventListener('click', () => {
    stopChatListener();
    showView('view-room');
  });

  document.getElementById('btnSend')?.addEventListener('click', sendMessage);
  document.getElementById('chatInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  // 綁定除了 Chat 以外的動作按鈕
  const actionButtons = document.querySelectorAll('.action-btn:not(#btnChat)');
  actionButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.textContent.trim();
      await handleDogAction(action);
    });
  });

  // 複製邀請連結按鈕（可選）
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

// 4️⃣ 領養新狗狗（新增 dogType 存入 Firestore 與 localStorage）
document.getElementById('btnAdopt')?.addEventListener('click', async () => {
  const name = document.getElementById('adoptName').value.trim();
  if (!name) {
    showAlert('請輸入你的名字');
    return;
  }
  if (!selectedDogType) {
    showAlert('請先選擇你要領養的狗！');
    return;
  }
  setButtonLoading('btnAdopt', true);
  const code = genCode();
  try {
    const cred = await auth.signInAnonymously();
    await db.collection('rooms').doc(code).set({
      owner: cred.user.uid,
      name: name,
      dogType: selectedDogType,  // ← 一並存入 Firestore
      personality: '活潑友善',
      happiness: 30,
      stars: 152,
      notifications: 4,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    // 更新 UI
    document.getElementById('userName').textContent = name;
    document.getElementById('roomCode').textContent = code;
    // 存到 localStorage
    chrome.storage.local.set({
      roomCode: code,
      userName: name,
      dogType: selectedDogType
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

// 5️⃣ 加入現有房間（讀取並存入 dogType）
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
    const roomData = roomDoc.data();
    const name = roomData.name || 'Guest';
    const dogTypeFromDB = roomData.dogType || 'dog1';
    // Optional: 儲存 user info
    await db.collection('users').doc(cred.user.uid).set({
      room: code,
      joinedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    // 更新 UI
    document.getElementById('roomCode').textContent = code;
    document.getElementById('userName').textContent = name;
    // 存 localStorage
    chrome.storage.local.set({
      roomCode: code,
      userName: name,
      dogType: dogTypeFromDB
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
    stopChatListener();
    chrome.storage.local.remove(['roomCode', 'userName', 'dogType'], () => {
      console.log('✅ 已退出房間');
      showView('view-init');
    });
  }
});

// 7️⃣ 狗狗動作處理
async function handleDogAction(action) {
  const userName = document.getElementById('userName')?.textContent || 'Pet';
  console.log(`🐕 執行動作: ${action} for ${userName}`);
  const isCompatible = await checkPageCompatibility();
  if (!isCompatible) {
    showAlert('⚠️ 此頁面不支援狗狗功能！\n\n請在一般網頁（如 Google、YouTube）上使用此功能。');
    return;
  }
  switch(action) {
    case 'Go out for a walk & poop':
      console.log('🐕 狗狗要出去散步囉！');
      {
        const result = await sendMessageToContentScript('START_WALKING', {
          dogName: userName,
          personality: '活潑友善，喜歡散步'
        });
        if (result) {
          showAlert(`${userName} 出去散步囉！狗狗已經出現在桌面上~`);
        }
      }
      break;
    case 'Dog park':
      console.log('🏞️ 前往狗狗公園');
      {
        const parkResult = await sendMessageToContentScript('GO_TO_PARK', { dogName: userName });
        if (parkResult) {
          showAlert(`帶 ${userName} 去狗狗公園玩耍！`);
        }
      }
      break;
    case 'Send to daycare':
      console.log('🏢 送去托兒所');
      showAlert(`${userName} 去托兒所交朋友囉！`);
      break;
    case 'Feed':
      console.log('🍖 餵食狗狗');
      {
        const feedResult = await sendMessageToContentScript('FEED_DOG', { dogName: userName });
        if (feedResult) {
          showAlert(`${userName} 吃飽飽了！心情變好了！`);
        }
      }
      break;
    case 'Treat':
      console.log('🦴 給予零食');
      {
        const treatResult = await sendMessageToContentScript('GIVE_TREAT', { dogName: userName });
        if (treatResult) {
          showAlert(`${userName} 收到好吃的零食，超開心！`);
        }
      }
      break;
    case 'Toy':
      console.log('🎾 玩玩具');
      {
        const toyResult = await sendMessageToContentScript('PLAY_TOY', { dogName: userName });
        if (toyResult) {
          showAlert(`${userName} 正在開心地玩玩具！`);
        }
      }
      break;
    default:
      showAlert(`${action} 功能開發中...`);
  }
}

// 8️⃣ 全局錯誤處理 & 卸載時處理
window.addEventListener('error', (event) => {
  console.error('❌ 全局錯誤:', event.error);
});

window.addEventListener('beforeunload', () => {
  stopChatListener();
});

// 🔟 Firebase 重啟連線
firebase.firestore().enableNetwork().then(() => {
  console.log('✅ Firebase 連接成功');
}).catch((error) => {
  console.error('❌ Firebase 連接失敗:', error);
});
