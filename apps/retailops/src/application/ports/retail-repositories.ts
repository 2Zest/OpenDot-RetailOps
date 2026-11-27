import type { Batch, Draft, Evidence, Operation, Product, Policy } from '../../domain/index.js';

export interface EntityRepository<T> {
  save(value: unknown): T;
  findById(id: string): T | undefined;
}

export interface PolicyRepository {
  save(value: unknown): Policy;
  findByIdAndRevision(id: string, revision: string): Policy | undefined;
}

export interface RetailRepositoryPorts {
  products: EntityRepository<Product>;
  batches: EntityRepository<Batch>;
  policies: PolicyRepository;
  evidence: EntityRepository<Evidence>;
  drafts: EntityRepository<Draft>;
  operations: EntityRepository<Operation>;
}
