#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const themesRoot = path.join(projectRoot, 'game-themes');
const backupsRoot = path.join(projectRoot, 'theme-backups');
const inputPath = process.argv[2];
const themeId = process.argv[3];

function fail(message) {
    console.error(`错误：${message}`);
    process.exit(1);
}

function isDirectory(directory) {
    try {
        return fs.statSync(directory).isDirectory();
    } catch {
        return false;
    }
}

function isThemeAsset(fileName) {
    return /\.(png|jpe?g|mp3|wav|ogg|m4a|aac)$/i.test(fileName);
}

function collectAssets(directory, baseDirectory = directory, result = []) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            collectAssets(absolute, baseDirectory, result);
        } else if (entry.isFile() && isThemeAsset(entry.name)) {
            result.push({
                source: absolute,
                relative: path.relative(baseDirectory, absolute),
            });
        }
    }
    return result;
}

function resolveThemeDirectory(inputDirectory) {
    const candidates = [
        path.join(inputDirectory, '主题资源'),
        inputDirectory,
    ];
    const themeFolders = ['audio', 'backgrounds', 'branding', 'effects', 'fonts', 'pieces', 'publishing', 'ui'];
    return candidates.find((candidate) => isDirectory(candidate) && (
        fs.existsSync(path.join(candidate, 'theme.json'))
        || themeFolders.some((folder) => isDirectory(path.join(candidate, folder)))
    )) || null;
}

function formatTimestamp(date) {
    const part = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}${part(date.getMonth() + 1)}${part(date.getDate())}-${part(date.getHours())}${part(date.getMinutes())}${part(date.getSeconds())}`;
}

function sameFile(first, second) {
    if (!fs.existsSync(second)) return false;
    const firstStat = fs.statSync(first);
    const secondStat = fs.statSync(second);
    if (firstStat.size !== secondStat.size) return false;
    return fs.readFileSync(first).equals(fs.readFileSync(second));
}

function runThemeCommand(args) {
    return spawnSync(process.execPath, [path.join(__dirname, 'select-game.js'), ...args], {
        cwd: projectRoot,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
    });
}

if (!inputPath || !themeId || process.argv.length !== 4) {
    fail('用法：npm run theme:update -- "/完整素材目录" <主题ID>');
}

if (!/^[a-z0-9][a-z0-9-]*$/.test(themeId)) {
    fail('主题 ID 只能使用小写字母、数字和短横线');
}

const inputDirectory = path.resolve(inputPath);
if (!isDirectory(inputDirectory)) {
    fail(`素材目录不存在：${inputDirectory}`);
}

const sourceTheme = resolveThemeDirectory(inputDirectory);
if (!sourceTheme) {
    fail('找不到主题资源目录；可以传入包含“主题资源”的交付根目录，或直接传入主题资源目录');
}

const destination = path.join(themesRoot, themeId);
const destinationConfig = path.join(destination, 'theme.json');
if (!fs.existsSync(destinationConfig)) {
    fail(`目标主题不存在或缺少 theme.json：game-themes/${themeId}`);
}

let destinationTheme;
try {
    destinationTheme = JSON.parse(fs.readFileSync(destinationConfig, 'utf8'));
} catch (error) {
    fail(`无法读取 game-themes/${themeId}/theme.json：${error.message}`);
}
if (destinationTheme.id !== themeId) {
    fail(`目标 theme.json 的 id 是“${destinationTheme.id}”，与指定主题“${themeId}”不一致`);
}

if (fs.realpathSync(sourceTheme) === fs.realpathSync(destination)) {
    fail('素材主题目录与工程目标目录相同，无需更新');
}

const assets = collectAssets(sourceTheme);
const sourceConfig = path.join(sourceTheme, 'theme.json');
if (fs.existsSync(sourceConfig)) {
    let sourceThemeConfig;
    try {
        sourceThemeConfig = JSON.parse(fs.readFileSync(sourceConfig, 'utf8'));
    } catch (error) {
        fail(`源 theme.json 读取失败：${error.message}`);
    }
    if (sourceThemeConfig.id === themeId) {
        assets.push({ source: sourceConfig, relative: 'theme.json' });
        console.log('源 theme.json 的主题 ID 匹配，将随资源一起校验并更新');
    } else {
        console.warn(`提醒：源 theme.json 的 id 是“${sourceThemeConfig.id || '未填写'}”，与目标“${themeId}”不一致，已跳过配置文件`);
    }
}
assets.sort((a, b) => a.relative.localeCompare(b.relative));
if (!assets.length) {
    fail(`主题资源目录中没有可更新的图片、音频或匹配的 theme.json：${sourceTheme}`);
}

const changed = assets.filter((asset) => !sameFile(asset.source, path.join(destination, asset.relative)));
console.log(`资源来源：${sourceTheme}`);
console.log(`目标主题：game-themes/${themeId}`);
console.log(`发现资源：${assets.length} 个；需要更新：${changed.length} 个`);

let backup = null;
if (changed.length) {
    const backupName = `${themeId}-update-${formatTimestamp(new Date())}-${process.pid}`;
    backup = path.join(backupsRoot, backupName);
    fs.mkdirSync(backupsRoot, { recursive: true });
    fs.cpSync(destination, backup, { recursive: true });
    console.log(`更新前备份：${path.relative(projectRoot, backup)}`);

    for (const asset of changed) {
        const target = path.join(destination, asset.relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(asset.source, target);
        console.log(`更新资源：${asset.relative}`);
    }
}

const validation = runThemeCommand(['--check', themeId]);
if (validation.error || validation.status !== 0) {
    if (backup) {
        fs.rmSync(destination, { recursive: true, force: true });
        fs.cpSync(backup, destination, { recursive: true });
    }
    const details = validation.error?.message || `${validation.stdout || ''}${validation.stderr || ''}`.trim();
    fail(`主题更新校验失败，${backup ? '已自动恢复更新前主题' : '主题未发生变化'}：\n${details}`);
}
if (validation.stdout) process.stdout.write(validation.stdout);

const selection = runThemeCommand([themeId]);
if (selection.stdout) process.stdout.write(selection.stdout);
if (selection.stderr) process.stderr.write(selection.stderr);
if (selection.error || selection.status !== 0) {
    fail(`主题资源已更新并通过校验，但主题切换失败：${selection.error?.message || '请检查上方错误'}。修复后运行 npm run select -- ${themeId}`);
}

console.log(changed.length
    ? `完成：已更新 ${changed.length} 个主题资源；备份保存在 ${path.relative(projectRoot, backup)}`
    : '完成：主题资源没有变化；主题已重新校验并切换');
