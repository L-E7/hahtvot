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

    const dictForm = document.getElementById('add-dictation-form');
    if (dictForm && !dictForm.dataset.bound) {
        dictForm.dataset.bound = '1';
        dictForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentChild) return alert('נא לבחור פרופיל ילד תחילה');

            const title = document.getElementById('dictation-title').value;
            const lang = document.getElementById('dictation-lang').value;
            const date = document.getElementById('dictation-date').value;
            const wordsRaw = document.getElementById('dictation-words').value;
            const practiceMode = document.getElementById('practice-mode-select').value;

            const rawLines = wordsRaw.split(/\r?\n/).map(line => line.replace(/^[\d\-\.\)]+\s*/, '').trim()).filter(w => w.length > 0);
            if (rawLines.length === 0) return alert('נא להכניס לפחות מילה אחת בשורה');

            const submitBtn = dictForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn ? submitBtn.innerText : 'שמור הכתבה בזיכרון 💾';
            if (submitBtn) {
                submitBtn.innerText = 'מבצע תרגום אוטומטי חכם... ⏳';
                submitBtn.disabled = true;
            }

            const processedWords = [];
            for (const line of rawLines) {
                let wordPart = line;
                let translationPart = '';

                if (line.includes('-')) {
                    const parts = line.split('-');
                    wordPart = parts[0].trim();
                    translationPart = parts.slice(1).join('-').trim();
                } else if (line.includes(',')) {
                    const parts = line.split(',');
                    wordPart = parts[0].trim();
                    translationPart = parts.slice(1).join(',').trim();
                }

                if (!translationPart && lang === 'en') {
                    try {
                        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(wordPart)}&langpair=en|he`);
                        const data = await res.json();
                        if (data && data.responseData && data.responseData.translatedText) {
                            translationPart = data.responseData.translatedText;
                        }
                    } catch (err) {}
                }

                processedWords.push({
                    word: wordPart,
                    translation: translationPart || wordPart
                });
            }

            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = originalBtnText;
            }

            if (!appData.dictations[currentChild.id]) {
                appData.dictations[currentChild.id] = [];
            }

            if (editingDictId) {
                const dict = appData.dictations[currentChild.id].find(d => d.id === editingDictId);
                if (dict) {
                    dict.title = title;
                    dict.lang = lang;
                    dict.date = date;
                    dict.words = processedWords;
                    dict.practiceMode = practiceMode;
                }
                editingDictId = null;
                if (submitBtn) submitBtn.innerText = 'שמור הכתבה בזיכרון 💾';
            } else {
                appData.dictations[currentChild.id].push({
                    id: 'dict_' + Date.now(),
                    title, lang, date,
                    words: processedWords,
                    practiceMode,
                    attempts: 0,
                    lastCategory: 'טרם נוסה',
                    historyMistakes: []
                });
            }

            saveAppData();
            dictForm.reset();
            renderDictationsList();
        });
    }

    const filterBtn = document.getElementById('filter-by-date-btn');
    if (filterBtn && !filterBtn.dataset.bound) {
        filterBtn.dataset.bound = '1';
        filterBtn.addEventListener('click', () => {
            const selectedDate = document.getElementById('calendar-date-picker').value;
            if (!selectedDate) return alert('נא לבחור תאריך מלוח השנה');
            renderDictationsList(selectedDate);
        });
    }

    const showAllBtn = document.getElementById('show-all-dictations-btn');
    if (showAllBtn && !showAllBtn.dataset.bound) {
        showAllBtn.dataset.bound = '1';
        showAllBtn.addEventListener('click', () => {
            const picker = document.getElementById('calendar-date-picker');
            if (picker) picker.value = '';
            renderDictationsList();
        });
    }

    const hebrewHintBtn = document.getElementById('hebrew-hint-btn');
    if (hebrewHintBtn && !hebrewHintBtn.dataset.bound) {
        hebrewHintBtn.dataset.bound = '1';
        hebrewHintBtn.addEventListener('click', showHebrewHint);
    }

    const imageHintBtn = document.getElementById('image-hint-btn');
    if (imageHintBtn && !imageHintBtn.dataset.bound) {
        imageHintBtn.dataset.bound = '1';
        imageHintBtn.addEventListener('click', showImageHint);
    }

    const speakBtn = document.getElementById('speak-word-btn');
    if (speakBtn && !speakBtn.dataset.bound) {
        speakBtn.dataset.bound = '1';
        speakBtn.addEventListener('click', speakCurrentWord);
    }

    const submitWordBtn = document.getElementById('submit-word-btn');
    if (submitWordBtn && !submitWordBtn.dataset.bound) {
        submitWordBtn.dataset.bound = '1';
        submitWordBtn.addEventListener('click', checkTypedWord);
    }

    const typedInput = document.getElementById('user-typed-word');
    if (typedInput && !typedInput.dataset.bound) {
        typedInput.dataset.bound = '1';
        typedInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkTypedWord();
        });
    }

    const restartBtn = document.getElementById('restart-practice-btn');
    if (restartBtn && !restartBtn.dataset.bound) {
        restartBtn.dataset.bound = '1';
        restartBtn.addEventListener('click', () => {
            if (currentDictation) startPractice(currentDictation.id);
        });
    }

    const practiceMistakesBtn = document.getElementById('practice-mistakes-only-btn');
    if (practiceMistakesBtn && !practiceMistakesBtn.dataset.bound) {
        practiceMistakesBtn.dataset.bound = '1';
        practiceMistakesBtn.addEventListener('click', startPracticeMistakesOnly);
    }

    const finishBtn = document.getElementById('finish-practice-btn');
    if (finishBtn && !finishBtn.dataset.bound) {
        finishBtn.dataset.bound = '1';
        finishBtn.addEventListener('click', () => {
            stopCurrentAudio();
            renderProfiles();
            showScreen('profile-screen');
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAppHandlers);
} else {
    initAppHandlers();
}

function renderDictationsList(filterDate = null) {
    loadAppDataFromStorage();
    const listContainer = document.getElementById('existing-dictations-list');
    if (!listContainer || !currentChild) return;
    listContainer.innerHTML = '';
    let dicts = appData.dictations[currentChild.id] || [];

    if (filterDate) {
        dicts = dicts.filter(d => d.date === filterDate);
    }

    if (dicts.length === 0) {
        listContainer.innerHTML = '<p style="text-align: center; color: #636e72;">אין הכתבות להצגה עבור בחירה זו.</p>';
        return;
    }

    dicts.forEach(dict => {
        const attempts = dict.attempts || 0;
        const status = dict.lastCategory || 'טרם נוסה';
        const historyMistakes = dict.historyMistakes && dict.historyMistakes.length > 0
            ? dict.historyMistakes.join(', ')
            : 'אין טעויות שמורות עדיין 🌟';

        let modeName = 'רגיל';
        if (dict.practiceMode === 'challenge') modeName = 'אתגר אות ראשונה ואחרונה';
        if (dict.practiceMode === 'translation') modeName = 'מבחן תרגום לאנגלית/עברית';

        const item = document.createElement('div');
        item.className = 'card';
        item.style.padding = '20px';
        item.innerHTML = `
            <h4 style="color: var(--primary);">${dict.title} (${dict.lang === 'he' ? 'עברית' : 'אנגלית'}) [${modeName}]</h4>
            <p style="margin-bottom: 8px;">תאריך: <b>${dict.date}</b> | מספר מילים: ${dict.words.length}</p>
            <p style="margin-bottom: 8px;">📊 מספר ניסיונות: <b>${attempts}</b> | סטטוס אחרון: <b>${status}</b></p>
            <p style="font-size: 14px; color: #d63031; margin-bottom: 15px;">❌ מילים שגויות: <b>${historyMistakes}</b></p>
            <div style="display: flex; gap: 10px;">
                <button type="button" class="btn success-btn" style="flex: 2; padding: 10px;" onclick="window.startPractice('${dict.id}')">התחל תרגול 🎯</button>
                <button type="button" class="btn secondary-btn" style="flex: 1; padding: 10px;" onclick="window.editDictation('${dict.id}')">ערוך ✏️</button>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

window.editDictation = function(dictId) {
    if (!currentChild) return;
    const dicts = appData.dictations[currentChild.id] || [];
    const dict = dicts.find(d => d.id === dictId);
    if (!dict) return;

    document.getElementById('dictation-title').value = dict.title;
    document.getElementById('dictation-lang').value = dict.lang;
    document.getElementById('dictation-date').value = dict.date;
    const modeSelect = document.getElementById('practice-mode-select');
    if (modeSelect) modeSelect.value = dict.practiceMode || 'standard';

    const formattedWords = dict.words.map(item => item.word).join('\n');
    document.getElementById('dictation-words').value = formattedWords;

    editingDictId = dict.id;
    const submitBtn = document.querySelector('#add-dictation-form button[type="submit"]');
    if (submitBtn) submitBtn.innerText = 'עדכן הכתבה 🔄';
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

window.startPractice = function(dictId) {
    if (!currentChild) return;
    const dicts = appData.dictations[currentChild.id] || [];
    const originalDict = dicts.find(d => d.id === dictId);
    if (!originalDict) return;

    currentDictation = {
        ...originalDict,
        words: shuffleArray(originalDict.words)
    };

    currentWordIndex = 0;
    userMistakes = [];

    originalDict.attempts = (originalDict.attempts || 0) + 1;
    saveAppData();

    const titleDisplay = document.getElementById('practice-title-display');
    if (titleDisplay) titleDisplay.innerText = `הכתבה: ${currentDictation.title}`;
    showScreen('practice-screen');
    setupCurrentWordUI();
    speakCurrentWord();
};

function startPracticeMistakesOnly() {
    if (!currentDictation || !currentDictation.historyMistakes || currentDictation.historyMistakes.length === 0) return;

    const mistakeWordsObjects = currentDictation.words.filter(w => currentDictation.historyMistakes.includes(w.word));
    if (mistakeWordsObjects.length === 0) return;

    currentDictation = {
        ...currentDictation,
        words: shuffleArray(mistakeWordsObjects)
    };

    currentWordIndex = 0;
    userMistakes = [];

    const titleDisplay = document.getElementById('practice-title-display');
    if (titleDisplay) titleDisplay.innerText = `תרגול חיזוק טעויות: ${currentDictation.title}`;
    showScreen('practice-screen');
    setupCurrentWordUI();
    speakCurrentWord();
}

function setupCurrentWordUI() {
    const currentItem = currentDictation.words[currentWordIndex];
    const modeBox = document.getElementById('mode-instruction-box');
    const modeText = document.getElementById('mode-instruction-text');
    const challengeBox = document.getElementById('challenge-hint-box');
    const challengeText = document.getElementById('challenge-hint-text');
    const hebrewHintDisplay = document.getElementById('hebrew-hint-display');
    const imageHintDisplay = document.getElementById('image-hint-display');
    const imageHintImg = document.getElementById('image-hint-img');
    const inputField = document.getElementById('user-typed-word');

    if (!inputField || !currentItem) return;
    inputField.value = '';

    if (hebrewHintDisplay) hebrewHintDisplay.style.display = 'none';
    if (imageHintDisplay) imageHintDisplay.style.display = 'none';
    if (imageHintImg) {
        imageHintImg.style.display = 'none';
        imageHintImg.src = '';
    }

    const mode = currentDictation.practiceMode || 'standard';

    if (mode === 'translation') {
        if (modeBox) modeBox.style.display = 'block';
        if (modeText) modeText.innerText = 'שמע את המילה באנגלית והקלד את הפירוש בעברית!';
        if (challengeBox) challengeBox.style.display = 'none';
        inputField.placeholder = "הקלד את הפירוש בעברית...";
    } else if (mode === 'challenge' && currentItem.word.length > 2) {
        if (modeBox) modeBox.style.display = 'none';
        if (challengeBox) challengeBox.style.display = 'block';
        const word = currentItem.word;
        const middlePart = word.substring(1, word.length - 1);
        if (challengeText) challengeText.innerText = `_  ${middlePart}  _`;
        inputField.placeholder = "הקלד אות ראשונה ואחרונה...";
    } else {
        if (modeBox) modeBox.style.display = 'none';
        if (challengeBox) challengeBox.style.display = 'none';
        inputField.placeholder = "הקלד את המילה כאן...";
    }

    const counter = document.getElementById('practice-word-counter');
    if (counter) {
        counter.innerText = `מילה ${currentWordIndex + 1} מתוך ${currentDictation.words.length}`;
    }

    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
        const progress = (currentWordIndex / currentDictation.words.length) * 100;
        progressBar.style.width = `${progress}%`;
    }
}

function stopCurrentAudio() {
    if (currentAudioPlayer) {
        try {
            currentAudioPlayer.pause();
            currentAudioPlayer.currentTime = 0;
        } catch (e) {}
        currentAudioPlayer = null;
    }
    if (synth) {
        try {
            synth.cancel();
        } catch (e) {}
    }
}

function playAudioUrl(url, rate, onSuccess, onFail) {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.playbackRate = rate;
    currentAudioPlayer = audio;

    let handled = false;
    const failOnce = () => {
        if (handled) return;
        handled = true;
        onFail();
    };

    audio.onplaying = () => {
        if (!handled) {
            onSuccess();
        }
    };

    audio.onerror = failOnce;
    audio.onstalled = failOnce;

    audio.src = url;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(failOnce);
    }
}

async function tryDictionaryAudio(word, rate, statusEl) {
    try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`);
        if (!res.ok) return false;
        const data = await res.json();
        const phonetics = Array.isArray(data) && data[0] && Array.isArray(data[0].phonetics) ? data[0].phonetics : [];
        const audioObj = phonetics.find(p => p && p.audio && p.audio.trim().length > 0);
        if (!audioObj) return false;

        let audioUrl = audioObj.audio.trim();
        if (audioUrl.startsWith('//')) audioUrl = 'https:' + audioUrl;

        return await new Promise((resolve) => {
            playAudioUrl(
                audioUrl,
                rate,
                () => {
                    if (statusEl) statusEl.innerText = `מקריא אודיו (מהירות ${rate})...`;
                    resolve(true);
                },
                () => resolve(false)
            );
        });
    } catch (e) {
        return false;
    }
}

function fallbackLocalSpeech(word, isEnglish, rate, statusEl) {
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
        if (statusEl) statusEl.innerText = 'לא ניתן להשמיע קול במכשיר זה כרגע.';
        return;
    }
    try {
        synth.resume();
        synth.cancel();
        populateVoices();

        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = isEnglish ? 'en-US' : 'he-IL';
        utterance.rate = rate;
        utterance.onstart = () => {
            if (statusEl) statusEl.innerText = `מקריא (${utterance.lang})...`;
        };
        utterance.onerror = () => {
            if (statusEl) statusEl.innerText = 'שגיאה בהשמעת הקול. בדוק חיבור אינטרנט ועוצמת מדיה.';
        };
        synth.speak(utterance);
    } catch (e) {
        if (statusEl) statusEl.innerText = 'שגיאה בהפעלת השמע.';
    }
}

async function speakCurrentWord() {
    if (!currentDictation) return;
    const currentItem = currentDictation.words[currentWordIndex];
    const statusEl = document.getElementById('speech-status');
    if (!currentItem) return;

    stopCurrentAudio();

    const mode = currentDictation.practiceMode || 'standard';
    const isEnglish = (mode === 'translation' || currentDictation.lang === 'en');
    const langCode = isEnglish ? 'en' : 'iw';

    const rateSelect = document.getElementById('speech-rate-select');
    const parsedRate = rateSelect ? parseFloat(rateSelect.value) : 0.75;
    const rate = isNaN(parsedRate) ? 0.75 : parsedRate;

    const voiceTypeSelect = document.getElementById('speech-voice-select');
    const voiceType = voiceTypeSelect ? voiceTypeSelect.value : 'auto';

    if (statusEl) statusEl.innerText = 'טוען הקראה... 🔊';

    const candidateUrls = [];
    if (isEnglish) {
        if (voiceType === 'male') {
            candidateUrls.push(`https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(currentItem.word)}`);
        } else if (voiceType === 'female') {
            candidateUrls.push(`https://api.streamelements.com/kappa/v2/speech?voice=Amy&text=${encodeURIComponent(currentItem.word)}`);
        }
    }
    candidateUrls.push(`https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${langCode}&q=${encodeURIComponent(currentItem.word)}`);

    const tryNextUrl = async (index) => {
        if (index >= candidateUrls.length) {
            if (isEnglish) {
                const dictOk = await tryDictionaryAudio(currentItem.word, rate, statusEl);
                if (dictOk) return;
            }
            fallbackLocalSpeech(currentItem.word, isEnglish, rate, statusEl);
            return;
        }

        playAudioUrl(
            candidateUrls[index],
            rate,
            () => {
                if (statusEl) statusEl.innerText = `מקריא (מהירות ${rate})...`;
                if (currentAudioPlayer) {
                    currentAudioPlayer.onended = () => {
                        if (statusEl) statusEl.innerText = '';
                    };
                }
            },
            () => {
                tryNextUrl(index + 1);
            }
        );
    };

    tryNextUrl(0);
}

