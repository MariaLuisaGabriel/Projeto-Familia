/**
 * MÓDULO DE REFERÊNCIA (R-56): modules/notes/application
 *
 * Contém portas (interfaces de repositório) e casos de uso.
 * Regra R-02: application/ NÃO importa de adapters/.
 * Regra R-35: Toda consulta filtra obrigatoriamente por workspace_id.
 * Regra R-48: Autorização verificada por caso de uso com base no papel no workspace.
 */
import {
  type ActorContext,
  type EntityReference,
  type UUIDv7,
  assertAuthorized,
} from '@estudos/core';
import { type Note, createNoteEntity } from '../domain/note.ts';

/**
 * Porta de saída (Repositório) — R-35: workspace_id é sempre parâmetro obrigatório.
 */
export interface NoteRepositoryPort {
  save(workspaceId: UUIDv7, note: Note): Promise<void>;
  listByWorkspace(workspaceId: UUIDv7): Promise<readonly Note[]>;
  findByLinkedEntity(workspaceId: UUIDv7, ref: EntityReference): Promise<readonly Note[]>;
  softDelete(workspaceId: UUIDv7, noteId: UUIDv7, deletedAtISO: string): Promise<void>;
}

export class NotesService {
  private readonly repo: NoteRepositoryPort;

  constructor(repo: NoteRepositoryPort) {
    this.repo = repo;
  }

  public async createNote(
    actor: ActorContext,
    input: {
      title: string;
      content_markdown: string;
      links?: readonly EntityReference[];
    }
  ): Promise<Note> {
    assertAuthorized(actor, 'editor', actor.workspace_id);
    const note = createNoteEntity({
      workspace_id: actor.workspace_id,
      title: input.title,
      content_markdown: input.content_markdown,
      links: input.links,
    });
    await this.repo.save(actor.workspace_id, note);
    return note;
  }

  public async listNotes(actor: ActorContext): Promise<readonly Note[]> {
    assertAuthorized(actor, 'viewer', actor.workspace_id);
    return this.repo.listByWorkspace(actor.workspace_id);
  }

  public async deleteNote(actor: ActorContext, noteId: UUIDv7): Promise<void> {
    assertAuthorized(actor, 'editor', actor.workspace_id);
    await this.repo.softDelete(actor.workspace_id, noteId, new Date().toISOString());
  }
}
