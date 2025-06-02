console.log("🚀 NovaPet popup.js has started");

// 🤖 OpenAI 配置
const OPENAI_API_KEY = ""; // 請替換成你的 API Key
const OPENAI_MODEL = "gpt-4o-mini"; // 或使用 'gpt-3.5-turbo'

// 1️⃣ Firebase 初始化
const firebaseConfig = {
  apiKey: "AIzaSyAtCmjIEUK0tH4LI1mdCYAxRu9eqgKOWP4",
  authDomain: "novapet-2b869.firebaseapp.com",
  projectId: "novapet-2b869",
  storageBucket: "novapet-2b869.firebasestorage.app",
  messagingSenderId: "543837261919",
  appId: "1:543837261919:web:0a0f279066b10006950bea",
  measurementId: "G-HBNGMMDKCL",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const PET_PERSONALITIES = {
  dog1: {
    name: "白色狗狗",
    personality: "gentle, shy, loyal, loves cuddles and quiet moments",
    personalityZh: "溫柔、害羞、忠誠、喜歡擁抱和安靜時光",
  },
  cat1: {
    name: "可愛貓貓",
    personality:
      "curious, independent, playful at times, enjoys observing and soft naps",
    personalityZh: "好奇、獨立、偶爾愛玩、喜歡觀察和柔軟的午睡",
  },
};
let selectedDogType = "dog1"; // Represents the pet type selected during adoption

// 2️⃣ 工具函式
function showView(id) {
  document.querySelectorAll(".view").forEach((v) => {
    v.classList.remove("active");
  });
  setTimeout(() => {
    const targetView = document.getElementById(id);
    if (targetView) {
      targetView.classList.add("active");
    } else {
      console.error("[Popup] Target view not found:", id);
    }
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
      btn.style.opacity = "0.6";
    } else {
      btn.disabled = false;
      btn.style.opacity = "1";
    }
  }
}

function selectDogOption(dogType) {
  selectedDogType = dogType;

  const hiddenInput = document.getElementById("selectedDogType");
  if (hiddenInput) {
    hiddenInput.value = dogType;
  }

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
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab || !tab.id) {
      throw new Error("找不到當前標籤頁");
    }
    console.log(`[Popup] 🎯 準備發送 ${action} 到標籤頁 ${tab.id}`);

    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action,
        ...data,
      });
      console.log(`[Popup] ✅ 消息發送成功 (${action}):`, response);
      return response;
    } catch (firstError) {
      console.warn(
        `[Popup] 📋 第一次嘗試發送 ${action} 失敗: ${firstError.message}. 準備注入 content script...`
      );
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"],
        });
        console.log("[Popup] ✅ Content script 已注入，等待初始化...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const response = await chrome.tabs.sendMessage(tab.id, {
          action,
          ...data,
        });
        console.log(`[Popup] ✅ 重試成功 (${action}):`, response);
        return response;
      } catch (injectionError) {
        console.error("[Popup] ❌ 注入失敗:", injectionError);
        if (
          injectionError.message
            .toLowerCase()
            .includes("cannot access a chrome extension page") ||
          injectionError.message
            .toLowerCase()
            .includes("cannot access chrome:// pages")
        ) {
          showAlert(
            "⚠️ 無法在此頁面運行寵物功能！\n\n請在一般網頁（如 Google、YouTube）上使用。系統頁面或擴充功能頁面不支援此功能。"
          );
        } else {
          showAlert(`無法注入寵物程式到當前頁面: ${injectionError.message}`);
        }
        throw new Error("無法注入 content script");
      }
    }
  } catch (error) {
    console.error(`[Popup] ❌ 發送 ${action} 消息失敗:`, error);
    if (error.message.includes("Receiving end does not exist")) {
      showAlert("🔄 請重新整理網頁後再試一次！\n\n寵物需要重新準備一下 🐾");
    } else if (
      !error.message.includes("無法注入 content script") &&
      !error.message.includes("無法在此頁面運行寵物功能")
    ) {
      showAlert(
        `❌ 發生錯誤: ${error.message}\n\n建議:\n1. 重新整理網頁\n2. 在一般網頁上使用\n3. 重新載入擴充功能`
      );
    }
    return null;
  }
}