function checkTypedWord() {
    const inputField = document.getElementById('user-typed-word');
    if (!inputField || !currentDictation) return;
    const typedValue = inputField.value.trim();
    const feedback = document.getElementById('feedback-message');

    if (!typedValue) {
        if (feedback) {
            feedback.innerText = '⚠️ נא להקליד ערך לפני הבדיקה!';
            feedback.style.color = '#fdcb6e';
        }
        return;
    }

    const currentItem = currentDictation.words[currentWordIndex];
    const mode = currentDictation.practiceMode || 'standard';
    let isCorrect = false;
    let expectedDisplayValue = currentItem.word;

    if (mode === 'translation') {
        expectedDisplayValue = currentItem.translation || currentItem.word;
        if (typedValue.toLowerCase() === expectedDisplayValue.toLowerCase()) {
            isCorrect = true;
        }
    } else if (mode === 'challenge' && currentItem.word.length > 2) {
        const firstLetter = currentItem.word[0].toLowerCase();
        const lastLetter = currentItem.word[currentItem.word.length - 1].toLowerCase();
        const typedClean = typedValue.toLowerCase().replace(/\s+/g, '');
        const expectedPair = firstLetter + lastLetter;

        if (typedClean === expectedPair || typedClean === currentItem.word.toLowerCase()) {
            isCorrect = true;
        }
    } else {
        if (typedValue.toLowerCase() === currentItem.word.toLowerCase()) {
            isCorrect = true;
        }
    }

    if (isCorrect) {
        if (feedback) {
            feedback.innerText = '🎉 מעולה! נכון מאוד!';
            feedback.style.color = '#00b894';
        }
    } else {
        if (feedback) {
            feedback.innerText = `❌ טעות. התשובה הנכונה היא: ${expectedDisplayValue}`;
            feedback.style.color = '#e84393';
        }
        userMistakes.push({ target: currentItem.word, typed: typedValue });
    }

    inputField.value = '';
    currentWordIndex++;

    const progress = (currentWordIndex / currentDictation.words.length) * 100;
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) progressBar.style.width = `${progress}%`;

    const counter = document.getElementById('practice-word-counter');
    if (counter) {
        counter.innerText = `מילה ${Math.min(currentWordIndex + 1, currentDictation.words.length)} מתוך ${currentDictation.words.length}`;
    }

    setTimeout(() => {
        if (feedback) feedback.innerText = '';
        if (currentWordIndex < currentDictation.words.length) {
            setupCurrentWordUI();
            speakCurrentWord();
        } else {
            showResults();
        }
    }, 1500);
}

