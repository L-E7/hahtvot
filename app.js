// מצב האפליקציה בזיכרון המקומי (LocalStorage)
let appData = JSON.parse(localStorage.getItem('spellingAppData')) || {
    user: null,
    children: [],
    dictations: {} // childId: [ {id, title, lang, date, words: []} ]
};

let currentChild = null;
let currentDictation = null;
let currentWordIndex = 0;
let userMistakes = [];
let synth = window.speechSynthesis;

// ניהול מעבר מסכים
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// התחברות כאורח או Google
document.getElementById('guest-login-btn').addEventListener('click', () => {
    appData.user = { name: 'אורח', email: 'guest@app.com' };
    saveAndRenderProfiles();
});

document.getElementById('google-login-btn').addEventListener('click', () => {
    // סימולציית התחברות Google (בהמשך ניתן לחבר ל-Firebase Auth)
    appData.user = { name: 'משתמש Google', email: 'user@gmail.com' };
    saveAndRenderProfiles();
});

function saveAndRenderProfiles() {
    localStorage.setItem('spellingAppData', JSON.stringify(appData));
    showScreen('profile-screen');
    renderProfiles();
}

// ניהול ערכת נושא
document.getElementById('theme-select').addEventListener('change', (e) => {
    document.body.setAttribute('data-theme', e.target.value);
});

// הוספת ילד (עד 5)
document.getElementById('add-child-btn').addEventListener('click', () => {
    const nameInput = document.getElementById('new-child-name');
    const name = nameInput.value.trim();
    if (!name) return alert('נא להכניס שם ילד');
    if (appData.children.length >= 5) return alert('ניתן להוסיף עד 5 ילדים בלבד');

    const newChild = { id: 'child_' + Date.now(), name };
    appData.children.push(newChild);
    nameInput.value = '';
    localStorage.setItem('spellingAppData', JSON.stringify(appData));
    renderProfiles();
});

function renderProfiles() {
    const container = document.getElementById('profiles-container');
    container.innerHTML = '';
    appData.children.forEach(child => {
        const card = document.createElement('div');
        card.className = 'profile-card';
        card.innerHTML = `<h3>👤 ${child.name}</h3>`;
        card.addEventListener('click', () => {
            currentChild = child;
            openParentOrPractice();
        });
        container.appendChild(card);
    });
}

function openParentOrPractice() {
    // מעבר לבחירת הכתבה או ניהול
    document.getElementById('current-managing-child').innerText = currentChild.name;
    renderDictationsList();
    showScreen('parent-screen');
}

document.getElementById('back-to-profiles').addEventListener('click', () => showScreen('profile-screen'));
document.getElementById('back-to-profiles-from-practice').addEventListener('click', () => showScreen('profile-screen'));

// ניהול הכתבות להורים
document.getElementById('add-dictation-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('dictation-title').value;
    const lang = document.getElementById('dictation-lang').value;
    const date = document.getElementById('dictation-date').value;
    const wordsRaw = document.getElementById('dictation-words').value;
    const words = wordsRaw.split(/,|\n/).map(w => w.trim()).filter(w => w.length > 0);

    if (!appData.dictations[currentChild.id]) {
        appData.dictations[currentChild.id] = [];
    }

    appData.dictations[currentChild.id].push({
        id: 'dict_' + Date.now(),
        title, lang, date, words
    });

    localStorage.setItem('spellingAppData', JSON.stringify(appData));
    document.getElementById('add-dictation-form').reset();
    renderDictationsList();
});

function renderDictationsList() {
    const listContainer = document.getElementById('existing-dictations-list');
    listContainer.innerHTML = '';
    const dicts = appData.dictations[currentChild.id] || [];
    
    if (dicts.length === 0) {
        listContainer.innerHTML = '<p>אין עדיין הכתבות לפרופיל זה. צור הכתבה למעלה!</p>';
        return;
    }

    dicts.forEach(dict => {
        const item = document.createElement('div');
        item.className = 'card';
        item.innerHTML = `
            <h4>${dict.title} (${dict.lang === 'he' ? 'עברית' : 'אנגלית'})</h4>
            <p>תאריך: ${dict.date} | מספר מילים: ${dict.words.length}</p>
            <button class="btn success-btn" onclick="startPractice('${dict.id}')">התחל תרגול 🎯</button>
        `;
        listContainer.appendChild(item);
    });
}