// 2.6️⃣ 檢查當前頁面是否相容
async function checkPageCompatibility() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab || !tab.url) return false;
    const restrictedPrefixes = [
      "chrome://",
      "chrome-extension://",
      "moz-extension://",
      "edge://",
      "opera://",
      "about:",
      "file://",
      "https://chrome.google.com/webstore",
    ];
    return !restrictedPrefixes.some((prefix) => tab.url.startsWith(prefix));
  } catch (error) {
    console.error("[Popup] Error checking page compatibility:", error);
    return false;
  }
}

// 🤖 GPT 相關功能
async function generatePetResponse(userMessage, petName, petType = "dog1") {
  const personality =
    PET_PERSONALITIES[petType]?.personality || "playful and friendly";
  if (!OPENAI_API_KEY || OPENAI_API_KEY === "YOUR_OPENAI_API_KEY_HERE") {
    return getDefaultPetResponse(petType);
  }
  try {
    // ... (fetch to OpenAI - unchanged) ...
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content: `You are a virtual pet named ${petName}. Your personality is ${personality}. Your type is ${
              petType === "cat1" ? "a cat" : "a dog"
            }.
Please respond in a cute pet manner:
- Use sounds appropriate to your type.
- Show love/loyalty (dog) or affection/independence (cat).
- Keep a playful and adorable tone (matching your personality).
- Mention things pets love.
- Keep responses short and emotional (under 50 words).
- Use emojis and action descriptions like *wags tail*, *purrs*.
- IMPORTANT: Always respond in English only, regardless of the user's language.
- IMPORTANT: Stay consistent with your personality.`,
          },
          { role: "user", content: userMessage },
        ],
        temperature: 0.8,
        max_tokens: 100,
        presence_penalty: 0.6,
        frequency_penalty: 0.5,
      }),
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("[Popup] ❌ OpenAI API Error (generatePetResponse):", error);
    return getDefaultPetResponse(petType);
  }
}

function getDefaultPetResponse(petType = "dog1") {
  const dogResponses = [
    "Woof! That sounds interesting!",
    "Arf arf! I love hearing from you!",
    "*wags tail* You're the best!",
    "汪汪！我好愛你喔！",
    "*搖尾巴* 真的嗎？好棒喔！",
  ];
  const catResponses = [
    "Meow? Tell me more!",
    "Purrrr... that makes me happy!",
    "Mrow! Thanks for sharing with me!",
    "*rubs against leg*",
    "Purr... I missed you!",
  ];
  const responses = petType === "cat1" ? catResponses : dogResponses;
  return responses[Math.floor(Math.random() * responses.length)];
}

function createTypingIndicator() {
  const indicator = document.createElement("div");
  indicator.className = "message typing-indicator";
  indicator.innerHTML = `
    <div class="dog-avatar-small"></div> 
    <div class="message-content"><span class="typing-dots"><span>.</span><span>.</span><span>.</span></span></div>`;
  return indicator;
}

async function getConversationContext(roomCode, limit = 5) {
  try {
    const snapshot = await db
      .collection("chats")
      .doc(roomCode)
      .collection("messages")
      .orderBy("timestamp", "desc")
      .limit(limit * 2)
      .get();
    const messages = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      messages.unshift({
        role: data.sender === "user" ? "user" : "assistant",
        content: data.text,
      });
    });
    return messages.slice(-limit * 2);
  } catch (error) {
    console.error("[Popup] 獲取對話歷史失敗:", error);
    return [];
  }
}

async function generatePetResponseWithContext(
  userMessage,
  petName,
  roomCode,
  petType = "dog1"
) {
  const personality =
    PET_PERSONALITIES[petType]?.personality || "playful and friendly";
  if (!OPENAI_API_KEY || OPENAI_API_KEY === "YOUR_OPENAI_API_KEY_HERE") {
    return getDefaultPetResponse(petType);
  }
  try {
    const conversationHistory = await getConversationContext(roomCode, 3);
    const messages = [
      {
        role: "system",
        content: `You are a virtual pet named ${petName}. Your personality is ${personality}. Your type is ${
          petType === "cat1" ? "a cat" : "a dog"
        }.
Respond cute & short (under 50 words, English only). Remember context. Use sounds & actions (*wags tail*).`,
      },
      ...conversationHistory,
      { role: "user", content: userMessage },
    ];
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: 0.8,
        max_tokens: 100,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `API Error: ${response.status} - ${
          errorData.error?.message || "Unknown"
        }`
      );
    }
    const data = await response.json();
    if (data.choices?.[0]?.message) return data.choices[0].message.content;
    throw new Error("Invalid OpenAI response structure.");
  } catch (error) {
    console.error(
      "[Popup] ❌ OpenAI API Error (generatePetResponseWithContext):",
      error
    );
    return getDefaultPetResponse(petType);
  }
}

