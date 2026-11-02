// מצב האפליקציה בזיכרון המקומי
let appData = JSON.parse(localStorage.getItem('spellingAppData')) || {
    user: null,
    children: [],
    dictations: {}
};

let currentChild = null;
let currentDictation = null;
let currentWordIndex = 0;
let userMistakes = [];
let synth = window.speechSynthesis;
let voices = [];

function populateVoices() {
    if (synth) {
        voices = synth.getVoices();
    }
}

populateVoices();
if (synth && 'onvoiceschanged' in synth) {
    synth.onvoiceschanged = populateVoices;
}

// הרצה לאחר טעינת הדף לוודא שכל הכפתורים עובדים
document.addEventListener('DOMContentLoaded', () => {
    // מעבר בין מסכים
    window.showScreen = function(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(screenId);
        if (target) target.classList.add('active');
    };

    // כניסת אורח
    const guestBtn = document.getElementById('guest-login-btn');
    if (guestBtn) {
        guestBtn.addEventListener('click', () => {
            appData.user = { name: 'אורח', email: 'guest@app.com' };
            saveAndRenderProfiles();
        });
    }

    // כניסת Google (סימולציה)
    const googleBtn = document.getElementById('google-login-btn');
    if (googleBtn) {
        googleBtn.addEventListener('click', () => {
            appData.user = { name: 'משתמש Google', email: 'user@gmail.com' };
            saveAndRenderProfiles();
        });
    }

    // ניהול ערכת נושא
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            document.body.setAttribute('data-theme', e.target.value);
        });
    }

    // הוספת ילד
    const addChildBtn = document.getElementById('add-child-btn');
    if (addChildBtn) {
        addChildBtn.addEventListener('click', () => {
            const nameInput = document.getElementById('new-child-name');
            const name = nameInput ? nameInput.value.trim() : '';
            if (!name) return alert('נא להכניס שם ילד');
            if (appData.children.length >= 5) return alert('ניתן להוסיף עד 5 ילדים בלבד');

            const newChild = { id: 'child_' + Date.now(), name };
            appData.children.push(newChild);
            if (nameInput) nameInput.value = '';
            localStorage.setItem('spellingAppData', JSON.stringify(appData));
            renderProfiles();
        });
    }

    // כפתורי חזרה
    const backBtn1 = document.getElementById('back-to-profiles');
    if (backBtn1) backBtn1.addEventListener('click', () => showScreen('profile-screen'));

    const backBtn2 = document.getElementById('back-to-profiles-from-practice');
    if (backBtn2) backBtn2.addEventListener('click', () => showScreen('profile-screen'));

    // טופס הוספת הכתבה
    const dictForm = document.getElementById('add-dictation-form');
    if (dictForm) {
        dictForm.addEventListener('submit', (e) => {
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
            dictForm.reset();
            renderDictationsList();
        });
    }

    // כפתורי תרגול
    const speakBtn = document.getElementById('speak-word-btn');
    if (speakBtn) speakBtn.addEventListener('click', speakCurrentWord);

    const fallbackBtn = document.getElementById('fallback-audio-btn');
    if (fallbackBtn) {
        fallbackBtn.addEventListener('click', () => {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 587.33;
            osc.start();
            setTimeout(() => osc.stop(), 200);
        });
    }

    const submitWordBtn = document.getElementById('submit-word-btn');
    if (submitWordBtn) submitWordBtn.addEventListener('click', checkTypedWord);

    const typedInput = document.getElementById('user-typed-word');
    if (typedInput) {
        typedInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkTypedWord();
        });
    }

    const restartBtn = document.getElementById('restart-practice-btn');
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            if (currentDictation) startPractice(currentDictation.id);
        });
    }

    const finishBtn = document.getElementById('finish-practice-btn');
    if (finishBtn) finishBtn.addEventListener('click', () => showScreen('profile-screen'));
});

function saveAndRenderProfiles() {
    localStorage.setItem('spellingAppData', JSON.stringify(appData));
    showScreen('profile-screen');
    renderProfiles();
}

function renderProfiles() {
    const container = document.getElementById('profiles-container');
    if (!container) return;
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
    const nameSpan = document.getElementById('current-managing-child');
    if (nameSpan && currentChild) nameSpan.innerText = currentChild.name;
    renderDictationsList();
    showScreen('parent-screen');
}

function renderDictationsList() {
    const listContainer = document.getElementById('existing-dictations-list');
    if (!listContainer || !currentChild) return;
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

window.startPractice = function(dictId) {
    if (!currentChild) return;
    const dicts = appData.dictations[currentChild.id];
    currentDictation = dicts.find(d => d.id === dictId);
    if (!currentDictation) return;
    currentWordIndex = 0;
    userMistakes = [];
    
    const titleDisplay = document.getElementById('practice-title-display');
    if (titleDisplay) titleDisplay.innerText = `הכתבה: ${currentDictation.title}`;
    showScreen('practice-screen');
    speakCurrentWord();
};

function speakCurrentWord() {
    if (!currentDictation) return;
    const word = currentDictation.words[currentWordIndex];
    if (synth && word) {
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = currentDictation.lang === 'he' ? 'he-IL' : 'en-US';
        
        if (voices.length === 0) {
            voices = synth.getVoices();
        }
        const langPrefix = currentDictation.lang === 'he' ? 'he' : 'en';
        const targetVoice = voices.find(v => v.lang.startsWith(langPrefix));
        if (targetVoice) {
            utterance.voice = targetVoice;
        }

        utterance.rate = 0.9;
        synth.speak(utterance);
    }
}

function checkTypedWord() {
    const inputField = document.getElementById('user-typed-word');
    if (!inputField || !currentDictation) return;
    const typedValue = inputField.value.trim();
    const targetWord = currentDictation.words[currentWordIndex];
    const feedback = document.getElementById('feedback-message');

    if (typedValue === targetWord) {
        if (feedback) {
            feedback.innerText = '🎉 מעולה! נכון מאוד!';
            feedback.style.color = '#00b894';
        }
    } else {
        if (feedback) {
            feedback.innerText = `❌ טעות. המילה הנכונה היא: ${targetWord}`;
            feedback.style.color = '#e84393';
        }
        userMistakes.push({ target: targetWord, typed: typedValue });
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
            speakCurrentWord();
        } else {
            showResults();
        }
    }, 1500);
}

function showResults() {
    showScreen('results-screen');
    if (!currentDictation) return;
    const correctCount = currentDictation.words.length - userMistakes.length;
    const scoreText = document.getElementById('final-score-text');
    if (scoreText) {
        scoreText.innerText = `ענית נכון על ${correctCount} מתוך ${currentDictation.words.length} מילים!`;
    }

    const mistakesBox = document.getElementById('mistakes-review');
    if (mistakesBox) {
        if (userMistakes.length > 0) {
            mistakesBox.innerHTML = '<h4>טיפים לחיזוק מילים שפספסת:</h4>' + userMistakes.map(m => `
                <p>מילה: <b>${m.target}</b> (הקלדת: ${m.typed}) - 💡 טיפ: נסה לפרק את המילה להברות ולשנן את האותיות המרכזיות.</p>
            `).join('');
        } else {
            mistakesBox.innerHTML = '<p>🌟 מושלם! אין טעויות בכלל! אלוף העולם!</p>';
        }
    }
}
