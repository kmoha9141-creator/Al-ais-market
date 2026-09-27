const CACHE_NAME = 'souk-al-ees-v2';

const APP_FILES = [
  './',
  './index.html',
  './index-11.html',
  './manifest.json'
];

/* تثبيت الـ Service Worker */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        // نحاول تخزين الملفات الموجودة فقط،
        // حتى لا يفشل الـ Service Worker بالكامل بسبب ملف غير موجود.
        for (const file of APP_FILES) {
          try {
            const response = await fetch(file, {
              cache: 'no-store'
            });

            if (response.ok) {
              await cache.put(file, response);
            }
          } catch (error) {
            console.warn('تعذر تخزين:', file, error);
          }
        }
      })
      .then(() => self.skipWaiting())
  );
});


/* تفعيل النسخة الجديدة */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});


/* التعامل مع الطلبات */
self.addEventListener('fetch', event => {

  if (event.request.method !== 'GET') {
    return;
  }

  const requestURL = new URL(event.request.url);

  // لا نتدخل في المواقع الخارجية
  if (requestURL.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {

        // حفظ نسخة حديثة من الملف في الكاش
        if (response && response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, copy).catch(() => {});
            });
        }

        return response;
      })
      .catch(async () => {

        /*
         * إذا لم يوجد إنترنت، أو حدث 404/فشل تحميل،
         * نحاول استخدام النسخة المخزنة.
         */

        const cached = await caches.match(event.request);

        if (cached) {
          return cached;
        }

        /*
         * إذا كان الطلب هو الصفحة الرئيسية،
         * نبحث عن نسخة index.html أو index-11.html.
         */

        if (
          event.request.mode === 'navigate' ||
          requestURL.pathname.endsWith('/')
        ) {

          const indexHTML = await caches.match('./index.html');

          if (indexHTML) {
            return indexHTML;
          }

          const index11HTML = await caches.match('./index-11.html');

          if (index11HTML) {
            return index11HTML;
          }
        }

        /*
         * آخر محاولة: إرجاع الصفحة الرئيسية المخزنة.
         */
        const root = await caches.match('./');

        if (root) {
          return root;
        }

        return new Response(
          'سوق العيص الإلكتروني',
          {
            status: 503,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8'
            }
          }
        );
      })
  );
});


/*
 * استقبال أمر تحديث فوري من التطبيق
 */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
