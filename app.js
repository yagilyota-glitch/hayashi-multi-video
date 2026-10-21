/**
 * Multi-Video Canvas (hayashi)
 * 複数のムービーを1つのウィンドウ内に並列配置し、
 * それぞれ自由な移動・拡大・縮小・回転とループ再生を行うアプリケーション
 */

// あらかじめ準備している初期ムービーファイル一覧（サーバー上の ./videos/ 配下を参照）
const PRESET_VIDEOS = [
  { id: 'movie-1', title: 'Movie 01', src: './videos/movie1.mp4' },
  { id: 'movie-2', title: 'Movie 02', src: './videos/movie2.mp4' },
  { id: 'movie-3', title: 'Movie 03', src: './videos/movie3.mp4' },
  { id: 'movie-4', title: 'Movie 04', src: './videos/movie4.mp4' },
];

const BG_THEMES = ['bg-dark', 'bg-black', 'bg-gray', 'bg-light'];

const stage = document.getElementById('stage');
const inspector = document.getElementById('inspector');
const inspTitle = document.getElementById('insp-title');
const inspScale = document.getElementById('insp-scale');
const inspScaleVal = document.getElementById('insp-scale-val');
const inspRotate = document.getElementById('insp-rotate');
const inspRotateVal = document.getElementById('insp-rotate-val');
const btnMuteSelected = document.getElementById('btn-mute-selected');

let items = [];
let selectedId = null;
let topZIndex = 10;
let isPlayingAll = true;
let currentBgIndex = 0;

/**
 * 角度を -180° 〜 180° に正規化
 */
function normalizeAngle(deg) {
  let a = ((deg + 180) % 360);
  if (a < 0) a += 360;
  return Math.round(a - 180);
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * ウィンドウサイズに応じた基準ムービー幅を算出
 */
function getBaseWidth() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return Math.round(clamp(Math.min(vw * 0.36, vh * 0.44), 200, 480));
}

/**
 * 初期の4つのムービーを生成して配置
 */
function initPresetVideos() {
  const baseW = getBaseWidth();
  PRESET_VIDEOS.forEach((preset, idx) => {
    createVideoItem({
      id: preset.id,
      title: preset.title,
      src: preset.src,
      baseWidth: baseW,
      cx: window.innerWidth / 2,
      cy: window.innerHeight / 2,
      scale: 1,
      rotation: 0,
    }, idx);
  });
  arrangeGrid();
}

/**
 * ムービー要素をDOMおよび状態配列に追加
 */
