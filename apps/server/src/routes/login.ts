import type { FastifyInstance } from 'fastify';
import { getConfig } from '@src/config';

export async function loginRoutes(fastify: FastifyInstance): Promise<void> {
  const { googleWebClientId } = getConfig();

  fastify.get('/auth/login', async (_request, reply) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sign in — my-binder</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    h1 { font-size: 1.5rem; margin-bottom: 1.5rem; color: #333; }
    #error { color: #c0392b; margin-top: 1rem; display: none; }
  </style>
</head>
<body>
  <h1>my-binder API</h1>

  <div
    id="g_id_onload"
    data-client_id="${googleWebClientId}"
    data-callback="handleCredentialResponse"
    data-auto_prompt="false"
  ></div>
  <div class="g_id_signin" data-type="standard"></div>

  <p id="error"></p>

  <script src="https://accounts.google.com/gsi/client" async defer></script>
  <script>
    async function handleCredentialResponse(response) {
      const errorEl = document.getElementById('error');
      errorEl.style.display = 'none';

      try {
        const res = await fetch('/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: response.credential }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (res.status === 403 && body.error === 'ACCESS_DENIED') {
            errorEl.textContent =
              'Access denied: your Google account has not been permitted. ' +
              'Contact the administrator to request access.';
          } else {
            errorEl.textContent = body.message || 'Sign-in failed. Please try again.';
          }
          errorEl.style.display = 'block';
          return;
        }

        window.location.href = '/docs';
      } catch (err) {
        errorEl.textContent = 'Network error. Please try again.';
        errorEl.style.display = 'block';
      }
    }
  </script>
</body>
</html>`;

    return reply.code(200).header('Content-Type', 'text/html; charset=utf-8').send(html);
  });
}
