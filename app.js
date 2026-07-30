/* ============================================================
   BEAM — アプリ本体
   ============================================================ */
(function () {
  'use strict';

  var VERSION = 'v1.0';
  var LS_KEY = 'beam.custom.v1';
  var LS_HINT = 'beam.hint.dismissed.v1';

  /* ---------- 要素 ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var listEl = $('list');
  var beamer = $('beamer');
  var sheetWrap = $('sheet');
  var toastEl = $('toast');
  var toastTimer = null;

  var state = { current: null, editingId: null, wakeLock: null };

  /* ============================================================
     データ
     ============================================================ */

  function loadCustom() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter(function (s) { return s && s.url; }) : [];
    } catch (e) { return []; }
  }

  function saveCustom(arr) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); return true; }
    catch (e) { toast('保存できませんでした'); return false; }
  }

  // 基本セット（sets.js）＋ 自分で追加したセット（この端末の中）
  function allSets() {
    var base = (window.BEAM_SETS || []).map(function (s, i) {
      return { id: 'base-' + i, name: s.name || s.url, url: s.url, note: s.note || '', custom: false };
    });
    var mine = loadCustom().map(function (s) {
      return { id: s.id, name: s.name || s.url, url: s.url, note: s.note || '', custom: true };
    });
    return base.concat(mine);
  }

  function findSet(id) {
    var all = allSets();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  /* ============================================================
     URL の整形とチェック
     ============================================================ */

  function normalizeUrl(input) {
    var v = String(input || '').trim();
    if (!v) return null;
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) v = 'https://' + v;   // https:// が無ければ足す
    try {
      var u = new URL(v);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      if (!u.hostname || u.hostname.indexOf('.') === -1) return null;
      return u.href;
    } catch (e) { return null; }
  }

  function prettyUrl(url) {
    try {
      var u = new URL(url);
      var s = u.host + u.pathname.replace(/\/$/, '') + u.search;
      return s;
    } catch (e) { return url; }
  }

  /* ============================================================
     一覧の描画
     ============================================================ */

  var ICON_GO = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_EDIT = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';

  function render() {
    var sets = allSets();
    listEl.innerHTML = '';

    if (!sets.length) {
      var empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'まだセットがありません。下の「＋ セットを追加」から作れます。';
      listEl.appendChild(empty);
      return;
    }

    sets.forEach(function (s, i) {
      var card = document.createElement('div');
      card.className = 'card';

      var main = document.createElement('button');
      main.type = 'button';
      main.className = 'card-main';
      main.setAttribute('aria-label', s.name + ' をかざして渡す');

      var idx = document.createElement('span');
      idx.className = 'card-idx';
      idx.textContent = ('0' + (i + 1)).slice(-2);

      var text = document.createElement('span');
      text.className = 'card-text';

      var name = document.createElement('span');
      name.className = 'card-name';
      name.textContent = s.name;
      text.appendChild(name);

      var note = document.createElement('span');
      note.className = 'card-note';
      note.textContent = s.note || prettyUrl(s.url);
      text.appendChild(note);

      if (s.custom) {
        var tag = document.createElement('span');
        tag.className = 'card-tag';
        tag.textContent = 'この端末に保存';
        text.appendChild(tag);
      }

      var go = document.createElement('span');
      go.className = 'card-go';
      go.innerHTML = ICON_GO;

      main.appendChild(idx);
      main.appendChild(text);
      main.appendChild(go);
      main.addEventListener('click', function () { openBeamer(s.id); });
      card.appendChild(main);

      if (s.custom) {
        var edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'card-edit';
        edit.innerHTML = ICON_EDIT;
        edit.setAttribute('aria-label', s.name + ' を編集');
        edit.addEventListener('click', function (ev) { ev.stopPropagation(); openSheet(s.id); });
        card.appendChild(edit);
      }

      listEl.appendChild(card);
    });
  }

  /* ============================================================
     QR 描画
     ============================================================ */

  function drawQR(canvas, text) {
    var qr = qrcode(0, 'M');            // 0 = 必要なサイズを自動判定 / M = 誤り訂正レベル
    qr.addData(text);
    qr.make();

    var count = qr.getModuleCount();
    var quiet = 4;                      // QRの周囲に必要な余白（規格上4モジュール）
    var total = count + quiet * 2;

    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var cssPx = canvas.getBoundingClientRect().width || 320;
    var scale = Math.max(3, Math.floor((cssPx * dpr) / total));
    var px = total * scale;

    canvas.width = px;
    canvas.height = px;

    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = '#000000';
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
      }
    }
  }

  /* ============================================================
     かざす画面
     ============================================================ */

  function openBeamer(id) {
    var s = findSet(id);
    if (!s) return;
    state.current = s;

    $('beamerName').textContent = s.name;
    $('beamerUrl').textContent = prettyUrl(s.url);

    beamer.hidden = false;
    document.body.classList.add('locked');

    // 表示後にレイアウトが確定してから描画する（サイズを正しく取るため）
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { drawQR($('qr'), s.url); });
    });

    acquireWakeLock();
  }

  function closeBeamer() {
    beamer.hidden = true;
    document.body.classList.remove('locked');
    state.current = null;
    releaseWakeLock();
  }

  /* ---------- 画面を暗くさせない（スキャン中に消灯すると困るため） ---------- */

  function acquireWakeLock() {
    if (!('wakeLock' in navigator)) return;
    navigator.wakeLock.request('screen').then(function (lock) {
      state.wakeLock = lock;
      lock.addEventListener('release', function () { state.wakeLock = null; });
    }).catch(function () { /* 端末が非対応でも動作に影響なし */ });
  }

  function releaseWakeLock() {
    if (state.wakeLock) { try { state.wakeLock.release(); } catch (e) {} state.wakeLock = null; }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && state.current) acquireWakeLock();
  });

  /* ---------- 共有（iOSならここから AirDrop も選べる） ---------- */

  function doShare() {
    var s = state.current;
    if (!s) return;

    if (navigator.share) {
      navigator.share({ title: s.name, url: s.url }).catch(function (err) {
        if (err && err.name === 'AbortError') return;         // 本人がキャンセルしただけ
        copyUrl(s.url);
      });
      return;
    }
    copyUrl(s.url);
  }

  function copyUrl(url) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(function () { toast('URLをコピーしました'); })
        .catch(function () { toast('コピーできませんでした'); });
    } else {
      toast('コピーできませんでした');
    }
  }

  /* ============================================================
     追加／編集シート
     ============================================================ */

  function openSheet(id) {
    state.editingId = id || null;
    var editing = id ? findSet(id) : null;

    $('sheetTitle').textContent = editing ? 'セットを編集' : 'セットを追加';
    $('fName').value = editing ? editing.name : '';
    $('fUrl').value = editing ? editing.url : '';
    $('fNote').value = editing ? editing.note : '';
    $('deleteBtn').hidden = !editing;
    hideError();

    sheetWrap.hidden = false;
    document.body.classList.add('locked');
    setTimeout(function () { $('fName').focus(); }, 60);
  }

  function closeSheet() {
    sheetWrap.hidden = true;
    if (beamer.hidden) document.body.classList.remove('locked');
    state.editingId = null;
  }

  function showError(msg) { var e = $('fError'); e.textContent = msg; e.hidden = false; }
  function hideError() { $('fError').hidden = true; }

  function submitSheet(ev) {
    ev.preventDefault();
    hideError();

    var url = normalizeUrl($('fUrl').value);
    if (!url) { showError('URLの形が正しくないようです。例：rockets-band.vercel.app'); $('fUrl').focus(); return; }

    var name = $('fName').value.trim() || prettyUrl(url);
    var note = $('fNote').value.trim();

    var mine = loadCustom();

    if (state.editingId) {
      for (var i = 0; i < mine.length; i++) {
        if (mine[i].id === state.editingId) { mine[i].name = name; mine[i].url = url; mine[i].note = note; break; }
      }
      if (saveCustom(mine)) { closeSheet(); render(); toast('更新しました'); }
    } else {
      mine.push({ id: 'my-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), name: name, url: url, note: note });
      if (saveCustom(mine)) { closeSheet(); render(); toast('追加しました'); }
    }
  }

  function deleteCurrent() {
    if (!state.editingId) return;
    var target = findSet(state.editingId);
    if (!confirm('「' + (target ? target.name : 'このセット') + '」を削除します。よろしいですか？')) return;

    var mine = loadCustom().filter(function (s) { return s.id !== state.editingId; });
    if (saveCustom(mine)) { closeSheet(); render(); toast('削除しました'); }
  }

  /* ============================================================
     トースト
     ============================================================ */

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 1900);
  }

  /* ============================================================
     ホーム画面に追加のヒント（iPhoneでインストール前だけ出す）
     ============================================================ */

  function maybeShowHint() {
    var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    var dismissed = false;
    try { dismissed = localStorage.getItem(LS_HINT) === '1'; } catch (e) {}
    if (standalone || dismissed) return;
    $('installHint').hidden = false;
  }

  /* ============================================================
     起動
     ============================================================ */

  $('beamerClose').addEventListener('click', closeBeamer);
  $('shareBtn').addEventListener('click', doShare);
  $('addBtn').addEventListener('click', function () { openSheet(null); });
  $('cancelBtn').addEventListener('click', closeSheet);
  $('deleteBtn').addEventListener('click', deleteCurrent);
  $('sheetBackdrop').addEventListener('click', closeSheet);
  $('sheetForm').addEventListener('submit', submitSheet);
  $('hintClose').addEventListener('click', function () {
    $('installHint').hidden = true;
    try { localStorage.setItem(LS_HINT, '1'); } catch (e) {}
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!sheetWrap.hidden) closeSheet();
    else if (!beamer.hidden) closeBeamer();
  });

  // 画面回転・リサイズでQRを描き直す
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    if (!state.current) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (state.current) drawQR($('qr'), state.current.url); }, 120);
  });

  $('verLabel').textContent = VERSION;
  render();
  maybeShowHint();

  // オフラインでも起動できるようにする
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
})();
