import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
const packageCache = new Map();
function resolveUrl(spec) {
    return `https://esm.sh/${spec}`;
}
function rewriteImports(code) {
    return code.replace(/(from\s+['"])(\/[@\w][^'"]*)(['"])/g, '$1https://esm.sh$2$3');
}
export function createServerLoadPackage() {
    return async (spec) => {
        const cached = packageCache.get(spec);
        if (cached !== undefined)
            return cached;
        const res = await fetch(resolveUrl(spec));
        if (!res.ok) {
            throw new Error(`loadPackage("${spec}"): HTTP ${res.status} — package not found or esm.sh unavailable`);
        }
        const code = await res.text();
        const rewritten = rewriteImports(code);
        const hash = createHash('sha256').update(spec).digest('hex').slice(0, 8);
        const tmpFile = join(tmpdir(), `open-script-pkg-${hash}.mjs`);
        writeFileSync(tmpFile, rewritten);
        try {
            const mod = await import(`file:///${tmpFile.replace(/\\/g, '/')}`);
            packageCache.set(spec, mod);
            return mod;
        }
        finally {
            unlinkSync(tmpFile);
        }
    };
}
//# sourceMappingURL=load-package.js.map