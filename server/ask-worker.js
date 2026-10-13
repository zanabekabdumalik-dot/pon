// Сервер вопросов для сайта «Горизонт событий» (Cloudflare Worker).
//
// Сайт отправляет сюда вопрос, сервер добавляет ключ API и спрашивает Claude.
// Ключ хранится в секрете ANTHROPIC_API_KEY в настройках Worker'а и никогда не попадает на страницу.
// Код вставляется в редактор Cloudflare как есть, поэтому здесь обычный fetch без npm-пакетов:
// в браузерном редакторе Worker'а их не установить.
//
// Переменные (Settings → Variables and Secrets):
//   ANTHROPIC_API_KEY  — секрет, ключ API Anthropic (обязательно)
//   ALLOWED_ORIGIN     — адрес сайта, например https://event-horizon.netlify.app (через запятую можно несколько);
//                        без него отвечает любому сайту

const MODEL = 'claude-opus-5-5';
const MAX_QUESTION = 500;   // символов в одном вопросе
const MAX_TURNS = 7;        // сколько последних реплик разговора отправлять
const SYSTEM = 'You are the guide on Event Horizon, a small website about black holes, quantum physics and the history of the Universe. '
  + "Answer the visitor's question about space, astronomy or physics accurately and vividly for a curious non-expert. "
  + 'Reply in the same language the visitor writes in. Keep it short: two to four short paragraphs of plain text, no Markdown, no headings, no bullet lists. '
  + 'Use real numbers where they help. If the question is not about science or space, say in one sentence that you only answer questions about space and physics.';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGIN || '*').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
    const allowOrigin = allowed.includes('*') ? '*' : allowed.includes(origin) ? origin : '';
    const cors = {
      'Access-Control-Allow-Origin': allowOrigin || 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Vary': 'Origin',
    };
    const reply = (body, status = 200) => new Response(JSON.stringify(body), {
      status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8' },
    });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
    if (!allowOrigin) return reply({ error: 'origin_not_allowed' }, 403);
    if (!env.ANTHROPIC_API_KEY) return reply({ error: 'no_api_key' }, 500);

    let body;
    try { body = await request.json(); } catch { return reply({ error: 'bad_request' }, 400); }
    const messages = cleanMessages(body && body.messages);
    if (!messages) return reply({ error: 'bad_request' }, 400);

    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'server-side-fallback-2026-07-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 4096,
          system: SYSTEM,
          output_config: { effort: 'low' },   // короткие ответы в чате: меньше раздумий, быстрее и дешевле
          fallbacks: 'default',               // если модель откажется отвечать, API сам спросит запасную модель
          messages,
        }),
      });
    } catch {
      return reply({ error: 'upstream' }, 502);
    }
    if (res.status === 429 || res.status === 529) return reply({ error: 'rate_limited' }, 429);
    if (!res.ok) return reply({ error: 'upstream' }, 502);

    const msg = await res.json();
    if (msg.stop_reason === 'refusal') return reply({ error: 'refused' });
    const text = (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    if (!text) return reply({ error: 'upstream' }, 502);
    return reply({ text, truncated: msg.stop_reason === 'max_tokens' });
  },
};

// Принимаем только чередование user/assistant, начиная и заканчивая вопросом, с ограничением длины.
function cleanMessages(list) {
  if (!Array.isArray(list) || !list.length) return null;
  const out = [];
  for (const m of list.slice(-MAX_TURNS)) {
    const role = m && m.role === 'assistant' ? 'assistant' : 'user';
    const content = String((m && m.content) || '').trim().slice(0, role === 'user' ? MAX_QUESTION : 4000);
    if (!content) return null;
    if (out.length && out[out.length - 1].role === role) return null;
    out.push({ role, content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  if (!out.length || out[out.length - 1].role !== 'user') return null;
  return out;
}