// 🆕 聊天相關函式
function displayMessage(text, sender, senderName) {
  const messagesContainer = document.getElementById("chatMessages");
  if (!messagesContainer) return;
  const msgEl = document.createElement("div");

  // For pet's avatar in chat, could use currentPetTypeIndicator if available
  const currentPetType =
    document.getElementById("currentPetTypeIndicator")?.value || "dog1";
  const avatarClass =
    sender === "user"
      ? "user-avatar-small"
      : currentPetType === "cat1"
      ? "cat-avatar-small"
      : "dog-avatar-small";

  if (sender === "user") {
    msgEl.className = "message user-typing";
    msgEl.innerHTML = `<div class="${avatarClass}"></div><div class="message-content"><span class="user-name">You</span> ${text}</div>`;
  } else {
    msgEl.className = "message";
    msgEl.innerHTML = `<div class="${avatarClass}"></div><div class="message-content"><span class="pet-name-small">*${
      senderName || "Pet"
    }*</span> ${text}</div>`;
  }
  messagesContainer.appendChild(msgEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function saveMessageToFirebase(text, sender, senderName) {
  const roomCode = document.getElementById("roomCode")?.textContent;
  if (!roomCode) return;
  try {
    await db.collection("chats").doc(roomCode).collection("messages").add({
      text,
      sender,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      senderName,
    });
    console.log("[Popup] ✅ 訊息已儲存到 Firebase");
  } catch (error) {
    console.error("[Popup] ❌ 儲存訊息失敗:", error);
  }
}

async function loadChatHistory() {
  const roomCode = document.getElementById("roomCode")?.textContent;
  if (!roomCode) return;
  const messagesContainer = document.getElementById("chatMessages");
  if (!messagesContainer) return;
  messagesContainer.innerHTML = "";
  const petName = document.getElementById("userName")?.textContent || "Pet";
  const currentPetType =
    document.getElementById("currentPetTypeIndicator")?.value || "dog1";
  try {
    const snapshot = await db
      .collection("chats")
      .doc(roomCode)
      .collection("messages")
      .orderBy("timestamp", "asc")
      .limit(50)
      .get();
    if (snapshot.empty) {
      const greeting =
        currentPetType === "cat1"
          ? `Meow! I missed you, ${petName}! Let's chat!`
          : `Woof! I missed you, ${petName}! Let's chat!`;
      displayMessage(greeting, "pet", petName);
    } else {
      snapshot.forEach((doc) => {
        const data = doc.data();
        displayMessage(data.text, data.sender, data.senderName);
      });
      console.log(`[Popup] ✅ 載入了 ${snapshot.size} 條歷史訊息`);
    }
  } catch (error) {
    console.error("[Popup] ❌ 載入聊天記錄失敗:", error);
  }
}

let chatListener = null;
function startChatListener() {
  const roomCode = document.getElementById("roomCode")?.textContent;
  if (!roomCode) return;
  if (chatListener) chatListener(); // Unsubscribe previous listener

  chatListener = db
    .collection("chats")
    .doc(roomCode)
    .collection("messages")
    .orderBy("timestamp", "desc")
    .limit(1)
    .onSnapshot(
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            const messagesContainer = document.getElementById("chatMessages");
            if (!messagesContainer) return;
            const lastMsgContentEl = messagesContainer.querySelector(
              ".message:last-child .message-content"
            );
            // A more robust check to avoid duplicate display, especially for self-sent messages via listener
            if (
              lastMsgContentEl &&
              lastMsgContentEl.textContent.includes(data.text) &&
              ((data.sender === "user" &&
                lastMsgContentEl.querySelector(".user-name")) ||
                (data.sender !== "user" &&
                  lastMsgContentEl
                    .querySelector(".pet-name-small")
                    ?.textContent.includes(data.senderName)))
            ) {
              console.log(
                "[Popup] Skipping duplicate message from listener:",
                data.text
              );
              return;
            }
            displayMessage(data.text, data.sender, data.senderName);
          }
        });
      },
      (error) => console.error("[Popup] ❌ 訊息監聽錯誤:", error)
    );
}

