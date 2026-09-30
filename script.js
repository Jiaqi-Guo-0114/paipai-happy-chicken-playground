(function () {
  'use strict';

  const P = window.Paipai;

  // Chromium blocks manifest files on file:// even though the game itself is fully local.
  // Attach it only for the HTTPS/localhost modes where PWA installation is available.
  if (location.protocol !== 'file:') {
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = 'app.webmanifest';
    document.head.appendChild(manifest);
  }

  class App {
    constructor() {
      this.canvas = document.getElementById('gameCanvas');
      this.topBar = document.getElementById('topBar');
      this.backButton = document.getElementById('backButton');
      this.settingsButton = document.getElementById('settingsButton');
      this.caption = document.getElementById('caption');
      this.offlineStatus = document.getElementById('offlineStatus');
      this.offlineStatusText = document.getElementById('offlineStatusText');
      this.settingsPanel = document.getElementById('settingsPanel');
      this.confirmPanel = document.getElementById('confirmPanel');
      this.store = new P.StateStore(this.safeStorage());
      P.I18n.setLanguage(this.store.state.settings.language);
      this.audio = new P.AudioManager(this.store.state.settings);
      this.runtime = new P.Runtime(this.canvas, this);
      this.currentRoute = 'start';
      this.captionTimer = 0;
      this.confirmCallback = null;
      this.installReady = false;
      this.bindUI();
      this.syncSettings();
      this.syncLanguage();
      this.navigate('start');
      this.runtime.start();
      this.prepareOffline();
      this.watchOrientation();
      window.__PAIPAI__ = this;
    }

    safeStorage() {
      try {
        const test = '__paipai_storage_test__';
        window.localStorage.setItem(test, test);
        window.localStorage.removeItem(test);
        return window.localStorage;
      } catch (error) {
        console.warn('当前环境不允许本地存储，进度只会保留到本次关闭。', error);
        return null;
      }
    }

    bindUI() {
      this.backButton.addEventListener('click', () => { this.audio.sfx('tap'); this.back(); });
      this.settingsButton.addEventListener('click', () => { this.audio.sfx('tap'); this.openSettings(); });
      document.getElementById('closeSettings').addEventListener('click', () => this.closeModals());
      document.getElementById('sfxToggle').addEventListener('click', () => this.toggleSetting('sfx'));
      document.getElementById('voiceToggle').addEventListener('click', () => this.toggleSetting('voice'));
      document.getElementById('languageToggle').addEventListener('click', () => this.toggleLanguage());
      document.getElementById('resetScores').addEventListener('click', () => {
        this.confirm('训练成绩、最佳记录和奖励进度会清零，已经得到的贴纸会保留。', () => {
          this.store.resetScores();
          this.toast('训练记录已经重置');
        });
      });
      document.getElementById('resetStickers').addEventListener('click', () => {
        this.confirm('贴纸册里的摆放会全部清空，只保留最初的5枚贴纸。', () => {
          this.store.resetStickers();
          this.toast('贴纸册已经重置');
        });
      });
      document.getElementById('confirmCancel').addEventListener('click', () => this.closeConfirm());
      document.getElementById('confirmOkay').addEventListener('click', () => {
        const callback = this.confirmCallback;
        this.closeConfirm();
        if (callback) callback();
      });
      document.addEventListener('contextmenu', event => event.preventDefault());
      document.addEventListener('gesturestart', event => event.preventDefault());
    }

    modalOpen() {
      return !this.settingsPanel.classList.contains('hidden') || !this.confirmPanel.classList.contains('hidden');
    }

    openSettings() {
      this.syncSettings();
      this.settingsPanel.classList.remove('hidden');
    }

    closeConfirm() {
      this.confirmPanel.classList.add('hidden');
      this.confirmCallback = null;
    }

    closeModals() {
      this.settingsPanel.classList.add('hidden');
      this.closeConfirm();
    }

    confirm(message, callback) {
      document.getElementById('confirmMessage').textContent = P.I18n.text(message);
      this.confirmCallback = callback;
      this.confirmPanel.classList.remove('hidden');
    }

    toggleSetting(key) {
      this.store.update(state => { state.settings[key] = !state.settings[key]; });
      this.audio.applySettings(this.store.state.settings);
      this.syncSettings();
      if (key !== 'sfx' || this.store.state.settings.sfx) this.audio.sfx('tap');
    }

    syncSettings() {
      ['sfx', 'voice'].forEach(key => {
        const button = document.getElementById(`${key}Toggle`);
        button.setAttribute('aria-checked', String(this.store.state.settings[key]));
      });
    }

    toggleLanguage() {
      const next = P.I18n.language === 'zh' ? 'en' : 'zh';
      this.store.update(state => { state.settings.language = next; });
      P.I18n.setLanguage(next);
      this.audio.stopVoice();
      this.syncLanguage();
    }

    syncLanguage() {
      const english = P.I18n.language === 'en';
      const labels = english ? {
        title: "Paipai's Happy Chicken Playground",
        canvas: 'Game scene', back: 'Back to game menu', settings: 'Open settings',
        close: 'Close settings', settingsTitle: 'Game settings', sound: 'Sound effects',
        voice: 'Chinese voice prompts', resetScores: 'Reset scores', resetStickers: 'Reset stickers',
        note: 'Progress is saved on this device only.', confirm: 'Are you sure?',
        cancel: 'Cancel', reset: 'Confirm reset', rotate: 'Turn your device sideways',
        rotateDetail: 'Happy Chicken plays in landscape mode', languageButton: 'Switch language'
      } : {
        title: '派派的快乐小鸡乐园', canvas: '游戏画面', back: '返回游戏菜单', settings: '打开设置',
        close: '关闭设置', settingsTitle: '训练设置', sound: '游戏音效',
        voice: '中文提示音', resetScores: '重置训练记录', resetStickers: '重置贴纸册',
        note: '进度只保存在当前这台设备中。', confirm: '确定要重置吗？',
        cancel: '取消', reset: '确定重置', rotate: '请把设备横过来',
        rotateDetail: '快乐小鸡要在横屏里玩', languageButton: '切换语言'
      };
      document.documentElement.lang = english ? 'en' : 'zh-CN';
      document.title = labels.title;
      document.getElementById('app').setAttribute('aria-label', labels.title);
      document.getElementById('gameCanvas').setAttribute('aria-label', labels.canvas);
      document.getElementById('backButton').setAttribute('aria-label', labels.back);
      document.getElementById('settingsButton').setAttribute('aria-label', labels.settings);
      document.getElementById('closeSettings').setAttribute('aria-label', labels.close);
      document.getElementById('languageToggle').setAttribute('aria-label', labels.languageButton);
      document.getElementById('languageToggle').textContent = english ? 'English' : '中文';
      document.getElementById('settingsTitle').textContent = labels.settingsTitle;
      document.querySelector('#sfxToggle').previousElementSibling.textContent = labels.sound;
      document.querySelector('#voiceToggle').previousElementSibling.textContent = labels.voice;
      document.getElementById('resetScores').textContent = labels.resetScores;
      document.getElementById('resetStickers').textContent = labels.resetStickers;
      document.querySelector('.settings-note').textContent = labels.note;
      document.getElementById('confirmTitle').textContent = labels.confirm;
      document.getElementById('confirmCancel').textContent = labels.cancel;
      document.getElementById('confirmOkay').textContent = labels.reset;
      document.querySelector('#rotateNotice h1').textContent = labels.rotate;
      document.querySelector('#rotateNotice p').textContent = labels.rotateDetail;
      if (!this.caption.classList.contains('hidden')) this.caption.classList.add('hidden');
      this.setOfflineStatus(this.installReady ? '离线资源已准备好 · 可添加到主屏幕' : '正在准备离线资源…', this.installReady ? 'ready' : '');
    }

    sceneFactory(route) {
      const factories = {
        start: () => new P.Games.StartScene(),
        menu: () => new P.Games.MenuScene(),
        egg: () => new P.Games.EggGame(),
        maze: () => new P.Games.MazeGame(),
        coop: () => new P.Games.CoopGame(),
        puddle: () => new P.Games.PuddleGame(),
        puzzle: () => new P.Games.PuzzleGame(),
        stickers: () => new P.Games.StickerBook()
      };
      return (factories[route] || factories.menu)();
    }

    navigate(route, config = {}) {
      this.closeModals();
      this.audio.stopVoice();
      this.currentRoute = route;
      this.runtime.setScene(route, this.sceneFactory(route), config);
    }

    back() {
      if (this.currentRoute === 'start') return;
      if (this.currentRoute === 'menu') this.navigate('start');
      else this.navigate('menu');
    }

    sceneChanged(route) {
      this.topBar.classList.toggle('hidden', route === 'start');
      this.offlineStatus.classList.toggle('hidden', route !== 'menu');
    }

    toast(message, duration = 2200) {
      window.clearTimeout(this.captionTimer);
      this.caption.textContent = P.I18n.text(message);
      this.caption.classList.remove('hidden');
      this.captionTimer = window.setTimeout(() => this.caption.classList.add('hidden'), duration);
    }

    voice(key, caption) {
      if (caption) this.toast(caption, 3400);
      this.audio.voice(key, true);
    }

    award(stickerIds) {
      if (!stickerIds || !stickerIds.length) return;
      this.audio.sfx('reward');
      this.audio.voice('reward', true);
      this.toast(`获得${stickerIds.length === 1 ? '一枚' : `${stickerIds.length}枚`}新贴纸！去贴纸册看看吧`, 3600);
    }

    setOfflineStatus(message, state = '') {
      this.offlineStatusText.textContent = P.I18n.text(message);
      this.offlineStatus.classList.remove('ready', 'error');
      if (state) this.offlineStatus.classList.add(state);
    }

    async prepareOffline() {
      if (location.protocol === 'file:') {
        this.setOfflineStatus('电脑本地模式 · 可直接离线玩', 'ready');
        return;
      }
      if (!('serviceWorker' in navigator)) {
        this.setOfflineStatus('此浏览器不支持离线安装', 'error');
        return;
      }
      if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        this.setOfflineStatus('请使用私有 HTTPS 地址安装', 'error');
        return;
      }
      try {
        navigator.serviceWorker.addEventListener('message', event => {
          if (event.data && event.data.type === 'PRECACHE_READY') {
            this.installReady = true;
            this.setOfflineStatus('离线资源已准备好 · 可添加到主屏幕', 'ready');
          } else if (event.data && event.data.type === 'PRECACHE_ERROR') {
            this.setOfflineStatus('离线资源不完整，请刷新重试', 'error');
          }
        });
        const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
        await navigator.serviceWorker.ready;
        const worker = registration.active || registration.waiting || registration.installing;
        if (worker) worker.postMessage({ type: 'CHECK_PRECACHE' });
        for (let attempt = 0; attempt < 24 && !this.installReady; attempt += 1) {
          const cache = await caches.open(`paipai-happy-chicken-${window.PAIPAI_VERSION}`);
          const cached = await Promise.all(window.PAIPAI_ASSETS.map(asset => cache.match(asset)));
          if (cached.every(Boolean)) {
            this.installReady = true;
            this.setOfflineStatus('离线资源已准备好 · 可添加到主屏幕', 'ready');
            break;
          }
          await new Promise(resolve => window.setTimeout(resolve, 250));
        }
        if (!this.installReady) this.setOfflineStatus('离线资源不完整，请刷新重试', 'error');
      } catch (error) {
        console.error('离线资源准备失败。', error);
        this.setOfflineStatus('离线资源准备失败，请刷新重试', 'error');
      }
    }

    watchOrientation() {
      let wasPortrait = matchMedia('(orientation: portrait)').matches;
      const update = () => {
        const portrait = matchMedia('(orientation: portrait)').matches;
        if (portrait && !wasPortrait && this.audio.unlocked) this.audio.voice('rotate', true);
        wasPortrait = portrait;
      };
      window.addEventListener('orientationchange', update, { passive: true });
      window.addEventListener('resize', update, { passive: true });
    }
  }

  function boot() {
    if (!window.Paipai || !window.Paipai.Games) {
      document.body.textContent = '游戏资源加载失败，请重新打开。';
      return;
    }
    new App();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
