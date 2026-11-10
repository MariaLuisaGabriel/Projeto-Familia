/**
 * Interface pública do módulo @estudos/calendar (R-03)
 */
export {
  type CalendarEvent,
  createCalendarEventEntity,
  validateEventCustomFields,
  exportEventsToIcs,
} from './domain/event.ts';
export { type CalendarRepositoryPort, CalendarService } from './application/calendar-service.ts';
export { InMemoryCalendarRepository } from './adapters/in-memory-calendar-repository.ts';