function stopChatListener() {
  if (chatListener) {
    chatListener();
    chatListener = null;
  }
}

async function sendMessage() {
  const input = document.getElementById("chatInput");
  if (!input) return;
  const message = input.value.trim();
  if (!message) return;

  const userName = document.getElementById("userName")?.textContent || "User";
  const petName = userName; // Pet's name is user's name
  const roomCode = document.getElementById("roomCode")?.textContent;
  if (!roomCode) return;

  const storageData = await chrome.storage.local.get(["petType"]);
  const currentPetType = storageData.petType || "dog1";

  displayMessage(message, "user", "You"); // Display user's message
  await saveMessageToFirebase(message, "user", userName); // Save user's message
  input.value = "";

  const typingIndicator = createTypingIndicator();
  const messagesContainer = document.getElementById("chatMessages");
  if (!messagesContainer) return;
  messagesContainer.appendChild(typingIndicator);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    const aiResponse = await generatePetResponseWithContext(
      message,
      petName,
      roomCode,
      currentPetType
    );
    typingIndicator.remove();
    displayMessage(aiResponse, "pet", petName); // Display AI's response
    await saveMessageToFirebase(aiResponse, "pet", petName); // Save AI's response
  } catch (error) {
    console.error("[Popup] 生成回應時發生錯誤:", error);
    typingIndicator.remove();
    const defaultResponse = getDefaultPetResponse(currentPetType);
    displayMessage(defaultResponse, "pet", petName);
    await saveMessageToFirebase(defaultResponse, "pet", petName);
  }
}

function renderAvatarFromData(data) {
  console.log("[renderAvatarFromData] 收到 data:", data);

  // 如果有 roomCode，表示已經有領養紀錄 → 顯示房間
  if (data.roomCode) {
    // 1️⃣ 填 roomCode / userName 到對應元素
    const roomCodeEl = document.getElementById("roomCode");
    const userNameEl = document.getElementById("userName");
    const petAvatarEl = document.getElementById("petAvatar");

    // 如果元素存在，就把文字塞上去
    if (roomCodeEl) roomCodeEl.textContent = data.roomCode;
    if (userNameEl) userNameEl.textContent = data.userName || "Guest";

    const petTypeFromStorage = data.petType || "dog1";
    console.log(
      "[renderAvatarFromData] Effective petType for avatar:",
      petTypeFromStorage
    );

    // 2️⃣ 把 petAvatarEl 裡面先清掉
    if (petAvatarEl) {
      petAvatarEl.innerHTML = "";
      console.log("[renderAvatarFromData] Cleared petAvatarEl.innerHTML");

      // 3️⃣ 建立 <img>，根據 petType 來決定 src
      const petIconImg = document.createElement("img");
      console.log(
        "[renderAvatarFromData] Created img element for room avatar:",
        petIconImg
      );

      let imgSrc = "";
      if (petTypeFromStorage === "dog1") {
        imgSrc = "images/Dog_happy.png";
      } else if (petTypeFromStorage === "cat1") {
        imgSrc = "images/Cat_happy.png";
      } else {
        imgSrc = "images/Dog_happy.png"; // Default fallback
      }
      console.log(
        "[renderAvatarFromData] Setting room avatar img src to:",
        imgSrc
      );

      // 設定 <img> 的 src + 樣式
      petIconImg.src = imgSrc;
      petIconImg.style.display = "block";
      petIconImg.style.width = "100%";
      petIconImg.style.height = "100%";
      petIconImg.style.objectFit = "contain";

      // onload / onerror 設定（方便偵錯 & fallback）
      petIconImg.onload = function () {
        console.log(
          "[renderAvatarFromData] Room avatar image LOADED successfully:",
          this.src
        );
      };
      petIconImg.onerror = function () {
        console.error(
          "[renderAvatarFromData] Room avatar image FAILED to load:",
          this.src
        );
        petAvatarEl.textContent = petTypeFromStorage === "cat1" ? "😺" : "🐕";
        Object.assign(petAvatarEl.style, {
          fontSize: "50px",
          lineHeight: petAvatarEl.clientHeight + "px" || "120px",
          textAlign: "center",
          color: "white",
        });
      };

      // 把 <img> 加回到 #petAvatar 裡
      petAvatarEl.appendChild(petIconImg);
      console.log(
        "[renderAvatarFromData] Appended room avatar img. Current petAvatarEl.innerHTML:",
        petAvatarEl.innerHTML
      );
    } else {
      console.error(
        "[renderAvatarFromData] ERROR: petAvatarEl not found in DOM for setting image!"
      );
    }

    // 4️⃣ 建／更新一個隱藏 input，供其他程式讀取「目前 petType」
    let currentPetTypeIndicator = document.getElementById(
      "currentPetTypeIndicator"
    );
    if (!currentPetTypeIndicator) {
      currentPetTypeIndicator = document.createElement("input");
      currentPetTypeIndicator.type = "hidden";
      currentPetTypeIndicator.id = "currentPetTypeIndicator";
      document.body.appendChild(currentPetTypeIndicator);
    }
    currentPetTypeIndicator.value = petTypeFromStorage;

    // 5️⃣ 最後切到 view-room
    showView("view-room");
    console.log("[renderAvatarFromData] Called showView('view-room')");
  } else {
    // 如果沒有 roomCode，代表尚未領養 → 顯示「領養／初始化畫面」（view-init / view-adopt）
    console.log(
      "[renderAvatarFromData] No roomCode in data. Showing view-init."
    );
    showView("view-init");
  }
}

