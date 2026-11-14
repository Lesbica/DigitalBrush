// PostToolUse hook: after Claude edits a .js file in src/ or server/, run ESLint on it.
// Exit code 2 reports lint errors back to Claude so it fixes them right away.
// Skips silently if dependencies are not installed (npm run setup).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

let raw = '';
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => {
    let input;
    try { input = JSON.parse(raw); } catch { process.exit(0); }
    const file = (input.tool_input && input.tool_input.file_path) || (input.tool_response && input.tool_response.filePath);
    if (!file) process.exit(0);

    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const rel = path.relative(projectDir, path.resolve(file)).split(path.sep).join('/');
    if (!rel.endsWith('.js') || rel.includes('node_modules/') || !fs.existsSync(path.resolve(file))) process.exit(0);

    const isServer = rel.startsWith('server/');
    if (!isServer && !rel.startsWith('src/')) process.exit(0);

    const bin = path.join(projectDir, 'node_modules', 'eslint', 'bin', 'eslint.js');
    if (!fs.existsSync(bin)) process.exit(0);

    const args = isServer
        ? [bin, '--no-eslintrc', '-c', 'server/.eslintrc.json', rel]
        : [bin, '--max-warnings', '0', rel];
    const r = spawnSync(process.execPath, args, { cwd: projectDir, encoding: 'utf8' });
    if (r.status !== 0) {
        process.stderr.write(`ESLint errors in ${rel}:\n${(r.stdout || r.stderr || '').trim()}\n`);
        process.exit(2);
    }
    process.exit(0);
});