// מצב תרגול והקראה
function startPractice(dictId) {
    const dicts = appData.dictations[currentChild.id];
    currentDictation = dicts.find(d => d.id === dictId);
    currentWordIndex = 0;
    userMistakes = [];
    
    document.getElementById('practice-title-display').innerText = `הכתבה: ${currentDictation.title}`;
    showScreen('practice-screen');
    speakCurrentWord();
}

function speakCurrentWord() {
    if (!currentDictation) return;
    const word = currentDictation.words[currentWordIndex];
    if (synth) {
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = currentDictation.lang === 'he' ? 'he-IL' : 'en-US';
        utterance.rate = 0.9;
        synth.speak(utterance);
    }
}

document.getElementById('speak-word-btn').addEventListener('click', speakCurrentWord);

// צליל חלופי גיבוי
document.getElementById('fallback-audio-btn').addEventListener('click', () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 587.33; // צליל D5
    osc.start();
    setTimeout(() => osc.stop(), 200);
});

// בדיקת המילה שהוקלדה
document.getElementById('submit-word-btn').addEventListener('click', checkTypedWord);
document.getElementById('user-typed-word').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') checkTypedWord();
});

function checkTypedWord() {
    const inputField = document.getElementById('user-typed-word');
    const typedValue = inputField.value.trim();
    const targetWord = currentDictation.words[currentWordIndex];

    if (typedValue === targetWord) {
        document.getElementById('feedback-message').innerText = '🎉 מעולה! נכון מאוד!';
        document.getElementById('feedback-message').style.color = '#00b894';
    } else {
        document.getElementById('feedback-message').innerText = `❌ טעות. המילה הנכונה היא: ${targetWord}`;
        document.getElementById('feedback-message').style.color = '#e84393';
        userMistakes.push({ target: targetWord, typed: typedValue });
    }

    inputField.value = '';
    currentWordIndex++;

    // עדכון מד התקדמות
    const progress = (currentWordIndex / currentDictation.words.length) * 100;
    document.getElementById('progress-bar').style.width = `${progress}%`;
    document.getElementById('practice-word-counter').innerText = `מילה ${Math.min(currentWordIndex + 1, currentDictation.words.length)} מתוך ${currentDictation.words.length}`;

    setTimeout(() => {
        document.getElementById('feedback-message').innerText = '';
        if (currentWordIndex < currentDictation.words.length) {
            speakCurrentWord();
        } else {
            showResults();
        }
    }, 1500);
}

function showResults() {
    showScreen('results-screen');
    const correctCount = currentDictation.words.length - userMistakes.length;
    const scoreText = document.getElementById('final-score-text');
    scoreText.innerText = `ענית נכון על ${correctCount} מתוך ${currentDictation.words.length} מילים!`;

    const mistakesBox = document.getElementById('mistakes-review');
    if (userMistakes.length > 0) {
        mistakesBox.innerHTML = '<h4>טיפים לחיזוק מילים שפספסת:</h4>' + userMistakes.map(m => `
            <p>מילה: <b>${m.target}</b> (הקלדת: ${m.typed}) - 💡 טיפ: נסה לפרק את המילה להברות ולשנן את האותיות המרכזיות.</p>
        `).join('');
    } else {
        mistakesBox.innerHTML = '<p>🌟 מושלם! אין טעויות בכלל! אלוף העולם!</p>';
    }
}

document.getElementById('restart-practice-btn').addEventListener('click', () => startPractice(currentDictation.id));
document.getElementById('finish-practice-btn').addEventListener('click', () => showScreen('profile-screen'));