// 3️⃣ DOMContentLoaded 中綁定所有事件
document.addEventListener("DOMContentLoaded", () => {
  console.log("🎯 DOM 載入完成");

  const dogOptions = document.querySelectorAll(".dog-option");
  dogOptions.forEach((opt) => {
    opt.addEventListener("click", () => {
      const dt = opt.getAttribute("data-dog-type");
      selectDogOption(dt);
    });
  });

  const viewAdopt = document.getElementById("view-adopt");
  if (viewAdopt && viewAdopt.classList.contains("active")) {
    selectDogOption("dog1");
  }

  setTimeout(() => {
    const loadingOverlay = document.getElementById("loadingOverlay");
    if (loadingOverlay) loadingOverlay.classList.add("hidden");
    document.body.classList.remove("loading");
  }, 200);

  chrome.storage.local.get(["roomCode", "userName", "petType"], (data) => {
    console.log("[Popup] Storage data retrieved on DOMContentLoaded:", data);
    renderAvatarFromData(data);
  });

  // Donate button events
  document.getElementById("btnDonate")?.addEventListener("click", () => {
    showView("view-donate"); /* ... (rest of donate logic unchanged) ... */
  });
  document
    .getElementById("btnBackFromDonate")
    ?.addEventListener("click", () => showView("view-room"));
  let selectedDonationAmount = 0;
  document.querySelectorAll(".amount-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      /* ... (rest of amount selection unchanged) ... */
      document
        .querySelectorAll(".amount-btn")
        .forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedDonationAmount = parseInt(btn.dataset.amount);
      const selAmtEl = document.getElementById("selectedAmount");
      if (selAmtEl) selAmtEl.textContent = `$${selectedDonationAmount}`;
      const subBtn = document.getElementById("btnSubmitDonate");
      if (subBtn) subBtn.classList.add("active");
    });
  });
  document.getElementById("btnSubmitDonate")?.addEventListener("click", () => {
    if (selectedDonationAmount > 0) {
      /* ... (rest of submit unchanged) ... */
      showAlert(`Thank you for your $${selectedDonationAmount} donation! ...`);
      setTimeout(() => showView("view-room"), 100);
    }
  });

  // Navigation buttons
  document.getElementById("btnNew")?.addEventListener("click", () => {
    chrome.storage.local.remove(["roomCode", "userName", "petType"]);
    const adoptNameEl = document.getElementById("adoptName");
    if (adoptNameEl) adoptNameEl.value = "";
    selectDogOption("dog1");
    showView("view-adopt");
  });
  document.getElementById("btnExisting")?.addEventListener("click", () => {
    const enterCodeEl = document.getElementById("enterCode");
    if (enterCodeEl) enterCodeEl.value = "";
    showView("view-enter");
  });
  document
    .getElementById("btnBackFromAdopt")
    ?.addEventListener("click", () => showView("view-init"));
  document
    .getElementById("btnBackFromEnter")
    ?.addEventListener("click", () => showView("view-init"));

  // Chat buttons
  document.getElementById("btnChat")?.addEventListener("click", async () => {
    showView("view-chat");
    await loadChatHistory();
    startChatListener();
  });
  document.getElementById("btnCloseChat")?.addEventListener("click", () => {
    stopChatListener();
    showView("view-room");
  });
  document.getElementById("btnSend")?.addEventListener("click", sendMessage);
  document.getElementById("chatInput")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  // Pet action buttons
  const actionButtons = document.querySelectorAll(
    ".action-btn:not(#btnChat):not(#btnDonate)"
  );
  actionButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.textContent.trim();
      await handlePetAction(action);
    });
  });

  // Invite button
  const inviteBtn = document.querySelector(".header-btn:not(#btnExit)");
  if (inviteBtn) {
    inviteBtn.addEventListener("click", () => {
      /* ... (invite logic unchanged) ... */
      const roomCode = document.getElementById("roomCode")?.textContent;
      if (!roomCode) {
        showAlert("無法獲取房間碼。");
        return;
      }
      const message = `Join my NovaPet space!\nRoom code: ${roomCode}`;
      if (navigator.clipboard) {
        navigator.clipboard
          .writeText(roomCode)
          .then(() => showAlert("房間碼已複製!"))
          .catch(() => showAlert(message));
      } else {
        showAlert(message);
      }
    });
  }
});

