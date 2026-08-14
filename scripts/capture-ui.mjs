import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const route = process.argv[2] || 'dashboard';
const output = path.resolve(process.argv[3] || `build/screenshots/${route}.png`);
const width = Number(process.argv[4] || 1440);
const height = Number(process.argv[5] || 900);

const pages = await fetch('http://127.0.0.1:9222/json/list').then((response) => response.json());
const page = pages.find((entry) => entry.type === 'page' && entry.webSocketDebuggerUrl);
if (!page) throw new Error('No Electron renderer found on the local debug port.');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let sequence = 0;
const pending = new Map();
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  message.error ? reject(new Error(message.error.message)) : resolve(message.result);
});

function send(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
const actualRoute = route === 'store-details' ? 'store/SLUS_202.28' : route === 'free-store' ? 'store' : route === 'free-store-modal' || route === 'free-store-progress' ? 'store/free/supertux-ps2' : route === 'settings-sources' ? 'settings' : route.startsWith('store-search-') ? 'store' : route;
const rendererUrl = new URL(page.url);
rendererUrl.hash = `#/${actualRoute}`;
await send('Page.navigate', { url: rendererUrl.toString() });
await new Promise((resolve) => setTimeout(resolve, route.startsWith('store') ? 5000 : 1400));
if (route.startsWith('store-search-')) {
  const query = route === 'store-search-serial' ? 'SLUS-20228' : 'Silent Hill';
  const focusResult = await send('Runtime.evaluate', {
    expression: "(() => { const input = document.querySelector('.search-shell input'); if (!(input instanceof HTMLInputElement)) return false; input.focus(); input.select(); return true; })()",
    returnByValue: true,
  });
  if (focusResult.result?.value) {
    await send('Input.insertText', { text: query });
  }
  await new Promise((resolve) => setTimeout(resolve, 900));
}
if (route === 'free-store') {
  await send('Runtime.evaluate', { expression: `document.querySelector('[data-testid="free-filter"]')?.click()` });
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (route === 'free-store-modal' || route === 'free-store-progress') {
  await send('Runtime.evaluate', { expression: `document.querySelector('[data-testid="download-install"]')?.click()` });
  await new Promise((resolve) => setTimeout(resolve, 400));
  if (route === 'free-store-progress') {
    await send('Runtime.evaluate', { expression: `document.querySelector('[data-testid="confirm-download"]')?.click()` });
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
}
if (route === 'settings' || route === 'settings-sources') {
  const expression = route === 'settings-sources'
    ? "[...document.querySelectorAll('.settings-nav button')].find((button) => button.textContent?.includes('Sources'))?.click()"
    : "[...document.querySelectorAll('.settings-nav button')].find((button) => button.textContent?.includes('Appearance'))?.click()";
  await send('Runtime.evaluate', { expression });
  await new Promise((resolve) => setTimeout(resolve, 350));
}
await send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });
const rendered = await send('Runtime.evaluate', { expression: `document.querySelector('.route-content')?.innerText?.slice(0, 1200) || ''`, returnByValue: true });
const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: true });
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, Buffer.from(screenshot.data, 'base64'));
socket.close();
process.stdout.write(`${output}\n${rendered.result?.value || ''}\n`);
