declare module 'graphql-redis-subscriptions' {
  import { PubSubEngine } from 'graphql-subscriptions';
  import { Redis, RedisOptions } from 'ioredis';

  export interface RedisPubSubOptions {
    connection?: RedisOptions;
    publisher?: Redis;
    subscriber?: Redis;
    reviver?: (key: any, value: any) => any;
    serializer?: (value: any) => string;
    deserializer?: (value: string) => any;
  }

  export class RedisPubSub implements PubSubEngine {
    constructor(options?: RedisPubSubOptions);
    publish(triggerName: string, payload: any): Promise<void>;
    subscribe(triggerName: string, onMessage: Function, options?: Object): Promise<number>;
    unsubscribe(subId: number): void;
    asyncIterator<T>(triggers: string | string[]): AsyncIterator<T>;
    close(): Promise<void>;
  }
}
