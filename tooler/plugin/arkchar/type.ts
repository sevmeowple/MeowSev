/**
 *
 *
 * @interface ModInfo
 * @typedef {ModInfo}
 *
 * @property {string} name
 * @property {string} baseInfo
 */
interface ModInfo {
  name: string;
  baseInfo: string;
}

/**
 *
 *
 * @interface CharBaseInfo
 * @typedef {CharBaseInfo}
 *
 * @property {string} birthday
 * @property {string} gender
 * @property {string} height
 * @property {string} race
 *
 */
interface CharBaseInfo {
  //生日,种族,身高,性别,专精
  name: string;
  birthday: string;
  height: string;
  race: string;
  mastery: string;
}

/**
 *
 *
 * @interface Word
 * @typedef {Word}
 *
 * @property {string} status
 * @property {string} content
 */
interface Word {
  status: string;
  content: string;
}


  /**
   * @interface CharacterInfo
   * @typedef {CharacterInfo}
   *
   * @property {string} name
   * @property {ModInfo[]} mod
   * @property {CharBaseInfo} baseInfo
   * @property {Word[]} words
   *
   */
interface CharacterInfo {
  baseInfo: CharBaseInfo;
  mod: ModInfo[];
  words: Word[];
}

export type { ModInfo, CharBaseInfo, Word, CharacterInfo };
