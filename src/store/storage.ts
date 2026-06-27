import type { StorageBackend, Cell } from '../types/cell';

const STORAGE_KEY = 'script-dashboard-cells';

export class LocalStorageBackend implements StorageBackend {
  async list(): Promise<Cell[]> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  async get(id: string): Promise<Cell | null> {
    const cells = await this.list();
    return cells.find(c => c.id === id) ?? null;
  }

  async save(cell: Cell): Promise<void> {
    const cells = await this.list();
    const idx = cells.findIndex(c => c.id === cell.id);
    if (idx >= 0) {
      cells[idx] = cell;
    } else {
      cells.push(cell);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cells));
  }

  async delete(id: string): Promise<void> {
    const cells = await this.list();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(cells.filter(c => c.id !== id))
    );
  }
}
