#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { optimizeFiles } = require('./optimize-theme');

const projectRoot = path.resolve(__dirname, '..');
const themesRoot = path.join(projectRoot, 'game-themes');
const slotsPath = path.join(__dirname, 'theme-slots.json');
const baseThemeId = 'fruit';
const brandSourcePath = path.join(projectRoot, 'assets/scripts/shared/gameBrand.ts');
const platformFiles = {
    wechatgame: {
        template: 'build-templates/wechatgame/project.config.json',
        profile: 'profiles/v2/packages/wechatgame.json',
    },
    'bytedance-mini-game': {
        template: 'build-templates/bytedance-mini-game/project.config.json',
        profile: 'profiles/v2/packages/bytedance-mini-game.json',
    },
};

function fail(message) {
    console.error(`\n错误：${message}`);
    process.exit(1);
}

function readJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        fail(`无法读取 JSON：${path.relative(projectRoot, filePath)}\n${error.message}`);
    }
}

function getImageSize(filePath) {
    const data = fs.readFileSync(filePath);

    if (data.length >= 24 && data.toString('ascii', 1, 4) === 'PNG') {
        return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
    }

    if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8) {
        let offset = 2;
        while (offset + 8 < data.length) {
            if (data[offset] !== 0xff) {
                offset++;
                continue;
            }

            const marker = data[offset + 1];
            if (marker === 0xd8 || marker === 0xd9) {
                offset += 2;
                continue;
            }

            const segmentLength = data.readUInt16BE(offset + 2);
            const isStartOfFrame = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
            if (isStartOfFrame) {
                return { width: data.readUInt16BE(offset + 7), height: data.readUInt16BE(offset + 5) };
            }
            offset += 2 + segmentLength;
        }
    }

    throw new Error('只支持 PNG 和 JPEG 图片');
}

function getTheme(themeId) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(themeId)) {
        fail(`主题 ID “${themeId}”不合法，只能使用小写字母、数字和短横线`);
    }

    const directory = path.join(themesRoot, themeId);
    const configPath = path.join(directory, 'theme.json');
    if (!fs.existsSync(configPath)) {
        fail(`主题不存在：game-themes/${themeId}`);
    }

    const config = readJson(configPath);
    if (config.id !== themeId) {
        fail(`${themeId}/theme.json 中的 id 必须是 “${themeId}”`);
    }
    if (!config.gameId || !/^[a-z0-9][a-z0-9-]*$/.test(config.gameId)) {
        fail(`${themeId}/theme.json 需要合法的 gameId`);
    }
    if (!Number.isInteger(config.pieceCount) || config.pieceCount < 8 || config.pieceCount > 999) {
        fail(`${themeId}/theme.json 的 pieceCount 必须是 8～999 的整数（随机关卡至少使用 8 种）`);
    }
    if (typeof config.pieceName !== 'string' || !config.pieceName.trim() || config.pieceName.length > 10) {
        fail(`${themeId}/theme.json 的 pieceName 必须是 1～10 字的显示称呼，例如“水果”或“萌宠图案”`);
    }
    if (!config.displayName || !config.shareTitle || !config.projectName) {
        fail(`${themeId}/theme.json 需要 displayName、shareTitle 和 projectName`);
    }
    for (const platform of Object.keys(platformFiles)) {
        const appId = config.platforms?.[platform]?.appId;
        if (appId !== null && (typeof appId !== 'string' || !appId.trim())) {
            fail(`${themeId}/theme.json 中 ${platform}.appId 必须是字符串或 null`);
        }
    }
    return { id: themeId, directory, config };
}

