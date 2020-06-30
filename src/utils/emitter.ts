import { EventEmitter } from 'events';

export type EventMap = Record<string, unknown>;

export type EventKey<T extends EventMap> = string & keyof T;

export type EventReceiver<T> = (props: T) => unknown;

export class Emitter<T extends EventMap> {
  private emitter: EventEmitter = new EventEmitter();

  public on<K extends string & keyof T>(eventName: K, fn: EventReceiver<T[K]>): void {
    this.emitter.on(eventName, fn);
  }

  public once<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>): void {
    this.emitter.once(eventName, fn);
  }

  public off<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>): void {
    this.emitter.off(eventName, fn);
  }

  protected emit<K extends EventKey<T>>(eventName: K, props: T[K]): void {
    this.emitter.emit(eventName, props);
  }
}