function showResults() {
    showScreen('results-screen');
    if (!currentDictation || !currentChild) return;

    const childDicts = appData.dictations[currentChild.id] || [];
    const originalDict = childDicts.find(d => d.id === currentDictation.id);

    const totalWords = currentDictation.words.length;
    const correctCount = totalWords - userMistakes.length;
    const percentage = (correctCount / totalWords) * 100;

    let category = '';
    let categoryEmoji = '';
    if (percentage === 100) {
        category = 'הצלחת 🏆';
        categoryEmoji = '🌟 מושלם! אלוף העולם!';
    } else if (percentage >= 70) {
        category = 'רק עוד קצת 💪';
        categoryEmoji = '👍 קרוב מאוד למושלם! עוד מאמץ קטן ואתה שם!';
    } else {
        category = 'צריך עוד להתאמן 📚';
        categoryEmoji = '💡 לא נורא בכלל, כדאי לחזור על המילים שפספסת ולהתאמן שוב.';
    }

    if (originalDict) {
        originalDict.lastCategory = category;

        if (!Array.isArray(originalDict.historyMistakes)) originalDict.historyMistakes = [];
        userMistakes.forEach(m => {
            if (!originalDict.historyMistakes.includes(m.target)) {
                originalDict.historyMistakes.push(m.target);
            }
        });

        saveAppData();
    }

    const scoreText = document.getElementById('final-score-text');
    if (scoreText) {
        scoreText.innerHTML = `ענית נכון על ${correctCount} מתוך ${totalWords} מילים!<br><br><b>רמת ביצוע: ${category}</b><br><span style="font-size: 16px; color: #636e72;">${categoryEmoji}</span>`;
    }

    const mistakesBox = document.getElementById('mistakes-review');
    const practiceMistakesBtn = document.getElementById('practice-mistakes-only-btn');

    if (mistakesBox) {
        if (userMistakes.length > 0) {
            mistakesBox.innerHTML = '<h4>מילים שכדאי לחזק מהתרגול הנוכחי:</h4>' + userMistakes.map(m => `
                <p>מילה: <b>${m.target}</b> (הקלדת: ${m.typed})</p>
            `).join('');
            if (practiceMistakesBtn) practiceMistakesBtn.style.display = 'inline-block';
        } else {
            mistakesBox.innerHTML = '<p>✨ אין טעויות בכלל בתרגול הזה!</p>';
            if (practiceMistakesBtn) practiceMistakesBtn.style.display = 'none';
        }
    }
}
