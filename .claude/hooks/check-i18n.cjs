// PostToolUse hook: after Claude edits frontend translations (src/i18n/), run the Vitest i18n test
// that checks uk.json and en.json have the same keys. Exit code 2 reports failures back to Claude.
// (Server texts are covered by `npm run test:api`, which needs the local DB, so they are not run here.)
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
    if (!rel.startsWith('src/i18n/')) process.exit(0);

    const bin = path.join(projectDir, 'node_modules', 'vitest', 'vitest.mjs');
    if (!fs.existsSync(bin)) process.exit(0);

    const r = spawnSync(process.execPath, [bin, 'run', 'src/i18n/i18n.test.js'], { cwd: projectDir, encoding: 'utf8' });
    if (r.status !== 0) {
        process.stderr.write(`i18n test failed after editing ${rel}:\n${(r.stdout + r.stderr).trim().slice(-3000)}\n`);
        process.exit(2);
    }
    process.exit(0);
});