function validateUniqueIdentity(theme) {
    for (const entry of fs.readdirSync(themesRoot, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name === theme.id) continue;
        const otherConfigPath = path.join(themesRoot, entry.name, 'theme.json');
        if (!fs.existsSync(otherConfigPath)) continue;
        const other = readJson(otherConfigPath);
        if (theme.config.gameId === other.gameId) {
            fail(`${theme.id} 与 ${entry.name} 使用了相同 gameId “${theme.config.gameId}”，会混用游戏存档`);
        }
        for (const platform of Object.keys(platformFiles)) {
            const appId = theme.config.platforms[platform].appId;
            if (appId && appId === other.platforms?.[platform]?.appId) {
                fail(`${theme.id} 与 ${entry.name} 使用了相同的 ${platform} AppID “${appId}”`);
            }
        }
    }
}

function validateTheme(theme, slots, requireAll) {
    const files = [];
    const errors = [];
    const registeredFiles = new Set(slots.map((slot) => slot.file));

    for (const slot of slots) {
        const source = path.join(theme.directory, slot.file);
        if (!fs.existsSync(source)) {
            if (requireAll) {
                errors.push(`缺少基础资源：${slot.file}`);
            }
            continue;
        }

        try {
            if (slot.width !== undefined && slot.height !== undefined) {
                const size = getImageSize(source);
                if (size.width !== slot.width || size.height !== slot.height) {
                    errors.push(`${slot.file} 尺寸为 ${size.width}x${size.height}，标准要求 ${slot.width}x${slot.height}`);
                    continue;
                }
            } else if (fs.statSync(source).size === 0) {
                errors.push(`${slot.file} 是空文件`);
                continue;
            }
            files.push({ ...slot, source });
        } catch (error) {
            errors.push(`${slot.file}：${error.message}`);
        }
    }

    // cake12 及以上由主题按数量提供，未来增加 cake33 等无需修改路径映射表。
    const extraPieceNames = new Set();
    const piecesDirectory = path.join(theme.directory, 'pieces');
    if (fs.existsSync(piecesDirectory)) {
        for (const name of fs.readdirSync(piecesDirectory)) {
            const match = /^cake([0-9]{2,})(Light)?\.png$/.exec(name);
            if (!match || Number(match[1]) < 12 || registeredFiles.has(`pieces/${name}`)) continue;
            const number = Number(match[1]);
            if (String(number).padStart(2, '0') !== match[1]) {
                errors.push(`棋子编号格式不正确：pieces/${name}`);
                continue;
            }
            const relative = `pieces/${name}`;
            const source = path.join(piecesDirectory, name);
            const width = match[2] ? 100 : 86;
            const height = width;
            const size = getImageSize(source);
            if (size.width !== width || size.height !== height) {
                errors.push(`${relative} 尺寸为 ${size.width}x${size.height}，标准要求 ${width}x${height}`);
                continue;
            }
            extraPieceNames.add(name);
            files.push({ file: relative, target: `assets/resources/gamePackages/textures/icons/cakes/${name}`, source, width, height, extra: true });
        }
    }

    const availablePieceNumbers = [...extraPieceNames].map((name) => Number(/^cake([0-9]+)/.exec(name)[1]));
    const highestPieceNumber = Math.max(11, ...availablePieceNumbers);
    for (let number = 12; number <= highestPieceNumber; number++) {
        const prefix = `cake${String(number).padStart(2, '0')}`;
        if (!extraPieceNames.has(`${prefix}.png`) || !extraPieceNames.has(`${prefix}Light.png`)) {
            errors.push(`pieces/${prefix}.png 和 ${prefix}Light.png 必须成对、连续提供`);
        }
    }
    if (theme.config.pieceCount > highestPieceNumber) {
        errors.push(`pieceCount=${theme.config.pieceCount} 超出已提供的棋子编号 ${highestPieceNumber}`);
    }

    const allowed = new Set(['theme.json', 'branding/.gitkeep', ...registeredFiles, ...[...extraPieceNames].map((name) => `pieces/${name}`), 'publishing/icon-512.png']);
    for (const folder of fs.readdirSync(theme.directory, { withFileTypes: true })) {
        if (folder.name === '.DS_Store') continue;
        if (folder.isFile() && !allowed.has(folder.name)) {
            errors.push(`未登记的文件：${folder.name}`);
        }
        if (!folder.isDirectory()) continue;
        const folderPath = path.join(theme.directory, folder.name);
        for (const entry of fs.readdirSync(folderPath, { withFileTypes: true })) {
            if (entry.name === '.DS_Store') continue;
            const relative = `${folder.name}/${entry.name}`;
            const publishingImage = folder.name === 'publishing' && /\.(png|jpe?g)$/i.test(entry.name);
            if (!entry.isFile() || (!allowed.has(relative) && !publishingImage)) {
                errors.push(`未登记的文件或目录：${relative}`);
            }
        }
    }

    const icon = path.join(theme.directory, 'publishing/icon-512.png');
    if (fs.existsSync(icon)) {
        const size = getImageSize(icon);
        if (size.width !== 512 || size.height !== 512) {
            errors.push('publishing/icon-512.png 必须是 512x512');
        }
    }

    if (errors.length) {
        console.error(`\n主题 “${theme.id}”校验失败：`);
        for (const error of errors) {
            console.error(`- ${error}`);
        }
        process.exit(1);
    }

    return files;
}

