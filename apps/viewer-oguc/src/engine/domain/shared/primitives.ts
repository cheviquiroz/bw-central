declare const __brand: unique symbol;

/**
 * Creates a nominal type from a base type.
 */
export type Brand<T, Name> = T & {
  readonly [__brand]: Name;
};