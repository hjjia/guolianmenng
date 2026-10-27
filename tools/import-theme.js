#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const themesRoot = path.join(projectRoot, 'game-themes');
const handoffPath = process.argv[2];

function fail(message) {
    console.error(`错误：${message}`);
    process.exit(1);
}

if (!handoffPath || process.argv.length !== 3) {
    fail('用法：npm run theme:import -- "/完整路径/新游戏文件夹"');
}

const handoffRoot = path.resolve(handoffPath);
const source = fs.existsSync(path.join(handoffRoot, '主题资源', 'theme.json'))
    ? path.join(handoffRoot, '主题资源') : handoffRoot;
const configPath = path.join(source, 'theme.json');
if (!fs.existsSync(configPath)) fail('交付文件夹缺少 主题资源/theme.json');

let config;
try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
    fail(`theme.json 读取失败：${error.message}`);
}
const themeId = config.id;
if (typeof themeId !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(themeId) || themeId === 'fruit') {
    fail('theme.json 的 id 必须是新的小写英文主题 ID，不能是 fruit');
}
const shortcut = `select:${themeId}`;
const command = `node tools/select-game.js ${themeId}`;
const packagePath = path.join(projectRoot, 'package.json');
const existingScripts = JSON.parse(fs.readFileSync(packagePath, 'utf8')).scripts || {};
if (existingScripts[shortcut] && existingScripts[shortcut] !== command) {
    fail(`package.json 中 ${shortcut} 已指向其他命令，未覆盖`);
}
for (const entry of fs.readdirSync(themesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === themeId) continue;
    const existingConfig = path.join(themesRoot, entry.name, 'theme.json');
    if (!fs.existsSync(existingConfig)) continue;
    const existing = JSON.parse(fs.readFileSync(existingConfig, 'utf8'));
    if (config.gameId && config.gameId === existing.gameId) {
        fail(`gameId “${config.gameId}”已被 ${entry.name} 使用；每个游戏需要独立的存档身份`);
    }
    for (const platform of ['wechatgame', 'bytedance-mini-game']) {
        const appId = config.platforms?.[platform]?.appId;
        if (appId && appId === existing.platforms?.[platform]?.appId) {
            fail(`${platform} AppID 已被 ${entry.name} 使用；请填写新游戏自己的 AppID 或暂设为 null`);
        }
    }
}

const destination = path.join(themesRoot, themeId);
if (fs.existsSync(destination) && fs.realpathSync(destination) === fs.realpathSync(source)) {
    fail('交付目录直接指向工程主题目录；请提供独立的素材文件夹');
}
console.log(`导入来源：${source}`);
console.log(`英文主题目录：game-themes/${themeId}；切换命令：npm run ${shortcut}`);

const tempRoot = path.join(projectRoot, 'temp', 'theme-import');
fs.mkdirSync(tempRoot, { recursive: true });
const uniqueId = `${themeId}-${Date.now()}-${process.pid}`;
const staging = path.join(tempRoot, `staging-${uniqueId}`);
const backup = path.join(tempRoot, `backup-${uniqueId}`);

fs.cpSync(source, staging, { recursive: true });

// 平台多尺寸图标留在交付包；512 PNG 同步到主题中，供后续平台上传。
const iconSource = path.join(handoffRoot, 'logo-sizes', 'png', 'logo-512.png');
if (fs.existsSync(iconSource)) {
    const iconDestination = path.join(staging, 'publishing', 'icon-512.png');
    fs.mkdirSync(path.dirname(iconDestination), { recursive: true });
    fs.copyFileSync(iconSource, iconDestination);
}

let hadPrevious = false;
try {
    if (fs.existsSync(destination)) {
        fs.renameSync(destination, backup);
        hadPrevious = true;
    }
    fs.renameSync(staging, destination);
    const validation = spawnSync(process.execPath, [path.join(__dirname, 'select-game.js'), '--check', themeId], {
        cwd: projectRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    });
    if (validation.error || validation.status !== 0) {
        throw new Error(validation.error?.message || validation.stdout + validation.stderr);
    }
    console.log(validation.stdout.trim());
} catch (error) {
    if (fs.existsSync(destination)) fs.rmSync(destination, { recursive: true, force: true });
    if (hadPrevious) fs.renameSync(backup, destination);
    if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
    fail(`导入校验失败，已恢复原主题目录：\n${error.message}`);
}

console.log(`已导入 game-themes/${themeId}${hadPrevious ? `；原版本备份于 ${path.relative(projectRoot, backup)}` : ''}`);

const selection = spawnSync(process.execPath, [path.join(__dirname, 'select-game.js'), themeId], {
    cwd: projectRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
});
if (selection.stdout) process.stdout.write(selection.stdout);
if (selection.stderr) process.stderr.write(selection.stderr);
if (selection.error || selection.status !== 0) {
    fail(`主题已导入，但切换失败：${selection.error?.message || '请检查上方错误'}。修复后运行 npm run select -- ${themeId}`);
}

const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
if (!packageJson.scripts[shortcut]) {
    packageJson.scripts[shortcut] = command;
    fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
}
console.log(`以后可直接运行 npm run ${shortcut}`);
