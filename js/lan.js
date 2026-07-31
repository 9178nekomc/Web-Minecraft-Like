(() => {
  'use strict';

  class VoxelLAN {
    constructor() {
      this.socket = null;
      this.handlers = new Map();
      this.id = '';
      this.role = 'offline';
      this.name = '';
      this.url = '';
      this.ready = false;
      this.connectPromise = null;
      this.pingTimer = null;
      this.latency = 0;
    }

    static normalizeAddress(value) {
      let address = String(value || '').trim();
      if (!address) {
        if (location.protocol === 'http:' || location.protocol === 'https:') {
          return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
        }
        return 'ws://localhost:8080/ws';
      }
      if (!/^wss?:\/\//i.test(address) && !/^https?:\/\//i.test(address)) address = `ws://${address}`;
      address = address.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
      try {
        const url = new URL(address);
        if (!url.port) url.port = url.protocol === 'wss:' ? '443' : '8080';
        if (!url.pathname || url.pathname === '/') url.pathname = '/ws';
        return url.toString();
      } catch { return address; }
    }

    on(type, handler) {
      if (!this.handlers.has(type)) this.handlers.set(type, new Set());
      this.handlers.get(type).add(handler);
      return () => this.handlers.get(type)?.delete(handler);
    }

    emit(type, payload) {
      for (const handler of this.handlers.get(type) || []) {
        try { handler(payload); } catch (error) { console.error('[LAN handler]', type, error); }
      }
      for (const handler of this.handlers.get('*') || []) {
        try { handler(type, payload); } catch (error) { console.error('[LAN handler]', type, error); }
      }
    }

    connect(address, role, name) {
      this.close(false);
      this.url = VoxelLAN.normalizeAddress(address);
      this.role = role;
      this.name = String(name || '玩家').trim().slice(0, 20) || '玩家';
      this.connectPromise = new Promise((resolve, reject) => {
        let settled = false;
        const socket = new WebSocket(this.url);
        this.socket = socket;
        const timeout = setTimeout(() => {
          if (!settled) { settled = true; reject(new Error('连接超时，请确认局域网服务正在运行。')); }
          try { socket.close(); } catch {}
        }, 7000);
        socket.addEventListener('open', () => {
          this.rawSend({ type: 'hello', role, name: this.name, version: 1 });
          this.emit('status', { state: 'socket-open', message: '已连接服务，正在进入房间…' });
        });
        socket.addEventListener('message', event => {
          let message;
          try { message = JSON.parse(event.data); } catch { return; }
          if (message.type === 'roleAccepted') {
            this.id = message.id;
            this.role = message.role;
            this.ready = true;
            clearTimeout(timeout);
            if (!settled) { settled = true; resolve(message); }
            this.startHeartbeat();
          } else if (message.type === 'error' && !settled) {
            settled = true; clearTimeout(timeout); reject(new Error(message.message || '无法加入房间。'));
          } else if (message.type === 'pong') {
            this.latency = Math.max(0, Date.now() - Number(message.time || Date.now()));
            this.emit('latency', this.latency);
          }
          this.emit(message.type, message);
        });
        socket.addEventListener('close', event => {
          clearTimeout(timeout);
          this.stopHeartbeat();
          const wasReady = this.ready;
          this.ready = false;
          if (!settled) { settled = true; reject(new Error('连接被关闭，请检查地址和服务窗口。')); }
          this.emit('close', { wasReady, code: event.code, reason: event.reason });
        });
        socket.addEventListener('error', () => {
          this.emit('status', { state: 'error', message: 'WebSocket 连接失败。' });
        });
      });
      return this.connectPromise;
    }

    rawSend(value) {
      if (this.socket?.readyState !== WebSocket.OPEN) return false;
      try { this.socket.send(JSON.stringify(value)); return true; } catch { return false; }
    }

    send(type, payload = {}, options = {}) {
      if (!this.ready) return false;
      return this.rawSend({ type, ...payload, ...(options.to ? { to: options.to } : {}), ...(options.broadcast ? { broadcast: true } : {}) });
    }

    startHeartbeat() {
      this.stopHeartbeat();
      this.pingTimer = setInterval(() => this.rawSend({ type: 'ping', time: Date.now() }), 3000);
    }

    stopHeartbeat() {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    close(notify = true) {
      this.stopHeartbeat();
      if (this.socket) {
        if (notify && this.ready) this.rawSend({ type: 'leaving' });
        try { this.socket.close(1000, 'Leaving'); } catch {}
      }
      this.socket = null;
      this.ready = false;
      this.id = '';
      this.role = 'offline';
    }
  }

  window.VoxelLAN = VoxelLAN;
})();
