// tieba.ts
import { axiosInstance } from '@utils/axios';
import qs from 'qs';

interface TiebaSearchParams {
  kw: string;           // 贴吧名称
  word: string;         // 搜索关键词
  pn?: number;          // 页码
  rn?: number;          // 每页结果数
  only_thread?: number; // 是否只搜索主题帖
  sm?: number;          // 搜索类型
}

async function searchTieba(params: TiebaSearchParams) {
  try {
    const searchParams = {
      _client_version: '11.0.0.0',
      kw: params.kw,
      word: params.word,
      only_thread: params.only_thread ?? 1,
      pn: params.pn ?? 1,
      rn: params.rn ?? 20,
      sm: params.sm ?? 0
    };

    const response = await axiosInstance({
      method: 'post',
      url: 'https://tieba.baidu.com/c/s/searchpost',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: qs.stringify(searchParams)
    });

    return response.data;
    
  } catch (error) {
    console.error('贴吧搜索失败:', error);
    throw error;
  }
}

export { searchTieba, type TiebaSearchParams };