(() => {
  const icon = document.getElementById('gap-icon');
  const badge = document.getElementById('gap-badge');
  let standby = false;
  let dragging = false;
  let activeTarget = null;
  let digitsCount = 0;
  const MAX_DIGITS = 6;

  // Restore last position
  const stored = localStorage.getItem('gap-position');
  if (stored) {
    try { const pos = JSON.parse(stored); icon.style.right = 'auto'; icon.style.left = pos.x + 'px'; icon.style.top = pos.y + 'px'; icon.style.bottom = 'auto'; }
    catch(e){}
  }

  function setBadge(text){ badge.textContent = text }
  function enterStandby(){ standby = true; icon.classList.add('standby'); setBadge('standby'); }
  function exitStandby(){ standby = false; icon.classList.remove('standby'); setBadge('idle'); clearActiveTarget(); }

  function clearActiveTarget(){ if(activeTarget){ activeTarget.classList.remove('active','gap-highlight'); activeTarget = null; digitsCount = 0; } }

  // Pointer (mouse/touch) drag handling
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

  // Single click toggles standby; when standby, clicking a .gapp-target sets it
  icon.addEventListener('click', e => {
    // prevent click during dragging
    if(dragging) return;
    if(!standby) {
      enterStandby();
    } else {
      // When in standby: if activeTarget is set and under MAX_DIGITS, generate one digit and insert
      if(activeTarget){
        if(digitsCount >= MAX_DIGITS) {
          setBadge('full');
          return;
        }
        const d = Math.floor(Math.random()*10).toString();
        insertDigitToTarget(d);
      } else {
        // allow user to set target by clicking a cell; but clicking icon without target toggles off standby
        exitStandby();
      }
    }
  });

  // Clicking on a target cell sets it when in standby
  document.addEventListener('click', e => {
    if(!standby) return;
    const el = e.target.closest && e.target.closest('.gapp-target');
    if(el){
      e.preventDefault(); e.stopPropagation();
      if(activeTarget && activeTarget !== el) clearActiveTarget();
      activeTarget = el;
      activeTarget.classList.add('active','gap-highlight');
      digitsCount = 0;
      setBadge('target set');
    }
  }, true);

  function insertDigitToTarget(digit){
    if(!activeTarget) return;
    // append to contentEditable or input/textarea
    if(activeTarget.isContentEditable){
      activeTarget.textContent = (activeTarget.textContent || '') + digit;
    } else if(activeTarget.tagName === 'INPUT' || activeTarget.tagName === 'TEXTAREA'){
      activeTarget.value = (activeTarget.value || '') + digit;
    } else {
      activeTarget.textContent = (activeTarget.textContent || '') + digit;
    }
    digitsCount++;
    setBadge(digitsCount + '/' + MAX_DIGITS);
    // small pulse animation
    flash(activeTarget);
  }

  function flash(el){
    el.classList.add('flash');
    setTimeout(()=>el.classList.remove('flash'),180);
  }

  // quick helper: if user double-clicks icon fast, clear target
  icon.addEventListener('dblclick', e => { clearActiveTarget(); setBadge('cleared'); });

  // initialize
  setBadge('idle');

})();
