// ================ 0. OpenAI API Key (教學示範用) ================
const OPENAI_API_KEY = "請輸入你的OPEN API KEY"; 
// 請務必在 manifest.json 加上 "host_permissions": ["https://api.openai.com/*"]


// ================ 0.1 Generate dog dialogue (English version) ================
async function generateDogDialogue(personality) {
  // personality: "playful and mischievous, loves to joke around" 
  let systemMessage = `Your name is Xiaojimao, a dog with a ${personality} personality. Speak in short, cute, and fun English lines.`;
  let userMessage = `Please say the shortest and cutest English sentence in no more than 10 words.`;

  try {
    let response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: userMessage }
        ],
        max_tokens: 50,
        temperature: 1.0
      })
    });

    let data = await response.json();
    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content.trim();
    } else {
      return "...(The dog remains silent)";
    }
  } catch (err) {
    console.error("OpenAI API Error:", err);
    return "...(An error occurred)";
  }
}

// For example:
let dogPersonality = "playful and mischievous, loves to joke around";

// 中文版本
// async function generateDogDialogue(personality) {
//   // personality: "活潑又頑皮，喜歡跟人開玩笑" 
//   let systemMessage = `你的名字是小雞毛，你是一隻個性${personality}的小狗，說話要可愛、簡短、有趣。`;
//   let userMessage = `請你用最簡短可愛的中文說一句話，字數不超過10字。`;

//   try {
//     let response = await fetch("https://api.openai.com/v1/chat/completions", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         "Authorization": `Bearer ${OPENAI_API_KEY}`
//       },
//       body: JSON.stringify({
//         model: "gpt-3.5-turbo",
//         messages: [
//           { role: "system", content: systemMessage },
//           { role: "user", content: userMessage }
//         ],
//         max_tokens: 50,
//         temperature: 1.0
//       })
//     });

//     let data = await response.json();
//     if (data.choices && data.choices.length > 0) {
//       return data.choices[0].message.content.trim();
//     } else {
//       return "…（狗狗沉默了）";
//     }
//   } catch (err) {
//     console.error("OpenAI API 錯誤：", err);
//     return "…（發生錯誤）";
//   }
// }

// // 假設狗狗個性固定在這裡，您也可以讓使用者自行輸入
// let dogPersonality = "活潑又頑皮，喜歡跟人開玩笑";

// ================ 1. 建立狗狗容器 (可拖曳 + 會自動亂跑) ================
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

// ================ 2. 建立對話框 ================
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

// 關鍵：強制單行不換行
dogDialog.style.whiteSpace = 'nowrap';
dogDialog.style.display = 'inline-block';
dogDialog.style.maxWidth = 'none';

dogContainer.appendChild(dogDialog);


async function showDogDialogue() {
  let aiDialogue = await generateDogDialogue(dogPersonality);

  // 將換行符號統一替換成空白
  aiDialogue = aiDialogue.replace(/\n/g, ' ');

  dogDialog.textContent = aiDialogue;
  dogDialog.style.opacity = '1';

  setTimeout(() => {
    dogDialog.style.opacity = '0';
  }, 2000);
}


// ================ 3. 建立狗屋 ================
let dogHouse = document.createElement('img');
dogHouse.src = chrome.runtime.getURL('dogHouse.png');
dogHouse.style.position = 'fixed';
dogHouse.style.width = '120px';
dogHouse.style.height = 'auto';
dogHouse.style.left = '20px';
dogHouse.style.bottom = '20px';
dogHouse.style.zIndex = '9999';
document.body.appendChild(dogHouse);

// ================ 4. 自動亂跑邏輯 (這裡才設 transition) ================
function moveDogRandomly() {
  // 讓容器在「自動亂跑」時有 4 秒平滑動畫 (比原先2s更慢)
  dogContainer.style.transition = 'all 4s linear';

  let x = Math.random() * (window.innerWidth - dogContainer.offsetWidth);
  let y = Math.random() * (window.innerHeight - dogContainer.offsetHeight);
  dogContainer.style.left = x + 'px';
  dogContainer.style.top = y + 'px';

  // 移動4秒後(等動畫結束)，再顯示AI對話並檢查狗屋
  setTimeout(() => {
    showDogDialogue();
    checkDogInHouse();
  }, 4000);
}

// 每6秒移動一次 (比原先3s更久)
let moveInterval = setInterval(moveDogRandomly, 6000);

// ================ 顯示AI對話 (顯示久一點) ================
async function showDogDialogue() {
  let aiDialogue = await generateDogDialogue(dogPersonality);
  // 移除換行
  aiDialogue = aiDialogue.replace(/\n/g, ' ');

  dogDialog.textContent = aiDialogue;
  dogDialog.style.opacity = '1';

  // 原本2秒改為5秒才隱藏
  setTimeout(() => {
    dogDialog.style.opacity = '0';
  }, 5000);
}


// ================ 5. 滑鼠拖曳 (在這裡 transition = 'none') ================
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

// ================ 6. 檢查狗狗是否進入狗屋 ================
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

// ================ 7. 讓狗狗再度出來 ================
function letDogOut() {
  dogHouse.src = chrome.runtime.getURL('dogHouse.png');
  dogContainer.style.display = 'block';
  moveDogRandomly();
}

// ================ 8. 建立按鈕，呼叫 letDogOut ================
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
