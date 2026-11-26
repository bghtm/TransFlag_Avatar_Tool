// 把 res/ 里的旗帜素材内联进 index.html 的 FLAG_ASSETS 段。
//
// 为什么必须内联：本工具支持「双击 index.html」直接用（file:// 打开）。
// 这种页面 origin 是 null，浏览器禁止读取本地图片像素 —— 直接把 ./res/*.png 画进 canvas
// 会污染画布：预览一片空白（看起来像黑的），下载时 toDataURL() 抛 SecurityError。
// data: URI 不会污染画布，因此本地和线上（GitHub Pages）都能正常预览与下载。
//
// 用法（在仓库根目录）：
//   node tools/build-flags.mjs
//
// 只会重写 index.html 里 <FLAG_ASSETS_BEGIN> 与 <FLAG_ASSETS_END> 之间的内容。

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(ROOT, 'index.html');

// key 必须与 index.html 里 FLAG_TEMPLATES_ARRAY 的 key 一致
const FLAGS = [
    { key: 'bottom_trans', file: 'res/底部鱼板跨旗模板.png' },
    { key: 'bottom_transles', file: 'res/底部transles鱼板.png' },
    { key: 'bottom_les', file: 'res/底部les鱼板.png' },
    { key: 'right_bottom_trans', file: 'res/右下鱼板跨旗模板.png' },
    { key: 'right_bottom_les', file: 'res/右下les鱼板.png' },
    { key: 'right_bottom_transles', file: 'res/右下transles鱼板.png' },
];

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const BEGIN = '// <FLAG_ASSETS_BEGIN>';
const END = '// <FLAG_ASSETS_END>';

const html = await readFile(INDEX, 'utf8');
const beginAt = html.indexOf(BEGIN);
const endAt = html.indexOf(END);
if (beginAt === -1 || endAt === -1 || endAt < beginAt) {
    console.error('index.html 里找不到 FLAG_ASSETS 标记，已中止。');
    process.exit(1);
}

const lines = ['const FLAG_ASSETS = {'];
let totalBytes = 0;
for (const { key, file } of FLAGS) {
    const abs = path.join(ROOT, file);
    const bytes = await readFile(abs);
    totalBytes += bytes.length;
    const mime = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    lines.push(`    ${key}: 'data:${mime};base64,${bytes.toString('base64')}',`);
    console.log(`  ${key.padEnd(22)} ${String(bytes.length).padStart(7)} B  ${file}`);
}
lines.push('};');

// 保持与周围代码一致的缩进和换行符
const indentMatch = html.slice(0, beginAt).match(/\n([ \t]*)$/);
const indent = indentMatch ? indentMatch[1] : '';
const eol = html.includes('\r\n') ? '\r\n' : '\n';

// 把 BEGIN 行与 END 行之间的内容整段替换掉
const afterBeginLine = html.indexOf('\n', beginAt) + 1;
const endLineStart = html.lastIndexOf('\n', endAt) + 1;
const block = lines.map(line => (line ? indent + line : line)).join(eol) + eol;
const next = html.slice(0, afterBeginLine) + block + html.slice(endLineStart);
await writeFile(INDEX, next, 'utf8');

console.log(`\n已内联 ${FLAGS.length} 个旗帜，原始共 ${(totalBytes / 1024).toFixed(1)} KB。`);
console.log(`index.html 现在 ${(Buffer.byteLength(next, 'utf8') / 1024).toFixed(1)} KB。`);
