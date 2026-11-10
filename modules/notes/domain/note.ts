/**
 * MÓDULO DE REFERÊNCIA (R-56): modules/notes/domain
 *
 * Responsabilidade (§4.1): Anotações em Markdown e vínculos (tipo, id) com outras entidades.
 * Regra R-01: domain/ NÃO importa nada de application/, adapters/, packages/db ou bibliotecas de infraestrutura.
 */
import {
  type WorkspaceScopedEntity,
  type EntityReference,
  type UUIDv7,
  createBaseEntityFields,
  assertWithinLimit,
  sanitizeUserText,
  WORKSPACE_LIMITS,
  DomainError,
} from '@estudos/core';

export interface Note extends WorkspaceScopedEntity {
  readonly title: string;
  readonly content_markdown: string;
  readonly links: readonly EntityReference[];
}

export function createNoteEntity(params: {
  workspace_id: UUIDv7;
  title: string;
  content_markdown: string;
  links?: readonly EntityReference[];
  created_by_rule_id?: string | null;
}): Note {
  const cleanTitle = sanitizeUserText(params.title.trim());
  if (!cleanTitle) {
    throw new DomainError('NOTE_TITLE_REQUIRED', 'Toda nota exige um título não vazio.');
  }
  assertWithinLimit('Título da nota', cleanTitle.length, WORKSPACE_LIMITS.MAX_SHORT_TEXT_CHARS);

  const sanitizedMarkdown = sanitizeUserText(params.content_markdown);
  assertWithinLimit('Nota (Markdown)', sanitizedMarkdown.length, WORKSPACE_LIMITS.MAX_NOTE_MARKDOWN_CHARS);

  const base = createBaseEntityFields(params.workspace_id, {
    created_by_rule_id: params.created_by_rule_id ?? null,
  });

  return {
    ...base,
    title: cleanTitle,
    content_markdown: sanitizedMarkdown,
    links: [...(params.links ?? [])],
  };
}
