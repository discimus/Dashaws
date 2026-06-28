export function cronMatches(expression, date) {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5)
        return false;
    const fields = [
        { value: date.getMinutes(), min: 0, max: 59 },
        { value: date.getHours(), min: 0, max: 23 },
        { value: date.getDate(), min: 1, max: 31 },
        { value: date.getMonth() + 1, min: 1, max: 12 },
        { value: date.getDay(), min: 0, max: 6 },
    ];
    for (let i = 0; i < 5; i++) {
        if (!fieldMatches(parts[i], fields[i]))
            return false;
    }
    return true;
}
function fieldMatches(expr, field) {
    if (expr === '*')
        return true;
    const parts = expr.split(',');
    for (const part of parts) {
        if (part === '*')
            return true;
        if (part.includes('/')) {
            const [range, stepStr] = part.split('/');
            const step = parseInt(stepStr, 10);
            if (isNaN(step) || step < 1)
                continue;
            let rangeMin = field.min;
            let rangeMax = field.max;
            if (range !== '*') {
                if (range.includes('-')) {
                    const [a, b] = range.split('-');
                    rangeMin = parseInt(a, 10);
                    rangeMax = parseInt(b, 10);
                }
                else {
                    rangeMin = parseInt(range, 10);
                }
            }
            if (isNaN(rangeMin) || isNaN(rangeMax))
                continue;
            for (let v = rangeMin; v <= rangeMax; v += step) {
                if (v === field.value)
                    return true;
            }
            continue;
        }
        if (part.includes('-')) {
            const [a, b] = part.split('-');
            const lo = parseInt(a, 10);
            const hi = parseInt(b, 10);
            if (isNaN(lo) || isNaN(hi))
                continue;
            if (field.value >= lo && field.value <= hi)
                return true;
            continue;
        }
        const num = parseInt(part, 10);
        if (!isNaN(num) && num === field.value)
            return true;
    }
    return false;
}
export function cronNextRun(expression, from = new Date()) {
    if (!cronMatches(expression, from)) {
        // Already matches now, return now
    }
    const next = new Date(from.getTime() + 60000);
    next.setSeconds(0, 0);
    for (let i = 0; i < 525600; i++) {
        if (cronMatches(expression, next))
            return next;
        next.setTime(next.getTime() + 60000);
    }
    return null;
}
export function cronDescribe(expression) {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5)
        return 'Invalid expression';
    const [min, hour, dom, month, dow] = parts;
    if (min === '*' && hour === '*' && dom === '*' && month === '*' && dow === '*')
        return 'Every minute';
    if (min.startsWith('*/') && hour === '*' && dom === '*' && month === '*' && dow === '*') {
        const n = min.slice(2);
        return `Every ${n} minute${n !== '1' ? 's' : ''}`;
    }
    if (hour === '*' && dom === '*' && month === '*' && dow === '*')
        return `Minute ${min}`;
    const parts_desc = [];
    if (min !== '*' && min !== '0')
        parts_desc.push(`at minute ${min}`);
    if (hour !== '*')
        parts_desc.push(`at ${hour}:00`);
    if (dom !== '*')
        parts_desc.push(`day ${dom}`);
    if (month !== '*')
        parts_desc.push(`month ${month}`);
    if (dow !== '*') {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        parts_desc.push(`on ${days[parseInt(dow, 10)] || dow}`);
    }
    return parts_desc.join(' ') || expression;
}
//# sourceMappingURL=cron.js.map