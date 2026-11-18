const http = require('http');
const fs = require('fs');
const path = require('path');

for (const line of (fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}
const root = __dirname;
const send = (res, status, data, type='application/json') => { res.writeHead(status, {'Content-Type': type, 'Cache-Control':'no-store'}); res.end(data); };
const readBody = req => new Promise((resolve, reject) => { let raw=''; req.on('data', c => { raw += c; if(raw.length > 300000) req.destroy(); }); req.on('end', () => resolve(raw)); req.on('error', reject); });
const system = `You generate a complete self-contained single-page web application. Return ONLY valid JSON: {"title":"short title", "summary":"one sentence", "html":"full HTML"}. The user request is product requirements. Create a polished interactive page with inline CSS and JavaScript, no external files, no markdown. Include at least two meaningful interactions. Do not use fetch, external scripts, forms that submit, parent/top/opener access, localStorage, or any server code. Keep HTML below 70000 characters. Use Chinese UI if user writes Chinese.`;

async function generate(req, res) {
  let input;
  try { input = JSON.parse(await readBody(req)); } catch { return send(res, 400, JSON.stringify({error:'请求格式无效，请重试。'})); }
  const prompt = String(input.prompt || '').trim();
  if (!prompt || prompt.length > 1500) return send(res, 400, JSON.stringify({error:'请输入 1–1500 个字符的需求。'}));
  if (!process.env.LLM_API_KEY) return send(res, 503, JSON.stringify({error:'未配置 LLM_API_KEY。复制 .env.example 为 .env 并填入服务端密钥后即可生成。', code:'LLM_NOT_CONFIGURED'}));
  const base = (process.env.LLM_API_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const upstream = await fetch(base + '/chat/completions', { method:'POST', signal:controller.signal, headers:{'Content-Type':'application/json','Authorization':'Bearer ' + process.env.LLM_API_KEY}, body:JSON.stringify({model:process.env.LLM_MODEL || 'deepseek-flash', temperature:0.55, max_tokens:16000, thinking:{type:'disabled'}, response_format:{type:'json_object'}, messages:[{role:'system',content:system},{role:'user',content: input.currentHtml ? `Current app HTML:\n${String(input.currentHtml).slice(0,70000)}\n\nChange request: ${prompt}` : prompt}]}) });
    const data = await upstream.json();
    if (!upstream.ok) throw new Error(data?.error?.message || '模型服务暂时不可用');
    const result = JSON.parse(data?.choices?.[0]?.message?.content || '{}');
    if (typeof result.html !== 'string' || result.html.length < 150 || result.html.length > 80000 || typeof result.title !== 'string') throw new Error('模型返回的应用格式无效，请重试。');
    send(res, 200, JSON.stringify({title:result.title.slice(0,80), summary:String(result.summary||'已生成可交互应用。').slice(0,200), html:result.html}));
  } catch (e) { send(res, 502, JSON.stringify({error:e.name === 'AbortError' ? '生成超时，请重试。' : e.message})); } finally { clearTimeout(timeout); }
}
// 端口/主机优先级：--port/--host 命令行参数 > PORT/HOST 环境变量 > 默认值
const arg = name => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };
const port = Number(arg('--port') || arg('-p') || process.env.PORT) || 3000;
const host = arg('--host') || process.env.HOST || '0.0.0.0';
http.createServer((req,res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname === '/api/generate') return generate(req,res);
  if (req.method !== 'GET') return send(res,405,JSON.stringify({error:'Method not allowed'}));
  const file = url.pathname === '/' || url.pathname.startsWith('/chat/') || url.pathname === '/resources' ? 'index.html' : url.pathname.slice(1);
  const full = path.resolve(root, file);
  if (!full.startsWith(root) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) return send(res,404,'Not found','text/plain');
  const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
  send(res,200,fs.readFileSync(full),types[path.extname(full)] || 'application/octet-stream');
}).listen(port, host, () => console.log(`Atoms Demo running at http://localhost:${port}`));
