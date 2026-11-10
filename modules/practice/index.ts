/**
 * Interface pública do módulo @estudos/practice (R-03)
 */
export {
  type Question,
  type Attempt,
  type Card,
  type ReviewLog,
  type FsrsRating,
  createCardEntity,
  scheduleNextFsrsReview,
} from './domain/practice-entities.ts';
export { type PracticeRepositoryPort, PracticeService } from './application/practice-service.ts';
export { InMemoryPracticeRepository } from './adapters/in-memory-practice-repository.ts';
