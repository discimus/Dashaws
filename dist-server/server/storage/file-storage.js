import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
const DATA_DIR = process.env.SCRIPT_DASHBOARD_DATA_DIR || join(process.cwd(), 'data');
const CELLS_FILE = join(DATA_DIR, 'cells.json');
function ensureDir() {
    if (!existsSync(DATA_DIR))
        mkdirSync(DATA_DIR, { recursive: true });
}
function readCells() {
    try {
        if (!existsSync(CELLS_FILE))
            return [];
        return JSON.parse(readFileSync(CELLS_FILE, 'utf-8'));
    }
    catch {
        return [];
    }
}
function writeCells(cells) {
    ensureDir();
    writeFileSync(CELLS_FILE, JSON.stringify(cells, null, 2));
}
export class FileStorageBackend {
    async list() {
        return readCells();
    }
    async get(id) {
        const cells = readCells();
        return cells.find(c => c.id === id) ?? null;
    }
    async save(cell) {
        const cells = readCells();
        const idx = cells.findIndex(c => c.id === cell.id);
        if (idx >= 0) {
            cells[idx] = { ...cell, updatedAt: Date.now() };
        }
        else {
            cells.push({ ...cell, updatedAt: Date.now() });
        }
        writeCells(cells);
    }
    async delete(id) {
        const cells = readCells();
        writeCells(cells.filter(c => c.id !== id));
    }
}
//# sourceMappingURL=file-storage.js.map