function outputNameFor(themeId, platform) {
    return `${themeId}-${platform}`;
}

function updatePlatformConfig(filePath, platform, appId, displayName, gameId) {
    if (!fs.existsSync(filePath)) return;
    const document = readJson(filePath);
    if (filePath.includes('project.config.json')) {
        document.appid = appId || '';
        document.projectname = displayName;
    } else {
        const builder = document.builder || {};
        for (const options of Object.values(builder.taskOptionsMap || {})) {
            if (Object.hasOwn(options, 'appid')) options.appid = appId || '';
        }
        if (builder.options?.[platform]) builder.options[platform].appid = appId || '';
        if (builder.common && platform === 'wechatgame') builder.common.name = gameId;
    }
    writeTextIfChanged(filePath, `${JSON.stringify(document, null, 2)}\n`);
}

function writeTextIfChanged(filePath, content) {
    if (!fs.existsSync(filePath) || fs.readFileSync(filePath, 'utf8') !== content) {
        fs.writeFileSync(filePath, content);
    }
}

function updateGameIdentity(theme) {
    const { gameId, displayName, shareTitle, projectName, pieceCount, pieceName, platforms } = theme.config;
    const brandSource = [
        '// 由 npm run select:<主题> 根据 game-themes/<主题>/theme.json 更新。',
        'export const gameBrand: { id: string; displayName: string; shareTitle: string; pieceCount: number; pieceName: string } = {',
        `    id: ${JSON.stringify(gameId)},`,
        `    displayName: ${JSON.stringify(displayName)},`,
        `    shareTitle: ${JSON.stringify(shareTitle)},`,
        `    pieceCount: ${pieceCount},`,
        `    pieceName: ${JSON.stringify(pieceName.trim())},`,
        '};',
        '',
    ].join('\n');
    writeTextIfChanged(brandSourcePath, brandSource);

    const packagePath = path.join(projectRoot, 'package.json');
    const packageJson = readJson(packagePath);
    packageJson.name = projectName;
    writeTextIfChanged(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

    for (const [platform, paths] of Object.entries(platformFiles)) {
        const appId = platforms[platform].appId;
        updatePlatformConfig(path.join(projectRoot, paths.template), platform, appId, displayName, gameId);
        updatePlatformConfig(path.join(projectRoot, paths.profile), platform, appId, displayName, gameId);
    }
}

function copyIfChanged(source, destination) {
    const newContent = fs.readFileSync(source);
    if (fs.existsSync(destination) && fs.readFileSync(destination).equals(newContent)) {
        return false;
    }
    fs.writeFileSync(destination, newContent);
    return true;
}

function sha256(filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function syncExtraPieces(theme, extraFiles, stateDirectory) {
    const statePath = path.join(stateDirectory, 'selected-theme.json');
    const previousState = fs.existsSync(statePath) ? readJson(statePath) : {};
    const previous = new Map((previousState.extraPieces || []).map((file) => [file.target, file]));
    const desired = new Map(extraFiles.map((file) => [file.target, file]));

    // 只管理脚本上次创建且内容未被手动改动的附加棋子。
    for (const [target, file] of previous) {
        const destination = path.join(projectRoot, target);
        if (!fs.existsSync(destination) || sha256(destination) !== file.sha256) {
            fail(`附加棋子已被手动修改或移走：${target}。请先将修改保存到主题目录。`);
        }
    }
    for (const target of desired.keys()) {
        if (!previous.has(target) && fs.existsSync(path.join(projectRoot, target))) {
            fail(`附加棋子目标已存在，未覆盖：${target}`);
        }
    }

    const metadataCache = path.join(stateDirectory, 'theme-meta');
    for (const [target] of previous) {
        if (desired.has(target)) continue;
        const destination = path.join(projectRoot, target);
        const metaPath = `${destination}.meta`;
        if (fs.existsSync(metaPath)) {
            const cachePath = path.join(metadataCache, previousState.id, `${path.basename(target)}.meta`);
            fs.mkdirSync(path.dirname(cachePath), { recursive: true });
            fs.copyFileSync(metaPath, cachePath);
            fs.unlinkSync(metaPath);
        }
        fs.unlinkSync(destination);
    }

    let updated = 0;
    for (const [target, file] of desired) {
        const destination = path.join(projectRoot, target);
        const existed = fs.existsSync(destination);
        if (copyIfChanged(file.source, destination)) updated++;
        if (!existed) {
            const cachePath = path.join(metadataCache, theme.id, `${path.basename(target)}.meta`);
            if (fs.existsSync(cachePath)) fs.copyFileSync(cachePath, `${destination}.meta`);
        }
    }
    return {
        updated,
        state: extraFiles.map((file) => ({ target: file.target, sha256: sha256(file.source) })),
    };
}

function listThemes() {
    if (!fs.existsSync(themesRoot)) {
        return;
    }
    const ids = fs.readdirSync(themesRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(themesRoot, entry.name, 'theme.json')))
        .map((entry) => entry.name)
        .sort();

    console.log('可用主题：');
    for (const id of ids) {
        const theme = getTheme(id);
        console.log(`- ${id}: ${theme.config.displayName || id}`);
    }
}

const args = process.argv.slice(2);
if (args.includes('--list')) {
    listThemes();
    process.exit(0);
}

const checkOnly = args.includes('--check');
const themeId = args.find((arg) => !arg.startsWith('--'));
if (!themeId) {
    console.log('用法：');
    console.log('  npm run select:fruit');
    console.log('  npm run select:pet');
    console.log('  npm run select -- <主题ID>');
    console.log('  npm run theme:validate -- <主题ID>');
    process.exit(checkOnly ? 1 : 0);
}

const slots = readJson(slotsPath);
if (new Set(slots.map((slot) => slot.file)).size !== slots.length ||
    new Set(slots.map((slot) => slot.target)).size !== slots.length) {
    fail('theme-slots.json 存在重复的交付文件名或目标路径');
}
const baseTheme = getTheme(baseThemeId);
const selectedTheme = getTheme(themeId);
validateUniqueIdentity(selectedTheme);
const baseFiles = validateTheme(baseTheme, slots, true);
const selectedFiles = themeId === baseThemeId ? [] : validateTheme(selectedTheme, slots, false);
const extraFiles = selectedFiles.filter((file) => file.extra);
const regularFiles = selectedFiles.filter((file) => !file.extra);
const selectedByTarget = new Map(regularFiles.map((file) => [file.target, file]));
const selectedMediaFiles = baseFiles.map((baseFile) => selectedByTarget.get(baseFile.target) || baseFile).concat(extraFiles);
const sourceMediaBytes = selectedMediaFiles.reduce((bytes, file) => bytes + fs.statSync(file.source).size, 0);

for (const slot of slots) {
    const target = path.join(projectRoot, slot.target);
    if (!fs.existsSync(target)) {
        fail(`Cocos 目标资源不存在：${slot.target}`);
    }
    if (slot.target.startsWith('assets/') && !fs.existsSync(`${target}.meta`)) {
        fail(`Cocos 目标资源缺少 .meta：${slot.target}.meta`);
    }
}

if (checkOnly) {
    console.log(`主题校验通过：${selectedTheme.config.displayName || themeId}`);
    console.log(`基础资源 ${baseFiles.length} 个，主题覆盖 ${themeId === baseThemeId ? baseFiles.length : regularFiles.length} 个，附加棋子 ${extraFiles.length} 张`);
    console.log(`所选图片/音频原图合计 ${(sourceMediaBytes / 1024 / 1024).toFixed(2)} MiB（不含引擎和代码；实际同步时会自动压缩）`);
    process.exit(0);
}

// 在临时目录压缩本次真正会同步的图片，主题目录里的原图保持不变。
const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'game-select-'));
let updatedFiles = 0;
let optimizedResult;
let selectedMediaBytes;
try {
    const images = [...new Set(selectedMediaFiles.map((file) => file.source).filter((source) => /\.(png|jpe?g)$/i.test(source)))];
    optimizedResult = optimizeFiles(images, tempDirectory, true);
    const selectedSource = (file) => optimizedResult.optimizedSources.get(file.source) || file.source;
    selectedMediaBytes = selectedMediaFiles.reduce((bytes, file) => bytes + fs.statSync(selectedSource(file)).size, 0);

    // 对每个槽位从当前主题选资源；缺少的槽位回退到水果主题。
    const stateDirectory = path.join(projectRoot, 'temp');
    fs.mkdirSync(stateDirectory, { recursive: true });
    const extraResult = syncExtraPieces(selectedTheme,
        extraFiles.map((file) => ({ ...file, source: selectedSource(file) })), stateDirectory);
    updatedFiles += extraResult.updated;
    for (const file of selectedMediaFiles.slice(0, baseFiles.length)) {
        if (copyIfChanged(selectedSource(file), path.join(projectRoot, file.target))) updatedFiles++;
    }
    updateGameIdentity(selectedTheme);

    fs.writeFileSync(path.join(stateDirectory, 'selected-theme.json'), `${JSON.stringify({
        id: selectedTheme.id,
        displayName: selectedTheme.config.displayName || selectedTheme.id,
        selectedAt: new Date().toISOString(),
        overriddenFiles: selectedFiles.length,
        extraPieces: extraResult.state,
    }, null, 2)}\n`);
} finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
}

