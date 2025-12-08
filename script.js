(() => {
  const icon = document.getElementById('gap-icon');
  const badge = document.getElementById('gap-badge');
  const sessionInfo = document.getElementById('session-info');
  const code1El = document.getElementById('code-1');
  const code2El = document.getElementById('code-2');
  const code3El = document.getElementById('code-3');
  const finalCodeInfo = document.getElementById('final-code-info');
  const finalCodeValue = document.getElementById('final-code-value');
  const timerDisplay = document.getElementById('timer-display');
  const timerDisplayEnd = document.getElementById('timer-display-end');
  
  const MAX_DIGITS = 6;
  const END_COUNTDOWN_TIME = 15; // Czas odliczania końcowego w sekundach (dla Fazy 1 i Fazy 3)

  let standby = false;
  let dragging = false;
  let activeTarget = null;
  let sessionState = 'idle'; // 'idle', 'standby', 'code1_input', 'session_active', 'code3_input', 'finished'
  let digitsCount = 0;
  let countdownTimer = null;
  
  let sessionData = {}; // Przechowuje PIN, Kod 1, Kod 3, Czas Początkowy

  // --- Helpers ---
  function setBadge(text){ badge.textContent = text; }
  function setSessionStatus(text, color = '#007bff'){ sessionInfo.textContent = 'Status: ' + text; sessionInfo.style.color = color; }

  // --- Korelacja i Logika Kodowania ---
  function generateCode3(code1){
    const pin = code1.substring(1, 5); // 4 cyfry PIN
    const reversedPin = pin.split('').reverse().join(''); // Odwrócony PIN
    const firstDigit = code1[0]; // Cyfra 1 (Tryb/AI)
    const lastDigit = code1[5]; // Cyfra 6 (Deklaracja B2B/Biznesowa)
    
    // Kod 3 (Końcowy): Cyfra 1 + PIN Odwrotny (4 cyfry) + Cyfra 6
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
