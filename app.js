// מצב האפליקציה בזיכרון המקומי
let appData = JSON.parse(localStorage.getItem('spellingAppData')) || {
    user: null,
    children: [],
    dictations: {} // { childId: [ { id, title, lang, date, words: [], stats: { attempts: 0 } } ] }
};

let currentChild = null;
let currentDictation = null;
let currentWordIndex = 0;
let userMistakes = [];
let synth = window.speechSynthesis;
let voices = [];
let editingDictId = null;

function populateVoices() {
    if (synth) {
        voices = synth.getVoices();
    }
}

populateVoices();
if (synth && 'onvoiceschanged' in synth) {
    synth.onvoiceschanged = populateVoices;
}

document.addEventListener('DOMContentLoaded', () => {
    window.showScreen = function(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(screenId);
        if (target) target.classList.add('active');
    };

    const guestBtn = document.getElementById('guest-login-btn');
    if (guestBtn) {
        guestBtn.addEventListener('click', () => {
            appData.user = { name: 'הורה / משתמש', email: 'user@app.com' };
            saveAndRenderProfiles();
        });
    }

    const googleBtn = document.getElementById('google-login-btn');
    if (googleBtn) {
        googleBtn.addEventListener('click', () => {
            appData.user = { name: 'הורה מחובר', email: 'parent@gmail.com' };
            saveAndRenderProfiles();
        });
    }

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            document.body.setAttribute('data-theme', e.target.value);
        });
    }

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

    const backBtn1 = document.getElementById('back-to-profiles');
    if (backBtn1) backBtn1.addEventListener('click', () => showScreen('profile-screen'));

    const backBtn2 = document.getElementById('back-to-profiles-from-practice');
    if (backBtn2) backBtn2.addEventListener('click', () => showScreen('profile-screen'));

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

            if (editingDictId) {
                const dict = appData.dictations[currentChild.id].find(d => d.id === editingDictId);
                if (dict) {
                    dict.title = title;
                    dict.lang = lang;
                    dict.date = date;
                    dict.words = words;
                }
                editingDictId = null;
                const submitBtn = dictForm.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.innerText = 'שמור הכתבה 💾';
            } else {
                appData.dictations[currentChild.id].push({
                    id: 'dict_' + Date.now(),
                    title, lang, date, words,
                    attempts: 0,
                    lastCategory: 'טרם נוסה'
                });
            }

            localStorage.setItem('spellingAppData', JSON.stringify(appData));
            dictForm.reset();
            renderDictationsList();
        });
    }

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
        const attempts = dict.attempts || 0;
        const status = dict.lastCategory || 'טרם נוסה';
        const item = document.createElement('div');
        item.className = 'card';
        item.innerHTML = `
            <h4>${dict.title} (${dict.lang === 'he' ? 'עברית' : 'אנגלית'})</h4>
            <p>תאריך: ${dict.date} | מספר מילים: ${dict.words.length}</p>
            <p>📊 מספר ניסיונות: <b>${attempts}</b> | סטטוס אחרון: <b>${status}</b></p>
            <button class="btn success-btn" onclick="startPractice('${dict.id}')">התחל תרגול 🎯</button>
            <button class="btn secondary-btn" onclick="editDictation('${dict.id}')">ערוך ✏️</button>
        `;
        listContainer.appendChild(item);
    });
}

window.editDictation = function(dictId) {
    const dicts = appData.dictations[currentChild.id];
    const dict = dicts.find(d => d.id === dictId);
    if (!dict) return;

    document.getElementById('dictation-title').value = dict.title;
    document.getElementById('dictation-lang').value = dict.lang;
    document.getElementById('dictation-date').value = dict.date;
    document.getElementById('dictation-words').value = dict.words.join(', ');

    editingDictId = dict.id;
    const submitBtn = document.querySelector('#add-dictation-form button[type="submit"]');
    if (submitBtn) submitBtn.innerText = 'עדכן הכתבה 🔄';
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.startPractice = function(dictId) {
    if (!currentChild) return;
    const dicts = appData.dictations[currentChild.id];
    currentDictation = dicts.find(d => d.id === dictId);
    if (!currentDictation) return;
    currentWordIndex = 0;
    userMistakes = [];
    
    // מעקב ניסיונות - כל פעם שמתחילים תרגול, מעדכנים מונה
    currentDictation.attempts = (currentDictation.attempts || 0) + 1;
    localStorage.setItem('spellingAppData', JSON.stringify(appData));

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
    const totalWords = currentDictation.words.length;
    const correctCount = totalWords - userMistakes.length;
    const percentage = (correctCount / totalWords) * 100;

    // חלוקה ל-3 רמות הצלחה
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

    // שמירת הסטטוס האחרון בהכתבה
    currentDictation.lastCategory = category;
    localStorage.setItem('spellingAppData', JSON.stringify(appData));

    const scoreText = document.getElementById('final-score-text');
    if (scoreText) {
        scoreText.innerHTML = `ענית נכון על ${correctCount} מתוך ${totalWords} מילים!<br><br><b>רמת ביצוע: ${category}</b><br><span style="font-size: 16px; color: #636e72;">${categoryEmoji}</span>`;
    }

    const mistakesBox = document.getElementById('mistakes-review');
    if (mistakesBox) {
        if (userMistakes.length > 0) {
            mistakesBox.innerHTML = '<h4>מילים שכדאי לחזק:</h4>' + userMistakes.map(m => `
                <p>מילה: <b>${m.target}</b> (הקלדת: ${m.typed})</p>
            `).join('');
        } else {
            mistakesBox.innerHTML = '<p>✨ אין טעויות בכלל!</p>';
        }
    }
}
