// =========================
// 1. 建立狗狗容器 (可拖曳 + 會自動亂跑)
// =========================
let dogContainer = document.createElement('div');
dogContainer.style.position = 'fixed';
dogContainer.style.width = '100px';
dogContainer.style.height = 'auto';
dogContainer.style.zIndex = '10000';
// 允許滑鼠點擊，才能拖曳
dogContainer.style.pointerEvents = 'auto';
dogContainer.style.cursor = 'move';
document.body.appendChild(dogContainer);

// 建立狗狗 (GIF)
let dog = document.createElement('img');
dog.src = chrome.runtime.getURL('dog.gif'); // 確認 manifest.json 有宣告 dog.gif
dog.style.width = '100%';
dog.style.height = 'auto';
// 不要再用 position: fixed / absolute，以免脫離容器
dogContainer.appendChild(dog);

// =========================
// 2. 建立對話框 (與狗狗同容器)
// =========================
let dogDialog = document.createElement('div');
dogDialog.style.position = 'absolute';
dogDialog.style.left = '110px';
dogDialog.style.top = '0px';
dogDialog.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
dogDialog.style.border = '1px solid #000';
dogDialog.style.borderRadius = '8px';
dogDialog.style.padding = '5px 10px';
dogDialog.style.transition = 'opacity 0.5s ease';
dogDialog.style.opacity = '0';
dogDialog.style.pointerEvents = 'none';
dogContainer.appendChild(dogDialog);


let dialogues = ["嗨！", "好開心！", "一起玩吧！", "汪汪！"];

// 顯示對話框
function showDogDialogue() {
  let randomDialogue = dialogues[Math.floor(Math.random() * dialogues.length)];
  dogDialog.textContent = randomDialogue;
  dogDialog.style.opacity = '1';
  setTimeout(() => {
    dogDialog.style.opacity = '0';
  }, 2000);
}

// =========================
// 3. 建立狗屋 (固定在螢幕某處)
// =========================
let dogHouse = document.createElement('img');
dogHouse.src = chrome.runtime.getURL('dogHouse.png'); // 確認 manifest.json 有宣告 dogHouse.png
dogHouse.style.position = 'fixed';
dogHouse.style.width = '120px';
dogHouse.style.height = 'auto';
// 例如放在螢幕左下角
dogHouse.style.left = '20px';
dogHouse.style.bottom = '20px';
dogHouse.style.zIndex = '9999';
document.body.appendChild(dogHouse);

// =========================
// 4. 自動亂跑邏輯
// =========================
function moveDogRandomly() {
  // 計算容器的新座標
  let x = Math.random() * (window.innerWidth - dogContainer.offsetWidth);
  let y = Math.random() * (window.innerHeight - dogContainer.offsetHeight);
  // 動畫效果 (2秒內移動到新位置)
  dogContainer.style.transition = 'all 2s linear';
  dogContainer.style.left = `${x}px`;
  dogContainer.style.top = `${y}px`;

  // 移動後顯示對話框
  showDogDialogue();

  // 2秒後(等動畫結束)，檢查是否進屋
  setTimeout(() => {
    checkDogInHouse();
  }, 2000);
}

// 每3秒移動一次
let moveInterval = setInterval(moveDogRandomly, 3000);
// 初始化先移動一次
moveDogRandomly();

// =========================
// 5. 滑鼠拖曳狗狗容器
// =========================
let isDragging = false;
let offsetX = 0;
let offsetY = 0;

// mousedown：開始拖曳
dogContainer.addEventListener('mousedown', (e) => {
  e.preventDefault();
  isDragging = true;
  // 取得容器目前位置
  let rect = dogContainer.getBoundingClientRect();
  offsetX = e.clientX - rect.left;
  offsetY = e.clientY - rect.top;

  // 如果想拖曳時暫停狗狗亂跑，可在這裡停掉 setInterval
  // clearInterval(moveInterval);
});

// mousemove：移動中
document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  e.preventDefault();

  let x = e.clientX - offsetX;
  let y = e.clientY - offsetY;

  // 防止拖出螢幕
  x = Math.max(0, Math.min(window.innerWidth - dogContainer.offsetWidth, x));
  y = Math.max(0, Math.min(window.innerHeight - dogContainer.offsetHeight, y));

  dogContainer.style.left = x + 'px';
  dogContainer.style.top = y + 'px';
});

// mouseup：結束拖曳
document.addEventListener('mouseup', (e) => {
  if (isDragging) {
    isDragging = false;
    // 結束拖曳後可再啟動亂跑
    // moveInterval = setInterval(moveDogRandomly, 3000);
    // 檢查是否進屋
    checkDogInHouse();
  }
});

// =========================
// 6. 檢查狗狗是否進入狗屋 (碰撞偵測)
// =========================
function checkDogInHouse() {
  let dogRect = dogContainer.getBoundingClientRect();
  let houseRect = dogHouse.getBoundingClientRect();

  // 判斷兩個矩形是否重疊
  if (isColliding(dogRect, houseRect)) {
    // 狗狗進屋 => 換狗屋圖 & 隱藏狗狗容器
    dogHouse.src = chrome.runtime.getURL('dogHouseWithDog.png');
    dogContainer.style.display = 'none';
    showDogDialogueMessage("我回家囉！");
  }
}

// 簡單的矩形重疊檢查
function isColliding(r1, r2) {
  return !(
    r1.right < r2.left ||
    r1.left > r2.right ||
    r1.bottom < r2.top ||
    r1.top > r2.bottom
  );
}

// 顯示一個簡單訊息對話框 (非狗狗對話框)
function showDogDialogueMessage(text) {
  alert(text);
  // 或者可以加個自訂 div 來顯示訊息，而不是用 alert
}

// =========================
// 7. 讓狗狗再度出來的函式
// =========================
function letDogOut() {
  // 1) 換回空狗屋
  dogHouse.src = chrome.runtime.getURL('dogHouse.png');

  // 2) 顯示狗狗容器
  dogContainer.style.display = 'block';

  // 3) 把狗狗容器的 (left, top) 設在狗屋附近
  //    先取得狗屋的座標
  let houseRect = dogHouse.getBoundingClientRect();
  
  // 這裡示範把狗狗「大約」放在狗屋中央
  // （您可以依自己需求微調 +/- 幾十 px）
  let startX = houseRect.left + (houseRect.width / 2) - (dogContainer.offsetWidth / 2);
  let startY = houseRect.top + (houseRect.height / 2) - (dogContainer.offsetHeight / 2);

  // 設定狗狗容器位置
  dogContainer.style.left = startX + 'px';
  dogContainer.style.top = startY + 'px';

  // 4) 讓狗狗從狗屋位置跑到隨機位置
  moveDogRandomly();
}

// =========================
// 8. （選擇性）建立按鈕，點擊呼叫 letDogOut
// =========================
let letOutButton = document.createElement('button');
letOutButton.innerText = "Let Dog Out";
letOutButton.style.position = 'fixed';
letOutButton.style.top = '10px';
letOutButton.style.right = '10px';
letOutButton.style.zIndex = '999999';
document.body.appendChild(letOutButton);

// 按下按鈕 => 呼叫 letDogOut()
letOutButton.addEventListener('click', () => {
  letDogOut();
});
