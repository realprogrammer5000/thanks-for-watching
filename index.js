const { spawn } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const format = (str, obj) => str.replace(/{([\da-zA-Z_-]+)}/g, (match, key) => typeof obj[key] !== 'undefined' ? obj[key] : match);

const getTmpFilePrefix = () => path.join(os.tmpdir(), crypto.randomBytes(16).toString('hex'));

const writeMLTFile = async (title) => {
    const string = (await fs.readFile(path.join(__dirname, 'assets', 'project.template.mlt'))).toString();
    // https://en.wikipedia.org/wiki/Symlink_race
    // should be secure enough
    const renderedVideoPath = getTmpFilePrefix() + '.mp4';
    const outputFileText = format(string, {title, outFile: renderedVideoPath, basePath: path.join(__dirname, 'assets')});
    const mltFilePath = getTmpFilePrefix() + '.mlt';
    await fs.writeFile(mltFilePath, outputFileText);
    return {mltFilePath, renderedVideoPath};
};

const meltIt = path => new Promise(resolve => {
    spawn('melt', [path]).on('close', () => resolve())
});

const combineClips = (introPath) => new Promise(resolve => {
    const outPath = getTmpFilePrefix() + '.mp4';
    ffmpeg(introPath).input(path.join(__dirname, 'assets', 'endscreen.mp4')).on('end', () => resolve(outPath)).on('progress', function(progress) {
        console.log('Processing: ' + progress.percent + '% done');
    }).mergeToFile(outPath, os.tmpdir())
});

(async () => {
    console.log('writing mlt file');
    const {mltFilePath, renderedVideoPath} = await writeMLTFile(process.argv[2]);
    console.log('melting');
    await meltIt(mltFilePath);
    await fs.unlink(mltFilePath);
    console.log('combining');
    const outPath = await combineClips(renderedVideoPath);
    console.log('unlinking');
    await fs.unlink(renderedVideoPath);
    console.log(outPath);
})();