function createVideoItem(config) {
  const id = config.id || `movie-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const el = document.createElement('div');
  el.className = 'video-item';
  el.dataset.id = id;

  el.innerHTML = `
    <div class="video-frame">
      <video
        src="${config.src}"
        autoplay
        loop
        muted
        playsinline
        webkit-playsinline
        preload="auto"
      ></video>
      <div class="video-badge"></div>
    </div>
    <div class="handles">
      <div class="rotate-stem"></div>
      <div class="handle-rotate" data-action="rotate" title="ドラッグして回転 (Shiftで15°刻み)">↻</div>
      <div class="handle-scale nw" data-action="scale" title="ドラッグして拡大・縮小"></div>
      <div class="handle-scale ne" data-action="scale" title="ドラッグして拡大・縮小"></div>
      <div class="handle-scale se" data-action="scale" title="ドラッグして拡大・縮小"></div>
      <div class="handle-scale sw" data-action="scale" title="ドラッグして拡大・縮小"></div>
    </div>
  `;

  stage.appendChild(el);

  const videoEl = el.querySelector('video');
  const badgeEl = el.querySelector('.video-badge');

  // 自動ループ再生の確実な開始
  videoEl.muted = true;
  videoEl.loop = true;
  const playPromise = videoEl.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {
      // ユーザー操作後に再試行
    });
  }

  const state = {
    id,
    title: config.title || `Movie ${items.length + 1}`,
    src: config.src,
    el,
    videoEl,
    badgeEl,
    cx: config.cx ?? window.innerWidth / 2,
    cy: config.cy ?? window.innerHeight / 2,
    baseWidth: config.baseWidth ?? getBaseWidth(),
    scale: config.scale ?? 1,
    rotation: config.rotation ?? 0,
    zIndex: ++topZIndex,
  };

  items.push(state);
  bindItemInteractions(state);
  renderItem(state);
  return state;
}

/**
 * 状態に基づいてDOMの座標・サイズ・回転角・バッジ表示を更新
 */
function renderItem(item) {
  const width = item.baseWidth * item.scale;
  item.el.style.width = `${width}px`;
  item.el.style.zIndex = String(item.zIndex);
  item.el.style.transform = `translate3d(${item.cx}px, ${item.cy}px, 0) translate(-50%, -50%) rotate(${item.rotation}deg)`;

  const scalePct = Math.round(item.scale * 100);
  const rotDeg = normalizeAngle(item.rotation);
  item.badgeEl.textContent = `${item.title} | ${scalePct}% | ${rotDeg}°`;

  if (selectedId === item.id) {
    updateInspectorUI(item);
  }
}

/**
 * ムービーを選択状態にし、最前面へ移動
 */
function selectItem(id) {
  selectedId = id;
  items.forEach((item) => {
    if (item.id === id) {
      item.zIndex = ++topZIndex;
      item.el.classList.add('selected');
      renderItem(item);
      updateInspectorUI(item);
    } else {
      item.el.classList.remove('selected');
    }
  });

  if (id) {
    inspector.classList.remove('hidden');
  } else {
    inspector.classList.add('hidden');
  }
}

function updateInspectorUI(item) {
  inspTitle.textContent = item.title;
  const scalePct = clamp(Math.round(item.scale * 100), 25, 300);
  const rotDeg = normalizeAngle(item.rotation);
  inspScale.value = String(scalePct);
  inspScaleVal.textContent = `${ Math.round(item.scale * 100) }%`;
  inspRotate.value = String(rotDeg);
  inspRotateVal.textContent = `${rotDeg}°`;
  btnMuteSelected.textContent = item.videoEl.muted ? '🔇 消音中' : '🔊 音声ON';
}

/**
 * 各ムービーに対するポインタ操作（移動・拡縮・回転・ホイール・マルチタッチ）の設定
 */
function bindItemInteractions(item) {
  const el = item.el;
  const activePointers = new Map();
  let gestureState = null;

  el.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    selectItem(item.id);

    // 再生がブロックされていた場合のフォールバック再生
    if (isPlayingAll && item.videoEl.paused) {
      item.videoEl.play().catch(() => {});
    }

    el.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 1) {
      const action = e.target.dataset.action || 'move';
      const startDist = Math.max(20, Math.hypot(e.clientX - item.cx, e.clientY - item.cy));
      const startAngle = Math.atan2(e.clientY - item.cy, e.clientX - item.cx) * (180 / Math.PI);

      gestureState = {
        mode: action, // 'move' | 'scale' | 'rotate'
        startX: e.clientX,
        startY: e.clientY,
        startCx: item.cx,
        startCy: item.cy,
        startScale: item.scale,
        startRotation: item.rotation,
        startDist,
        startAngle,
      };
    } else if (activePointers.size === 2) {
      // 2本指ピンチ（拡大縮小）＆ツイスト（回転）＆2本指移動
      const pts = Array.from(activePointers.values());
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const dist = Math.max(20, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y));
      const angle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) * (180 / Math.PI);

      gestureState = {
        mode: 'multitouch',
        startMidX: midX,
        startMidY: midY,
        startCx: item.cx,
        startCy: item.cy,
        startScale: item.scale,
        startRotation: item.rotation,
        startDist: dist,
        startAngle: angle,
      };
    }
  });

  el.addEventListener('pointermove', (e) => {
    if (!activePointers.has(e.pointerId) || !gestureState) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (gestureState.mode === 'multitouch' && activePointers.size >= 2) {
      const pts = Array.from(activePointers.values());
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const dist = Math.max(20, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y));
      const angle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) * (180 / Math.PI);

      item.cx = gestureState.startCx + (midX - gestureState.startMidX);
      item.cy = gestureState.startCy + (midY - gestureState.startMidY);
      item.scale = clamp(gestureState.startScale * (dist / gestureState.startDist), 0.2, 4.0);
      item.rotation = normalizeAngle(gestureState.startRotation + (angle - gestureState.startAngle));
      renderItem(item);
      return;
    }

    if (gestureState.mode === 'move') {
      item.cx = gestureState.startCx + (e.clientX - gestureState.startX);
      item.cy = gestureState.startCy + (e.clientY - gestureState.startY);
      renderItem(item);
    } else if (gestureState.mode === 'scale') {
      const curDist = Math.max(10, Math.hypot(e.clientX - item.cx, e.clientY - item.cy));
      const ratio = curDist / gestureState.startDist;
      item.scale = clamp(gestureState.startScale * ratio, 0.2, 4.0);
      renderItem(item);
    } else if (gestureState.mode === 'rotate') {
      const curAngle = Math.atan2(e.clientY - item.cy, e.clientX - item.cx) * (180 / Math.PI);
      let nextRot = gestureState.startRotation + (curAngle - gestureState.startAngle);
      if (e.shiftKey) {
        nextRot = Math.round(nextRot / 15) * 15;
      }
      item.rotation = normalizeAngle(nextRot);
      renderItem(item);
    }
  });

  const endPointer = (e) => {
    activePointers.delete(e.pointerId);
    if (activePointers.size === 0) {
      gestureState = null;
    }
  };
  el.addEventListener('pointerup', endPointer);
  el.addEventListener('pointercancel', endPointer);

  // マウスホイール / トラックパッドによる直感的な拡大縮小・回転
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    e.stopPropagation();
    selectItem(item.id);

    if (e.shiftKey || e.altKey) {
      // Shift または Option(Alt) + ホイールで回転
      const deltaRot = (e.deltaY || e.deltaX) * 0.25;
      item.rotation = normalizeAngle(item.rotation + deltaRot);
    } else {
      // 通常ホイールまたはピンチで拡大縮小
      const zoomFactor = Math.exp(-e.deltaY * 0.0025);
      item.scale = clamp(item.scale * zoomFactor, 0.2, 4.0);
    }
    renderItem(item);
  }, { passive: false });

  // ダブルクリックで角度と拡大率をリセット
  el.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    item.scale = 1;
    item.rotation = 0;
    renderItem(item);
  });
}

/**
 * グリッド状に綺麗へ整列（初期配置・リセット用）
 */
function arrangeGrid() {
  const count = items.length;
  if (count === 0) return;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const topOffset = 68;
  const availW = vw - 48;
  const availH = vh - topOffset - 48;

  const cols = count <= 1 ? 1 : count <= 4 ? 2 : Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);

  const cellW = availW / cols;
  const cellH = availH / rows;
  const baseW = clamp(Math.min(cellW * 0.78, cellH * 1.25), 180, 460);

  items.forEach((item, index) => {
    const c = index % cols;
    const r = Math.floor(index / cols);
    item.baseWidth = baseW;
    item.cx = Math.round(24 + cellW * (c + 0.5));
    item.cy = Math.round(topOffset + cellH * (r + 0.5));
    item.scale = 1;
    item.rotation = 0;
    renderItem(item);
  });
}

/**
 * ランダムな位置・角度・スケールで配置
 */
function arrangeScatter() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const padX = Math.min(200, vw * 0.2);
  const padY = Math.min(160, vh * 0.22);

  items.forEach((item) => {
    item.cx = Math.round(padX + Math.random() * (vw - padX * 2));
    item.cy = Math.round(padY + 30 + Math.random() * (vh - padY * 2 - 30));
    item.scale = Number((0.75 + Math.random() * 0.55).toFixed(2));
    item.rotation = Math.round((Math.random() - 0.5) * 44);
    item.zIndex = ++topZIndex;
    renderItem(item);
  });
}

/**
 * ステージの空白領域クリックで選択解除
 */
stage.addEventListener('pointerdown', (e) => {
  if (e.target === stage) {
    selectItem(null);
  }
});

/**
 * ツールバーおよびインスペクタのイベント設定
 */
document.getElementById('btn-play-all').addEventListener('click', () => {
  isPlayingAll = !isPlayingAll;
  const label = document.getElementById('icon-play-all');
  items.forEach((item) => {
    if (isPlayingAll) {
      item.videoEl.play().catch(() => {});
    } else {
      item.videoEl.pause();
    }
  });
  label.textContent = isPlayingAll ? '⏸ 一時停止' : '▶ すべて再生';
});

document.getElementById('btn-sync').addEventListener('click', () => {
  items.forEach((item) => {
    item.videoEl.currentTime = 0;
    if (isPlayingAll) {
      item.videoEl.play().catch(() => {});
    }
  });
});

document.getElementById('btn-layout-grid').addEventListener('click', () => {
  arrangeGrid();
});

document.getElementById('btn-layout-scatter').addEventListener('click', () => {
  arrangeScatter();
});

document.getElementById('btn-bg').addEventListener('click', () => {
  document.body.classList.remove(BG_THEMES[currentBgIndex]);
  currentBgIndex = (currentBgIndex + 1) % BG_THEMES.length;
  document.body.classList.add(BG_THEMES[currentBgIndex]);
});

function toggleCleanMode(forceState) {
  const next = typeof forceState === 'boolean'
    ? forceState
    : !document.body.classList.contains('clean-mode');
  document.body.classList.toggle('clean-mode', next);
}

document.getElementById('btn-clean').addEventListener('click', () => toggleCleanMode(true));
document.getElementById('btn-restore-ui').addEventListener('click', () => toggleCleanMode(false));

// インスペクタのスライダー操作
inspScale.addEventListener('input', () => {
  const item = items.find((i) => i.id === selectedId);
  if (!item) return;
  item.scale = Number(inspScale.value) / 100;
  renderItem(item);
});

inspRotate.addEventListener('input', () => {
  const item = items.find((i) => i.id === selectedId);
  if (!item) return;
  item.rotation = Number(inspRotate.value);
  renderItem(item);
});

document.getElementById('btn-reset-scale').addEventListener('click', () => {
  const item = items.find((i) => i.id === selectedId);
  if (!item) return;
  item.scale = 1;
  renderItem(item);
});

document.getElementById('btn-reset-rotate').addEventListener('click', () => {
  const item = items.find((i) => i.id === selectedId);
  if (!item) return;
  item.rotation = 0;
  renderItem(item);
});

btnMuteSelected.addEventListener('click', () => {
  const item = items.find((i) => i.id === selectedId);
  if (!item) return;
  item.videoEl.muted = !item.videoEl.muted;
  updateInspectorUI(item);
});

document.getElementById('btn-delete-selected').addEventListener('click', () => {
  if (!selectedId) return;
  removeSelectedItem();
});

function removeSelectedItem() {
  const idx = items.findIndex((i) => i.id === selectedId);
  if (idx === -1) return;
  const [removed] = items.splice(idx, 1);
  removed.videoEl.pause();
  removed.el.remove();
  selectItem(null);
}

/**
 * ローカル動画の追加・差し替えおよびドラッグ＆ドロップ対応
 */
function addFilesToStage(fileList) {
  const files = Array.from(fileList).filter((f) => f.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(f.name));
  files.forEach((file, i) => {
    const url = URL.createObjectURL(file);
    const cleanName = file.name.replace(/\.[^.]+$/, '');
    const newItem = createVideoItem({
      title: cleanName,
      src: url,
      cx: Math.round(window.innerWidth * (0.35 + Math.random() * 0.3)),
      cy: Math.round(window.innerHeight * (0.35 + Math.random() * 0.3)),
      scale: 1,
      rotation: Math.round((Math.random() - 0.5) * 16),
    });
    if (i === files.length - 1) {
      selectItem(newItem.id);
    }
  });
}

document.getElementById('input-add-video').addEventListener('change', (e) => {
  if (e.target.files?.length) {
    addFilesToStage(e.target.files);
    e.target.value = '';
  }
});

document.getElementById('input-replace-video').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  const item = items.find((i) => i.id === selectedId);
  if (file && item) {
    const url = URL.createObjectURL(file);
    item.src = url;
    item.title = file.name.replace(/\.[^.]+$/, '');
    item.videoEl.src = url;
    item.videoEl.loop = true;
    item.videoEl.play().catch(() => {});
    renderItem(item);
  }
  e.target.value = '';
});

// ウィンドウ全体へのファイルドラッグ＆ドロップ
const dropOverlay = document.getElementById('drop-overlay');
let dragDepth = 0;

window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragDepth++;
  dropOverlay.classList.remove('hidden');
});

window.addEventListener('dragover', (e) => {
  e.preventDefault();
});

window.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) {
    dropOverlay.classList.add('hidden');
  }
});

window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  dropOverlay.classList.add('hidden');
  if (e.dataTransfer?.files?.length) {
    addFilesToStage(e.dataTransfer.files);
  }
});

// キーボードショートカット
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'h' || e.key === 'H') {
    toggleCleanMode();
  } else if (e.key === 'Escape') {
    if (document.body.classList.contains('clean-mode')) {
      toggleCleanMode(false);
    } else {
      selectItem(null);
    }
  } else if (e.key === ' ') {
    e.preventDefault();
    document.getElementById('btn-play-all').click();
  } else if ((e.key === 'Backspace' || e.key === 'Delete') && selectedId) {
    removeSelectedItem();
  }
});

// 初期化実行
initPresetVideos();
