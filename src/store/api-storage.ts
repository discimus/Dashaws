import type { Cell, StorageBackend } from '../types/cell';

export class ApiStorageBackend implements StorageBackend {
  private baseUrl: string;

  constructor(baseUrl = 'http://localhost:3456/api') {
    this.baseUrl = baseUrl;
  }

  async list(): Promise<Cell[]> {
    const res = await fetch(`${this.baseUrl}/cells`);
    return res.json();
  }

  async get(id: string): Promise<Cell | null> {
    const res = await fetch(`${this.baseUrl}/cells/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    return res.json();
  }

  async save(cell: Cell): Promise<void> {
    await fetch(`${this.baseUrl}/cells/${encodeURIComponent(cell.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cell),
    });
  }

  async delete(id: string): Promise<void> {
    await fetch(`${this.baseUrl}/cells/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }
}
