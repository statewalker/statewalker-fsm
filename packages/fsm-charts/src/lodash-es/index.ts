export let _: any = {
  constant: (value: any) => () => value,
};
export function setLodash(lib: any) {
  _ = lib;
}
export function getLodash() {
  return _;
}
