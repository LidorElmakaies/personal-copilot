import { redisConnectionFromUrl } from './redis-connection';

describe('redisConnectionFromUrl', () => {
  it('reads host and default port/db', () => {
    expect(redisConnectionFromUrl('redis://redis:6379')).toEqual({
      host: 'redis',
      port: 6379,
      username: undefined,
      password: undefined,
      db: 0,
    });
    expect(redisConnectionFromUrl('redis://localhost')).toMatchObject({
      port: 6379,
    });
  });

  it('reads credentials (percent-decoded password) and db', () => {
    expect(redisConnectionFromUrl('redis://user:p%40ss@h:6380/2')).toEqual({
      host: 'h',
      port: 6380,
      username: 'user',
      password: 'p@ss',
      db: 2,
    });
  });
});
