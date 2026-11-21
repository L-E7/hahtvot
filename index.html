<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>אלופפיצ'ר - עולם ההכתבות</title>
    <link rel="stylesheet" href="style.css">
    <link rel="manifest" href="manifest.json">
    <meta name="theme-color" content="#6c5ce7">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;600;700;900&display=swap" rel="stylesheet">
</head>
<body data-theme="soccer">

    <!-- מסך התחברות -->
    <div id="auth-screen" class="screen active">
        <div class="card auth-card" style="text-align: center;">
            <h1 style="color: var(--primary);">🎒 אלופפיצ'ר</h1>
            <p>עולם ההכתבות החכם והמתקדם לקראת המבחן של המורה!</p>
            <div class="auth-buttons" style="display: flex; flex-direction: column; gap: 10px;">
                <button type="button" id="main-login-btn" onclick="handleLoginClick()" class="btn primary-btn">כניסה והמשך לתרגול 🌐</button>
            </div>
        </div>
    </div>

    <!-- מסך בחירת פרופיל וערכת נושא -->
    <div id="profile-screen" class="screen">
        <div class="container">
            <header class="main-header">
                <h2>👤 בחר פרופיל ילד</h2>
                <div class="theme-selector">
                    <label style="font-size: 14px; font-weight: bold;">ערכת נושא:</label>
                    <select id="theme-select">
                        <option value="soccer">⚽ כדורגל</option>
                        <option value="minecraft">🟩 מיינקראפט</option>
                        <option value="fortnite">🎯 פורטנייט</option>
                        <option value="unicorn">🦄 יוניקורן</option>
                    </select>
                </div>
            </header>

            <div id="profiles-container" class="grid-container"></div>

            <div class="card" style="padding: 20px;">
                <h3 style="font-size: 18px;">הוספת ילד חדש</h3>
                <input type="text" id="new-child-name" placeholder="שם הילד/ה...">
                <button type="button" id="add-child-btn" class="btn success-btn">הוסף ילד ➕</button>
            </div>
        </div>
    </div>

    <!-- מסך ניהול הכתבות להורים -->
    <div id="parent-screen" class="screen">
        <div class="container">
            <button type="button" id="back-to-profiles" class="btn secondary-btn" style="width: auto; padding: 8px 15px; margin-bottom: 15px;">⬅ חזרה</button>
            <h2>ניהול הכתבות עבור: <span id="current-managing-child" style="color: var(--primary);"></span></h2>
            
            <div class="card">
                <h3>✨ הוספת הכתבה חדשה (תרגום אוטומטי חכם)</h3>
                <form id="add-dictation-form">
                    <input type="text" id="dictation-title" placeholder="שם ההכתבה (למשל: חזרה למבחן - עמ' 37)" required>
                    <select id="dictation-lang">
                        <option value="he">עברית</option>
                        <option value="en">אנגלית</option>
                    </select>
                    <input type="date" id="dictation-date" required>
                    
                    <div style="margin: 15px 0; background: rgba(108, 92, 231, 0.05); padding: 12px; border-radius: 12px; border: 1px dashed var(--primary);">
                        <label style="display: block; font-weight: bold; margin-bottom: 5px; color: var(--primary);">בחר סגנון תרגול להכתבה זו:</label>
                        <select id="practice-mode-select">
                            <option value="standard">רגיל (כתיבת המילה המלאה לפי שמיעה)</option>
                            <option value="challenge">אתגר אות ראשונה ואחרונה (האמצע גלוי)</option>
                            <option value="translation">מבחן תרגום (שמיעת מילה באנגלית וכתיבת הפירוש בעברית)</option>
                        </select>
                    </div>

                    <textarea id="dictation-words" placeholder="הכנס מילים בשורות נפרדות (באנגלית המערכת תתרגם אוטומטית לעברית!):&#10;apple&#10;cat&#10;dog" rows="5" required></textarea>
                    <small style="display: block; color: #636e72; margin-bottom: 15px;">💡 אין צורך לכתוב פירוש ידנית! הכנס מילים באנגלית והמערכת תתרגם לבד ברקע.</small>
                    <button type="submit" class="btn primary-btn">שמור הכתבה בזיכרון 💾</button>
                </form>
            </div>

            <div class="card">
                <h3>📅 בחר הכתבה לפי תאריך בלוח השנה</h3>
                <div class="calendar-filter-box" style="margin-bottom: 15px; display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap;">
                    <input type="date" id="calendar-date-picker" style="width: auto; margin-bottom: 0;">
                    <button type="button" id="filter-by-date-btn" class="btn primary-btn" style="width: auto; padding: 10px 15px; font-size: 14px;">הצג לתאריך 🔍</button>
                    <button type="button" id="show-all-dictations-btn" class="btn secondary-btn" style="width: auto; padding: 10px 15px; font-size: 14px;">הצג הכל 📋</button>
                </div>
                <div id="existing-dictations-list"></div>
            </div>
        </div>
    </div>

    <!-- מסך תרגול הכתבה לילד -->
    <div id="practice-screen" class="screen">
        <div class="container card" style="text-align: center;">
            <button type="button" id="back-to-profiles-from-practice" class="btn secondary-btn" style="width: auto; padding: 6px 12px; font-size: 14px; float: right; margin-bottom: 10px;">⬅ יציאה</button>
            <h2 id="practice-title-display" style="clear: both; margin-top: 10px;">תרגול הכתבה</h2>
            
            <div class="progress-bar-container">
                <div id="progress-bar"></div>
            </div>
            <p id="practice-word-counter" style="font-weight: bold; color: #636e72;">מילה 1 מתוך 5</p>

            <div id="mode-instruction-box" style="font-size: 16px; color: #e17055; font-weight: bold; margin: 10px 0; display: none; background: #fff3cd; padding: 8px; border-radius: 8px;">
                <span id="mode-instruction-text"></span>
            </div>

            <div id="challenge-hint-box" style="font-size: 22px; color: var(--primary); font-weight: bold; margin: 12px 0; display: none; letter-spacing: 2px;">
                רמז מבנה: <span id="challenge-hint-text"></span>
            </div>

            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin: 12px 0;">
                <button type="button" id="hebrew-hint-btn" class="btn warning-btn" style="width: auto; padding: 8px 14px; font-size: 14px;">💡 רמז בעברית</button>
                <button type="button" id="image-hint-btn" class="btn secondary-btn" style="width: auto; padding: 8px 14px; font-size: 14px;">🖼️ רמז תמונה</button>
            </div>

            <div id="hebrew-hint-display" style="display: none; background: #e8f8f5; color: #00897b; font-weight: bold; padding: 10px; border-radius: 10px; margin: 10px 0;">
                עברית: <span id="hebrew-hint-word"></span>
            </div>

            <div id="image-hint-display" style="display: none; margin: 12px auto; max-width: 240px;">
                <p id="image-hint-status" style="font-size: 13px; color: #636e72; margin-bottom: 6px;"></p>
                <img id="image-hint-img" src="" alt="רמז תמונה" style="display: none; width: 100%; max-height: 180px; object-fit: contain; border-radius: 12px; border: 2px solid #dfe6e9; background: #fff;">
            </div>

            <div class="audio-controls" style="display: flex; flex-direction: column; gap: 10px; align-items: center; margin: 18px 0;">
                <button type="button" id="speak-word-btn" class="btn primary-btn" style="font-size: 18px; padding: 16px;">🔊 שמע מילה</button>
                <p id="speech-status" style="font-size: 12px; color: #636e72; margin: 0;"></p>
                
                <div style="display: flex; gap: 10px; width: 100%; justify-content: center; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 140px; text-align: right;">
                        <label style="font-size: 12px; display: block; margin-bottom: 3px; font-weight: bold;">מהירות הקראה:</label>
                        <select id="speech-rate-select" style="margin-bottom: 0;">
                            <option value="0.25">🐢🐢 איטי במיוחד (0.25)</option>
                            <option value="0.5">🐢 איטי מאוד (0.5)</option>
                            <option value="0.75" selected>🚶 איטי וברור (0.75)</option>
                            <option value="1.0">🏃 רגיל (1.0)</option>
                        </select>
                    </div>
                    <div style="flex: 1; min-width: 140px; text-align: right;">
                        <label style="font-size: 12px; display: block; margin-bottom: 3px; font-weight: bold;">סוג קול (דובר/ה):</label>
                        <select id="speech-voice-select" style="margin-bottom: 0;">
                            <option value="auto">אוֹטוֹמָטִי</option>
                            <option value="female">קול אישה 👩</option>
                            <option value="male">קול גבר 👨</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="input-area" style="display: flex; gap: 10px; margin-top: 15px;">
                <input type="text" id="user-typed-word" placeholder="הקלד את התשובה כאן..." autocomplete="off" style="margin-bottom: 0; flex: 1;">
                <button type="button" id="submit-word-btn" class="btn success-btn" style="width: auto; padding: 0 25px;">בדוק 🎯</button>
            </div>
            <p id="feedback-message" style="font-size: 18px; font-weight: bold; margin-top: 15px; min-height: 25px;"></p>
        </div>
    </div>

    <!-- מסך סיכום וציונים -->
    <div id="results-screen" class="screen">
        <div class="container card text-center">
            <h2>🎉 כל הכבוד! סיימת את ההכתבה!</h2>
            <p id="final-score-text" class="big-text" style="font-size: 18px; margin: 20px 0;"></p>
            <div id="mistakes-review" class="mistakes-box" style="text-align: right; margin-bottom: 20px;"></div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button type="button" id="restart-practice-btn" class="btn primary-btn">תרגל שוב 🔄</button>
                <button type="button" id="practice-mistakes-only-btn" class="btn warning-btn" style="display: none;">תרגל רק על המילים שטעית בהן 💡</button>
                <button type="button" id="finish-practice-btn" class="btn secondary-btn">חזרה לתפריט הראשי 🏠</button>
            </div>
        </div>
    </div>

    <script>
        function handleLoginClick() {
            if (typeof window.loginAsGoogle === 'function') {
                window.loginAsGoogle();
                return;
            }
            try {
                const raw = localStorage.getItem('spellingAppData');
                const data = raw ? JSON.parse(raw) : { user: null, children: [], dictations: {} };
                data.user = { name: 'הורה מחובר', email: 'parent@gmail.com' };
                localStorage.setItem('spellingAppData', JSON.stringify(data));
            } catch (e) {}
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            const profileScreen = document.getElementById('profile-screen');
            if (profileScreen) profileScreen.classList.add('active');
        }
    </script>
    <script src="app.js"></script>
</body>
</html>
