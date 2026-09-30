/* global PAIPAI_VERSION, PAIPAI_ASSETS */
'use strict';

importScripts('./assets.js');

const CACHE_NAME = `paipai-happy-chicken-${PAIPAI_VERSION}`;
const APP_SHELL = PAIPAI_ASSETS;

async function notifyClients(type) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach(client => client.postMessage({ type, version: PAIPAI_VERSION }));
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('paipai-happy-chicken-') && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
    await notifyClients('PRECACHE_READY');
  })());
});

self.addEventListener('message', event => {
  if (!event.data || event.data.type !== 'CHECK_PRECACHE') return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const results = await Promise.all(APP_SHELL.map(asset => cache.match(asset)));
    if (results.every(Boolean)) {
      if (event.source) event.source.postMessage({ type: 'PRECACHE_READY', version: PAIPAI_VERSION });
    } else if (event.source) {
      event.source.postMessage({ type: 'PRECACHE_ERROR', version: PAIPAI_VERSION });
    }
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put('./index.html', response.clone());
        }
        return response;
      } catch (_) {
        return (await caches.match(request)) || (await caches.match('./index.html'));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    } catch (_) {
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});
