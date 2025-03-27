import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});


turndown.addRule("removeLinks", {
  filter: ["a"],
  replacement: function (content, node) {
    return content;
  },
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