// 4️⃣ 領養新寵物
document.getElementById("btnAdopt")?.addEventListener("click", async () => {
  const nameInput = document.getElementById("adoptName");
  if (!nameInput) return;
  const name = nameInput.value.trim();
  if (!name) {
    showAlert("請輸入你的名字");
    return;
  }
  if (!selectedDogType) {
    showAlert("請先選擇你要領養的寵物！");
    return;
  }

  setButtonLoading("btnAdopt", true);
  const code = genCode();
  try {
    const cred = await auth.signInAnonymously();
    await db.collection("rooms").doc(code).set({
      owner: cred.user.uid,
      name,
      petType: selectedDogType,
      happiness: 30,
      stars: 152,
      notifications: 4,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    const userNameEl = document.getElementById("userName");
    if (userNameEl) userNameEl.textContent = name;
    const roomCodeEl = document.getElementById("roomCode");
    if (roomCodeEl) roomCodeEl.textContent = code;

    chrome.storage.local.set(
      {
        roomCode: code,
        userName: name,
        petType: selectedDogType,
      },
      () => {
        console.log("[Popup] ✅ 已儲存 roomCode, userName, petType 到 Storage");
        // 再讀一次 Storage，把 avatar、文字一次 render 完全
        chrome.storage.local.get(
          ["roomCode", "userName", "petType"],
          (data) => {
            renderAvatarFromData(data);
          }
        );
      }
    );
    console.log("[Popup] ✅ 房間創建成功:", code);
  } catch (error) {
    console.error("[Popup] ❌ 創建房間失敗:", error);
    showAlert("創建房間失敗，請稍後再試");
  } finally {
    setButtonLoading("btnAdopt", false);
  }
});

// 5️⃣ 加入現有房間
document.getElementById("btnEnter")?.addEventListener("click", async () => {
  const codeInput = document.getElementById("enterCode");
  if (!codeInput) return;
  const code = codeInput.value.trim().toUpperCase();
  if (!code) {
    showAlert("請輸入房間碼");
    return;
  }

  setButtonLoading("btnEnter", true);
  try {
    // const cred = await auth.signInAnonymously(); // Not strictly needed if just joining
    const roomDoc = await db.collection("rooms").doc(code).get();
    if (!roomDoc.exists) {
      showAlert("房間不存在，請檢查房間碼");
      setButtonLoading("btnEnter", false);
      return;
    }
    const roomData = roomDoc.data();
    const name = roomData.name || "Guest";
    const petTypeFromDB = roomData.petType || "dog1";

    const roomCodeEl = document.getElementById("roomCode");
    if (roomCodeEl) roomCodeEl.textContent = code;
    const userNameEl = document.getElementById("userName");
    if (userNameEl) userNameEl.textContent = name;

    // 3. 寫入 storage，並在 callback 中呼叫 renderAvatarFromData() → 才真正把 avatar 塞進去
    chrome.storage.local.set(
      {
        roomCode: code,
        userName: name,
        petType: petTypeFromDB,
      },
      () => {
        console.log("[Popup] ✅ 已將 roomCode, userName, petType 存進 storage");
        // 4. 讀出 storage 裡的新值並渲染 avatar 與文字，再切到 view-room
        chrome.storage.local.get(
          ["roomCode", "userName", "petType"],
          (data) => {
            renderAvatarFromData(data);
            console.log(
              "[Popup] ✅ renderAvatarFromData 已執行，畫面切到 view-room"
            );
          }
        );
      }
    );
    // 註：不要再寫 showView("view-room")，因為 renderAvatarFromData 裡已經包含了 showView
    // console.log("[Popup] ✅ 成功加入房間:", code);
  } catch (error) {
    console.error("[Popup] ❌ 加入房間失敗:", error);
    showAlert("加入房間失敗，請稍後再試");
  } finally {
    setButtonLoading("btnEnter", false);
  }
});

// 6️⃣ 退出房間
document.getElementById("btnExit")?.addEventListener("click", async () => {
  const roomCode = document.getElementById("roomCode")?.textContent;
  const confirmMessage = `Are you sure? You will need the space name to come back.\n\nSpace code: ${
    roomCode || "N/A"
  }`;

  if (confirm(confirmMessage)) {
    try {
      console.log("[Popup] 🐾 正在移除寵物...");
      const removeResult = await sendMessageToContentScript("REMOVE_DOG");
      if (removeResult?.success)
        console.log("[Popup] ✅ 寵物已成功移除 (from content script)");
      else console.warn("[Popup] ⚠️ 移除寵物可能失敗或未收到確認");
    } catch (error) {
      console.error("[Popup] ❌ 移除寵物時發生錯誤:", error);
    }
    stopChatListener();
    chrome.storage.local.remove(["roomCode", "userName", "petType"], () => {
      console.log("[Popup] ✅ 已退出房間，清除localStorage");
      const roomCodeEl = document.getElementById("roomCode");
      if (roomCodeEl) roomCodeEl.textContent = "";
      const userNameEl = document.getElementById("userName");
      if (userNameEl) userNameEl.textContent = "";
      const petAvatarEl = document.getElementById("petAvatar");
      if (petAvatarEl) petAvatarEl.innerHTML = "";
      showView("view-init");
    });
  }
});

// 7️⃣ 寵物動作處理
async function handlePetAction(actionText) {
  const userName = document.getElementById("userName")?.textContent || "Pet";
  console.log(`[Popup] 🐾 執行動作: ${actionText} for ${userName}`);

  const isCompatible = await checkPageCompatibility();
  if (!isCompatible) {
    showAlert("⚠️ 此頁面不支援寵物功能！...\n");
    return;
  }

  let actionToSend;
  // let alertMessage = ""; // Alert handled by content script or not at all

  switch (actionText) {
    case "Go out for a walk":
      actionToSend = "START_WALKING";
      break;
    // Add other cases like 'Feed', 'Treat', 'Toy' if you have dedicated buttons for them
    // For now, these actions are primarily triggered from content.js's control panel
    default:
      showAlert(`${actionText} 功能開發中...`);
      return;
  }

  if (actionToSend) {
    const storageData = await chrome.storage.local.get(["petType"]);
    const currentPetType = storageData.petType || "dog1";
    const petPersonality = PET_PERSONALITIES[currentPetType]?.personality;

    const result = await sendMessageToContentScript(actionToSend, {
      dogName: userName, // This is passed as pet's name to content script
      personality: petPersonality,
      // petType: currentPetType // Optionally pass petType if content script needs it for this action
    });

    if (result?.success)
      console.log(`[Popup] ${actionToSend} 成功:`, result.message || "OK");
    else
      console.warn(
        `[Popup] ${actionToSend} 可能失敗:`,
        result?.message || "No confirmation"
      );
  }
}

// 8️⃣ 全局錯誤處理 & 卸載時處理
window.addEventListener("error", (event) => {
  console.error(
    "[Popup] ❌ 全局錯誤:",
    event.error,
    event.message,
    event.filename,
    event.lineno
  );
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("[Popup] ❌ 未處理的 Promise Rejection:", event.reason);
});
window.addEventListener("beforeunload", () => {
  stopChatListener();
});

// 🔟 Firebase 重啟連線
firebase
  .firestore()
  .enableNetwork()
  .then(() => console.log("[Popup] ✅ Firebase 網路已啟用"))
  .catch((error) => console.error("[Popup] ❌ Firebase 啟用網路失敗:", error));
