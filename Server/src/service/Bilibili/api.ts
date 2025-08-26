import axios from 'axios';
import { encWbi } from './utils';
import type { 
    BiliSearchResponse, 
    BiliSearchVideo, 
    PageListResponse, 
    PlayUrlResponse, 
    QualityOption 
} from './type';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
const REFERER = 'https://www.bilibili.com/';

// 获取最新的 img_key 和 sub_key
export async function getWbiKeys() {
    const res = await axios.get('https://api.bilibili.com/x/web-interface/nav', {
        headers: {
            'User-Agent': USER_AGENT,
            'Referer': REFERER
        }
    });
    const {
        data: {
            wbi_img: { img_url, sub_url },
        },
    } = res.data;

    return {
        img_key: img_url.slice(
            img_url.lastIndexOf('/') + 1,
            img_url.lastIndexOf('.')
        ),
        sub_key: sub_url.slice(
            sub_url.lastIndexOf('/') + 1,
            sub_url.lastIndexOf('.')
        )
    }
}

// 获取 buvid3
export async function fetchBuvid3() {
    const res = await axios.get('https://www.bilibili.com', {
        headers: {
            'User-Agent': USER_AGENT,
        }
    });
    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
        const buvid3 = setCookie.find((c: string) => c.startsWith('buvid3='));
        if (buvid3) {
            return buvid3.split(';')[0];
        }
    }
    return '';
}

// 搜索视频
export async function searchBilibiliWbi(keyword: string): Promise<BiliSearchVideo[]> {
    const { img_key, sub_key } = await getWbiKeys();
    const params = { keyword };
    const query = encWbi(params, img_key, sub_key);
    const buvid3 = await fetchBuvid3();

    const url = `https://api.bilibili.com/x/web-interface/wbi/search/all/v2?${query}`;
    const headers = {
        'User-Agent': USER_AGENT,
        'Referer': REFERER,
        'Cookie': buvid3,
    };

    const res = await axios.get(url, { headers });
    const searchResult: BiliSearchResponse = res.data;

    if (searchResult.code !== 0) {
        throw new Error(`搜索失败: ${searchResult.code} - ${searchResult.message}`);
    }

    const videoResult = searchResult.data.result.find(r => r.result_type === 'video');
    if (!videoResult || !videoResult.data.length) {
        throw new Error('没有找到相关视频');
    }

    return videoResult.data;
}

// 获取视频分P列表
export async function getPageList(bvid: string): Promise<PageListResponse> {
    const buvid3 = await fetchBuvid3();
    const url = `https://api.bilibili.com/x/player/pagelist?bvid=${bvid}`;
    const headers = {
        'User-Agent': USER_AGENT,
        'Referer': REFERER,
        'Cookie': buvid3,
    };

    const res = await axios.get(url, { headers });
    return res.data;
}

// 获取播放地址
export async function fetchPlayUrl(
    bvid: string, 
    cid: string | number,
    quality: QualityOption = { qn: 32, fnval: 0 }
): Promise<PlayUrlResponse> {
    const { img_key, sub_key } = await getWbiKeys();
    const params = {
        bvid,
        cid: cid.toString(),
        qn: quality.qn,
        fnval: quality.fnval,
        fourk: 1,
        platform: 'html5'
    };

    const query = encWbi(params, img_key, sub_key);
    const buvid3 = await fetchBuvid3();

    const url = `https://api.bilibili.com/x/player/wbi/playurl?${query}`;
    const headers = {
        'User-Agent': USER_AGENT,
        'Referer': REFERER,
        'Cookie': buvid3,
    };

    const res = await axios.get(url, { headers });
    return res.data;
}