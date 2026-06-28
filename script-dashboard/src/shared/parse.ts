export function parseParams(params: string): Record<string, unknown> {
  try {
    const p = JSON.parse(params || '{}');
    return typeof p === 'object' && p !== null && !Array.isArray(p) ? p : {};
  } catch {
    return {};
  }
}

export function parseMessageBody(body: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(body);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : { message: body };
  } catch {
    return { message: body };
  }
}
