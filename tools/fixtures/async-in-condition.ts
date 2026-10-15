// 조건 자리의 async 호출 픽스처. async 함수를 await 없이 조건에 쓰면 Promise 라 늘 참이다.
import { isEngineValid } from "./validator";

// toolExists: 맨 이름 async 함수를 if 에 그대로 — 도구가 없어도 분기에 들어간다(react 릴리즈 스크립트).
async function toolExists(name: string): Promise<boolean> {
  return name.length > 0;
}
export async function verify(): Promise<void> {
  if (toolExists("gh")) {
    console.log("verifying");
  }
  // awaited: await 했다 — 정상.
  const awaited = await toolExists("gh");
  if (awaited) console.log("ok");
}

// isReady: 화살표 async 를 삼항 조건에. checkSync 는 동기라 정상.
const isReady = async () => true;
const checkSync = () => true;
export const label = () => (isReady() ? "ready" : "wait") + (checkSync() ? "!" : "?");

export class Installer {
  // this.canInstall: async 메서드를 `!` 로 — 늘 거짓이라 막는 분기가 죽는다(vscode extensionManagementService).
  async canInstall(id: string): Promise<boolean> {
    return id !== "";
  }
  async install(id: string): Promise<void> {
    if (!this.canInstall(id)) throw new Error("cannot install");
  }

  // isEngineValid: 같은 이름 async 메서드가 있지만, 맨 이름 호출은 import 한 동기 함수다. [FP:async-cond-name-kind]
  private async isEngineValid(engine: string): Promise<boolean> {
    return engine !== "";
  }
  check(engine: string): boolean {
    return isEngineValid(engine) ? true : false;
  }

  // started: 조건이 아니라 값으로 넘긴다 — Promise 를 들고 가는 정상 코드.
  start(): Promise<boolean> {
    const started = this.canInstall("x");
    return started;
  }
}
