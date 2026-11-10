/**
 * Interface pública do módulo @estudos/study (R-03)
 */
export {
  type Subject,
  type Topic,
  type StudyItem,
  type StudyItemStatus,
  type Goal,
  createSubjectEntity,
  createTopicEntity,
  createStudyItemEntity,
  buildStudyScheduleFromGenerator,
} from './domain/study-entities.ts';
export { type StudyRepositoryPort, StudyService } from './application/study-service.ts';
export { InMemoryStudyRepository } from './adapters/in-memory-study-repository.ts';
