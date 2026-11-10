// PreToolUse hook: never let Claude edit real env files or stage them in git.
// Allowed: .env.example and .env.development (committed, no secrets).
// Exit code 2 blocks the tool call and shows the message to Claude.
const path = require('path');

const isSecretEnvFile = (p) => {
    const base = path.basename(String(p).replace(/["']/g, ''));
    if (base === '.env') return true;
    return /^\.env\.(local|production|test|.+\.local)$/.test(base);
};

let raw = '';
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => {
    let input;
    try { input = JSON.parse(raw); } catch { process.exit(0); }
    const tool = input.tool_name;
    const ti = input.tool_input || {};

    if (tool === 'Edit' || tool === 'Write' || tool === 'NotebookEdit') {
        if (ti.file_path && isSecretEnvFile(ti.file_path)) {
            process.stderr.write(
                `Blocked: ${ti.file_path} holds secrets and must be changed by the user, not by Claude. ` +
                'Edit server/.env.example for new keys instead.\n'
            );
            process.exit(2);
        }
        process.exit(0);
    }

    if (tool === 'Bash' || tool === 'PowerShell') {
        const cmd = String(ti.command || '');
        // Look at every `git add ...` segment of the command line
        const segments = cmd.split(/&&|\|\||;|\n|\|/);
        for (const seg of segments) {
            const m = /\bgit\s+add\b(.*)$/.exec(seg);
            if (!m) continue;
            const args = m[1].trim().split(/\s+/).filter(Boolean);
            const envArg = args.find((a) => !a.startsWith('-') && isSecretEnvFile(a));
            if (envArg) {
                process.stderr.write(`Blocked: "git add ${envArg}" would commit secrets. Env files stay out of git.\n`);
                process.exit(2);
            }
        }
    }
    process.exit(0);
});
