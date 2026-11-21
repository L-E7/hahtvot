function speakCurrentWord() {
    if (!currentDictation) return;
    const currentItem = currentDictation.words[currentWordIndex];
    const statusEl = document.getElementById('speech-status');
    if (!currentItem) return;

    if (!('speechSynthesis' in window)) {
        if (statusEl) statusEl.innerText = 'הדפדפן לא תומך בהקראה קולית (speechSynthesis).';
        return;
    }

    try {
        window.speechSynthesis.resume();
    } catch (e) {}

    const runUtterance = () => {
        const allVoices = window.speechSynthesis.getVoices() || [];
        if (allVoices.length > 0) voices = allVoices;

        const utterance = new SpeechSynthesisUtterance(currentItem.word);
        const mode = currentDictation.practiceMode || 'standard';
        utterance.lang = (mode === 'translation' || currentDictation.lang === 'en') ? 'en-US' : 'he-IL';

        const langPrefix = utterance.lang.startsWith('he') ? 'he' : 'en';
        const availableVoices = voices.filter(v =>
            v.lang && v.lang.toLowerCase().replace('_', '-').startsWith(langPrefix)
        );

        const voiceTypeSelect = document.getElementById('speech-voice-select');
        const voiceType = voiceTypeSelect ? voiceTypeSelect.value : 'auto';

        if (availableVoices.length > 0 && voiceType !== 'auto') {
            let matchedVoice = null;
            if (voiceType === 'female') {
                matchedVoice = availableVoices.find(v => /female|zira|susan|samantha|victoria|moira|tessa|fiona|google.*female|natural.*female/i.test(v.name));
            } else if (voiceType === 'male') {
                matchedVoice = availableVoices.find(v => /\bmale\b|david|george|daniel|alex|fred|google.*male|natural.*male/i.test(v.name));
            }
            if (matchedVoice) utterance.voice = matchedVoice;
        }

        const rateSelect = document.getElementById('speech-rate-select');
        const parsedRate = rateSelect ? parseFloat(rateSelect.value) : 0.75;
        utterance.rate = isNaN(parsedRate) ? 0.75 : parsedRate;

        utterance.onerror = (ev) => {
            if (statusEl) {
                statusEl.innerText = `שגיאת שמע (${ev.error || 'unknown'}). ודא שעוצמת המדיה פתוחה ושיש קול מותקן למכשיר.`;
            }
        };

        utterance.onstart = () => {
            if (statusEl) {
                statusEl.innerText = `מקריא (${utterance.lang}, מהירות ${utterance.rate})...`;
            }
        };

        utterance.onend = () => {
            if (statusEl) {
                statusEl.innerText = availableVoices.length === 0
                    ? `הושמע (לא זוהה קול ייעודי ל-${langPrefix} במכשיר, נעשה שימוש בברירת מחדל).`
                    : '';
            }
        };

        window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
        setTimeout(runUtterance, 80);
    } else {
        runUtterance();
    }
}
