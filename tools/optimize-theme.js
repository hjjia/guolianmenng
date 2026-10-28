#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

function run(command, args, maxBuffer = 128 * 1024 * 1024, input) {
    const result = spawnSync(command, args, { encoding: null, maxBuffer, input });
    if (result.error || result.status !== 0) {
        throw new Error(`${command} 执行失败：${result.error?.message || result.stderr.toString('utf8')}`);
    }
    return result.stdout;
}

function decodedPixels(file) {
    return run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']);
}

function imageError(original, candidate) {
    const before = decodedPixels(original);
    const after = decodedPixels(candidate);
    if (before.length !== after.length) return null;

    let alphaError = 0;
    let visibleError = 0;
    let severeAlphaChanges = 0;
    const pixelCount = before.length / 4;
    for (let offset = 0; offset < before.length; offset += 4) {
        const beforeAlpha = before[offset + 3];
        const afterAlpha = after[offset + 3];
        const difference = Math.abs(beforeAlpha - afterAlpha);
        alphaError += difference;
        if (difference > 16) severeAlphaChanges++;
        for (let channel = 0; channel < 3; channel++) {
            // 比较实际合成到画面上的颜色，忽略全透明区域无意义的 RGB 数据。
            visibleError += Math.abs(before[offset + channel] * beforeAlpha - after[offset + channel] * afterAlpha) / 255;
        }
    }
    return {
        alphaMae: alphaError / pixelCount,
        visibleMae: visibleError / (pixelCount * 3),
        severeAlphaFraction: severeAlphaChanges / pixelCount,
    };
}

function quantizePngColors(file, candidate) {
    const header = fs.readFileSync(file);
    const width = header.readUInt32BE(16);
    const height = header.readUInt32BE(20);
    const pixels = decodedPixels(file);
    if (pixels.length !== width * height * 4) {
        throw new Error(`PNG 像素尺寸不匹配：${path.relative(root, file)}`);
    }

    // 保留全部 8 位透明度，只把 RGB 调整到相邻的 4 级色值；全透明像素清除不可见颜色。
    for (let offset = 0; offset < pixels.length; offset += 4) {
        for (let channel = 0; channel < 3; channel++) {
            pixels[offset + channel] = pixels[offset + 3] === 0
                ? 0
                : Math.min(255, Math.round(pixels[offset + channel] / 4) * 4);
        }
    }
    run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba',
        '-s', `${width}x${height}`, '-i', 'pipe:0', '-frames:v', '1',
        '-compression_level', '9', '-pred', 'mixed', candidate], 128 * 1024 * 1024, pixels);
}

function optimizeFiles(files, tempDirectory, balanced = true) {
    const optimizedSources = new Map();
    let originalBytes = 0;
    let savedBytes = 0;
    const optimizedFiles = [];
    for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const originalSize = fs.statSync(file).size;
        originalBytes += originalSize;
        if (originalSize < (balanced ? 50 : 128) * 1024) continue;

        const isPng = file.toLowerCase().endsWith('.png');
        const candidate = path.join(tempDirectory, `candidate-${index}${isPng ? '.png' : '.jpg'}`);
        const candidates = [candidate];
        if (isPng) {
            if (balanced) {
                run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file,
                    '-filter_complex', 'split[a][b];[a]palettegen=max_colors=256:reserve_transparent=1:transparency_color=000000[p];[b][p]paletteuse=dither=bayer:bayer_scale=5',
                    '-frames:v', '1', '-compression_level', '9', candidate]);
                const rgbaCandidate = path.join(tempDirectory, `candidate-${index}-rgba4.png`);
                quantizePngColors(file, rgbaCandidate);
                candidates.push(rgbaCandidate);
            } else {
                run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-frames:v', '1', '-compression_level', '9', '-pred', 'mixed', candidate]);
            }
        } else {
            if (balanced) {
                run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-frames:v', '1', '-q:v', '4', candidate]);
            } else {
                run('jpegtran', ['-optimize', '-copy', 'none', '-outfile', candidate, file]);
            }
        }

        let bestCandidate;
        let bestSize = originalSize;
        for (const current of candidates) {
            const size = fs.statSync(current).size;
            if (size >= bestSize) continue;
            if (balanced) {
                if (size > originalSize * 0.85) continue;
                const error = imageError(file, current);
                if (!error || error.visibleMae > 2.5 || error.alphaMae > 1 || error.severeAlphaFraction > 0.01) continue;
            } else if (isPng && !decodedPixels(file).equals(decodedPixels(current))) {
                throw new Error(`PNG 像素校验失败，原文件未更改：${path.relative(root, file)}`);
            }
            bestCandidate = current;
            bestSize = size;
        }

        if (!bestCandidate) continue;

        // 压缩结果只放临时目录。主题目录始终保留交付原图。
        optimizedSources.set(file, bestCandidate);
        savedBytes += originalSize - bestSize;
        optimizedFiles.push({ file, savedBytes: originalSize - bestSize });
    }
    return { optimizedSources, originalBytes, savedBytes, optimizedFiles };
}

module.exports = { optimizeFiles };

if (require.main === module) {
    const [themeId, ...options] = process.argv.slice(2);
    const balanced = options.includes('--balanced');
    if (!themeId || !/^[a-z0-9][a-z0-9-]*$/.test(themeId) || options.some((option) => option !== '--balanced')) {
        console.error('用法：npm run theme:optimize -- <主题ID> [--balanced]（只预估，不修改主题）');
        process.exit(1);
    }

    const themeDirectory = path.join(root, 'game-themes', themeId);
    if (!fs.existsSync(path.join(themeDirectory, 'theme.json'))) {
        console.error(`找不到主题：${themeId}`);
        process.exit(1);
    }
    const files = fs.readdirSync(themeDirectory, { withFileTypes: true }).flatMap((folder) => {
        if (!folder.isDirectory()) return [];
        const directory = path.join(themeDirectory, folder.name);
        return fs.readdirSync(directory, { withFileTypes: true })
            .filter((entry) => entry.isFile() && /\.(png|jpe?g)$/i.test(entry.name))
            .map((entry) => path.join(directory, entry.name));
    });
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'game-theme-opt-'));
    try {
        const result = optimizeFiles(files, tempDirectory, balanced);
        console.log(`${themeId}：检查 ${files.length} 张图片，预计优化 ${result.optimizedFiles.length} 张，节省 ${(result.savedBytes / 1024).toFixed(1)} KiB`);
        console.log('这是只读预估；执行 npm run select:<主题> 时会压缩并同步到 Cocos 目标目录。');
    } finally {
        fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
}
