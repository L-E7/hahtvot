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

const THEME_KEY = 'spellingAppTheme';
const SAVE_BTN_LABEL = 'שמור הכתבה';
const UPDATE_BTN_LABEL = 'עדכן הכתבה';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDate(isoDate) {
    if (!isoDate) return '—';
    const d = new Date(`${isoDate}T00:00:00`);
    if (isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function todayIso() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function statusTone(status) {
    if (!status) return '';
    if (status.includes('הצלחת')) return 'badge-success';
    if (status.includes('רק עוד')) return 'badge-warning';
    if (status.includes('צריך')) return 'badge-danger';
    return '';
}

function iconSvg(name, extraClass = '') {
    return `<svg class="icon ${extraClass}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}

function applyTheme(theme) {
    const allowed = ['soccer', 'minecraft', 'fortnite', 'unicorn'];
    const safeTheme = allowed.includes(theme) ? theme : 'soccer';
    document.body.setAttribute('data-theme', safeTheme);
    const select = document.getElementById('theme-select');
    if (select) select.value = safeTheme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        const bg = getComputedStyle(document.body).getPropertyValue('--bg').trim();
        if (bg) meta.setAttribute('content', bg);
    }
}

function resetEditState() {
    editingDictId = null;
    const submitBtn = document.querySelector('#add-dictation-form button[type="submit"]');
    if (submitBtn) submitBtn.innerText = SAVE_BTN_LABEL;
    const cancelBtn = document.getElementById('cancel-edit-btn');
    if (cancelBtn) cancelBtn.hidden = true;
    const formTitle = document.getElementById('dictation-form-title');
    if (formTitle) formTitle.innerText = 'הוספת הכתבה חדשה';
}

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

    const children = appData.children || [];
    const countBadge = document.getElementById('children-count');
    if (countBadge) countBadge.innerText = `${children.length}/5`;
    const addBtn = document.getElementById('add-child-btn');
    const nameInput = document.getElementById('new-child-name');
    const isFull = children.length >= 5;
    if (addBtn) addBtn.disabled = isFull;
    if (nameInput) {
        nameInput.disabled = isFull;
        nameInput.placeholder = isFull ? 'הגעת למספר הפרופילים המרבי' : 'שם הילד/ה...';
    }

    if (children.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <strong>אין עדיין פרופילים</strong>
                <span>הוסיפו את הילד הראשון בטופס למטה כדי להתחיל לתרגל.</span>
            </div>`;
        return;
    }

    children.forEach(child => {
        const dictCount = (appData.dictations[child.id] || []).length;
        const initial = (child.name || '?').trim().charAt(0) || '?';

        const card = document.createElement('div');
        card.className = 'profile-card';
        card.innerHTML = `
            <button type="button" class="profile-select" aria-label="בחר את ${escapeHtml(child.name)}">
                <span class="avatar" aria-hidden="true">${escapeHtml(initial)}</span>
                <span class="profile-name">${escapeHtml(child.name)}</span>
                <span class="profile-meta">${dictCount === 1 ? 'הכתבה אחת' : `${dictCount} הכתבות`}</span>
            </button>
            <div class="profile-actions">
                <button type="button" class="btn icon-btn" data-action="edit" aria-label="ערוך שם של ${escapeHtml(child.name)}" title="ערוך שם">${iconSvg('pencil')}</button>
                <button type="button" class="btn icon-btn danger" data-action="delete" aria-label="מחק את הפרופיל של ${escapeHtml(child.name)}" title="מחק פרופיל">${iconSvg('trash')}</button>
            </div>`;

        card.querySelector('.profile-select').addEventListener('click', () => {
            currentChild = child;
            openParentOrPractice();
        });
        card.querySelector('[data-action="edit"]').addEventListener('click', (e) => window.editChildName(e, child.id));
        card.querySelector('[data-action="delete"]').addEventListener('click', (e) => window.deleteChildProfile(e, child.id));

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

    const form = document.getElementById('add-dictation-form');
    if (form) form.reset();
    resetEditState();
    const dateInput = document.getElementById('dictation-date');
    if (dateInput && !dateInput.value) dateInput.value = todayIso();
    const picker = document.getElementById('calendar-date-picker');
    if (picker) picker.value = '';

    renderDictationsList();
    showScreen('parent-screen');
    window.scrollTo({ top: 0 });
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

    let savedTheme = null;
    try { savedTheme = localStorage.getItem(THEME_KEY); } catch (e) {}
    applyTheme(savedTheme || document.body.getAttribute('data-theme'));

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect && !themeSelect.dataset.bound) {
        themeSelect.dataset.bound = '1';
        themeSelect.addEventListener('change', (e) => {
            applyTheme(e.target.value);
            try { localStorage.setItem(THEME_KEY, e.target.value); } catch (err) {}
        });
    }

    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    if (cancelEditBtn && !cancelEditBtn.dataset.bound) {
        cancelEditBtn.dataset.bound = '1';
        cancelEditBtn.addEventListener('click', () => {
            const form = document.getElementById('add-dictation-form');
            if (form) form.reset();
            resetEditState();
            const dateInput = document.getElementById('dictation-date');
            if (dateInput) dateInput.value = todayIso();
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
            const originalBtnText = submitBtn ? submitBtn.innerText : SAVE_BTN_LABEL;
            if (submitBtn) {
                submitBtn.innerText = 'מתרגם ושומר...';
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
            resetEditState();
            const dateInput = document.getElementById('dictation-date');
            if (dateInput) dateInput.value = todayIso();
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
        typedInput.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
            e.preventDefault();
            checkTypedWord();
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

    const filterLabel = document.getElementById('dictations-filter-label');
    if (filterLabel) {
        filterLabel.innerText = filterDate ? `מסונן: ${formatDate(filterDate)}` : `${dicts.length} סה"כ`;
    }

    if (dicts.length === 0) {
        listContainer.innerHTML = `<p class="list-empty">${filterDate ? 'אין הכתבות בתאריך שנבחר.' : 'עדיין אין הכתבות. הוסיפו הכתבה ראשונה בטופס למעלה.'}</p>`;
        return;
    }

    const sorted = [...dicts].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    sorted.forEach(dict => {
        const attempts = dict.attempts || 0;
        const status = dict.lastCategory || 'טרם נוסה';
        const mistakes = Array.isArray(dict.historyMistakes) ? dict.historyMistakes : [];

        let modeName = 'רגיל';
        if (dict.practiceMode === 'challenge') modeName = 'אתגר אות ראשונה ואחרונה';
        if (dict.practiceMode === 'translation') modeName = 'מבחן תרגום';

        const mistakesHtml = mistakes.length > 0
            ? `<span>מילים לחיזוק:</span>${mistakes.map(m => `<span class="word-chip" dir="auto">${escapeHtml(m)}</span>`).join('')}`
            : '<span>אין טעויות שמורות עדיין</span>';

        const item = document.createElement('article');
        item.className = 'dictation-item';
        item.innerHTML = `
            <div class="dictation-head">
                <h4 class="dictation-title">${escapeHtml(dict.title)}</h4>
                <div class="badge-row">
                    <span class="badge badge-soft">${dict.lang === 'he' ? 'עברית' : 'אנגלית'}</span>
                    <span class="badge">${escapeHtml(modeName)}</span>
                    <span class="badge ${statusTone(status)}">${escapeHtml(status)}</span>
                </div>
            </div>
            <div class="stats">
                <div class="stat"><span class="stat-label">תאריך</span><span class="stat-value">${escapeHtml(formatDate(dict.date))}</span></div>
                <div class="stat"><span class="stat-label">מילים</span><span class="stat-value">${dict.words.length}</span></div>
                <div class="stat"><span class="stat-label">ניסיונות</span><span class="stat-value">${attempts}</span></div>
            </div>
            <div class="mistake-summary">${mistakesHtml}</div>
            <div class="dictation-actions">
                <button type="button" class="btn success-btn" data-action="practice">${iconSvg('play')}התחל תרגול</button>
                <button type="button" class="btn ghost-btn btn-auto" data-action="edit">${iconSvg('pencil')}ערוך</button>
            </div>
        `;
        item.querySelector('[data-action="practice"]').addEventListener('click', () => window.startPractice(dict.id));
        item.querySelector('[data-action="edit"]').addEventListener('click', () => window.editDictation(dict.id));
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
    if (submitBtn) submitBtn.innerText = UPDATE_BTN_LABEL;
    const cancelBtn = document.getElementById('cancel-edit-btn');
    if (cancelBtn) cancelBtn.hidden = false;
    const formTitle = document.getElementById('dictation-form-title');
    if (formTitle) formTitle.innerText = `עריכת הכתבה: ${dict.title}`;
    const formCard = document.getElementById('dictation-form-card');
    if (formCard) formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
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
    inputField.disabled = false;
    const submitWordBtn = document.getElementById('submit-word-btn');
    if (submitWordBtn) submitWordBtn.disabled = false;
    const feedbackEl = document.getElementById('feedback-message');
    if (feedbackEl) {
        feedbackEl.innerText = '';
        feedbackEl.className = 'feedback';
    }
    setTimeout(() => inputField.focus({ preventScroll: true }), 50);

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
    if (!inputField || !currentDictation || inputField.disabled) return;
    const typedValue = inputField.value.trim();
    const feedback = document.getElementById('feedback-message');

    if (!typedValue) {
        if (feedback) {
            feedback.innerText = 'נא להקליד תשובה לפני הבדיקה';
            feedback.className = 'feedback is-warning';
        }
        inputField.focus();
        return;
    }

    inputField.disabled = true;
    const submitWordBtn = document.getElementById('submit-word-btn');
    if (submitWordBtn) submitWordBtn.disabled = true;

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
            feedback.innerText = 'מעולה! נכון מאוד 🎉';
            feedback.className = 'feedback is-correct';
        }
    } else {
        if (feedback) {
            feedback.innerText = `כמעט! התשובה הנכונה: ${expectedDisplayValue}`;
            feedback.className = 'feedback is-wrong';
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
        if (feedback) {
            feedback.innerText = '';
            feedback.className = 'feedback';
        }
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
        const pct = Math.round(percentage);
        const ringColor = pct === 100 ? 'var(--success)' : pct >= 70 ? 'var(--warning)' : 'var(--danger)';
        scoreText.innerHTML = `
            <div class="score-ring" style="--pct: ${pct}; --ring-color: ${ringColor};" role="img" aria-label="ציון ${pct} אחוז">
                <div class="score-ring-inner">
                    <span class="score-pct">${pct}%</span>
                    <span class="score-sub">${correctCount} מתוך ${totalWords}</span>
                </div>
            </div>
            <span class="badge ${statusTone(category)}">${escapeHtml(category)}</span>
            <p class="score-message">${escapeHtml(categoryEmoji)}</p>`;
    }

    const mistakesBox = document.getElementById('mistakes-review');
    const practiceMistakesBtn = document.getElementById('practice-mistakes-only-btn');

    if (mistakesBox) {
        if (userMistakes.length > 0) {
            mistakesBox.innerHTML = `
                <h3 class="mistakes-title">מילים שכדאי לחזק</h3>
                <ul class="mistake-list">
                    ${userMistakes.map(m => `
                        <li class="mistake-item">
                            <span class="mistake-target" dir="auto">${escapeHtml(m.target)}</span>
                            <span class="mistake-typed" dir="auto">הקלדת: ${escapeHtml(m.typed)}</span>
                        </li>`).join('')}
                </ul>`;
            if (practiceMistakesBtn) practiceMistakesBtn.style.display = 'inline-flex';
        } else {
            mistakesBox.innerHTML = '<p class="no-mistakes">אין טעויות בכלל בתרגול הזה!</p>';
            if (practiceMistakesBtn) practiceMistakesBtn.style.display = 'none';
        }
    }
}
