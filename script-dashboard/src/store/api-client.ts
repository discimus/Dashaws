import type { Cell, StorageBackend, Queue, EventTopic, CronEntry } from '../types/cell';
import type { ExecutionResult } from '../sandbox/executor';
import type { EncryptedBlob } from '../crypto/secrets';

export class ApiClient implements StorageBackend {
  private baseUrl: string;

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, init);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async health(): Promise<boolean> {
    try {
      await this.fetch('/health');
      return true;
    } catch {
      return false;
    }
  }

  async getLanguages(): Promise<string[]> {
    try {
      return await this.fetch('/languages');
    } catch {
      return ['javascript'];
    }
  }

  // StorageBackend implementation

  async list(): Promise<Cell[]> {
    return this.fetch('/cells');
  }

  async get(id: string): Promise<Cell | null> {
    try {
      return await this.fetch(`/cells/${encodeURIComponent(id)}`);
    } catch {
      return null;
    }
  }

  async save(cell: Cell): Promise<void> {
    await this.fetch(`/cells/${encodeURIComponent(cell.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cell),
    });
  }

  async delete(id: string): Promise<void> {
    await this.fetch(`/cells/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async lockCell(id: string, clientId: string): Promise<{ ok: boolean; lockedBy?: string }> {
    try {
      return await this.fetch(`/cells/${encodeURIComponent(id)}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes('Locked by another client')) {
        // Parse the error to extract lockedBy if possible
        return { ok: false };
      }
      return { ok: false };
    }
  }

  async unlockCell(id: string, clientId: string): Promise<void> {
    await this.fetch(`/cells/${encodeURIComponent(id)}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId }),
    });
  }

  // Execution

  async runOnce(id: string, props?: Record<string, unknown>): Promise<ExecutionResult> {
    return this.fetch(`/cells/${encodeURIComponent(id)}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: props ? JSON.stringify(props) : undefined,
    });
  }

  async startCell(id: string): Promise<void> {
    await this.fetch(`/cells/${encodeURIComponent(id)}/start`, { method: 'POST' });
  }

  async stopCell(id: string): Promise<void> {
    await this.fetch(`/cells/${encodeURIComponent(id)}/stop`, { method: 'POST' });
  }

  // Env

  async getEnv(): Promise<Record<string, string>> {
    return this.fetch('/env');
  }

  async saveEnv(env: Record<string, string>): Promise<void> {
    await this.fetch('/env', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(env),
    });
  }

  // Queues

  async getQueues(): Promise<Record<string, Queue>> {
    return this.fetch('/queues');
  }

  async saveQueues(queues: Record<string, Queue>): Promise<void> {
    await this.fetch('/queues', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queues),
    });
  }

  // Topics

  async getTopics(): Promise<Record<string, EventTopic>> {
    return this.fetch('/topics');
  }

  async saveTopics(topics: Record<string, EventTopic>): Promise<void> {
    await this.fetch('/topics', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(topics),
    });
  }

  async emitEvent(name: string, body: string): Promise<void> {
    await this.fetch(`/topics/${encodeURIComponent(name)}/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  }

  // Crons

  async getCrons(): Promise<CronEntry[]> {
    return this.fetch('/crons');
  }

  async saveCrons(crons: CronEntry[]): Promise<void> {
    await this.fetch('/crons', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(crons),
    });
  }

  // Secrets

  async getSecretsStatus(): Promise<{ hasBlob: boolean; unlocked: boolean }> {
    return this.fetch('/secrets/status');
  }

  async unlockSecrets(password: string): Promise<boolean> {
    try {
      await this.fetch('/secrets/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async lockSecrets(): Promise<void> {
    await this.fetch('/secrets/lock', { method: 'POST' });
  }

  async putSecretsBlob(blob: EncryptedBlob): Promise<void> {
    await this.fetch('/secrets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(blob),
    });
  }

  async deleteSecretsAll(): Promise<void> {
    await this.fetch('/secrets', { method: 'DELETE' });
  }
}
