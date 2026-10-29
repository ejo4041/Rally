import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
export async function serve(port = 0) {
  const server = createServer(async (req, res) => {
    const path = req.url === '/' ? 'index.html' : req.url === '/browser.js' ? 'browser.js' : null;
    if (!path) { res.writeHead(404).end(); return; }
    try {
      const content = await readFile(new URL(`./dist/${path}`, import.meta.url));
      res.writeHead(200, { 'Content-Type': path.endsWith('.js') ? 'text/javascript' : 'text/html', 'Cache-Control': 'no-store' });
      res.end(content);
    } catch { res.writeHead(500).end('Run npm run build first.'); }
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return server;
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const server = await serve(Number(process.env.PORT || 4178));
  console.log(`Local Teams spike: http://localhost:${server.address().port}`);
}
