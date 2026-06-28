export function stripConstructors() {
    const ctors = [Array, Object, String, Number, Boolean, RegExp, Map, Set, Promise, Error, Date];
    const def = (ctor) => {
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
//# sourceMappingURL=strip-constructors.js.map