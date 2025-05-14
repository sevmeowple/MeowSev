import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: 'atx',        // 使用 # 格式的标题
  codeBlockStyle: 'fenced',   // 使用 ``` 的代码块格式
  hr: '---',                  // 水平分隔线格式
  bulletListMarker: '-',      // 无序列表使用 - 符号
  emDelimiter: '_'            // 使用下划线表示斜体
});

turndown.addRule("removeLinks", {
  filter: ["a"],
  replacement: function (content, node) {
    return content;
  },
});

// 1. 过滤掉 script 标签及其内容
turndown.remove(['script']);

// 2. 过滤掉 style 标签及其内容
turndown.remove(['style']);

// 3. 过滤掉 link 标签(CSS)
turndown.remove(['link']);

turndown.addRule('removeImages', {
  filter: 'img',
  replacement: function() {
    // 返回空字符串，完全移除图片
    return '';
  }
});

// 5. 自定义链接处理规则 - 只保留文本内容
turndown.addRule('removeLinks', {
  filter: 'a',
  replacement: function(content) {
    // 只返回链接内的文本内容，去掉 URL
    return content;
  }
});


// 跳过包含"一览"的表格
turndown.addRule("skipOverviewTables", {
  filter: function (node) {
    if (node.nodeName === "TABLE") {
      const thElements = node.getElementsByTagName("th");
      for (let i = 0; i < thElements.length; i++) {
        if (thElements[i].textContent?.includes("一览")) {
          return true;
        }
      }
    }
    return false;
  },
  replacement: function () {
    return ""; // 返回空字符串,相当于删除该表格
  },
});

export { turndown };
