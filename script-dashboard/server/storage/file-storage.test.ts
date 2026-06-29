import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { Cell } from '../../src/types/cell.js';

// The module uses process.env.DASHAWS_DATA_DIR — set it before import
const tmpDir = mkdtempSync(join(tmpdir(), 'dashaws-test-'));
process.env.DASHAWS_DATA_DIR = tmpDir;

// Dynamic import so env var takes effect
const { FileStorageBackend } = await import('./file-storage');

afterEach(() => {
  // Clean but preserve the directory
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

function makeCell(overrides: Partial<Cell> = {}): Cell {
  return {
    id: 'cell-1',
    name: 'Test Cell',
    language: 'javascript',
    script: 'console.log("hello")',
    intervalMs: 10000,
    enabled: false,
    lastRunAt: null,
    status: 'idle',
    output: [],
    state: {},
    params: '{}',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('FileStorageBackend', () => {
  it('list returns empty for fresh backend', async () => {
    const backend = new FileStorageBackend();
    const cells = await backend.list();
    expect(cells).toEqual([]);
  });

  it('save and list round-trip', async () => {
    const backend = new FileStorageBackend();
    const cell = makeCell({ id: 'a', name: 'Alpha' });
    await backend.save(cell);

    const cells = await backend.list();
    expect(cells).toHaveLength(1);
    expect(cells[0].id).toBe('a');
    expect(cells[0].name).toBe('Alpha');
  });

  it('get returns saved cell', async () => {
    const backend = new FileStorageBackend();
    await backend.save(makeCell({ id: 'b', name: 'Bravo' }));

    const cell = await backend.get('b');
    expect(cell).not.toBeNull();
    expect(cell!.name).toBe('Bravo');
  });

  it('get returns null for unknown id', async () => {
    const backend = new FileStorageBackend();
    expect(await backend.get('nonexistent')).toBeNull();
  });

  it('save updates existing cell', async () => {
    const backend = new FileStorageBackend();
    await backend.save(makeCell({ id: 'c', name: 'Original' }));
    await backend.save(makeCell({ id: 'c', name: 'Updated' }));

    const cell = await backend.get('c');
    expect(cell!.name).toBe('Updated');

    const cells = await backend.list();
    expect(cells).toHaveLength(1);
  });

  it('delete removes cell', async () => {
    const backend = new FileStorageBackend();
    await backend.save(makeCell({ id: 'd' }));
    await backend.save(makeCell({ id: 'e' }));

    await backend.delete('d');

    const cells = await backend.list();
    expect(cells).toHaveLength(1);
    expect(cells[0].id).toBe('e');
  });

  it('delete non-existent is no-op', async () => {
    const backend = new FileStorageBackend();
    await backend.save(makeCell({ id: 'z' }));
    await backend.delete('does-not-exist');

    const cells = await backend.list();
    expect(cells).toHaveLength(1);
  });

  it('save persists to disk', async () => {
    const backend = new FileStorageBackend();
    await backend.save(makeCell({ id: 'f', name: 'Persisted' }));

    const cellsFile = join(tmpDir, 'cells.json');
    expect(existsSync(cellsFile)).toBe(true);

    const raw = JSON.parse(readFileSync(cellsFile, 'utf-8'));
    expect(raw).toHaveLength(1);
    expect(raw[0].name).toBe('Persisted');
  });

  it('save properly formats JSON', async () => {
    const backend = new FileStorageBackend();
    await backend.save(makeCell({ id: 'j', name: 'JSON' }));

    const cellsFile = join(tmpDir, 'cells.json');
    const raw = readFileSync(cellsFile, 'utf-8');
    expect(raw).toContain('\n  ');
  });

  it('handles multiple cells', async () => {
    const backend = new FileStorageBackend();
    for (let i = 0; i < 50; i++) {
      await backend.save(makeCell({ id: `cell-${i}`, name: `Cell ${i}` }));
    }

    const cells = await backend.list();
    expect(cells).toHaveLength(50);
  });

  it('handles data directory creation', async () => {
    // Remove and let it recreate
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
    expect(existsSync(tmpDir)).toBe(false);

    const backend = new FileStorageBackend();
    await backend.save(makeCell({ id: 'h' }));

    expect(existsSync(tmpDir)).toBe(true);
    expect(existsSync(join(tmpDir, 'cells.json'))).toBe(true);
  });
});
