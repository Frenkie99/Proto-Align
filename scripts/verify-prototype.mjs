import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const htmlPath = path.join(root, 'prototypes', 'current', 'detailed-workbench.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
check(Boolean(scriptMatch), '缺少内联脚本');
if (scriptMatch) {
  try {
    new Function(scriptMatch[1]);
  } catch (error) {
    failures.push(`JavaScript 语法错误：${error.message}`);
  }
}

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const duplicatedIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
check(duplicatedIds.length === 0, `存在重复 id：${duplicatedIds.join(', ')}`);

[
  'projectMenu',
  'sourceDrawer',
  'sourceFileInput',
  'sourceFormOverlay',
  'linkEvidenceOverlay',
  'baselineOverlay',
  'versionHistoryOverlay',
  'version',
  'run',
  'activityDrawer',
  'decisionOverlay',
].forEach((id) => check(ids.includes(id), `缺少关键控件 #${id}`));

[
  "data-source-mode=\"prototype\"",
  "data-source-mode=\"feedback\"",
  'renderLinkedSources',
  'materializePendingIssue',
  'completePendingPrototypeReview',
  'renderBaselineState',
  'renderVersionHistory',
  'localStorage',
  '.issue.active .number{background:var(--marker)',
  '@media(max-width:980px)',
  '@media(max-width:760px)',
].forEach((token) => check(html.includes(token), `缺少能力标记：${token}`));

const forcedWidth = html.indexOf('min-width:1220px');
const responsiveOverride = html.indexOf('.shell{min-width:0}');
check(forcedWidth < 0 || responsiveOverride > forcedWidth, '固定宽度没有被后置响应式规则覆盖');

if (failures.length) {
  console.error('ProtoAlign 原型静态验证失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('ProtoAlign 原型静态验证通过');
console.log(`- JavaScript 语法：通过`);
console.log(`- 唯一 DOM id：${ids.length} 个`);
console.log('- 项目切换、资料输入、证据关联、复检闭环：结构齐全');
console.log('- 980px / 760px 响应式降级：规则齐全');
