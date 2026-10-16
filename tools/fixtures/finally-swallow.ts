declare const isDev: () => boolean;
declare const work: () => number[];

export function postprocess() {
  let out: number[] = [];
  try {
    out = work();
  } catch (e) {
    if (isDev()) {
      throw e;
    }
  } finally {
    return out;
  }
}

export function redraw() {
  try {
    work();
  } catch (e) {
    throw e;
  } finally {
    throw new Error("cleanup failed");
  }
}

export function guarded(flag: boolean) {
  try {
    return work();
  } catch (e) {
    flag = false;
    throw e;
  } finally {
    if (flag) {
      return [];
    }
  }
}

export function noRethrow() {
  try {
    work();
  } catch (e) {
    console.error(e);
  } finally {
    return [];
  }
}

export function innerTry() {
  try {
    work();
  } catch (e) {
    try {
      throw e;
    } catch {}
  } finally {
    return [];
  }
}

export function afterFinally() {
  let out: number[] = [];
  try {
    out = work();
  } catch (e) {
    if (isDev()) throw e;
  } finally {
    out = out.slice();
  }
  return out;
}
