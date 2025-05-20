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

// 2️⃣ 幫你包好的畫面切換與工具函式
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// 3️⃣ 一開始先從 storage 撈有沒有上次的 roomCode
chrome.storage.local.get(['roomCode','userName'], data => {
  if (data.roomCode) {
    // 🚪 有存，直接顯示房間頁
    document.getElementById('roomCode').textContent = data.roomCode;
    document.getElementById('userName').textContent = data.userName || 'Guest';
    showView('view-room');
  } else {
    // 🏠 沒存，顯示【初始選單】而非 adopt 畫面
    showView('view-init');
  }
});

// 4️⃣ 領養新狗
document.getElementById('btnAdopt').addEventListener('click', async () => {
  const name = document.getElementById('adoptName').value.trim();
  if (!name) return alert('請輸入名字');

  const code = genCode();
  document.getElementById('userName').textContent = name;
  document.getElementById('roomCode').textContent = code;

  try {
    const cred = await auth.signInAnonymously();
    await db.collection('rooms').doc(code).set({
      owner: cred.user.uid,
      name,
      personality: '活潑友善',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.error(e);
    return alert('建立房間失敗');
  }

  // 存 session，下次打開直接回到房間頁
  chrome.storage.local.set({ roomCode: code, userName: name });
  showView('view-room');
});

// 5️⃣ Exit space：清掉 storage，回到初始選單
document.getElementById('btnExit').addEventListener('click', () => {
  const code = document.getElementById('roomCode').textContent;
  if (confirm(`Are you sure? You will need the space name to come back.\n${code}`)) {
    chrome.storage.local.remove(['roomCode','userName'], () => {
      showView('view-init');
    });
  }
});

// 6️⃣ Get a new dog（清除舊 session）  
document.getElementById('btnNew').addEventListener('click', () => {
  chrome.storage.local.remove(['roomCode','userName']);
  document.getElementById('adoptName').value = '';
  showView('view-adopt');
});

// 7️⃣ Take care of an existing dog  
document.getElementById('btnExisting').addEventListener('click', () => {
  document.getElementById('enterCode').value = '';
  showView('view-enter');
});

// 8️⃣ Enter space  
document.getElementById('btnEnter').addEventListener('click', async () => {
  const code = document.getElementById('enterCode').value.trim();
  if (!code) return alert('請輸入房間碼');

  document.getElementById('roomCode').textContent = code;
  document.getElementById('userName').textContent = 'Guest';

  try {
    const cred = await auth.signInAnonymously();
    await db.collection('users').doc(cred.user.uid).set({
      room: code,
      joinedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.error(e);
  }

  chrome.storage.local.set({ roomCode: code, userName: 'Guest' });
  showView('view-room');
});
