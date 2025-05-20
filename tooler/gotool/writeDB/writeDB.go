package writedb

import (
    "encoding/json"
    "fmt"
    "os"
    "path/filepath"
    
    "github.com/BurntSushi/toml"
)

// 与之前相同的结构体定义，确保它们与TOML文件的结构一致
type CharacterInfo struct {
    CharID          string           `json:"charID" toml:"char_id"`
    InfoName        string           `json:"infoName" toml:"info_name"`
    IsLimited       bool             `json:"isLimited" toml:"is_limited"`
    StoryTextAudio  []StorySection   `json:"storyTextAudio" toml:"story_text_audio"`
    HandbookAvgList []HandbookAvg    `json:"handbookAvgList,omitempty" toml:"handbook_avg_list,omitempty"`
}

type StorySection struct {
    Stories      []Story `json:"stories" toml:"stories"`
    StoryTitle   string  `json:"storyTitle" toml:"story_title"`
    UnLockorNot  bool    `json:"unLockorNot" toml:"unlocked"`
}

type Story struct {
    StoryText    string      `json:"storyText" toml:"story_text"`
    UnLockType   string      `json:"unLockType" toml:"unlock_type"`
    UnLockParam  string      `json:"unLockParam" toml:"unlock_param"`
    ShowType     string      `json:"showType" toml:"show_type"`
    PatchIdList  interface{} `json:"patchIdList" toml:"patch_id_list"`
}

type HandbookAvg struct {
    // 根据实际数据结构添加字段
}

// ReadTomlAndConvertToJSON 读取TOML文件并转换为JSON字符串
func ReadTomlAndConvertToJSON(tomlFilePath string) (string, error) {
    // 创建一个CharacterInfo实例来存储TOML数据
    var characterInfo CharacterInfo
    
    // 解析TOML文件
    _, err := toml.DecodeFile(tomlFilePath, &characterInfo)
    if err != nil {
        return "", fmt.Errorf("解析TOML文件失败: %v", err)
    }
    
    // 将结构体转换为JSON
    jsonBytes, err := json.MarshalIndent(characterInfo, "", "  ")
    if err != nil {
        return "", fmt.Errorf("转换为JSON失败: %v", err)
    }
    
    return string(jsonBytes), nil
}

// ReadTomlAndGetObject 读取TOML文件并返回CharacterInfo对象
func ReadTomlAndGetObject(tomlFilePath string) (*CharacterInfo, error) {
    var characterInfo CharacterInfo
    
    // 解析TOML文件
    _, err := toml.DecodeFile(tomlFilePath, &characterInfo)
    if err != nil {
        return nil, fmt.Errorf("解析TOML文件失败: %v", err)
    }
    
    return &characterInfo, nil
}

// SaveAsJSON 将TOML文件转换为JSON并保存
func SaveAsJSON(tomlFilePath string, outputPath string) error {
    // 读取并转换
    jsonStr, err := ReadTomlAndConvertToJSON(tomlFilePath)
    if err != nil {
        return err
    }
    
    // 如果输出路径未指定，使用相同名称但后缀为.json
    if outputPath == "" {
        dir, file := filepath.Split(tomlFilePath)
        base := filepath.Base(file)
        nameWithoutExt := base[:len(base)-len(filepath.Ext(base))]
        outputPath = filepath.Join(dir, nameWithoutExt+".json")
    }
    
    // 写入JSON文件
    err = os.WriteFile(outputPath, []byte(jsonStr), 0644)
    if err != nil {
        return fmt.Errorf("写入JSON文件失败: %v", err)
    }
    
    return nil
}

// 示例用法
func ExampleUsage() {
    tomlFilePath := "/home/sevmeowple/WorkSpace/Happy/MeowSev/tooler/gotool/output/char_002_amiya.toml"
    
    // 方法1: 读取并获取JSON字符串
    jsonStr, err := ReadTomlAndConvertToJSON(tomlFilePath)
    if err != nil {
        fmt.Printf("错误: %v\n", err)
        return
    }
    fmt.Println("JSON字符串:")
    fmt.Println(jsonStr)
    
    // 方法2: 读取并获取对象
    charInfo, err := ReadTomlAndGetObject(tomlFilePath)
    if err != nil {
        fmt.Printf("错误: %v\n", err)
        return
    }
    fmt.Printf("角色ID: %s\n", charInfo.CharID)
    fmt.Printf("角色名称: %s\n", charInfo.InfoName)
    fmt.Printf("故事章节数: %d\n", len(charInfo.StoryTextAudio))
    
    // 方法3: 转换并保存为JSON文件
    err = SaveAsJSON(tomlFilePath, "")
    if err != nil {
        fmt.Printf("保存JSON失败: %v\n", err)
        return
    }
    fmt.Println("成功保存JSON文件!")
}