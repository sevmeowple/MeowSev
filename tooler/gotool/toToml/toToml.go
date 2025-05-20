package totoml

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/BurntSushi/toml"
)

// 创建对应结构体以便更好地处理数据
type CharacterInfo struct {
	CharID          string         `json:"charID" toml:"char_id"`
	InfoName        string         `json:"infoName" toml:"info_name"`
	IsLimited       bool           `json:"isLimited" toml:"is_limited"`
	CharName        string         `json:"charName" toml:"char_name"` // 新增字段
	StoryTextAudio  []StorySection `json:"storyTextAudio" toml:"story_text_audio"`
	HandbookAvgList []HandbookAvg  `json:"handbookAvgList,omitempty" toml:"handbook_avg_list,omitempty"`
}

type StorySection struct {
	Stories     []Story `json:"stories" toml:"stories"`
	StoryTitle  string  `json:"storyTitle" toml:"story_title"`
	UnLockorNot bool    `json:"unLockorNot" toml:"unlocked"`
}

type Story struct {
	StoryText   string      `json:"storyText" toml:"story_text"`
	UnLockType  string      `json:"unLockType" toml:"unlock_type"`
	UnLockParam string      `json:"unLockParam" toml:"unlock_param"`
	ShowType    string      `json:"showType" toml:"show_type"`
	PatchIdList interface{} `json:"patchIdList" toml:"patch_id_list"`
}

type HandbookAvg struct {
	// 根据实际数据结构添加字段
}

// 处理结果的统计信息
type ProcessResult struct {
	TotalCount   int
	SuccessCount int
	FailCount    int
}

// 进度回调函数类型
type ProgressCallback func(current, total, success, fail int)

// ConvertJSONFileToTOML 将JSON文件转换为多个TOML文件
// jsonFilePath: JSON文件路径
// outputDir: 输出目录路径
// dictKey: 包含角色数据的字典键名
// maxConcurrency: 最大并发数
// progressCallback: 进度回调函数（可为nil）
func ConvertJSONFileToTOML(jsonFilePath string, outputDir string, dictKey string, maxConcurrency int, progressCallback ProgressCallback) (*ProcessResult, error) {
	// 读取JSON文件
	jsonFile, err := os.ReadFile(jsonFilePath)
	if err != nil {
		return nil, fmt.Errorf("无法读取文件: %v", err)
	}

	var jsonData map[string]interface{}
	err = json.Unmarshal(jsonFile, &jsonData)
	if err != nil {
		return nil, fmt.Errorf("解析JSON失败: %v", err)
	}

	// 提取数据
	dictValue, ok := jsonData[dictKey].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("无法提取%s", dictKey)
	}

	// 创建输出目录(如果不存在)
	err = os.MkdirAll(outputDir, 0755)
	if err != nil {
		return nil, fmt.Errorf("无法创建输出目录: %v", err)
	}

	// 获取所有角色的键
	characterKeys := getKeysFromMap(dictValue)

	// 设置合理的并发数
	if maxConcurrency <= 0 {
		maxConcurrency = 10 // 默认值
	}

	// 使用waitGroup来跟踪所有goroutine
	var wg sync.WaitGroup
	// 限制并发数量的信号量
	sem := make(chan struct{}, maxConcurrency)

	// 处理计数，使用原子操作确保并发安全
	var processCount int32 = 0
	var successCount int32 = 0
	var failCount int32 = 0

	// 循环处理每个角色数据
	for _, charKey := range characterKeys {
		wg.Add(1)
		sem <- struct{}{} // 获取一个并发槽

		go func(charID string) {
			defer wg.Done()
			defer func() { <-sem }() // 释放并发槽

			// 获取角色数据
			charValueRaw, ok := dictValue[charID].(map[string]interface{})
			if !ok {
				log.Printf("警告: 无法提取角色数据 %s", charID)
				atomic.AddInt32(&failCount, 1)
				notifyProgress(&processCount, int32(len(characterKeys)), &successCount, &failCount, progressCallback)
				return
			}

			// 将map转换为结构体
			charValueJSON, err := json.Marshal(charValueRaw)
			if err != nil {
				log.Printf("警告: 无法序列化角色数据 %s: %v", charID, err)
				atomic.AddInt32(&failCount, 1)
				notifyProgress(&processCount, int32(len(characterKeys)), &successCount, &failCount, progressCallback)
				return
			}

			var characterInfo CharacterInfo
			err = json.Unmarshal(charValueJSON, &characterInfo)
			if err != nil {
				log.Printf("警告: 无法将角色数据转换为结构体 %s: %v", charID, err)
				atomic.AddInt32(&failCount, 1)
				notifyProgress(&processCount, int32(len(characterKeys)), &successCount, &failCount, progressCallback)
				return
			}

			if len(characterInfo.StoryTextAudio) > 0 && len(characterInfo.StoryTextAudio[0].Stories) > 0 {
				storyText := characterInfo.StoryTextAudio[0].Stories[0].StoryText

				// 查找代号部分
				startIndex := strings.Index(storyText, "【代号】")
				if startIndex != -1 {
					startIndex += len("【代号】") // 移动到代号之后
					endIndex := strings.Index(storyText[startIndex:], "\n")
					if endIndex != -1 {
						// 提取代号
						characterInfo.CharName = storyText[startIndex : startIndex+endIndex]
					}
				}
			}

			// 构建TOML文件路径
			tomlFilePath := filepath.Join(outputDir, fmt.Sprintf("%s.toml", charID))

			// 创建并打开文件
			file, err := os.Create(tomlFilePath)
			if err != nil {
				log.Printf("警告: 无法创建TOML文件 %s: %v", charID, err)
				atomic.AddInt32(&failCount, 1)
				notifyProgress(&processCount, int32(len(characterKeys)), &successCount, &failCount, progressCallback)
				return
			}
			defer file.Close()

			// 将数据编码为TOML并写入文件
			err = toml.NewEncoder(file).Encode(characterInfo)
			if err != nil {
				log.Printf("警告: 无法将数据写入TOML文件 %s: %v", charID, err)
				atomic.AddInt32(&failCount, 1)
				notifyProgress(&processCount, int32(len(characterKeys)), &successCount, &failCount, progressCallback)
				return
			}

			atomic.AddInt32(&successCount, 1)
			notifyProgress(&processCount, int32(len(characterKeys)), &successCount, &failCount, progressCallback)
		}(charKey)
	}

	// 等待所有goroutine完成
	wg.Wait()
	close(sem)

	return &ProcessResult{
		TotalCount:   len(characterKeys),
		SuccessCount: int(successCount),
		FailCount:    int(failCount),
	}, nil
}

