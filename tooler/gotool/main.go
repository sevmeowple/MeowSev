package main

import (
    "fmt"
    "gotool/toToml"
)

func main() {
    var path = "../../ArknightsGameData/zh_CN/gamedata/excel/handbook_info_table.json"
    
    // 定义进度回调函数
    progressCallback := func(current, total, success, fail int) {
        progress := float64(current) / float64(total) * 100
        fmt.Printf("进度: %.2f%% (%d/%d) - 成功: %d, 失败: %d\n", 
            progress, current, total, success, fail)
    }
    
    // 调用转换函数
    result, err := totoml.ConvertJSONFileToTOML(
        path,          // JSON 文件路径
        "./output/",   // 输出目录
        "handbookDict", // 包含角色数据的字典键名
        10,            // 最大并发数
        progressCallback, // 进度回调函数
    )
    
    if err != nil {
        fmt.Printf("转换失败: %v\n", err)
        return
    }
    
    fmt.Printf("\n处理完成! 总计: %d, 成功: %d, 失败: %d\n", 
        result.TotalCount, result.SuccessCount, result.FailCount)
}