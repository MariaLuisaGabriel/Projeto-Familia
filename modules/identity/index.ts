/**
 * Interface pública do módulo @estudos/identity (R-03)
 */
export {
  type Account,
  type WorkspaceMembership,
  createAccountEntity,
  createMembershipEntity,
} from './domain/account.ts';
export { type IdentityRepositoryPort, IdentityService } from './application/identity-service.ts';
export { InMemoryIdentityRepository } from './adapters/in-memory-identity-repository.ts';
