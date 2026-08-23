(() => {
  'use strict';

  const pets = window.PETS_DATA || [];
  const app = document.getElementById('app');
  const STORAGE_KEY = 'codexPetSelector.v1';
  const SYNC_PERIOD_MS = 1800;
  const state = loadState();

  let view = {name:'home', index:0, filter:'all', fromConfirm:false, transition:null};
  let animator = null;
  let gestureCleanup = null;

  function defaultPetState(){ return {reviewed:false, heart:false, stars:{}, memo:''}; }
  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return {pets:{}};
      const parsed = JSON.parse(raw);
      if(!parsed || typeof parsed !== 'object') return {pets:{}};
      parsed.pets ||= {};
      return parsed;
    }catch(_){ return {pets:{}}; }
  }
  function pstate(id){
    if(!state.pets[id]) state.pets[id] = defaultPetState();
    return state.pets[id];
  }
  function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function reviewedCount(){ return pets.filter(p => pstate(p.id).reviewed).length; }
  function selectedCount(){ return pets.filter(isSelected).length; }
  function isSelected(p){
    const s = pstate(p.id);
    return !!s.heart || Object.values(s.stars || {}).some(Boolean);
  }
  function starCount(p){ return Object.values(pstate(p.id).stars || {}).filter(Boolean).length; }
  function firstUnreviewed(){
    const i = pets.findIndex(p => !pstate(p.id).reviewed);
    return i < 0 ? pets.length : i;
  }
  function esc(s){
    return String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  }
  function sheetUrl(pet){
    const localHost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    return localHost && pet.localSheet ? pet.localSheet : pet.sheet;
  }

  function homeIcon(){
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.7 12 3.8l8.5 6.9v8.1a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7z"/><path d="M9 20.5v-6.2h6v6.2"/></svg>`;
  }
  function backIcon(){
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>`;
  }
  function heartIcon(on){
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 5.8c-2-2.1-5.3-2.1-7.3 0L12 7.4l-1.5-1.6a5 5 0 0 0-7.3 0c-2.2 2.3-2.2 6.1 0 8.4L12 21l8.8-6.8c2.2-2.3 2.2-6.1 0-8.4Z" ${on?'class="fill"':''}/></svg>`;
  }

  function stopAnimator(){
    if(animator){ animator.stop(); animator = null; }
    if(gestureCleanup){ gestureCleanup(); gestureCleanup = null; }
  }

  function render(){
    stopAnimator();
    window.scrollTo(0,0);
    if(view.name === 'home') renderHome();
    else if(view.name === 'judge') renderJudge();
    else if(view.name === 'confirm') renderConfirm();
    else if(view.name === 'detail') renderDetail();
    else if(view.name === 'complete') renderComplete();
  }

  function renderHome(){
    const rc = reviewedCount();
    const canContinue = rc > 0 && rc < pets.length;
    const canConfirm = selectedCount() > 0;
    app.innerHTML = `<section class="cover-screen">
      <div class="cover-book">
        <div class="cover-kicker">PET CATALOG</div>
        <div class="cover-number">55</div>
        <div class="cover-rule"></div>
        <div class="cover-actions">
          <button class="cover-btn primary" id="startBtn">はじめから</button>
          <button class="cover-btn" id="continueBtn" ${canContinue?'':'disabled'}>つづきから</button>
          <button class="cover-btn" id="confirmBtn" ${canConfirm?'':'disabled'}>かくにん</button>
        </div>
        <div class="cover-progress">${rc} / ${pets.length}</div>
      </div>
    </section>`;

    $('#startBtn').onclick = () => { view = {name:'judge',index:0,filter:'all',fromConfirm:false,transition:'next'}; render(); };
    $('#continueBtn').onclick = () => {
      const i = firstUnreviewed();
      view = i >= pets.length
        ? {name:'complete',index:0,filter:'all',fromConfirm:false,transition:null}
        : {name:'judge',index:i,filter:'all',fromConfirm:false,transition:'next'};
      render();
    };
    $('#confirmBtn').onclick = () => { view = {name:'confirm',index:0,filter:'all',fromConfirm:false,transition:null}; render(); };
  }

  function renderJudge(){
    if(view.index >= pets.length){ view.name = 'complete'; render(); return; }
    const pet = pets[view.index];
    const s = pstate(pet.id);
    const entryClass = view.transition === 'next' ? 'page-enter-next' : view.transition === 'prev' ? 'page-enter-prev' : '';
    view.transition = null;

    app.innerHTML = `<section class="catalog-shell">
      <article class="catalog-page ${entryClass}" id="catalogPage">
        <header class="catalog-toolbar">
          <div class="toolbar-side left">
            <button class="round-icon home-icon" id="homeBtn" aria-label="ホーム">${view.fromConfirm ? backIcon() : homeIcon()}</button>
          </div>
          <div class="page-counter">${view.fromConfirm ? '再判定' : `${view.index+1} / ${pets.length}`}</div>
          <div class="toolbar-side right">
            <button class="round-icon heart-toggle ${s.heart?'on':''}" id="heartBtn" aria-label="キャラクター構造を採用" aria-pressed="${s.heart?'true':'false'}">${heartIcon(s.heart)}</button>
          </div>
        </header>

        <div class="catalog-heading">
          <div class="pet-title">${esc(pet.displayName)}</div>
          <div class="pet-hint">${pet.showIdHint ? esc(pet.id) : '&nbsp;'}</div>
        </div>

        <div class="action-grid" id="actionGrid">
          ${pet.actions.map((a,i) => actionCard(pet,a,i,!!s.stars[a.key],true)).join('')}
        </div>
      </article>
    </section>`;

    initAnimations(pet);
    $$('.star-btn').forEach(btn => btn.onclick = () => toggleStar(btn, s));
    $('#heartBtn').onclick = () => toggleHeart($('#heartBtn'), s);

    $('#homeBtn').onclick = () => {
      if(view.fromConfirm){
        view = {name:'detail',index:view.index,filter:view.filter || 'all',fromConfirm:false,transition:null};
      }else{
        view = {name:'home',index:0,filter:'all',fromConfirm:false,transition:null};
      }
      render();
    };

    if(!view.fromConfirm){
      gestureCleanup = setupPageSwipe($('#catalogPage'), {
        canPrev: () => view.index > 0,
        canNext: () => true,
        onPrev: () => moveJudge('prev'),
        onNext: () => moveJudge('next')
      });
    }
  }

  function moveJudge(direction){
    const pet = pets[view.index];
    const s = pstate(pet.id);
    if(direction === 'next'){
      s.reviewed = true;
      save();
      if(view.index >= pets.length - 1){
        view = {name:'complete',index:0,filter:'all',fromConfirm:false,transition:null};
      }else{
        view.index += 1;
        view.transition = 'next';
      }
    }else if(direction === 'prev' && view.index > 0){
      view.index -= 1;
      view.transition = 'prev';
    }
    render();
  }

  function setupPageSwipe(page, opts){
    let startX = 0, startY = 0, lastX = 0, startT = 0, tracking = false, horizontal = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const down = (e) => {
      if(e.pointerType === 'mouse' && e.button !== 0) return;
      if(e.target.closest('button,textarea,input,a')) return;
      tracking = true; horizontal = false;
      startX = lastX = e.clientX; startY = e.clientY; startT = performance.now();
      page.classList.add('dragging');
      try{ page.setPointerCapture(e.pointerId); }catch(_){ }
    };
    const move = (e) => {
      if(!tracking) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      lastX = e.clientX;
      if(!horizontal){
        if(Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if(Math.abs(dy) > Math.abs(dx) * 1.08){ cancelDrag(); return; }
        horizontal = true;
      }
      if(e.cancelable) e.preventDefault();
      const width = Math.max(page.clientWidth, 1);
      const resistance = (dx > 0 && !opts.canPrev()) ? .22 : (dx < 0 && !opts.canNext()) ? .22 : 1;
      const x = dx * resistance;
      const tilt = Math.max(-2.2, Math.min(2.2, (x / width) * -3.2));
      page.style.transform = `translate3d(${x}px,0,0) rotateY(${tilt}deg)`;
      page.style.setProperty('--page-drag', String(Math.min(1, Math.abs(x)/width)));
    };
    const up = () => {
      if(!tracking) return;
      const dx = lastX - startX;
      const dt = Math.max(1, performance.now() - startT);
      const velocity = Math.abs(dx) / dt;
      const width = Math.max(page.clientWidth, 1);
      const commit = horizontal && (Math.abs(dx) > Math.max(66, width * .16) || (Math.abs(dx) > 34 && velocity > .48));
      const direction = dx < 0 ? 'next' : 'prev';
      const allowed = direction === 'next' ? opts.canNext() : opts.canPrev();
      tracking = false;

      if(commit && allowed){
        page.classList.remove('dragging');
        page.style.removeProperty('transform');
        page.style.removeProperty('--page-drag');
        if(reduced){ direction === 'next' ? opts.onNext() : opts.onPrev(); return; }
        page.classList.add(direction === 'next' ? 'page-exit-next' : 'page-exit-prev');
        setTimeout(() => direction === 'next' ? opts.onNext() : opts.onPrev(), 230);
      }else{
        page.classList.remove('dragging');
        page.classList.add('page-snap-back');
        page.style.removeProperty('transform');
        page.style.removeProperty('--page-drag');
        setTimeout(() => page.classList.remove('page-snap-back'), 220);
      }
    };
    const cancelDrag = () => {
      if(!tracking) return;
      tracking = false; horizontal = false;
      page.classList.remove('dragging');
      page.style.removeProperty('transform');
      page.style.removeProperty('--page-drag');
    };

    page.addEventListener('pointerdown', down);
    page.addEventListener('pointermove', move, {passive:false});
    page.addEventListener('pointerup', up);
    page.addEventListener('pointercancel', cancelDrag);
    return () => {
      page.removeEventListener('pointerdown', down);
      page.removeEventListener('pointermove', move);
      page.removeEventListener('pointerup', up);
      page.removeEventListener('pointercancel', cancelDrag);
    };
  }

  function toggleStar(btn, s){
    const key = btn.dataset.action;
    s.stars[key] = !s.stars[key];
    save();
    btn.classList.toggle('on', !!s.stars[key]);
    btn.textContent = s.stars[key] ? '★' : '☆';
    btn.setAttribute('aria-pressed', s.stars[key] ? 'true' : 'false');
    btn.classList.remove('star-pop');
    void btn.offsetWidth;
    btn.classList.add('star-pop');
    setTimeout(() => btn.classList.remove('star-pop'), 260);
  }

  function toggleHeart(btn, s){
    s.heart = !s.heart;
    save();
    btn.classList.toggle('on', s.heart);
    btn.setAttribute('aria-pressed', s.heart ? 'true' : 'false');
    btn.innerHTML = heartIcon(s.heart);
    btn.classList.remove('heart-pop-on','heart-pop-off');
    void btn.offsetWidth;
    btn.classList.add(s.heart ? 'heart-pop-on' : 'heart-pop-off');
    setTimeout(() => btn.classList.remove('heart-pop-on','heart-pop-off'), 420);
  }

  function actionCard(pet, a, i, on, interactive){
    return `<div class="action-card">
      <div class="anim-wrap"><canvas width="192" height="208" data-action-index="${i}"></canvas></div>
      ${interactive
        ? `<button class="star-btn ${on?'on':''}" data-action="${esc(a.key)}" aria-label="${esc(a.label)}の動きを採用" aria-pressed="${on?'true':'false'}">${on?'★':'☆'}</button>`
        : `<div class="star-btn ${on?'on':''}" aria-hidden="true">${on?'★':'☆'}</div>`}
      <div class="action-label">${esc(a.label)}</div>
    </div>`;
  }

  function initAnimations(pet){
    const canvases = [...document.querySelectorAll('canvas[data-action-index]')];
    const img = new Image();
    let stopped = false, raf = 0, start = performance.now();
    const lastFrames = new Array(canvases.length).fill(-1);

    img.onload = () => {
      const tick = (t) => {
        if(stopped) return;
        canvases.forEach((canvas, ci) => {
          const ai = Number(canvas.dataset.actionIndex);
          const a = pet.actions[ai];
          if(!a) return;
          const frames = a.frames?.length ? a.frames : [0];
          const fi = Math.floor((t - start) / a.ms) % frames.length;
          if(fi === lastFrames[ci]) return;
          lastFrames[ci] = fi;
          drawFrame(canvas, img, ai, frames[fi]);
        });
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    img.onerror = () => canvases.forEach(c => c.closest('.anim-wrap')?.classList.add('load-error'));
    img.src = sheetUrl(pet);
    animator = {stop(){ stopped = true; cancelAnimationFrame(raf); img.onload = null; img.onerror = null; }};
  }

  function drawFrame(canvas, img, row, col){
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,192,208);
    ctx.drawImage(img, col*192, row*208, 192,208, 0,0,192,208);
  }

  function renderConfirm(){
    let selected = pets.filter(isSelected);
    if(view.filter === 'heart') selected = selected.filter(p => pstate(p.id).heart);
    if(view.filter === 'star') selected = selected.filter(p => starCount(p) > 0);
    const starMode = view.filter === 'star';

    app.innerHTML = `<section class="review-screen">
      <header class="review-toolbar">
        <button class="round-icon home-icon" id="homeBtn" aria-label="ホーム">${homeIcon()}</button>
        <div class="review-title">かくにん</div>
        <div class="toolbar-spacer"></div>
      </header>

      <div class="filters" role="tablist" aria-label="表示切替">
        <button class="filter-btn ${view.filter==='all'?'active':''}" data-filter="all">すべて</button>
        <button class="filter-btn ${view.filter==='heart'?'active':''}" data-filter="heart">♥ キャラ</button>
        <button class="filter-btn ${view.filter==='star'?'active':''}" data-filter="star">★ 動き</button>
      </div>

      ${selected.length
        ? (starMode ? `<div class="sync-list">${selected.map(p => syncPetCard(p)).join('')}</div>` : `<div class="confirm-list">${selected.map(p => confirmCard(p)).join('')}</div>`)
        : `<div class="empty">該当するPetはありません</div>`}

      <button class="export-btn" id="exportBtn">結果を書き出す</button>
    </section>`;

    $('#homeBtn').onclick = () => { view = {name:'home',index:0,filter:'all',fromConfirm:false,transition:null}; render(); };
    $$('.filter-btn').forEach(b => b.onclick = () => { view.filter = b.dataset.filter; render(); });
    $$('.confirm-card, .sync-pet-card').forEach(el => el.onclick = (e) => {
      if(e.target.closest('button')) return;
      view = {name:'detail',index:Number(el.dataset.index),filter:view.filter,fromConfirm:false,transition:null};
      render();
    });
    $('#exportBtn').onclick = exportResults;
    if(starMode && selected.length) initSynchronizedStarAnimations();
  }

  function confirmCard(p){
    const s = pstate(p.id), sc = starCount(p);
    const bg = `background-image:url(&quot;${esc(sheetUrl(p))}&quot;);background-size:800% ${p.rows*100}%;`;
    return `<button class="confirm-card" data-index="${p.index}">
      <div class="thumb-wrap"><div class="thumb-sprite" style="${bg}"></div></div>
      <div class="confirm-meta">
        <div class="confirm-name">${esc(p.displayName)}</div>
        <div class="confirm-flags">${s.heart?'<span class="flag-heart">♥</span>':''}${sc?`<span class="flag-star">★ ${sc}</span>`:''}</div>
      </div>
    </button>`;
  }

  function syncPetCard(p){
    const s = pstate(p.id);
    const starred = p.actions.map((a,i) => ({a,i})).filter(x => !!s.stars[x.a.key]);
    return `<article class="sync-pet-card" data-index="${p.index}">
      <div class="sync-pet-head">
        <div class="sync-pet-name">${esc(p.displayName)}</div>
        <div class="sync-count">★ ${starred.length}</div>
      </div>
      <div class="sync-action-grid">
        ${starred.map(({a,i}) => `<div class="sync-action">
          <div class="sync-canvas-wrap"><canvas width="192" height="208" data-sync-pet="${p.index}" data-sync-action="${i}"></canvas></div>
          <div class="sync-label">${esc(a.label)}</div>
        </div>`).join('')}
      </div>
    </article>`;
  }

  function initSynchronizedStarAnimations(){
    const canvases = [...document.querySelectorAll('canvas[data-sync-pet]')];
    const visible = new Set();
    const images = new Map();
    const loading = new Map();
    let stopped = false, raf = 0;
    const start = performance.now();

    const ensureImage = (petIndex) => {
      if(images.has(petIndex)) return Promise.resolve(images.get(petIndex));
      if(loading.has(petIndex)) return loading.get(petIndex);
      const p = pets[petIndex];
      const promise = new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => { images.set(petIndex, img); loading.delete(petIndex); resolve(img); };
        img.onerror = () => { loading.delete(petIndex); reject(new Error('image')); };
        img.src = sheetUrl(p);
      });
      loading.set(petIndex, promise);
      return promise;
    };

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const canvas = entry.target;
        if(entry.isIntersecting){
          visible.add(canvas);
          ensureImage(Number(canvas.dataset.syncPet)).catch(() => canvas.closest('.sync-canvas-wrap')?.classList.add('load-error'));
        }else{
          visible.delete(canvas);
        }
      });
    }, {rootMargin:'180px 0px'});
    canvases.forEach(c => observer.observe(c));

    const tick = (t) => {
      if(stopped) return;
      const phase = ((t - start) % SYNC_PERIOD_MS) / SYNC_PERIOD_MS;
      visible.forEach(canvas => {
        const pi = Number(canvas.dataset.syncPet), ai = Number(canvas.dataset.syncAction);
        const img = images.get(pi);
        const a = pets[pi]?.actions[ai];
        if(!img || !a) return;
        const frames = a.frames?.length ? a.frames : [0];
        const fi = Math.min(frames.length - 1, Math.floor(phase * frames.length));
        drawFrame(canvas, img, ai, frames[fi]);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    animator = {stop(){ stopped = true; cancelAnimationFrame(raf); observer.disconnect(); visible.clear(); images.clear(); loading.clear(); }};
  }

  function renderDetail(){
    const pet = pets[view.index], s = pstate(pet.id), sc = starCount(pet);
    app.innerHTML = `<section class="review-screen detail-screen">
      <header class="review-toolbar">
        <button class="round-icon back-icon" id="backBtn" aria-label="かくにんへ戻る">${backIcon()}</button>
        <div class="review-title">${esc(pet.displayName)}</div>
        <div class="toolbar-spacer"></div>
      </header>
      <div class="detail-status"><span class="${s.heart?'heart-on':''}">${s.heart?'♥':'♡'}</span><span class="${sc?'star-on':''}">★ ${sc}</span></div>
      <div class="action-grid detail-grid">${pet.actions.map((a,i) => actionCard(pet,a,i,!!s.stars[a.key],false)).join('')}</div>
      <div class="memo-box"><textarea id="memo" placeholder="メモ">${esc(s.memo || '')}</textarea></div>
      <button class="rejudge-btn" id="rejudgeBtn">再判定</button>
    </section>`;

    initAnimations(pet);
    $('#memo').addEventListener('input', e => { s.memo = e.target.value; save(); });
    $('#backBtn').onclick = () => { view = {name:'confirm',index:0,filter:view.filter || 'all',fromConfirm:false,transition:null}; render(); };
    $('#rejudgeBtn').onclick = () => { view = {name:'judge',index:pet.index,filter:view.filter || 'all',fromConfirm:true,transition:null}; render(); };
  }

  function renderComplete(){
    app.innerHTML = `<section class="cover-screen">
      <div class="cover-book complete-book">
        <div class="cover-kicker">PET CATALOG</div>
        <div class="complete-number">55 / 55</div>
        <div class="complete-copy">すべて確認しました</div>
        <div class="cover-actions">
          <button class="cover-btn primary" id="confirmBtn">かくにん</button>
          <button class="cover-btn" id="homeBtn">ホーム</button>
        </div>
      </div>
    </section>`;
    $('#confirmBtn').onclick = () => { view = {name:'confirm',index:0,filter:'all',fromConfirm:false,transition:null}; render(); };
    $('#homeBtn').onclick = () => { view = {name:'home',index:0,filter:'all',fromConfirm:false,transition:null}; render(); };
  }

  function exportResults(){
    const out = {
      schema:'codex-pet-selector-result-v2',
      exportedAt:new Date().toISOString(),
      total:pets.length,
      reviewed:reviewedCount(),
      selected:pets.filter(isSelected).map(p => {
        const s = pstate(p.id);
        return {
          id:p.id,
          displayName:p.displayName,
          sourceZip:p.sourceZip,
          characterStructure:!!s.heart,
          actions:p.actions.filter(a => !!s.stars[a.key]).map(a => a.key),
          memo:s.memo || ''
        };
      })
    };
    const blob = new Blob([JSON.stringify(out,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url;
    a.download = 'codex_pet_selection.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function $(q){ return document.querySelector(q); }
  function $$(q){ return [...document.querySelectorAll(q)]; }

  render();
})();
