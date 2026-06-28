import type { Cell, StorageBackend } from '../../src/types/cell.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = process.env.SCRIPT_DASHBOARD_DATA_DIR || join(process.cwd(), 'data');
const CELLS_FILE = join(DATA_DIR, 'cells.json');

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readCells(): Cell[] {
  try {
    if (!existsSync(CELLS_FILE)) return [];
    return JSON.parse(readFileSync(CELLS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeCells(cells: Cell[]): void {
  ensureDir();
  writeFileSync(CELLS_FILE, JSON.stringify(cells, null, 2));
}

export class FileStorageBackend implements StorageBackend {
  async list(): Promise<Cell[]> {
    return readCells();
  }

  async get(id: string): Promise<Cell | null> {
    const cells = readCells();
    return cells.find(c => c.id === id) ?? null;
  }

  async save(cell: Cell): Promise<void> {
    const cells = readCells();
    const idx = cells.findIndex(c => c.id === cell.id);
    if (idx >= 0) {
      cells[idx] = { ...cell, updatedAt: Date.now() };
    } else {
      cells.push({ ...cell, updatedAt: Date.now() });
    }
    writeCells(cells);
  }

  async delete(id: string): Promise<void> {
    const cells = readCells();
    writeCells(cells.filter(c => c.id !== id));
  }
}
