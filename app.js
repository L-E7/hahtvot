const STORAGE_KEY = 'spellingAppData';

let appData = {
    user: null,
    children: [],
    dictations: {}
};

function loadAppDataFromStorage() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (saved && typeof saved === 'object') {
            appData = {
                user: saved.user || null,
                children: Array.isArray(saved.children) ? saved.children : [],
                dictations: saved.dictations && typeof saved.dictations === 'object' ? saved.dictations : {}
            };
        }
    } catch (e) {}
}

function saveAppData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    } catch (e) {}
}

loadAppDataFromStorage();

let currentChild = null;
let currentDictation = null;
let currentWordIndex = 0;
let userMistakes = [];
let synth = ('speechSynthesis' in window) ? window.speechSynthesis : null;
let voices = [];
let editingDictId = null;
let currentAudioPlayer = null;

function populateVoices() {
    if (!synth) return;
    try {
        const list = synth.getVoices();
        if (Array.isArray(list) && list.length > 0) {
            voices = list;
        }
    } catch (e) {}
}

populateVoices();
if (synth && 'onvoiceschanged' in synth) {
    synth.onvoiceschanged = populateVoices;
}

window.showScreen = function(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
    }
};

window.selectChildById = function(childId) {
    loadAppDataFromStorage();
    const found = (appData.children || []).find(c => c.id === childId);
    if (!found) return;
    currentChild = found;
    openParentOrPractice();
};

window.editChildName = function(event, childId) {
    if (event) event.stopPropagation();
    loadAppDataFromStorage();
    const child = (appData.children || []).find(c => c.id === childId);
    if (!child) return;

    const updatedName = prompt('ערוך את שם הילד/ה:', child.name);
    if (updatedName === null) return;

    const cleanName = updatedName.trim();
    if (!cleanName) {
        alert('שם הילד לא יכול להיות ריק');
        return;
    }

    child.name = cleanName;
    if (currentChild && currentChild.id === childId) {
        currentChild.name = cleanName;
    }
    saveAppData();
    renderProfiles();
};

window.deleteChildProfile = function(event, childId) {
    if (event) event.stopPropagation();
    loadAppDataFromStorage();
    const child = (appData.children || []).find(c => c.id === childId);
    if (!child) return;

    const ok = confirm(`למחוק את הפרופיל "${child.name}"?`);
    if (!ok) return;

    appData.children = appData.children.filter(c => c.id !== childId);
    if (appData.dictations && appData.dictations[childId]) {
        delete appData.dictations[childId];
    }
    if (currentChild && currentChild.id === childId) {
        currentChild = null;
    }
    saveAppData();
    renderProfiles();
};

function renderProfiles() {
    loadAppDataFromStorage();
    const container = document.getElementById('profiles-container');
    if (!container) return;
    container.innerHTML = '';

    if (!appData.children || appData.children.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #636e72; grid-column: 1 / -1;">אין עדיין פרופילים. הוסף ילד למטה 👇</p>';
        return;
    }

    appData.children.forEach(child => {
        const card = document.createElement('div');
        card.className = 'profile-card';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.alignItems = 'center';
        card.style.gap = '10px';

        const titleEl = document.createElement('h3');
        titleEl.style.margin = '0';
        titleEl.style.cursor = 'pointer';
        titleEl.innerText = `👤 ${child.name}`;

        const actionsRow = document.createElement('div');
        actionsRow.style.display = 'flex';
        actionsRow.style.gap = '8px';

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn secondary-btn';
        editBtn.style.width = 'auto';
        editBtn.style.padding = '5px 10px';
        editBtn.style.fontSize = '12px';
        editBtn.innerText = '✏️ ערוך שם';
        editBtn.addEventListener('click', (e) => window.editChildName(e, child.id));

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn secondary-btn';
        delBtn.style.width = 'auto';
        delBtn.style.padding = '5px 10px';
        delBtn.style.fontSize = '12px';
        delBtn.innerText = '🗑️';
        delBtn.addEventListener('click', (e) => window.deleteChildProfile(e, child.id));

        actionsRow.appendChild(editBtn);
        actionsRow.appendChild(delBtn);

        card.appendChild(titleEl);
        card.appendChild(actionsRow);

        card.addEventListener('click', () => {
            currentChild = child;
            openParentOrPractice();
        });

        container.appendChild(card);
    });
}

window.addChildProfile = function() {
    loadAppDataFromStorage();
    const nameInput = document.getElementById('new-child-name');
    const name = nameInput ? nameInput.value.trim() : '';
    if (!name) {
        alert('נא להכניס שם ילד');
        return;
    }
    if (!Array.isArray(appData.children)) {
        appData.children = [];
    }
    if (appData.children.length >= 5) {
        alert('ניתן להוסיף עד 5 ילדים בלבד');
        return;
    }

    const newChild = { id: 'child_' + Date.now(), name };
    appData.children.push(newChild);
    if (nameInput) nameInput.value = '';
    saveAppData();
    renderProfiles();
};

