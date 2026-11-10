/**
 * MÓDULO DE REFERÊNCIA (R-56): modules/notes/adapters
 *
 * Implementa as portas definidas em application/.
 * R-34, R-35: Isola os dados por workspace_id e usa soft delete (deleted_at).
 */
import type { EntityReference, UUIDv7 } from '@estudos/core';
import type { Note } from '../domain/note.ts';
import type { NoteRepositoryPort } from '../application/notes-service.ts';

export class InMemoryNoteRepository implements NoteRepositoryPort {
  private readonly store = new Map<string, Note>();

  public async save(workspaceId: UUIDv7, note: Note): Promise<void> {
    if (note.workspace_id !== workspaceId) {
      throw new Error('Violação de isolamento de workspace ao salvar nota (R-35).');
    }
    this.store.set(`${workspaceId}:${note.id}`, note);
  }

  public async listByWorkspace(workspaceId: UUIDv7): Promise<readonly Note[]> {
    const results: Note[] = [];
    for (const note of this.store.values()) {
      if (note.workspace_id === workspaceId && note.deleted_at === null) {
        results.push(note);
      }
    }
    return results.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  public async findByLinkedEntity(
    workspaceId: UUIDv7,
    ref: EntityReference
  ): Promise<readonly Note[]> {
    const all = await this.listByWorkspace(workspaceId);
    return all.filter((n) => n.links.some((l) => l.type === ref.type && l.id === ref.id));
  }

  public async softDelete(
    workspaceId: UUIDv7,
    noteId: UUIDv7,
    deletedAtISO: string
  ): Promise<void> {
    const key = `${workspaceId}:${noteId}`;
    const existing = this.store.get(key);
    if (existing && existing.workspace_id === workspaceId) {
      this.store.set(key, {
        ...existing,
        deleted_at: deletedAtISO,
        updated_at: deletedAtISO,
      });
    }
  }
}
