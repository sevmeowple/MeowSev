export interface BiliSearchResponse {
    code: number;
    message: string;
    data: {
        result: Array<{
            result_type: string;
            data: BiliSearchVideo[];
        }>;
    };
}

export interface BiliSearchVideo {
    type: string;
    id: number;
    aid: number;
    bvid: string;
    title: string;
    author: string;
    duration: string;
    description: string;
    play: number;
    pic: string;
}

export interface PageListResponse {
    code: number;
    message: string;
    data: Array<{
        cid: number;
        page: number;
        part: string;
        duration: number;
        dimension: {
            width: number;
            height: number;
            rotate: number;
        };
    }>;
}

export interface PlayUrlResponse {
    code: number;
    message: string;
    data: {
        // DASH格式
        dash?: {
            video: Array<{
                id: number;
                baseUrl: string;
                backupUrl?: string[];
            }>;
            audio: Array<{
                id: number;
                baseUrl: string;
                backupUrl?: string[];
            }>;
        };
        // FLV/MP4格式
        durl?: Array<{
            order: number;
            length: number;
            size: number;
            url: string;
            backup_url?: string[];
        }>;
        quality: number;
        format: string;
        timelength: number;
        accept_quality: number[];
        accept_description: string[];
    };
}

export interface QualityOption {
    qn: number;
    fnval: number;
}