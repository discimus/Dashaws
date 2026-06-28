export function maskValue(val, secrets) {
    if (typeof val === 'string') {
        let result = val;
        for (const secret of secrets) {
            if (secret.length > 0) {
                while (result.includes(secret)) {
                    result = result.replace(secret, '\u2022'.repeat(6));
                }
            }
        }
        return result;
    }
    if (Array.isArray(val)) {
        return val.map(v => maskValue(v, secrets));
    }
    if (val !== null && typeof val === 'object') {
        const masked = {};
        for (const [k, v] of Object.entries(val)) {
            masked[k] = maskValue(v, secrets);
        }
        return masked;
    }
    return val;
}
export function maskState(state, secrets) {
    if (secrets.size === 0)
        return state;
    const masked = {};
    for (const [k, v] of Object.entries(state)) {
        masked[k] = maskValue(v, secrets);
    }
    return masked;
}
export function maskArgs(args, secrets) {
    if (secrets.size === 0)
        return args;
    return args.map(a => maskValue(a, secrets));
}
//# sourceMappingURL=mask.js.map