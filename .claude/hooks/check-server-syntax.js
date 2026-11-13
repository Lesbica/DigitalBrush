// PostToolUse hook: after Claude edits a backend file, run `node --check` on it.
// Exit code 2 reports the syntax error back to Claude so it fixes it right away.
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
    if (!rel.startsWith('server/') || !rel.endsWith('.js') || rel.includes('node_modules/')) process.exit(0);

    const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (r.status !== 0) {
        process.stderr.write(`Syntax error in ${rel} (node --check):\n${(r.stderr || r.stdout || '').trim()}\n`);
        process.exit(2);
    }
    process.exit(0);
});
