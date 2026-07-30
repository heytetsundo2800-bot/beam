/* ============================================================
   BEAM — アプリ本体
   ============================================================ */
(function () {
  'use strict';

  var VERSION = 'v1.1';
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
     環境の判定
     ============================================================ */

  var UA = navigator.userAgent || '';

  var env = {
    // LINEのアプリ内ブラウザ。UAの末尾に " Line/12.x.x" が付く
    line:       /\bLine\//i.test(UA),
    // その他のアプリ内ブラウザ（Instagram / Facebook / X など）
    otherInApp: /FBAN|FBAV|FB_IAB|Instagram|\bGSA\/|MicroMessenger/i.test(UA),
    ios:        /iPad|iPhone|iPod/.test(UA) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    android:    /Android/.test(UA),
    standalone: window.matchMedia('(display-mode: standalone)').matches ||
                window.navigator.standalone === true
  };
  env.inApp  = env.line || env.otherInApp;
  env.mobile = env.ios || env.android;
  // iOSで「ホーム画面に追加」ができるのは Safari だけ（Chrome等の別ブラウザでは出ない）
  env.iosSafari = env.ios && !env.inApp && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(UA);

  // Androidの「インストール」を1タップで出せるようにイベントを捕まえておく
  var deferredInstall = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstall = e;
    if (!$('setup').hidden) buildSetup();   // 表示中なら手順を1タップ版に差し替える
  });

  /* ---------- 共有用URL（LINEから外部ブラウザで開かせる） ---------- */

  function appUrl() {
    return location.origin + location.pathname.replace(/index\.html$/, '');
  }

  // LINEはこのパラメータが付いたURLを、アプリ内ではなく端末の標準ブラウザで開く
  function shareUrl() {
    var u = appUrl();
    return u + (u.indexOf('?') === -1 ? '?' : '&') + 'openExternalBrowser=1';
  }

  function shareApp() {
    var data = { title: 'BEAM — かざして、渡す。', url: shareUrl() };
    if (navigator.share) {
      navigator.share(data).catch(function (err) {
        if (err && err.name === 'AbortError') return;
        copyUrl(shareUrl());
      });
      return;
    }
    copyUrl(shareUrl());
  }

  /* ============================================================
     アイコン（手順の中に出す小さな絵）
     ============================================================ */

  var ICONS = {
    share: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 3v12M12 3l-3.5 3.5M12 3l3.5 3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 13v5.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    dots3v: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>',
    dots3h: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>',
    plusBox:'<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 8.5v7M8.5 12h7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>'
  };

  function ui(label, icon) {
    return '<span class="ui">' + (icon ? ICONS[icon] : '') + label + '</span>';
  }

  function renderSteps(el, items) {
    el.innerHTML = '';
    items.forEach(function (html) {
      var li = document.createElement('li');
      li.innerHTML = html;
      el.appendChild(li);
    });
  }

  /* ============================================================
     セットアップ案内（ホーム画面に追加）
     ============================================================ */

  function buildSetup() {
    var heading = $('setupHeading');
    var lead = $('setupLead');
    var primary = $('setupPrimary');
    var qrWrap = $('setupQrWrap');

    primary.hidden = true;
    qrWrap.hidden = true;
    lead.textContent = 'かざすだけで、相手のスマホにURLを渡せるアプリです。';

    /* --- PC --- */
    if (!env.mobile) {
      heading.textContent = 'BEAMはスマホで使うアプリです';
      lead.innerHTML = 'パソコンでも中身は確認できますが、<br>実際に渡すのはスマホからになります。';
      renderSteps($('steps'), [
        'スマホのカメラで、下のQRコードを読み取る',
        '開いたページの案内どおりに<b>ホーム画面に追加</b>する',
        'ホーム画面のアイコンから開けば準備完了'
      ]);
      qrWrap.hidden = false;
      requestAnimationFrame(function () { drawQR($('setupQr'), shareUrl()); });
      $('setupSkip').textContent = 'パソコンで中身を見る';
      return;
    }

    /* --- Android：1タップでインストールできる場合 --- */
    if (env.android && deferredInstall) {
      heading.textContent = 'ホーム画面に追加してください';
      renderSteps($('steps'), [
        '下の<b>「ホーム画面に追加」</b>ボタンを押す',
        '確認が出たら<b>「インストール」</b>を押す',
        'ホーム画面にBEAMのアイコンができれば完了'
      ]);
      primary.hidden = false;
      primary.textContent = 'ホーム画面に追加';
      primary.onclick = function () {
        deferredInstall.prompt();
        deferredInstall.userChoice.then(function (r) {
          deferredInstall = null;
          if (r && r.outcome === 'accepted') { closeSetup(); toast('追加しました'); }
          else buildSetup();
        });
      };
      return;
    }

    /* --- Android：手動 --- */
    if (env.android) {
      heading.textContent = 'ホーム画面に追加してください';
      renderSteps($('steps'), [
        '画面の<b>右上</b>にある' + ui('', 'dots3v') + 'を押す',
        'メニューの中の<b>「ホーム画面に追加」</b>（または「アプリをインストール」）を押す',
        '<b>「追加」</b>を押す → ホーム画面にBEAMのアイコンができます'
      ]);
      return;
    }

    /* --- iPhone：Safari以外で開いている --- */
    if (env.ios && !env.iosSafari) {
      heading.textContent = 'Safariで開き直してください';
      lead.innerHTML = 'iPhoneでホーム画面に追加できるのは<br><b>Safari</b>だけです。';
      renderSteps($('steps'), [
        '下の<b>「URLをコピーする」</b>を押す',
        '<b>Safari</b>を開いて、アドレス欄に貼り付けて開く',
        '出てくる案内どおりにホーム画面に追加する'
      ]);
      primary.hidden = false;
      primary.textContent = 'URLをコピーする';
      primary.onclick = function () { copyUrl(appUrl()); };
      return;
    }

    /* --- iPhone Safari（本命） --- */
    heading.textContent = 'ホーム画面に追加してください';
    renderSteps($('steps'), [
      '画面の<b>いちばん下</b>にある' + ui('共有', 'share') + 'ボタンを押す',
      'メニューを<b>下にスクロール</b>して' + ui('ホーム画面に追加', 'plusBox') + 'を押す',
      '<b>右上の「追加」</b>を押す → ホーム画面にBEAMのアイコンができます'
    ]);
  }

  function openSetup() {
    buildSetup();
    $('setup').hidden = false;
    document.body.classList.add('locked');
  }

  function closeSetup() {
    $('setup').hidden = true;
    document.body.classList.remove('locked');
    try { localStorage.setItem(LS_HINT, '1'); } catch (e) {}
    maybeShowHint();
  }

  /* ============================================================
     アプリ内ブラウザ（LINEなど）の案内
     ============================================================ */

  function buildInApp() {
    var name = env.line ? 'LINE' : 'アプリ';
    $('inappHeading').textContent = name + 'の中で開いています';

    if (env.ios) {
      renderSteps($('inappSteps'), [
        '画面の<b>右下</b>にある' + ui('', 'dots3h') + 'を押す',
        '<b>「他のアプリで開く」</b>または<b>「Safariで開く」</b>を押す',
        'Safariが開いたら、案内どおりにホーム画面に追加する'
      ]);
    } else {
      renderSteps($('inappSteps'), [
        '画面の<b>右上</b>にある' + ui('', 'dots3v') + 'を押す',
        '<b>「他のアプリで開く」</b>または<b>「ブラウザで開く」</b>を押す',
        'Chromeが開いたら、案内どおりにホーム画面に追加する'
      ]);
    }

    $('inappOpen').onclick = function () {
      // LINEはこのパラメータ付きURLを標準ブラウザで開く。
      // 効かない環境ではこのまま再読み込みされるだけなので、下の手動手順に誘導する。
      location.href = shareUrl();
      setTimeout(function () { toast('開かなければ、下の手順でお願いします'); }, 1600);
    };
    $('inappCopy').onclick = function () { copyUrl(appUrl()); };
  }

  function openInAppGuide() {
    buildInApp();
    $('inapp').hidden = false;
    document.body.classList.add('locked');
  }

  /* ============================================================
     起動時にどの画面を出すか決める
     ============================================================ */

  function routeFirstScreen() {
    if (env.standalone) return;                 // すでにアプリとして開いている → 何も出さない

    if (env.inApp) { openInAppGuide(); return; } // LINEなどの中 → まずブラウザに出てもらう

    var dismissed = false;
    try { dismissed = localStorage.getItem(LS_HINT) === '1'; } catch (e) {}

    if (!dismissed) { openSetup(); return; }     // 初回 → セットアップ案内
    maybeShowHint();                             // 2回目以降 → 小さいヒントだけ
  }

  function maybeShowHint() {
    if (env.standalone) return;
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

  $('hintClose').addEventListener('click', function () { $('installHint').hidden = true; });
  $('hintGo').addEventListener('click', openSetup);
  $('setupLink').addEventListener('click', openSetup);
  $('setupSkip').addEventListener('click', closeSetup);
  $('shareAppBtn').addEventListener('click', shareApp);
  $('inappSkip').addEventListener('click', function () {
    $('inapp').hidden = true;
    document.body.classList.remove('locked');
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!sheetWrap.hidden) closeSheet();
    else if (!beamer.hidden) closeBeamer();
    else if (!$('setup').hidden) closeSetup();
  });

  // 画面回転・リサイズでQRを描き直す
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    if (!state.current) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (state.current) drawQR($('qr'), state.current.url); }, 120);
  });

  // 共有用に付けた ?openExternalBrowser=1 はアドレス欄から消しておく
  if (location.search) {
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
  }

  $('verLabel').textContent = VERSION;
  render();
  routeFirstScreen();

  // オフラインでも起動できるようにする
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
})();
