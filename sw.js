const CACHE_NAME = 'leave-app-v5';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './script.js'
];

self.addEventListener('install', event => {
    self.skipWaiting(); // 즉시 새 버전 설치
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache); // 이전 버전 캐시 삭제
                    }
                })
            );
        }).then(() => self.clients.claim()) // 즉시 새 서비스 워커 제어권 획득
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});