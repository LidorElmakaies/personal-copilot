// The Users Service's tables, as other services may read them: read-only TypeORM mappings
// (synchronize: false), never written outside the Users Service. Add an entity to the service's
// TypeORM `entities` to use it.
export * from './users-user.entity';
export * from './users-profile.entity';
