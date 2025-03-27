import { searchTieba } from "./utils";
import type { TiebaSearchParams } from "./utils";


const params:TiebaSearchParams ={
    kw: "中国科学技术大学吧",
    word:"绿色圆圈"
} 

console.log(
    await searchTieba(
        params
    )
)