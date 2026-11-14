// Every literal t('section.key') in the code must exist in both languages,
// otherwise the page shows the raw key instead of text.
import fs from 'node:fs';
import path from 'node:path';
import uk from './locales/uk.json';
import en from './locales/en.json';

const SRC = path.resolve(__dirname, '..');

function sourceFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(full);
        return /\.jsx?$/.test(entry.name) && !/\.test\.jsx?$/.test(entry.name) ? [full] : [];
    });
}

// i18next plural keys: "count_one", "count_other"… satisfy "count"
const has = (dict, key) => {
    const parts = key.split('.');
    const last = parts.pop();
    let node = dict;
    for (const p of parts) {
        node = node?.[p];
        if (!node || typeof node !== 'object') return false;
    }
    return typeof node[last] === 'string' || Object.keys(node).some((k) => k.startsWith(`${last}_`));
};

const usedKeys = () => {
    const keys = new Map();
    for (const file of sourceFiles(SRC)) {
        const text = fs.readFileSync(file, 'utf8');
        for (const [, key] of text.matchAll(/\bt\(\s*['"]([a-zA-Z][\w-]*\.[\w.-]+)['"]/g)) {
            if (!keys.has(key)) keys.set(key, path.relative(SRC, file));
        }
    }
    return keys;
};

test('the scan finds the keys the pages use', () => {
    const keys = usedKeys();
    expect(keys.size).toBeGreaterThan(100);
    expect(keys.has('nav.createTitle')).toBe(true);
    expect(keys.has('home.heroTitleStart')).toBe(true);
});

test.each([['en', en], ['uk', uk]])('every key used in the code exists in %s', (_, dict) => {
    const missing = [...usedKeys()].filter(([key]) => !has(dict, key)).map(([key, file]) => `${key} (${file})`);
    expect(missing).toEqual([]);
});
