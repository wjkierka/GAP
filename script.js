(() => {
  const icon = document.getElementById('gap-icon');
  const badge = document.getElementById('gap-badge');
  const sessionInfo = document.getElementById('session-info');
  const timerStatus = document.getElementById('timer-status');
  const code1El = document.getElementById('code-1');
  const code2El = document.getElementById('code-2');
  const code3El = document.getElementById('code-3');
  const finalCodeInfo = document.getElementById('final-code-info');
  const finalCodeValue = document.getElementById('final-code-value');
  
  const MAX_DIGITS = 6;
  const END_COUNTDOWN_TIME = 15; // Czas odliczania końcowego w sekundach

  let standby = false;
  let dragging = false;
  let activeTarget = null;
  let sessionState = 'idle'; // 'idle', 'standby', 'code1_input', 'session_active', 'code3_input', 'finished'
  
  let countdownTimer = null;
  let sessionTimer = null; 
  let sessionStartTime = 0;
  let sessionDefaultDuration = 1800; // Domyślny czas sesji poza widgetem (30 minut)

  let sessionData = {}; // Przechowuje PIN, Kod 1, Kod 3, Czas Początkowy

  // --- Helpers ---
  function setBadge(text){ badge.textContent = text; }
  function setSessionStatus(text, color = '#007bff'){ sessionInfo.textContent = 'Status: ' + text; sessionInfo.style.color = color; }
  function setTimerStatus(text){ timerStatus.textContent = text; }

  function clearActiveTarget(){ 
      if(activeTarget){ 
          activeTarget.classList.remove('active','gap-highlight'); 
          activeTarget.contentEditable = 'false'; // Blokowanie edycji
      } 
      activeTarget = null;
  }
  
  function activateTarget(el){
      clearActiveTarget();
      activeTarget = el;
      activeTarget.classList.add('active','gap-highlight');
      activeTarget.contentEditable = 'true'; // Aktywacja edycji
      activeTarget.focus();
  }

  // --- Korelacja i Logika Kodowania ---
  function generateCode3(code1){
    const pin = code1.substring(1, 5);
    const reversedPin = pin.split('').reverse().join('');
    
    // Kod 3: * + PIN Odwrotny (4 cyfry) + *
    // Gwiazdki to maska dla cyfr wprowadzanych w Fazie 3
    const maskedCode3 = '*' + reversedPin + '*';
    
    // Pełny Kod 3, który posłuży do walidacji
    const fullCode3 = code1[0] + reversedPin + code1[5];
    
    return {masked: maskedCode3, full: fullCode3, reversedPin: reversedPin};
  }
  
  // --- Timer Logic (Pomiar Czasu Sesji) ---
  function updateSessionTimer(){
      const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
      const remaining = Math.max(0, sessionDefaultDuration - elapsed);
      
      const formatTime = (seconds) => {
          const m = Math.floor(seconds / 60);
          const s = seconds % 60;
          return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      };

      if (remaining <= 0) {
          clearInterval(sessionTimer);
          setTimerStatus(`[Faza 2] CZAS SESJI (Limit: ${formatTime(sessionDefaultDuration)}): ${formatTime(elapsed)} (Przekroczono czas!)`, 'red');
          // W tym miejscu powinna nastąpić automatyczna logika zakończenia sesji
      } else {
          setTimerStatus(`[Faza 2] CZAS SESJI: ${formatTime(elapsed)} / Pozostało: ${formatTime(remaining)}`, 'red');
      }
  }

  function startSessionTimer(){
      sessionStartTime = Date.now();
      if(sessionTimer) clearInterval(sessionTimer);
      sessionTimer = setInterval(updateSessionTimer, 1000);
      updateSessionTimer();
  }

  function stopSessionTimer(){
      if(sessionTimer) clearInterval(sessionTimer);
      sessionTimer = null;
  }

  // --- Timer Logic (Odliczanie Końcowe) ---
  function startCountdown(duration, callback){
    if(countdownTimer) clearInterval(countdownTimer);
    let timeRemaining = duration;
    
    function updateTimer(){
        setTimerStatus(`[Faza ${sessionState === 'code1_input' ? 1 : 3}] ODZICZANIE KOŃCOWE: ${timeRemaining}s`, 'red');
        if(timeRemaining <= 0){
            clearInterval(countdownTimer);
            callback(true); // Czas się skończył
            return;
        }
        timeRemaining--;
    }
    
    updateTimer();
    countdownTimer = setInterval(updateTimer, 1000);
  }
  
  function stopCountdown(){
    if(countdownTimer) clearInterval(countdownTimer);
    countdownTimer = null;
  }

  // --- Faza I: Inicjacja Sesji ---
  function enterStandby(){ 
      standby = true; 
      icon.classList.add('standby'); 
      setBadge('czuwanie');
      setSessionStatus('Wybierz Komórkę 1, aby rozpocząć start sesji.');
      sessionState = 'standby';
      code1El.textContent = '';
      code2El.textContent = '';
      code3El.textContent = '';
      setTimerStatus('');
      finalCodeInfo.style.display = 'none';
      clearActiveTarget();
  }
  
  function exitStandby(){ 
      standby = false; 
      icon.classList.remove('standby'); 
      setBadge('idle'); 
      setSessionStatus('Oczekuję na inicjację.');
      sessionState = 'idle';
      stopCountdown();
      stopSessionTimer();
      clearActiveTarget(); 
  }

  function handleCode1Input(code){
      // (1) Zakończ Faza 1
      stopCountdown(); 
      
      const {masked: maskedCode3, full: fullCode3, reversedPin} = generateCode3(code);
      
      sessionData = {
          code1: code,
          pin: code.substring(1, 5),
          mode: (code[0] === '0') ? 'Co-op' : 'Self',
          code3_full: fullCode3,
          code3_masked: maskedCode3,
          reversedPin: reversedPin,
      };
      
      // (2) Wyświetl Kod 3 (maskowany)
      code3El.textContent = sessionData.code3_masked;
      finalCodeValue.textContent = sessionData.code3_masked;
      finalCodeInfo.style.display = 'block';

      // (3) Przejście do Fazy 2 (Sesja Zewnętrzna)
      sessionState = 'session_active';
      clearActiveTarget();
      code2El.classList.add('gap-highlight'); // Oznacz Komórkę 2 jako cel
      
      setSessionStatus(`SESJA AKTYWNA: ${sessionData.mode} Mode. Czekam na Kod 2.`, 'green');
      startSessionTimer(); // Uruchom licznik sesji
      
      activateTarget(code2El); // Aktywuj Komórkę 2
  }

  // --- Faza II: Oczekiwanie na Kod 2 (Protokół) ---
  function handleCode2Paste(code){
      if(code.length !== MAX_DIGITS) return;
      
      stopSessionTimer(); // Zakończenie pomiaru czasu sesji zewnętrznej
      sessionData.code2 = code; // Protokół TPC&TPO / FC

      // (1) Przejście do Fazy 3 (Zakończenie)
      sessionState = 'code3_input';
      clearActiveTarget();
      code2El.classList.remove('gap-highlight');
      code3El.classList.add('gap-highlight'); 
      
      setSessionStatus('SESJA ZAKOŃCZONA. Uzupełnij Kod 3 (Gwiazdki). Masz 15 sekund.', 'orange');

      // (2) Start Odliczania Końcowego (Faza 3)
      startCountdown(END_COUNTDOWN_TIME, (timeout) => {
          if(timeout && sessionState === 'code3_input'){
              setSessionStatus('SESJA ZAKOŃCZONA, BŁĄD: Przekroczono czas na Kod 3.', 'red');
              sessionState = 'finished';
              clearActiveTarget();
          }
      }); // Nie potrzebujemy drugiego display el, użyjemy głównego timerStatus
      
      activateTarget(code3El); // Aktywuj Komórkę 3 do edycji
  }
  
  // --- Faza III: Zakończenie Sesji ---
  function handleCode3Input(code){
      if(code.length !== MAX_DIGITS) return;
      
      stopCountdown();
      
      // Walidacja: czy wprowadzony Kod 3 zgadza się z pełnym, oczekiwanym kodem
      if(code === sessionData.code3_full){
          const duration = ((Date.now() - sessionData.startTime) / 1000).toFixed(2);
          setSessionStatus(`FINAŁ GAP: Zakończono! PIN Odwrotny: ${sessionData.reversedPin}.`, 'purple');
          sessionState = 'finished';
      } else {
          setSessionStatus('FINAŁ GAP: BŁĄD. Wprowadzony Kod 3 nie zgadza się z oczekiwanym.', 'red');
          sessionState = 'finished';
      }
      
      clearActiveTarget();
      finalCodeInfo.style.display = 'none';
      setTimerStatus('');
  }

  // --- Event Handlers ---
  
  // Kliknięcie ikony tylko toggle'uje standby (idle/standby)
  icon.addEventListener('click', e => {
    e.stopPropagation();
    if(dragging) return;
    if(sessionState === 'idle' || sessionState === 'finished') {
      enterStandby();
    } else if(sessionState === 'standby') {
      exitStandby();
    }
  });

  // 1. Aktywacja komórek na kliknięcie
  document.addEventListener('click', e => {
    const el = e.target.closest && e.target.closest('.gapp-target');
    if(!el) return;

    if(el.id === 'code-1' && sessionState === 'standby'){
        // START Fazy 1
        activateTarget(el);
        el.textContent = '';
        sessionState = 'code1_input';
        
        setSessionStatus('Wprowadzaj Kod 1 (PIN 2-5). Masz 15 sekund!', 'red');
        startCountdown(END_COUNTDOWN_TIME, (timeout) => {
            if(timeout && sessionState === 'code1_input' && el.textContent.length < MAX_DIGITS){
                setSessionStatus('BŁĄD: Przekroczono czas na Kod 1.', 'red');
                sessionState = 'finished';
                clearActiveTarget();
            }
        });

    } else if(el.id === 'code-3' && sessionState === 'code3_input'){
        // START Fazy 3 (jeśli nie jest już aktywna)
        if(activeTarget !== el) activateTarget(el);
        // Dalsza logika w keyup/input
        
    } else if (el.id === 'code-2' && sessionState === 'session_active') {
        // Aktywacja Komórki 2 (jest aktywna przez system, ale kliknięcie może pomóc wkleić)
        activateTarget(el);
        
    } else {
        // Blokowanie kliknięć w niewłaściwe komórki/fazy
        e.preventDefault(); e.stopPropagation();
    }
  }, true);

  // 2. Wprowadzanie klawiaturą (z funkcją blokowania i wklejania)
  document.addEventListener('input', e => {
      const el = e.target;
      if (!el.classList.contains('gapp-target') || activeTarget !== el) return;
      
      // Filtracja tylko cyfr i ograniczenie długości (wpisywanie od lewej)
      let currentCode = el.textContent.replace(/[^0-9*]/g, '');
      const maxLength = parseInt(el.dataset.maxLength || MAX_DIGITS);

      // Logika dla Komórki 3: zachowanie maski z odwróconym PIN-em
      if (el.id === 'code-3' && sessionState === 'code3_input') {
          // Użytkownik może edytować tylko pozycje 1 i 6
          const pinPart = sessionData.code3_masked.substring(1, 5); // Odwrócony PIN
          
          let firstChar = currentCode[0] && currentCode[0] !== '*' ? currentCode[0] : '*';
          let lastChar = currentCode[5] && currentCode[5] !== '*' ? currentCode[5] : '*';
          
          // Używamy wprowadzonych cyfr i łączymy z maską
          currentCode = firstChar + pinPart + lastChar;
          
      } else {
          // Dla Kodów 1 i 2 - ograniczenie długości
          currentCode = currentCode.substring(0, maxLength);
      }
      
      el.textContent = currentCode;
      
      // Przesuń kursor na koniec pola
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);

      // --- Logika Po Wprowadzeniu 6 Cyfr ---
      if (el.id === 'code-1' && sessionState === 'code1_input' && currentCode.length === MAX_DIGITS) {
          handleCode1Input(currentCode);
      } else if (el.id === 'code-2' && sessionState === 'session_active' && currentCode.length === MAX_DIGITS) {
          handleCode2Paste(currentCode);
      } else if (el.id === 'code-3' && sessionState === 'code3_input' && !currentCode.includes('*')) {
          handleCode3Input(currentCode);
      }
      
  });


  // --- Inicjalizacja/Pozycjonowanie (Bez Zmian) ---
  // ... (Kod dla drag&drop i inicjalizacji, jak w poprzedniej wersji)
  // Restore last position...
  const stored = localStorage.getItem('gap-position');
  if (stored) {
    try { const pos = JSON.parse(stored); icon.style.right = 'auto'; icon.style.left = pos.x + 'px'; icon.style.top = pos.y + 'px'; icon.style.bottom = 'auto'; }
    catch(e){}
  }
  
  // ... (reszta kodu drag&drop)
  let pointerOffset = {x:0,y:0};
  icon.addEventListener('pointerdown', e => {
    e.preventDefault();
    dragging = true; icon.classList.add('grabbing');
    icon.setPointerCapture(e.pointerId);
    const rect = icon.getBoundingClientRect();
    pointerOffset.x = e.clientX - rect.left;
    pointerOffset.y = e.clientY - rect.top;
  });
  window.addEventListener('pointermove', e => {
    if(!dragging) return;
    const x = e.clientX - pointerOffset.x;
    const y = e.clientY - pointerOffset.y;
    const rectWidth = () => icon.getBoundingClientRect().width; // lokalne definicje
    const rectHeight = () => icon.getBoundingClientRect().height; // lokalne definicje
    icon.style.left = Math.max(4, Math.min(window.innerWidth - rectWidth(), x)) + 'px';
    icon.style.top = Math.max(4, Math.min(window.innerHeight - rectHeight(), y)) + 'px';
  });
  window.addEventListener('pointerup', e => {
    if(!dragging) return;
    dragging = false; icon.classList.remove('grabbing');
    try{ icon.releasePointerCapture(e.pointerId) } catch(_){}
    localStorage.setItem('gap-position', JSON.stringify({x: parseInt(icon.style.left||0,10), y: parseInt(icon.style.top||0,10)}));
  });
  
  icon.addEventListener('dblclick', e => { exitStandby(); setSessionStatus('Oczekuję na inicjację.', '#007bff'); });
  // initialize
  setBadge('idle');

})();
    const code3 = firstDigit + reversedPin + lastDigit;
    return {code: code3, pin: reversedPin};
  }
  
  // --- Timer Logic (Odliczanie Końcowe) ---
  function startCountdown(duration, callback, displayEl){
    if(countdownTimer) clearInterval(countdownTimer);
    let timeRemaining = duration;
    
    function updateTimer(){
        if(displayEl) displayEl.textContent = timeRemaining;
        if(timeRemaining <= 0){
            clearInterval(countdownTimer);
            callback(true); // Czas się skończył
            return;
        }
        timeRemaining--;
    }
    
    updateTimer(); // Uruchom natychmiast
    countdownTimer = setInterval(updateTimer, 1000);
    return countdownTimer;
  }
  
  function stopCountdown(){
    if(countdownTimer) clearInterval(countdownTimer);
    countdownTimer = null;
  }

  // --- Faza I: Inicjacja Sesji ---
  function enterStandby(){ 
      standby = true; 
      icon.classList.add('standby'); 
      setBadge('czuwanie');
      setSessionStatus('Wybierz Komórkę 1, aby rozpocząć PRZEDTAKT.');
      sessionState = 'standby';
      clearActiveTarget();
  }
  
  function exitStandby(){ 
      standby = false; 
      icon.classList.remove('standby'); 
      setBadge('idle'); 
      setSessionStatus('Oczekuję na inicjację.');
      sessionState = 'idle';
      stopCountdown();
      clearActiveTarget(); 
  }

  function handleCode1Input(code){
      if(code.length !== MAX_DIGITS) return;
      
      stopCountdown(); // Stop timer po wprowadzeniu 6. cyfry
      
      const firstDigit = parseInt(code[0]);
      const lastDigit = parseInt(code[5]);
      
      // Walidacja trybu i zaangażowania AI
      const mode = (firstDigit === 0) ? 'Co-op Mode' : `Self Mode (AI: ${firstDigit}/9)`;
      
      // Walidacja B2B/Biznesowa
      const modeExtension = (firstDigit === 0 && lastDigit === 0) ? ' (B2B)' : 
                            (firstDigit !== 0 && lastDigit === 0) ? ' (Biznesowy)' : '';
      
      // Generowanie Kodów
      const {code: code3Value, pin: reversedPin} = generateCode3(code);
      
      sessionData = {
          code1: code,
          pin: code.substring(1, 5),
          mode: mode + modeExtension,
          code3: code3Value,
          reversedPin: reversedPin,
          startTime: Date.now()
      };
      
      // Przejście do fazy aktywnej sesji
      sessionState = 'session_active';
      activeTarget.blur(); // Usuń focus z komórki
      clearActiveTarget(); 
      
      setSessionStatus(`SESJA AKTYWNA: ${sessionData.mode}. Kod Końcowy (3) wygenerowany. Czekam na Kod 2.`, 'green');
      finalCodeInfo.style.display = 'block';
      finalCodeValue.textContent = sessionData.code3;
      code2El.classList.add('gap-highlight'); // Oznacz Komórkę 2 jako kolejny cel
  }

  // --- Faza III: Zakończenie Sesji ---
  function handleCode2Input(code){
      if(code.length < MAX_DIGITS) return; // Wystarczy, że ma 6 cyfr, widget nie waliduje treści TPC/FC
      
      sessionData.code2 = code; // Zapisz kod raportu

      sessionState = 'code3_input';
      activeTarget.blur(); 
      clearActiveTarget();
      code2El.classList.remove('gap-highlight');
      code3El.classList.add('gap-highlight'); // Oznacz Komórkę 3 jako kolejny cel
      
      setSessionStatus('SESJA ZAKOŃCZONA. Wprowadź Kod 3 (Ostatni Takt). Masz 15 sekund.', 'orange');

      // Start Odliczania Końcowego (Faza 3)
      startCountdown(END_COUNTDOWN_TIME, (timeout) => {
          if(timeout && sessionState === 'code3_input'){
              setSessionStatus('SESJA ZAKOŃCZONA, WERYFIKACJA CZASU: Przekroczono czas na Kod 3.', 'red');
              sessionState = 'finished';
          }
      }, timerDisplayEnd);
  }
  
  function handleCode3Input(code){
      if(code.length !== MAX_DIGITS) return;
      
      stopCountdown();
      
      if(code === sessionData.code3){
          const duration = ((Date.now() - sessionData.startTime) / 1000).toFixed(2);
          setSessionStatus(`FINAŁ GAP: Zakończono! Czas sesji: ${duration}s. PIN Odwrotny: ${sessionData.reversedPin}.`, 'purple');
          sessionState = 'finished';
      } else {
          setSessionStatus('FINAŁ GAP: BŁĄD. Wprowadzony Kod 3 nie zgadza się z wygenerowanym.', 'red');
          sessionState = 'finished';
      }
      
      clearActiveTarget();
      finalCodeInfo.style.display = 'none';
  }

  // --- Event Handlers (Modyfikacje) ---
  
  // 1. Zmiana: Kliknięcie ikony tylko toggle'uje standby
  icon.addEventListener('click', e => {
    e.stopPropagation();
    if(dragging) return;
    if(sessionState === 'idle' || sessionState === 'finished') {
      enterStandby();
    } else if(sessionState === 'standby') {
      exitStandby();
    }
  });

  // 2. Kliknięcie na komórkę ustawia cel i uruchamia logikę fazy
  document.addEventListener('click', e => {
    if(!standby && sessionState !== 'code3_input') return;
    const el = e.target.closest && e.target.closest('.gapp-target');
    if(!el) return;

    // Przekierowanie kliknięć na odpowiednie fazy
    if(el.id === 'code-1' && sessionState === 'standby'){
        activeTarget = el;
        activeTarget.textContent = '';
        activeTarget.classList.add('active','gap-highlight');
        sessionState = 'code1_input';
        digitsCount = 0;
        setBadge('Kod 1 [PRZEDTAKT]');
        setSessionStatus('Wprowadzaj Kod 1. Masz 15 sekund!', 'red');
        
        // Start Odliczania Końcowego (Faza 1)
        startCountdown(END_COUNTDOWN_TIME, (timeout) => {
            if(timeout && sessionState === 'code1_input' && digitsCount < MAX_DIGITS){
                setSessionStatus('BŁĄD WPROWADZANIA: Przekroczono czas na Kod 1.', 'red');
                sessionState = 'finished';
            }
        }, timerDisplay);
        
    } else if(el.id === 'code-3' && sessionState === 'code3_input'){
        // Aktywacja Komórki 3 - start Fazy 3
        activeTarget = el;
        activeTarget.textContent = '';
        activeTarget.classList.add('active','gap-highlight');
        digitsCount = 0;
        setBadge('Kod 3 [OSTATNI TAKT]');
        // Dalsza logika w keyup/input
        
    } else {
        // Blokowanie kliknięć w niewłaściwe komórki/fazy
        e.preventDefault(); e.stopPropagation();
    }
  }, true);
  
  // 3. Wprowadzanie klawiaturą (Zastępuje generowanie losowe)
  document.addEventListener('input', e => {
      const el = e.target;
      if (!el.classList.contains('gapp-target')) return;
      
      const currentCode = el.textContent.replace(/[^0-9]/g, '').substring(0, MAX_DIGITS);
      el.textContent = currentCode;
      
      const len = currentCode.length;
      digitsCount = len;
      
      if (len < MAX_DIGITS) return;
      
      // Logika po osiągnięciu 6 cyfr
      if (el.id === 'code-1' && sessionState === 'code1_input') {
          handleCode1Input(currentCode);
      } else if (el.id === 'code-2' && sessionState === 'session_active') {
          handleCode2Input(currentCode);
      } else if (el.id === 'code-3' && sessionState === 'code3_input') {
          handleCode3Input(currentCode);
      }
      
  });


  // --- Inicjalizacja/Pozycjonowanie (Bez Zmian) ---

  // Restore last position... (pozostała część kodu dla drag&drop)
  const stored = localStorage.getItem('gap-position');
  if (stored) {
    try { const pos = JSON.parse(stored); icon.style.right = 'auto'; icon.style.left = pos.x + 'px'; icon.style.top = pos.y + 'px'; icon.style.bottom = 'auto'; }
    catch(e){}
  }
  
  // ... (reszta kodu drag&drop oraz flash/rectWidth/Height - bez zmian)
  let pointerOffset = {x:0,y:0};
  icon.addEventListener('pointerdown', e => {
    e.preventDefault();
    dragging = true; icon.classList.add('grabbing');
    icon.setPointerCapture(e.pointerId);
    const rect = icon.getBoundingClientRect();
    pointerOffset.x = e.clientX - rect.left;
    pointerOffset.y = e.clientY - rect.top;
  });
  window.addEventListener('pointermove', e => {
    if(!dragging) return;
    const x = e.clientX - pointerOffset.x;
    const y = e.clientY - pointerOffset.y;
    icon.style.left = Math.max(4, Math.min(window.innerWidth - rectWidth(), x)) + 'px';
    icon.style.top = Math.max(4, Math.min(window.innerHeight - rectHeight(), y)) + 'px';
  });
  window.addEventListener('pointerup', e => {
    if(!dragging) return;
    dragging = false; icon.classList.remove('grabbing');
    try{ icon.releasePointerCapture(e.pointerId) } catch(_){}
    localStorage.setItem('gap-position', JSON.stringify({x: parseInt(icon.style.left||0,10), y: parseInt(icon.style.top||0,10)}));
  });

  function rectWidth(){ return icon.getBoundingClientRect().width }
  function rectHeight(){ return icon.getBoundingClientRect().height }

  icon.addEventListener('dblclick', e => { exitStandby(); setSessionStatus('Oczekuję na inicjację.', '#007bff'); });
  // initialize
  setBadge('idle');

})();
