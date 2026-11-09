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

    const langSelect = document.getElementById('dictation-lang');
    const challengeOptionDiv = document.getElementById('english-challenge-option');
    if (langSelect && challengeOptionDiv) {
        langSelect.addEventListener('change', (e) => {
            if (e.target.value === 'en') {
                challengeOptionDiv.style.display = 'block';
            } else {
                challengeOptionDiv.style.display = 'none';
                document.getElementById('challenge-mode-checkbox').checked = false;
            }
        });
    }

    const dictForm = document.getElementById('add-dictation-form');
    if (dictForm) {
        dictForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const title = document.getElementById('dictation-title').value;
            const lang = document.getElementById('dictation-lang').value;
            const date = document.getElementById('dictation-date').value;
            const wordsRaw = document.getElementById('dictation-words').value;
            const isChallengeMode = document.getElementById('challenge-mode-checkbox').checked;

            const words = wordsRaw.split(/\r?\n/).map(line => {
                let cleanLine = line.replace(/^[\d\-\.\)]+\s*/, '').trim();
                if (!cleanLine) return null;

                let wordPart = cleanLine;
                let translationPart = '';

                if (cleanLine.includes('-')) {
                    const parts = cleanLine.split('-');
                    wordPart = parts[0].trim();
                    translationPart = parts.slice(1).join('-').trim();
                } else if (cleanLine.includes(',')) {
                    const parts = cleanLine.split(',');
                    wordPart = parts[0].trim();
                    translationPart = parts.slice(1).join(',').trim();
                }

                return {
                    word: wordPart,
                    translation: translationPart
                };
            }).filter(item => item !== null && item.word.length > 0);

            if (words.length === 0) {
                return alert('נא להכניס לפחות מילה אחת בשורה');
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
                    dict.words = words;
                    dict.isChallengeMode = isChallengeMode;
                }
                editingDictId = null;
                const submitBtn = dictForm.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.innerText = 'שמור הכתבה 💾';
            } else {
                appData.dictations[currentChild.id].push({
                    id: 'dict_' + Date.now(),
                    title, lang, date, words,
                    isChallengeMode,
                    attempts: 0,
                    lastCategory: 'טרם נוסה',
                    historyMistakes: []
                });
            }

            localStorage.setItem('spellingAppData', JSON.stringify(appData));
            dictForm.reset();
            if (challengeOptionDiv) challengeOptionDiv.style.display = 'none';
            renderDictationsList();
        });
    }

    const filterBtn = document.getElementById('filter-by-date-btn');
    if (filterBtn) {
        filterBtn.addEventListener('click', () => {
            const selectedDate = document.getElementById('calendar-date-picker').value;
            if (!selectedDate) return alert('נא לבחור תאריך מלוח השנה');
            renderDictationsList(selectedDate);
        });
    }

    const showAllBtn = document.getElementById('show-all-dictations-btn');
    if (showAllBtn) {
        showAllBtn.addEventListener('click', () => {
            document.getElementById('calendar-date-picker').value = '';
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

function renderDictationsList(filterDate = null) {
    const listContainer = document.getElementById('existing-dictations-list');
    if (!listContainer || !currentChild) return;
    listContainer.innerHTML = '';
    let dicts = appData.dictations[currentChild.id] || [];
    
    if (filterDate) {
        dicts = dicts.filter(d => d.date === filterDate);
    }

    if (dicts.length === 0) {
        listContainer.innerHTML = '<p>אין הכתבות להצגה עבור בחירה זו.</p>';
        return;
    }

    dicts.forEach(dict => {
        const attempts = dict.attempts || 0;
        const status = dict.lastCategory || 'טרם נוסה';
        const historyMistakes = dict.historyMistakes && dict.historyMistakes.length > 0 
            ? dict.historyMistakes.join(', ') 
            : 'אין טעויות שמורות עדיין 🌟';

        const challengeBadge = dict.isChallengeMode ? '🎯 (מצב אתגר: השלמת אות ראשונה ואחרונה)' : '';

        const item = document.createElement('div');
        item.className = 'card';
        item.innerHTML = `
            <h4>${dict.title} (${dict.lang === 'he' ? 'עברית' : 'אנגלית'}) ${challengeBadge}</h4>
            <p>תאריך: <b>${dict.date}</b> | מספר מילים: ${dict.words.length}</p>
            <p>📊 מספר ניסיונות: <b>${attempts}</b> | סטטוס אחרון: <b>${status}</b></p>
            <p style="font-size: 14px; color: #d63031;">❌ מילים שגויות מניסיונות קודמים: <b>${historyMistakes}</b></p>
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
    
    const formattedWords = dict.words.map(item => item.translation ? `${item.word} - ${item.translation}` : item.word).join('\n');
    document.getElementById('dictation-words').value = formattedWords;

    const langSelect = document.getElementById('dictation-lang');
    const challengeOptionDiv = document.getElementById('english-challenge-option');
    const challengeCheckbox = document.getElementById('challenge-mode-checkbox');

    if (dict.lang === 'en') {
        challengeOptionDiv.style.display = 'block';
        challengeCheckbox.checked = !!dict.isChallengeMode;
    } else {
        challengeOptionDiv.style.display = 'none';
        challengeCheckbox.checked = false;
    }

    editingDictId = dict.id;
    const submitBtn = document.querySelector('#add-dictation-form button[type="submit"]');
    if (submitBtn) submitBtn.innerText = 'עדכן הכתבה 🔄';
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function shuffleArray(array) {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

window.startPractice = function(dictId) {
    if (!currentChild) return;
    const dicts = appData.dictations[currentChild.id];
    const originalDict = dicts.find(d => d.id === dictId);
    if (!originalDict) return;

    currentDictation = {
        ...originalDict,
        words: shuffleArray(originalDict.words)
    };

    currentWordIndex = 0;
    userMistakes = [];
    
    originalDict.attempts = (originalDict.attempts || 0) + 1;
    localStorage.setItem('spellingAppData', JSON.stringify(appData));

    const titleDisplay = document.getElementById('practice-title-display');
    if (titleDisplay) titleDisplay.innerText = `הכתבה: ${currentDictation.title}`;
    showScreen('practice-screen');
    setupCurrentWordUI();
    speakCurrentWord();
};

function setupCurrentWordUI() {
    const currentItem = currentDictation.words[currentWordIndex];
    const translationBox = document.getElementById('translation-hint-box');
    const translationText = document.getElementById('translation-text');
    const challengeBox = document.getElementById('challenge-hint-box');
    const challengeText = document.getElementById('challenge-hint-text');
    const inputField = document.getElementById('user-typed-word');

    inputField.value = '';

    if (currentItem.translation) {
        translationBox.style.display = 'block';
        translationText.innerText = currentItem.translation;
    } else {
        translationBox.style.display = 'none';
    }

    // מצב אתגר הפוך: האמצע גלוי, והילד צריך להקליד את האות הראשונה והאחרונה (או את שתי האותיות יחד)
    if (currentDictation.isChallengeMode && currentItem.word.length > 2) {
        challengeBox.style.display = 'block';
        const word = currentItem.word;
        const middlePart = word.substring(1, word.length - 1);
        // מציגים _ עבור האות הראשונה והאחרונה, ובאמצע את האותיות המלאות
        challengeText.innerText = `_  ${middlePart}  _  (השלם את האות הראשונה והאחרונה)`;
        inputField.placeholder = "הקלד את שתי האותיות (ראשונה ואחרונה) או את המילה המלאה...";
    } else {
        challengeBox.style.display = 'none';
        inputField.placeholder = "הקלד את המילה כאן...";
    }
}

function speakCurrentWord() {
    if (!currentDictation) return;
    const currentItem = currentDictation.words[currentWordIndex];
    if (synth && currentItem) {
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(currentItem.word);
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
    const feedback = document.getElementById('feedback-message');

    if (!typedValue) {
        if (feedback) {
            feedback.innerText = '⚠️ נא להקליד ערך לפני הבדיקה!';
            feedback.style.color = '#fdcb6e';
        }
        return;
    }

    const currentItem = currentDictation.words[currentWordIndex];
    const targetWord = currentItem.word;

    let isCorrect = false;

    if (currentDictation.isChallengeMode && targetWord.length > 2) {
        const firstLetter = targetWord[0].toLowerCase();
        const lastLetter = targetWord[targetWord.length - 1].toLowerCase();
        
        // הילד יכול להקליד את שתי האותיות יחד (למשל "ae" עבור apple) או את המילה המלאה
        const typedClean = typedValue.toLowerCase().replace(/\s+/g, '');
        const expectedPair = firstLetter + lastLetter;

        if (typedClean === expectedPair || typedClean === targetWord.toLowerCase()) {
            isCorrect = true;
        }
    } else {
        if (typedValue.toLowerCase() === targetWord.toLowerCase()) {
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
            setupCurrentWordUI();
            speakCurrentWord();
        } else {
            showResults();
        }
    }, 1500);
}

function showResults() {
    showScreen('results-screen');
    if (!currentDictation) return;
    
    const originalDict = appData.dictations[currentChild.id].find(d => d.id === currentDictation.id);

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
        
        if (!originalDict.historyMistakes) originalDict.historyMistakes = [];
        userMistakes.forEach(m => {
            if (!originalDict.historyMistakes.includes(m.target)) {
                originalDict.historyMistakes.push(m.target);
            }
        });

        localStorage.setItem('spellingAppData', JSON.stringify(appData));
    }

    const scoreText = document.getElementById('final-score-text');
    if (scoreText) {
        scoreText.innerHTML = `ענית נכון על ${correctCount} מתוך ${totalWords} מילים!<br><br><b>רמת ביצוע: ${category}</b><br><span style="font-size: 16px; color: #636e72;">${categoryEmoji}</span>`;
    }

    const mistakesBox = document.getElementById('mistakes-review');
    if (mistakesBox) {
        if (userMistakes.length > 0) {
            mistakesBox.innerHTML = '<h4>מילים שכדאי לחזק מהתרגול הנוכחי:</h4>' + userMistakes.map(m => `
                <p>מילה: <b>${m.target}</b> (הקלדת: ${m.typed})</p>
            `).join('');
        } else {
            mistakesBox.innerHTML = '<p>✨ אין טעויות בכלל בתרגול הזה!</p>';
        }
    }
}
