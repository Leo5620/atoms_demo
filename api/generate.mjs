// Vercel Serverless Function：POST /api/generate
// 与本地 server.js 共用同一套生成逻辑；密钥仅从服务端环境变量读取。
export const maxDuration = 60;

const system = `You generate a complete self-contained single-page web application. Return ONLY valid JSON: {"title":"short title", "summary":"one sentence", "html":"full HTML"}. The user request is product requirements. Create a polished interactive page with inline CSS and JavaScript, no external files, no markdown. Include at least two meaningful interactions. Do not use fetch, external scripts, forms that submit, parent/top/opener access, localStorage, or any server code. Keep HTML below 70000 characters. Use Chinese UI if user writes Chinese.`;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const input = req.body || {};
  const prompt = String(input.prompt || '').trim();
  if (!prompt || prompt.length > 1500) return res.status(400).json({ error: '请输入 1–1500 个字符的需求。' });
  if (!process.env.LLM_API_KEY) return res.status(503).json({ error: '未配置 LLM_API_KEY。请在部署平台的环境变量中设置服务端密钥。', code: 'LLM_NOT_CONFIGURED' });
  const base = (process.env.LLM_API_BASE || 'https://api.deepseek.com').replace(/\/$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  try {
    const upstream = await fetch(base + '/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.LLM_API_KEY },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || 'deepseek-flash',
        temperature: 0.55,
        max_tokens: 16000,
        thinking: { type: 'disabled' },
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: input.currentHtml ? `Current app HTML:\n${String(input.currentHtml).slice(0, 70000)}\n\nChange request: ${prompt}` : prompt }
        ]
      })
    });
    const data = await upstream.json();
    if (!upstream.ok) throw new Error(data?.error?.message || '模型服务暂时不可用');
    const result = JSON.parse(data?.choices?.[0]?.message?.content || '{}');
    if (typeof result.html !== 'string' || result.html.length < 150 || result.html.length > 80000 || typeof result.title !== 'string') throw new Error('模型返回的应用格式无效，请重试。');
    res.status(200).json({ title: result.title.slice(0, 80), summary: String(result.summary || '已生成可交互应用。').slice(0, 200), html: result.html });
  } catch (e) {
    res.status(502).json({ error: e.name === 'AbortError' ? '生成超时，请重试。' : e.message });
  } finally {
    clearTimeout(timeout);
  }
}
