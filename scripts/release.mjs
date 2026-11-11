// 發布新版本：
//   npm run release -- patch "修正 KD 計算；新增 xx 功能"
//   npm run release -- minor "…"     （或直接指定 1.2.0）
// 會修改 package.json 版本、在 CHANGELOG.md 加上更新內容（用；分隔多項），然後 commit 並 push。
// GitHub Actions 建置完成後自動發布 Release，電腦與手機 App 會自動更新。
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const [arg = 'patch', notes = '小幅改進與修正'] = process.argv.slice(2);
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const [a, b, c] = pkg.version.split('.').map(Number);
const next = /^\d+\.\d+\.\d+$/.test(arg) ? arg
  : arg === 'major' ? `${a + 1}.0.0` : arg === 'minor' ? `${a}.${b + 1}.0` : `${a}.${b}.${c + 1}`;

pkg.version = next;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
lock.version = next;
if (lock.packages?.['']) lock.packages[''].version = next;
writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');

const items = notes.split(/[;；]/).map((s) => s.trim()).filter(Boolean).map((s) => `- ${s}`).join('\n');
const log = readFileSync('CHANGELOG.md', 'utf8');
writeFileSync('CHANGELOG.md', log.replace('# 更新紀錄\n', `# 更新紀錄\n\n## v${next}\n${items}\n`));

execSync(`git add -A && git commit -m "Release v${next}" && git push`, { stdio: 'inherit' });
console.log(`\n已推送 v${next}，GitHub Actions 建置完成後（約 8 分鐘）會自動發布。`);
