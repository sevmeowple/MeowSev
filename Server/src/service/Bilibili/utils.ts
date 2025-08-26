import md5 from 'md5';

// WBI混淆表
const mixinKeyEncTab = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
    61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
    36, 20, 34, 44, 52
];

// BV/AV转换相关常量
const XOR_CODE = 23442827791579n;
const MASK_CODE = 2251799813685247n;
const MAX_AID = 1n << 51n;
const BASE = 58n;
const data = 'FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf';

// 获取混淆后的key
function getMixinKey(orig: string) {
    return mixinKeyEncTab
        .map((n) => orig[n])
        .join("")
        .slice(0, 32);
}

// 生成wbi签名参数
export function encWbi(
    params: { [key: string]: string | number | object },
    img_key: string,
    sub_key: string
) {
    const mixin_key = getMixinKey(img_key + sub_key),
        curr_time = Math.round(Date.now() / 1000),
        chr_filter = /[!'()*]/g;

    Object.assign(params, { wts: curr_time });
    const query = Object.keys(params)
        .sort()
        .map((key) => {
            const value = params[key].toString().replace(chr_filter, "");
            return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        })
        .join("&");

    const wbi_sign = md5(query + mixin_key);
    return query + "&w_rid=" + wbi_sign;
}

// AV号转BV号
export function av2bv(aid: number) {
    const bytes = ['B', 'V', '1', '0', '0', '0', '0', '0', '0', '0', '0', '0'];
    let bvIndex = bytes.length - 1;
    let tmp = (MAX_AID | BigInt(aid)) ^ XOR_CODE;
    while (tmp > 0) {
        bytes[bvIndex] = data[Number(tmp % BASE)];
        tmp = tmp / BASE;
        bvIndex -= 1;
    }
    [bytes[3], bytes[9]] = [bytes[9], bytes[3]];
    [bytes[4], bytes[7]] = [bytes[7], bytes[4]];
    return bytes.join('') as `BV1${string}`;
}

// BV号转AV号
export function bv2av(bvid: `BV1${string}`) {
    const bvidArr = Array.from<string>(bvid);
    [bvidArr[3], bvidArr[9]] = [bvidArr[9], bvidArr[3]];
    [bvidArr[4], bvidArr[7]] = [bvidArr[7], bvidArr[4]];
    bvidArr.splice(0, 3);
    const tmp = bvidArr.reduce((pre, bvidChar) => pre * BASE + BigInt(data.indexOf(bvidChar)), 0n);
    return Number((tmp & MASK_CODE) ^ XOR_CODE);
}

// 清理HTML标签和文件名非法字符
export function cleanTitle(title: string): string {
    return title.replace(/<[^>]*>/g, '').replace(/[<>:"/\\|?*]/g, '_').trim();
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}