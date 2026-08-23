(() => {
  'use strict';

  const pets = window.PETS_DATA || [];
  const app = document.getElementById('app');
  const STORAGE_KEY = 'codexPetSelector.v1';
  const SYNC_PERIOD_MS = 1800;
  const state = loadState();

  let view = {name:'home', index:0, filter:'all', fromConfirm:false};
  let animator = null;
  let viewCleanup = null;
  let confirmSnapshot = null;
  const imageCache = new Map();
  const IMAGE_CACHE_LIMIT = 5;

  function defaultPetState(){ return {reviewed:false, heart:false, stars:{}, memo:''}; }
  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return {pets:{}, lastIndex:0};
      const parsed = JSON.parse(raw);
      if(!parsed || typeof parsed !== 'object') return {pets:{}, lastIndex:0};
      parsed.pets ||= {};
      parsed.lastIndex = Number.isInteger(parsed.lastIndex) ? parsed.lastIndex : 0;
      return parsed;
    }catch(_){ return {pets:{}, lastIndex:0}; }
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
    return i < 0 ? Math.max(0, Math.min(pets.length - 1, state.lastIndex || 0)) : i;
  }
  function catalogNo(index){ return String(index + 1).padStart(2,'0'); }
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
  }
  function cleanupView(){
    stopAnimator();
    if(viewCleanup){ viewCleanup(); viewCleanup = null; }
  }

  function captureConfirmSnapshot(){
    const snapshot = {all:new Set(), hearts:new Set(), stars:new Map()};
    pets.forEach((p,i) => {
      const s = pstate(p.id);
      const keys = p.actions.filter(a => !!s.stars[a.key]).map(a => a.key);
      if(s.heart || keys.length) snapshot.all.add(i);
      if(s.heart) snapshot.hearts.add(i);
      if(keys.length) snapshot.stars.set(i, new Set(keys));
    });
    confirmSnapshot = snapshot;
    return snapshot;
  }
  function ensureConfirmSnapshot(){ return confirmSnapshot || captureConfirmSnapshot(); }
  function rememberHeart(index){
    if(!confirmSnapshot) return;
    confirmSnapshot.all.add(index);
    confirmSnapshot.hearts.add(index);
  }
  function rememberStar(index,key){
    if(!confirmSnapshot) return;
    confirmSnapshot.all.add(index);
    if(!confirmSnapshot.stars.has(index)) confirmSnapshot.stars.set(index,new Set());
    confirmSnapshot.stars.get(index).add(key);
  }
  function snapshotStarKeys(index){
    const snap = ensureConfirmSnapshot();
    return snap.stars.get(index) || new Set();
  }
  function openConfirm(filter='all'){
    captureConfirmSnapshot();
    view = {name:'confirm',index:0,filter,fromConfirm:false};
    render();
  }

  function render(){
    cleanupView();
    if(view.name === 'home') renderHome();
    else if(view.name === 'catalog') renderCatalog();
    else if(view.name === 'confirm') renderConfirm();
    else if(view.name === 'detail') renderDetail();
    else if(view.name === 'complete') renderComplete();
  }

  function renderHome(){
    confirmSnapshot = null;
    window.scrollTo(0,0);
    const rc = reviewedCount();
    const canContinue = rc > 0 || state.lastIndex > 0;
    const canConfirm = selectedCount() > 0;
    app.innerHTML = `<section class="cover-screen">
      <div class="cover-book">
        <div class="cover-kicker">GIF Asset</div>
        <div class="cover-image-slot" aria-label="イラスト配置予定スペース"><span>No Image</span></div>
        <div class="cover-rule"></div>
        <div class="cover-actions">
          <button class="cover-btn primary" id="startBtn">はじめから</button>
          <div class="continue-wrap">
            <button class="cover-btn" id="continueBtn" ${canContinue?'':'disabled'}>つづきから</button>
            <span class="continue-progress">${rc} / ${pets.length}</span>
          </div>
          <button class="cover-btn" id="confirmBtn" ${canConfirm?'':'disabled'}>かくにん</button>
        </div>
      </div>
    </section>`;

    $('#startBtn').onclick = () => { view = {name:'catalog',index:0,filter:'all',fromConfirm:false}; render(); };
    $('#continueBtn').onclick = () => { view = {name:'catalog',index:firstUnreviewed(),filter:'all',fromConfirm:false}; render(); };
    $('#confirmBtn').onclick = () => openConfirm('all');
  }

  function renderCatalog(){
    const single = !!view.fromConfirm;
    const indexes = single ? [view.index] : pets.map((_,i) => i);
    app.innerHTML = `<section class="catalog-feed ${single?'single-catalog':''}" id="catalogFeed" aria-label="Petカタログ">
      ${indexes.map(i => catalogPage(pets[i], i, single)).join('')}
    </section>`;

    $$('.heart-toggle').forEach(btn => btn.onclick = () => {
      const pi = Number(btn.dataset.petIndex);
      const s = pstate(pets[pi].id);
      toggleHeart(btn, s, pi);
    });
    $$('.star-btn[data-action]').forEach(btn => btn.onclick = () => {
      const pi = Number(btn.dataset.petIndex);
      const s = pstate(pets[pi].id);
      toggleStar(btn, s, pi);
    });
    $$('.home-icon').forEach(btn => btn.onclick = () => {
      if(single){
        view = {name:'detail',index:view.index,filter:view.filter || 'all',fromConfirm:false};
      }else{
        view = {name:'home',index:0,filter:'all',fromConfirm:false};
      }
      render();
    });

    if(single){
      const page = $('.pet-page');
      startPetAnimation(view.index, page);
      state.lastIndex = view.index;
      save();
    }else{
      setupVerticalCatalog(view.index);
    }
  }

  function catalogPage(pet, index, single){
    const s = pstate(pet.id);
    const num = catalogNo(index);
    return `<article class="pet-page" data-index="${index}" aria-label="${num}. ${esc(pet.displayName)}">
      <div class="page-number">${num} / ${pets.length}</div>
      <header class="pet-title-row">
        <button class="round-icon home-icon" data-pet-index="${index}" aria-label="${single?'かくにんへ戻る':'ホーム'}">${single?backIcon():homeIcon()}</button>
        <div class="pet-title-wrap">
          <div class="pet-title">${num}. ${esc(pet.displayName)}</div>
        </div>
        <button class="round-icon heart-toggle ${s.heart?'on':''}" data-pet-index="${index}" aria-label="キャラクター構造を採用" aria-pressed="${s.heart?'true':'false'}">${heartIcon(s.heart)}</button>
      </header>
      <div class="action-grid">
        ${pet.actions.map((a,i) => actionCard(pet,a,i,!!s.stars[a.key],true,index)).join('')}
      </div>
    </article>`;
  }

  function setupVerticalCatalog(startIndex){
    const feed = $('#catalogFeed');
    const pages = [...feed.querySelectorAll('.pet-page')];
    let activeIndex = -1;
    let scrollTimer = 0;
    let settleTimer = 0;
    let destroyed = false;

    const indexFromScroll = () => {
      const h = Math.max(1, feed.clientHeight);
      return Math.max(0, Math.min(pets.length - 1, Math.round(feed.scrollTop / h)));
    };

    const activate = (index, initial=false) => {
      if(destroyed || index < 0 || index >= pets.length) return;
      if(index === activeIndex && animator) return;

      if(activeIndex >= 0 && activeIndex !== index){
        pstate(pets[activeIndex].id).reviewed = true;
      }
      activeIndex = index;
      state.lastIndex = index;
      if(index === pets.length - 1){
        pstate(pets[index].id).reviewed = true;
      }
      save();

      pages.forEach((p,i) => p.classList.toggle('active-page', i === index));
      stopAnimator();
      startPetAnimation(index, pages[index]);
      preloadNeighbors(index);

      if(!initial && index === pets.length - 1){
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
          pstate(pets[index].id).reviewed = true;
          save();
        }, 700);
      }
    };

    const onScroll = () => {
      stopAnimator();
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => activate(indexFromScroll()), 85);
    };

    feed.addEventListener('scroll', onScroll, {passive:true});
    if('onscrollend' in window){
      feed.addEventListener('scrollend', () => activate(indexFromScroll()), {passive:true});
    }

    requestAnimationFrame(() => {
      const target = Math.max(0, Math.min(pets.length - 1, startIndex || 0));
      feed.scrollTop = target * feed.clientHeight;
      activate(target, true);
    });

    viewCleanup = () => {
      destroyed = true;
      clearTimeout(scrollTimer);
      clearTimeout(settleTimer);
      feed.removeEventListener('scroll', onScroll);
      if(activeIndex >= 0){ state.lastIndex = activeIndex; save(); }
    };
  }

  function actionCard(pet, a, actionIndex, on, interactive, petIndex){
    return `<div class="action-card">
      <div class="anim-wrap"><canvas width="192" height="208" data-pet-index="${petIndex}" data-action-index="${actionIndex}"></canvas></div>
      ${interactive
        ? `<button class="star-btn ${on?'on':''}" data-pet-index="${petIndex}" data-action="${esc(a.key)}" aria-label="${esc(a.label)}の動きを採用" aria-pressed="${on?'true':'false'}">${on?'★':'☆'}</button>`
        : `<div class="star-btn ${on?'on':''}" aria-hidden="true">${on?'★':'☆'}</div>`}
      <div class="action-label">${esc(a.label)}</div>
    </div>`;
  }

  function toggleStar(btn, s, petIndex){
    const key = btn.dataset.action;
    s.stars[key] = !s.stars[key];
    if(s.stars[key]) rememberStar(petIndex,key);
    save();
    if(btn.classList.contains('review-star-toggle')) refreshMirroredStarButtons(petIndex,key,!!s.stars[key]);
    else updateStarButton(btn, !!s.stars[key]);
  }
  function updateStarButton(btn,on){
    btn.classList.toggle('on', on);
    btn.textContent = on ? '★' : '☆';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.classList.remove('star-pop');
    void btn.offsetWidth;
    btn.classList.add('star-pop');
    setTimeout(() => btn.classList.remove('star-pop'), 250);
  }

  function toggleHeart(btn, s, petIndex){
    s.heart = !s.heart;
    if(s.heart) rememberHeart(petIndex);
    save();
    updateHeartButton(btn,s.heart);
  }
  function updateHeartButton(btn,on){
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.innerHTML = heartIcon(on);
    btn.classList.remove('heart-pop-on','heart-pop-off');
    void btn.offsetWidth;
    btn.classList.add(on ? 'heart-pop-on' : 'heart-pop-off');
    setTimeout(() => btn.classList.remove('heart-pop-on','heart-pop-off'), 400);
  }

  function cacheImage(index, img){
    if(imageCache.has(index)) imageCache.delete(index);
    imageCache.set(index, img);
    while(imageCache.size > IMAGE_CACHE_LIMIT){
      const first = imageCache.keys().next().value;
      imageCache.delete(first);
    }
  }

  function loadPetImage(index){
    const cached = imageCache.get(index);
    if(cached){
      imageCache.delete(index);
      imageCache.set(index, cached);
      return Promise.resolve(cached);
    }
    const pet = pets[index];
    return new Promise((resolve,reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { cacheImage(index,img); resolve(img); };
      img.onerror = reject;
      img.src = sheetUrl(pet);
    });
  }

  function preloadNeighbors(index){
    [index-1,index+1].filter(i => i >= 0 && i < pets.length).forEach(i => {
      if(imageCache.has(i)) return;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => cacheImage(i,img);
      img.src = sheetUrl(pets[i]);
    });
  }

  function startPetAnimation(petIndex, scope){
    const pet = pets[petIndex];
    const canvases = [...scope.querySelectorAll('canvas[data-action-index]')];
    let stopped = false;
    let timer = 0;
    let start = performance.now();
    const lastFrames = new Array(canvases.length).fill(-1);

    loadPetImage(petIndex).then(img => {
      if(stopped) return;
      const tick = () => {
        if(stopped) return;
        const t = performance.now();
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
        timer = window.setTimeout(tick, 50);
      };
      tick();
    }).catch(() => canvases.forEach(c => c.closest('.anim-wrap')?.classList.add('load-error')));

    animator = {stop(){ stopped = true; clearTimeout(timer); }};
  }

  function drawFrame(canvas, img, row, col){
    const ctx = canvas.getContext('2d', {alpha:true});
    ctx.clearRect(0,0,192,208);
    ctx.drawImage(img, col*192, row*208, 192,208, 0,0,192,208);
  }

  function renderConfirm(){
    window.scrollTo(0,0);
    const snap = ensureConfirmSnapshot();
    let indices;
    if(view.filter === 'heart') indices = [...snap.hearts];
    else if(view.filter === 'star') indices = [...snap.stars.keys()];
    else indices = [...snap.all];
    indices.sort((a,b) => a-b);
    const selected = indices.map(i => pets[i]).filter(Boolean);
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

    $('#homeBtn').onclick = () => {
      confirmSnapshot = null;
      view = {name:'home',index:0,filter:'all',fromConfirm:false};
      render();
    };
    $$('.filter-btn').forEach(b => b.onclick = () => { view.filter = b.dataset.filter; render(); });
    $$('.confirm-open').forEach(el => el.onclick = () => {
      view = {name:'detail',index:Number(el.dataset.index),filter:view.filter,fromConfirm:false};
      render();
    });
    $$('.sync-pet-card').forEach(el => el.onclick = (e) => {
      if(e.target.closest('button')) return;
      view = {name:'detail',index:Number(el.dataset.index),filter:view.filter,fromConfirm:false};
      render();
    });
    $$('.review-heart-toggle').forEach(btn => btn.onclick = (e) => {
      e.stopPropagation();
      const pi = Number(btn.dataset.petIndex);
      toggleHeart(btn,pstate(pets[pi].id),pi);
    });
    $$('.review-star-toggle').forEach(btn => btn.onclick = (e) => {
      e.stopPropagation();
      const pi = Number(btn.dataset.petIndex);
      const s = pstate(pets[pi].id);
      toggleStar(btn,s,pi);
    });
    $('#exportBtn').onclick = exportResults;
    if(starMode && selected.length) initSynchronizedStarAnimations();
  }

  function confirmCard(p){
    const s = pstate(p.id), num = catalogNo(p.index);
    const snapKeys = snapshotStarKeys(p.index);
    const orderedKeys = p.actions.filter(a => snapKeys.has(a.key));
    return `<article class="confirm-card" data-index="${p.index}">
      <button class="confirm-open" data-index="${p.index}" aria-label="${num}. ${esc(p.displayName)}を開く">
        <div class="thumb-wrap"><img class="thumb-sheet" loading="lazy" decoding="async" src="${esc(sheetUrl(p))}" alt=""></div>
        <div class="confirm-meta">
          <div class="confirm-name">${num}. ${esc(p.displayName)}</div>
        </div>
      </button>
      <div class="confirm-selectors">
        <button class="review-heart-toggle ${s.heart?'on':''}" data-pet-index="${p.index}" aria-label="キャラクター構造を採用" aria-pressed="${s.heart?'true':'false'}">${heartIcon(s.heart)}</button>
        <div class="review-star-chips">
          ${orderedKeys.map(a => `<button class="review-star-toggle ${s.stars[a.key]?'on':''}" data-pet-index="${p.index}" data-action="${esc(a.key)}" aria-pressed="${s.stars[a.key]?'true':'false'}"><span>${s.stars[a.key]?'★':'☆'}</span>${esc(a.label)}</button>`).join('')}
        </div>
      </div>
    </article>`;
  }

  function syncPetCard(p){
    const s = pstate(p.id), num = catalogNo(p.index);
    const snapKeys = snapshotStarKeys(p.index);
    const starred = p.actions.map((a,i) => ({a,i})).filter(x => snapKeys.has(x.a.key));
    return `<article class="sync-pet-card" data-index="${p.index}">
      <div class="sync-pet-head">
        <div class="sync-pet-name">${num}. ${esc(p.displayName)}</div>
        <button class="review-heart-toggle sync-heart ${s.heart?'on':''}" data-pet-index="${p.index}" aria-label="キャラクター構造を採用" aria-pressed="${s.heart?'true':'false'}">${heartIcon(s.heart)}</button>
      </div>
      <div class="sync-action-grid">
        ${starred.map(({a,i}) => `<div class="sync-action">
          <div class="sync-canvas-wrap"><canvas width="192" height="208" data-sync-pet="${p.index}" data-sync-action="${i}"></canvas></div>
          <button class="review-star-toggle sync-star-toggle ${s.stars[a.key]?'on':''}" data-pet-index="${p.index}" data-action="${esc(a.key)}" aria-pressed="${s.stars[a.key]?'true':'false'}">${s.stars[a.key]?'★':'☆'}</button>
          <div class="sync-label">${esc(a.label)}</div>
        </div>`).join('')}
      </div>
    </article>`;
  }

  function refreshMirroredStarButtons(petIndex,key,on){
    $$('.review-star-toggle').filter(btn =>
      Number(btn.dataset.petIndex) === petIndex && btn.dataset.action === key
    ).forEach(btn => {
      btn.classList.toggle('on',on);
      if(btn.classList.contains('sync-star-toggle')) btn.textContent = on ? '★' : '☆';
      else {
        const span = btn.querySelector('span');
        if(span) span.textContent = on ? '★' : '☆';
      }
      btn.setAttribute('aria-pressed',on?'true':'false');
      btn.classList.remove('star-pop');
      void btn.offsetWidth;
      btn.classList.add('star-pop');
      setTimeout(() => btn.classList.remove('star-pop'),250);
    });
  }

  function initSynchronizedStarAnimations(){
    const canvases = [...document.querySelectorAll('canvas[data-sync-pet]')];
    const visible = new Set();
    const images = new Map();
    let stopped = false, timer = 0;
    const start = performance.now();

    const ensureImage = async (petIndex) => {
      if(images.has(petIndex)) return images.get(petIndex);
      const img = await loadPetImage(petIndex);
      images.set(petIndex,img);
      return img;
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
    }, {rootMargin:'80px 0px'});
    canvases.forEach(c => observer.observe(c));

    const tick = () => {
      if(stopped) return;
      const t = performance.now();
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
      timer = window.setTimeout(tick, 50);
    };
    tick();

    animator = {stop(){ stopped = true; clearTimeout(timer); observer.disconnect(); visible.clear(); images.clear(); }};
  }

  function renderDetail(){
    window.scrollTo(0,0);
    const pet = pets[view.index], s = pstate(pet.id), sc = starCount(pet), num = catalogNo(pet.index);
    app.innerHTML = `<section class="review-screen detail-screen">
      <header class="review-toolbar">
        <button class="round-icon back-icon" id="backBtn" aria-label="かくにんへ戻る">${backIcon()}</button>
        <div class="review-title">${num}. ${esc(pet.displayName)}</div>
        <div class="toolbar-spacer"></div>
      </header>
      <div class="detail-status"><span class="${s.heart?'heart-on':''}">${s.heart?'♥':'♡'}</span><span class="${sc?'star-on':''}">★ ${sc}</span></div>
      <div class="action-grid detail-grid">${pet.actions.map((a,i) => actionCard(pet,a,i,!!s.stars[a.key],false,pet.index)).join('')}</div>
      <div class="memo-box"><textarea id="memo" placeholder="メモ">${esc(s.memo || '')}</textarea></div>
      <button class="rejudge-btn" id="rejudgeBtn">再判定</button>
    </section>`;

    startPetAnimation(pet.index, $('.detail-grid'));
    $('#memo').addEventListener('input', e => { s.memo = e.target.value; save(); });
    $('#backBtn').onclick = () => { view = {name:'confirm',index:0,filter:view.filter || 'all',fromConfirm:false}; render(); };
    $('#rejudgeBtn').onclick = () => { view = {name:'catalog',index:pet.index,filter:view.filter || 'all',fromConfirm:true}; render(); };
  }

  function renderComplete(){
    window.scrollTo(0,0);
    app.innerHTML = `<section class="cover-screen">
      <div class="cover-book complete-book">
        <div class="cover-kicker">GIF Asset</div>
        <div class="complete-number">55 / 55</div>
        <div class="complete-copy">すべて確認しました</div>
        <div class="cover-actions">
          <button class="cover-btn primary" id="confirmBtn">かくにん</button>
          <button class="cover-btn" id="homeBtn">ホーム</button>
        </div>
      </div>
    </section>`;
    $('#confirmBtn').onclick = () => openConfirm('all');
    $('#homeBtn').onclick = () => { view = {name:'home',index:0,filter:'all',fromConfirm:false}; render(); };
  }

  function exportResults(){
    const out = {
      schema:'codex-pet-selector-result-v3',
      exportedAt:new Date().toISOString(),
      total:pets.length,
      reviewed:reviewedCount(),
      selected:pets.filter(isSelected).map(p => {
        const s = pstate(p.id);
        return {
          catalogNo:p.index + 1,
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