// 通知进度
func notifyProgress(current *int32, total int32, success *int32, fail *int32, callback ProgressCallback) {
	newVal := atomic.AddInt32(current, 1)

	if callback != nil {
		// 每10个或处理完所有项时调用回调函数
		if newVal%10 == 0 || newVal == total {
			callback(
				int(newVal),
				int(total),
				int(atomic.LoadInt32(success)),
				int(atomic.LoadInt32(fail)),
			)
		}
	}
}

// 获取map中的所有键
func getKeysFromMap(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// ConvertSingleJSONToTOML 转换单个JSON对象为TOML文件
func ConvertSingleJSONToTOML(jsonData map[string]interface{}, tomlFilePath string) error {
	// 将map转换为结构体
	jsonBytes, err := json.Marshal(jsonData)
	if err != nil {
		return fmt.Errorf("无法序列化JSON数据: %v", err)
	}

	var characterInfo CharacterInfo
	err = json.Unmarshal(jsonBytes, &characterInfo)
	if err != nil {
		return fmt.Errorf("无法将JSON数据转换为结构体: %v", err)
	}

	if len(characterInfo.StoryTextAudio) > 0 && len(characterInfo.StoryTextAudio[0].Stories) > 0 {
		storyText := characterInfo.StoryTextAudio[0].Stories[0].StoryText

		// 查找代号部分
		startIndex := strings.Index(storyText, "【代号】")
		if startIndex != -1 {
			startIndex += len("【代号】") // 移动到代号之后
			endIndex := strings.Index(storyText[startIndex:], "\n")
			if endIndex != -1 {
				// 提取代号
				characterInfo.CharName = storyText[startIndex : startIndex+endIndex]
			}
		}
	}

	// 创建目录(如果不存在)
	dir := filepath.Dir(tomlFilePath)
	if dir != "" && dir != "." {
		err = os.MkdirAll(dir, 0755)
		if err != nil {
			return fmt.Errorf("无法创建目录: %v", err)
		}
	}

	// 创建并打开文件
	file, err := os.Create(tomlFilePath)
	if err != nil {
		return fmt.Errorf("无法创建TOML文件: %v", err)
	}
	defer file.Close()

	// 将数据编码为TOML并写入文件
	err = toml.NewEncoder(file).Encode(characterInfo)
	if err != nil {
		return fmt.Errorf("无法将数据写入TOML文件: %v", err)
	}

	return nil
}

// ConvertJSONStringToTOML 将JSON字符串转换为TOML文件
func ConvertJSONStringToTOML(jsonString string, tomlFilePath string) error {
	var jsonData map[string]interface{}
	err := json.Unmarshal([]byte(jsonString), &jsonData)
	if err != nil {
		return fmt.Errorf("无法解析JSON字符串: %v", err)
	}

	return ConvertSingleJSONToTOML(jsonData, tomlFilePath)
}
