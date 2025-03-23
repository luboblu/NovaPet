// =========================
// 1. 建立狗狗容器 (可拖曳 + 會自動亂跑)
// =========================
let dogContainer = document.createElement('div');
dogContainer.style.position = 'fixed';
dogContainer.style.width = '100px';
dogContainer.style.height = 'auto';
dogContainer.style.zIndex = '10000';
dogContainer.style.pointerEvents = 'auto';
dogContainer.style.cursor = 'move';
// 先不要給容器 transition，避免初始就有拖曳延遲
dogContainer.style.transition = 'none';
document.body.appendChild(dogContainer);

// 建立狗狗 (GIF)
let dog = document.createElement('img');
dog.src = chrome.runtime.getURL('dog.gif');
dog.style.width = '100%';
dog.style.height = 'auto';
dogContainer.appendChild(dog);

// =========================
// 2. 建立對話框
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
// 3. 建立狗屋
// =========================
let dogHouse = document.createElement('img');
dogHouse.src = chrome.runtime.getURL('dogHouse.png');
dogHouse.style.position = 'fixed';
dogHouse.style.width = '120px';
dogHouse.style.height = 'auto';
dogHouse.style.left = '20px';
dogHouse.style.bottom = '20px';
dogHouse.style.zIndex = '9999';
document.body.appendChild(dogHouse);

// =========================
// 4. 自動亂跑邏輯 (在這裡才設 transition = 'all 2s')
// =========================
function moveDogRandomly() {
  // 讓容器在「自動亂跑」時有 2 秒平滑動畫
  dogContainer.style.transition = 'all 2s linear';

  let x = Math.random() * (window.innerWidth - dogContainer.offsetWidth);
  let y = Math.random() * (window.innerHeight - dogContainer.offsetHeight);
  dogContainer.style.left = x + 'px';
  dogContainer.style.top = y + 'px';

  showDogDialogue();
  setTimeout(() => {
    checkDogInHouse();
  }, 2000);
}

// 每3秒移動一次
let moveInterval = setInterval(moveDogRandomly, 3000);
moveDogRandomly();

// =========================
// 5. 滑鼠拖曳 (在這裡 transition = 'none')
// =========================
let isDragging = false;
let offsetX = 0;
let offsetY = 0;

dogContainer.addEventListener('mousedown', (e) => {
  e.preventDefault();
  isDragging = true;
  // 一旦開始拖曳，就把 transition 關掉 => 即時跟隨
  dogContainer.style.transition = 'none';

  let rect = dogContainer.getBoundingClientRect();
  offsetX = e.clientX - rect.left;
  offsetY = e.clientY - rect.top;

  // 若想拖曳時暫停自動亂跑，可在這裡停掉
  // clearInterval(moveInterval);
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  e.preventDefault();

  let x = e.clientX - offsetX;
  let y = e.clientY - offsetY;

  x = Math.max(0, Math.min(window.innerWidth - dogContainer.offsetWidth, x));
  y = Math.max(0, Math.min(window.innerHeight - dogContainer.offsetHeight, y));

  // 拖曳時馬上更新 left / top => 同步跟隨滑鼠
  dogContainer.style.left = x + 'px';
  dogContainer.style.top = y + 'px';
});

document.addEventListener('mouseup', (e) => {
  if (isDragging) {
    isDragging = false;
    // 拖曳結束，可重新啟動亂跑或檢查狗屋
    checkDogInHouse();

    // 如果要馬上恢復自動移動的動畫，可在這裡再度設 transition
    // dogContainer.style.transition = 'all 2s linear';
  }
});

// =========================
// 6. 檢查狗狗是否進入狗屋
// =========================
function checkDogInHouse() {
  let dogRect = dogContainer.getBoundingClientRect();
  let houseRect = dogHouse.getBoundingClientRect();

  if (isColliding(dogRect, houseRect)) {
    dogHouse.src = chrome.runtime.getURL('dogHouseWithDog.png');
    dogContainer.style.display = 'none';
    alert("我回家囉！");
  }
}

function isColliding(r1, r2) {
  return !(
    r1.right < r2.left ||
    r1.left > r2.right ||
    r1.bottom < r2.top ||
    r1.top > r2.bottom
  );
}

// =========================
// 7. 讓狗狗再度出來
// =========================
function letDogOut() {
  dogHouse.src = chrome.runtime.getURL('dogHouse.png');
  dogContainer.style.display = 'block';
  // 也可以重置位置、再呼叫 moveDogRandomly()，視需求而定
  moveDogRandomly();
}

// =========================
// 8. 建立按鈕，呼叫 letDogOut
// =========================
let letOutButton = document.createElement('button');
letOutButton.innerText = "Let Dog Out";
letOutButton.style.position = 'fixed';
letOutButton.style.top = '10px';
letOutButton.style.right = '10px';
letOutButton.style.zIndex = '999999';
document.body.appendChild(letOutButton);

letOutButton.addEventListener('click', () => {
  letDogOut();
});