console.log(`主题已切换为：${selectedTheme.config.displayName || themeId}`);
console.log(`图片自动压缩 ${optimizedResult.optimizedFiles.length} 张；原图/音频 ${(sourceMediaBytes / 1024 / 1024).toFixed(2)} MiB，同步到工程后 ${(selectedMediaBytes / 1024 / 1024).toFixed(2)} MiB`);
console.log(`已检查 ${baseFiles.length} 个基础槽位；主题覆盖 ${regularFiles.length} 个，另有 ${extraFiles.length} 张附加棋子，实际更新 ${updatedFiles} 个文件`);
console.log(`建议在 Cocos Build Path 右侧填写输出名：${Object.keys(platformFiles).map((platform) => outputNameFor(themeId, platform)).join('、')}（默认位于 build/）`);
console.log('最终包体以 Cocos 构建结果为准。');
for (const [platform, config] of Object.entries(selectedTheme.config.platforms)) {
    if (!config.appId) console.warn(`提醒：${platform} AppID 尚未填写，正式构建前请填写 ${themeId}/theme.json`);
}
for (const brandFile of ['branding/logo.png', 'branding/logo-en.png', 'branding/editor-splash.png', 'branding/login-bg.jpg']) {
    if (themeId !== baseThemeId && !selectedFiles.some((file) => file.file === brandFile)) {
        console.warn(`提醒：${brandFile} 尚未提供，当前使用基础主题素材`);
    }
}
console.log('现在可以打开 Cocos Creator，等待资源导入完成后预览或构建。');
