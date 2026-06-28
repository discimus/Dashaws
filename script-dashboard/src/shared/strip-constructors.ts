export function stripConstructors(): {
  Array: typeof Array;
  Object: typeof Object;
  String: typeof String;
  Number: typeof Number;
  Boolean: typeof Boolean;
  RegExp: typeof RegExp;
  Map: typeof Map;
  Set: typeof Set;
  Promise: typeof Promise;
  ErrorConstructor: typeof Error;
  Date: typeof Date;
} {
  const ctors = [Array, Object, String, Number, Boolean, RegExp, Map, Set, Promise, Error, Date];
  const def = (ctor: unknown) => {
    Object.defineProperty(ctor, 'constructor', {
      value: undefined,
      writable: false,
      configurable: false,
      enumerable: false,
    });
  };
  ctors.forEach(def);
  return { Array, Object, String, Number, Boolean, RegExp, Map, Set, Promise, ErrorConstructor: Error, Date };
}