function saveAndRenderProfiles() {
    saveAppData();
    renderProfiles();
    showScreen('profile-screen');
}

window.loginAsGoogle = function() {
    loadAppDataFromStorage();
    appData.user = { name: 'הורה מחובר', email: 'parent@gmail.com' };
    saveAndRenderProfiles();
};

function openParentOrPractice() {
    const nameSpan = document.getElementById('current-managing-child');
    if (nameSpan && currentChild) nameSpan.innerText = currentChild.name;
    renderDictationsList();
    showScreen('parent-screen');
}

async function showHebrewHint() {
    if (!currentDictation) return;
    const currentItem = currentDictation.words[currentWordIndex];
    if (!currentItem) return;

    const hintBox = document.getElementById('hebrew-hint-display');
    const hintWord = document.getElementById('hebrew-hint-word');
    if (!hintBox || !hintWord) return;

    hintBox.style.display = 'block';

    if (currentItem.translation && currentItem.translation !== currentItem.word) {
        hintWord.innerText = currentItem.translation;
        return;
    }

    hintWord.innerText = 'מחפש תרגום...';
    try {
        const sourceLang = currentDictation.lang === 'he' ? 'he' : 'en';
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(currentItem.word)}&langpair=${sourceLang}|he`);
        const data = await res.json();
        const translated = data?.responseData?.translatedText;
        if (translated) {
            currentItem.translation = translated;
            hintWord.innerText = translated;
        } else {
            hintWord.innerText = 'לא נמצא תרגום';
        }
    } catch (err) {
        hintWord.innerText = 'שגיאה בטעינת תרגום';
    }
}

async function showImageHint() {
    if (!currentDictation) return;
    const currentItem = currentDictation.words[currentWordIndex];
    if (!currentItem) return;

    const imgBox = document.getElementById('image-hint-display');
    const statusEl = document.getElementById('image-hint-status');
    const imgEl = document.getElementById('image-hint-img');
    if (!imgBox || !statusEl || !imgEl) return;

    imgBox.style.display = 'block';
    imgEl.style.display = 'none';
    statusEl.innerText = 'מחפש תמונה...';

    try {
        const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(currentItem.word + ' filetype:bitmap')}&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=300&format=json&origin=*`;
        const res = await fetch(url);
        const data = await res.json();
        const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
        const match = pages.find(p => p.imageinfo && p.imageinfo[0] && (p.imageinfo[0].thumburl || p.imageinfo[0].url));

        if (match) {
            const info = match.imageinfo[0];
            imgEl.src = info.thumburl || info.url;
            imgEl.style.display = 'block';
            statusEl.innerText = '';
        } else {
            statusEl.innerText = 'לא נמצאה תמונה מתאימה למילה זו.';
        }
    } catch (err) {
        statusEl.innerText = 'לא ניתן לטעון תמונה כרגע.';
    }
}

function initAppHandlers() {
    renderProfiles();

    const loginBtn = document.getElementById('main-login-btn');
    if (loginBtn && !loginBtn.dataset.bound) {
        loginBtn.dataset.bound = '1';
        loginBtn.addEventListener('click', window.loginAsGoogle);
    }

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect && !themeSelect.dataset.bound) {
        themeSelect.dataset.bound = '1';
        themeSelect.addEventListener('change', (e) => {
            document.body.setAttribute('data-theme', e.target.value);
        });
    }

    const addChildBtn = document.getElementById('add-child-btn');
    if (addChildBtn && !addChildBtn.dataset.bound) {
        addChildBtn.dataset.bound = '1';
        addChildBtn.addEventListener('click', window.addChildProfile);
    }

    const childNameInput = document.getElementById('new-child-name');
    if (childNameInput && !childNameInput.dataset.bound) {
        childNameInput.dataset.bound = '1';
        childNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                window.addChildProfile();
            }
        });
    }

    const backBtn1 = document.getElementById('back-to-profiles');
    if (backBtn1 && !backBtn1.dataset.bound) {
        backBtn1.dataset.bound = '1';
        backBtn1.addEventListener('click', () => {
            renderProfiles();
            showScreen('profile-screen');
        });
    }

    const backBtn2 = document.getElementById('back-to-profiles-from-practice');
    if (backBtn2 && !backBtn2.dataset.bound) {
        backBtn2.dataset.bound = '1';
        backBtn2.addEventListener('click', () => {
            stopCurrentAudio();
            renderProfiles();
            showScreen('profile-screen');
        });
    }

    const dictForm = document.getElementById('add-dict
