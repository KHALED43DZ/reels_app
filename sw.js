// ===== Service Worker — مصنع الحكايات =====
// يقوم بتخزين واجهة التطبيق (Shell) مؤقتًا للسماح بالعمل دون اتصال بعد أول زيارة.
// طلبات Gemini وPollinations تتطلب اتصالاً بالإنترنت دائمًا ولا يتم تخزينها مؤقتًا.

const CACHE_NAME = 'tales-factory-cache-v1';

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap'
];

// تثبيت: تخزين ملفات الواجهة الأساسية
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => console.warn('SW install cache error:', err))
  );
  self.skipWaiting();
});

// تفعيل: حذف أي نسخ كاش قديمة
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// الجلب: عدم التدخل إطلاقًا في طلبات Gemini أو Pollinations (تتطلب شبكة حيّة دائمًا)
function isApiRequest(url) {
  return url.includes('generativelanguage.googleapis.com') ||
         url.includes('image.pollinations.ai');
}

self.addEventListener('fetch', (event) => {
  const requestUrl = event.request.url;

  if (isApiRequest(requestUrl)) {
    // مرّر الطلب مباشرة للشبكة دون أي تخزين مؤقت
    event.respondWith(fetch(event.request));
    return;
  }

  // استراتيجية: الكاش أولاً، ثم الشبكة كاحتياط، مع تحديث الكاش
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkFetch = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});
