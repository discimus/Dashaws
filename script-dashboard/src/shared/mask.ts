export function maskValue(val: unknown, secrets: Set<string>, seen = new WeakSet<object>()): unknown {
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
    if (seen.has(val)) return '[Circular]';
    seen.add(val);
    return val.map(v => maskValue(v, secrets, seen));
  }

  if (val !== null && typeof val === 'object') {
    if (seen.has(val as object)) return '[Circular]';
    seen.add(val as object);
    const masked: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      masked[k] = maskValue(v, secrets, seen);
    }
    return masked;
  }

  return val;
}

export function maskState(
  state: Record<string, unknown>,
  secrets: Set<string>
): Record<string, unknown> {
  if (secrets.size === 0) return state;
  const masked: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(state)) {
    masked[k] = maskValue(v, secrets);
  }
  return masked;
}

export function maskArgs(args: unknown[], secrets: Set<string>): unknown[] {
  if (secrets.size === 0) return args;
  return args.map(a => maskValue(a, secrets));
}
