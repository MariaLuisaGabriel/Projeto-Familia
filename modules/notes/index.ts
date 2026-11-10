/**
 * Interface pública do módulo @estudos/notes (R-03: único arquivo importável de fora).
 */
export { type Note, createNoteEntity } from './domain/note.ts';
export { type NoteRepositoryPort, NotesService } from './application/notes-service.ts';
export { InMemoryNoteRepository } from './adapters/in-memory-note-repository.ts';
