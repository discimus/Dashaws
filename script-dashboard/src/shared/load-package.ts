export const packageCache = new Map<string, Record<string, unknown>>();

export function clearPackageCache(): void {
  packageCache.clear();
}

export function resolveUrl(spec: string): string {
  return `https://esm.sh/${spec}`;
}

type ImportFn = (url: string) => Promise<Record<string, unknown>>;

export function createLoadPackage(
  importFn: ImportFn = (url: string) => import(url) as Promise<Record<string, unknown>>
): (spec: string) => Promise<Record<string, unknown>> {
  return async (spec: string): Promise<Record<string, unknown>> => {
    const cached = packageCache.get(spec);
    if (cached !== undefined) return cached;

    const esmUrl = resolveUrl(spec);

    try {
      const mod = await importFn(esmUrl);
      packageCache.set(spec, mod);
      return mod;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`loadPackage("${spec}"): ${msg}`);
    }
  };
}
