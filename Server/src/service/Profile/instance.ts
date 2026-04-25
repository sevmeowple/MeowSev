import type { ProfileService } from "./ProfileService";
import type { ProfileWorker } from "./ProfileWorker";
import type { ProfileScheduler } from "./ProfileScheduler";

/**
 * Profile 模块全局实例管理
 * 用于解决 config.ts → toolRegistry → config.ts 的循环依赖问题
 */
export let profileService: ProfileService | null = null;
export let profileWorker: ProfileWorker | null = null;
export let profileScheduler: ProfileScheduler | null = null;

export function setProfileService(ps: ProfileService): void {
  profileService = ps;
}

export function setProfileWorker(pw: ProfileWorker): void {
  profileWorker = pw;
}

export function setProfileScheduler(ps: ProfileScheduler): void {
  profileScheduler = ps;
}
