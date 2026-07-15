import path from "node:path";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { parse } from "node-html-parser";

const configs = {
  "zh-cn": {
    phrases: new Map([
      ["View details", "查看详情"],
      ["Explain", "说明"],
      ["Haihu", "海曙"],
      ["I无关IP资产", "独立知识产权资产"],
      ["科罗拉多", "CO"],
      ["半夜", "HT"],
      ["废水流", "废弃物流"],
      ["聚塑性分数", "分类塑料组分"],
      ["值准备好", "高价值"],
      ["解决方案的解决方案", "解决方案"],
      ["施工与笨重废弃物管线", "建筑与大件废弃物处理线"],
      ["大块废物", "大件废弃物"],
      ["大宗废物", "大件废弃物"],
      ["笨重废弃物", "大件废弃物"],
      ["笨重废物", "大件废弃物"],
      ["单机封装", "单机占地面积"],
      ["可用封装", "可用占地面积"],
      ["可用 的封装范围", "可用占地范围"],
      ["可用封装范围", "可用占地范围"],
      ["项目范围", "项目占地范围"],
      ["现代资源回收设施的两种系统", "面向现代资源回收设施的两套系统"],
      ["建筑废弃物", "C&D 废弃物"],
      ["建筑废料", "C&D 废弃物"],
      ["学历与荣誉", "资质与荣誉"],
      ["科罗拉多 2", "CO2"],
      ["科罗拉多2", "CO2"],
      ["救援服务提供者", "回收服务提供商"],
      ["案件诉讼", "案例操作"],
      ["消毒团队", "环卫团队"],
      ["工艺示波器", "工艺范围"],
      ["混合恢复流", "混合回收物流"],
      ["智能恢复参考", "智能回收参考"],
      ["恢复中心", "回收中心"],
      ["恢复率", "回收率"],
      ["恢复输出", "回收产出"],
      ["体积减少与恢复", "减容与回收"],
      ["可回收分数", "可回收组分"],
      ["可回收分段", "可回收组分"],
      ["光学分流", "光学分选"],
      ["PET瓶子分类", "PET瓶分选"],
      ["HDPE与PP排序", "HDPE与PP分选"],
      ["气流 分离", "气流分离"],
      ["支持 过程模块", "支持的工艺模块"],
      ["实数 限制", "实际限制"],
      ["对比对比", "前后对比"],
      ["合作单元", "合作单位"],
      ["减脂、分离", "减容、分离"],
      ["馈入打包接口", "进料到打包接口"],
      ["进来材料", "进料物料"],
      ["进来的废弃物", "进场废弃物"],
      ["物质家族", "物料类别"],
      ["工艺模块，具分离", "工艺模块，配套分离"],
      ["排序输出", "分选产出"],
      ["流程分选：", "流程排序："],
      ["分类输出", "分选产出"],
      ["分类模块", "分选模块"],
      ["分类统计", "分选统计"],
      ["分类率", "分选率"],
      ["分类系统", "分选系统"],
      ["分类设备", "分选设备"],
      ["分类中心", "分选中心"],
      ["分类类别", "分选类别"],
      ["材料类型", "物料类型"],
      ["材料类别", "物料类别"],
      ["材料范围", "物料范围"],
      ["材料路线", "物料路线"],
      ["材料流", "物料流"],
      ["材料流与报告", "物料流与报告"],
      ["有色人种", "有色"],
      ["清除PET", "透明PET"],
      ["清除 PET", "透明 PET"],
      ["清晰高度", "净空高度"],
      ["无障碍高度", "净空高度"],
      ["第一语言", "L1"],
      ["此外", "Plus"],
      ["打滑", "滑架"],
      ["骑乘", "安装"],
      ["引文讨论", "报价讨论"],
      ["接下来会有什么 happens", "后续流程"],
      ["后续 接下来会遇到什么", "后续流程"],
      ["可用可管理的空间", "可用占地面积"],
      ["可用可封地", "可用场地"],
      ["可用可封厂", "可用场地"],
      ["主要 的", "主要"],
      ["支持 的", "支持的"],
      ["维护 指南", "维护指南"],
      ["停止与减免废弃物项目", "C&D 与大件废弃物项目"],
      ["清晰的自定义废物类型", "清除自定义废弃物类型"],
      ["遥控器", "远程控制"],
    ]),
    words: new Map([
      ["support", "支持"], ["supports", "支持"], ["Supports", "支持"], ["Support", "支持"], ["supporting", "配套"],
      ["details", "详情"], ["detail", "详情"], ["detailed", "详细"], ["Details", "详情"], ["Detail", "详情"],
      ["supplier", "供应商"], ["suppliers", "供应商"], ["View", "查看"], ["view", "查看"],
      ["Send", "发送"], ["send", "发送"], ["Project", "项目"], ["project", "项目"],
      ["constraints", "限制"], ["constraint", "限制"], ["daily", "每日"], ["Daily", "每日"],
      ["case", "案例"], ["training", "培训"], ["available", "可用"], ["Available", "可用"],
      ["avai", "可用"], ["avaiz", "可用"], ["Avai", "可用"],
      ["Maintenance", "维护"], ["maintenance", "维护"], ["mainance", "维护"], ["mainentance", "维护"],
      ["mainintance", "维护"], ["mainten", "维护"], ["mainn", "维护"], ["suzepport", "支持"],
      ["pport", "支持"], ["pports", "支持"], ["approval", "审批"], ["Service", "服务"],
      ["days", "天"], ["container", "集装箱"], ["zones", "区域"], ["steps", "步骤"],
      ["Email", "邮箱"], ["main", "主要"], ["Air", "气流"], ["air", "气流"], ["Guide", "指南"],
      ["Remote", "远程"], ["application", "应用"], ["applications", "应用"], ["Applications", "应用场景"],
      ["design", "设计"], ["interface", "接口"], ["dashboard", "仪表盘"], ["assetsassets", "资产"],
      ["assets", "资产"], ["goals", "目标"], ["areas", "区域"], ["yard", "场地"], ["processes", "工序"],
      ["Happens", "后续"], ["pilot", "试点"], ["Pilot", "试点"], ["line", "产线"], ["Line", "产线"],
      ["footprint", "占地面积"], ["Supported", "支持"], ["upper", "上限"], ["trailer", "拖车"],
      ["tailored", "定制"], ["chain", "流程"], ["Lower", "降低"], ["engineering", "工程"],
      ["uncertainty", "不确定性"], ["ainty", "不确定性"], ["Real", "实际"], ["Independent", "独立"],
      ["software", "软件"], ["modules", "模块"], ["against", "对比"], ["Bottle", "瓶"], ["raised", "提升"],
      ["Haishu", "海曙"], ["Phone", "电话"], ["guide", "指南"], ["constrai", "限制"], ["ains", "限制"],
      ["恢复", "回收"], ["复原", "回收"], ["康复", "回收"], ["饲料", "给料"],
      ["放映", "筛分"], ["屏幕", "显示屏"], ["封装", "占地面积"], ["遗址", "场地"],
      ["笨重", "大件"], ["示波器", "范围"], ["科罗拉多", "CO"], ["体育", "PE"],
      ["嗯", "mm"], ["双重", "t/h"], ["巴林", "打包"],
      ["觅食", "给料"], ["喂食", "给料"], ["开车", "驱动"], ["happens", "后续"],
    ]),
  },
  "zh-hant": {
    phrases: new Map([
      ["View details", "查看詳情"],
      ["Explain", "說明"],
      ["Haihu", "海曙"],
      ["科羅拉多州", "CO"],
      ["半夜", "HT"],
      ["廢水流", "廢棄物流"],
      ["聚塑性分數", "分類塑膠組分"],
      ["值準備好", "高價值"],
      ["施工與笨重廢棄物管線", "營建與大型廢棄物處理線"],
      ["大塊廢物", "大型廢棄物"],
      ["笨重廢棄物", "大型廢棄物"],
      ["笨重廢物", "大型廢棄物"],
      ["單機封裝", "單機佔地面積"],
      ["可用封裝", "可用佔地面積"],
      ["可用 的封裝範圍", "可用佔地範圍"],
      ["可用封裝範圍", "可用佔地範圍"],
      ["現代資源回收設施的兩種系統", "面向現代資源回收設施的兩套系統"],
      ["建築廢棄物", "C&D 廢棄物"],
      ["建築廢料", "C&D 廢棄物"],
      ["學歷與榮譽", "資質與榮譽"],
      ["科羅拉多 2", "CO2"],
      ["科羅拉多2", "CO2"],
      ["救援服務提供者", "回收服務提供商"],
      ["案件訴訟", "案例操作"],
      ["消毒團隊", "環衛團隊"],
      ["工藝示波器", "工藝範圍"],
      ["混合復原串流", "混合回收物流"],
      ["智慧復原參考", "智慧回收參考"],
      ["智慧康復中心", "智慧回收中心"],
      ["康復中心", "回收中心"],
      ["復原中心", "回收中心"],
      ["恢復中心", "回收中心"],
      ["恢復率", "回收率"],
      ["復原率", "回收率"],
      ["可回收分餾物", "可回收組分"],
      ["可回收分段", "可回收組分"],
      ["光學分流", "光學分選"],
      ["PET瓶子分類", "PET瓶分選"],
      ["HDPE與PP排序", "HDPE與PP分選"],
      ["氣流 分離", "氣流分離"],
      ["支援 製程模組", "支援的製程模組"],
      ["實際 限制", "實際限制"],
      ["對比對比", "前後對比"],
      ["合作單元", "合作單位"],
      ["接收到回報", "接收到報告"],
      ["進來資料", "進料物料"],
      ["進來的廢棄物", "進場廢棄物"],
      ["物質家族", "物料類別"],
      ["排序輸出", "分選產出"],
      ["流程分選：", "流程排序："],
      ["分類輸出", "分選產出"],
      ["分類模組", "分選模組"],
      ["分類統計", "分選統計"],
      ["分類率", "分選率"],
      ["分類系統", "分選系統"],
      ["分類設備", "分選設備"],
      ["分類中心", "分選中心"],
      ["分類類別", "分選類別"],
      ["材料類型", "物料類型"],
      ["材料類別", "物料類別"],
      ["材料範圍", "物料範圍"],
      ["材料路線", "物料路線"],
      ["材料流", "物料流"],
      ["材料流與報告", "物料流與報告"],
      ["送料", "給料"],
      ["有色人種", "有色"],
      ["清除PET", "透明PET"],
      ["清除 PET", "透明 PET"],
      ["清場", "透明"],
      ["清晰高度", "淨空高度"],
      ["無障礙高度", "淨空高度"],
      ["第一級", "L1"],
      ["此外", "Plus"],
      ["打滑", "滑架"],
      ["騎乘", "安裝"],
      ["引文討論", "報價討論"],
      ["接下來會有什麼 happens", "後續流程"],
      ["後續 接下來會是什麼", "後續流程"],
      ["可用可管理的空間", "可用佔地面積"],
      ["可用可封地", "可用場地"],
      ["可用可封廠", "可用場地"],
      ["主要 的", "主要"],
      ["支援 的", "支援的"],
      ["維護 指南", "維護指南"],
      ["遙控器", "遠端控制"],
    ]),
    words: new Map([
      ["support", "支援"], ["supports", "支援"], ["Supports", "支援"], ["Support", "支援"], ["supporting", "配套"],
      ["details", "詳情"], ["detail", "詳情"], ["detailed", "詳細"], ["Details", "詳情"], ["Detail", "詳情"],
      ["supplier", "供應商"], ["suppliers", "供應商"], ["View", "查看"], ["view", "查看"],
      ["Send", "傳送"], ["send", "傳送"], ["Project", "專案"], ["project", "專案"],
      ["constraints", "限制"], ["constraint", "限制"], ["daily", "每日"], ["Daily", "每日"],
      ["case", "案例"], ["training", "培訓"], ["available", "可用"], ["Available", "可用"],
      ["avai", "可用"], ["avaiz", "可用"], ["Avai", "可用"],
      ["Maintenance", "維護"], ["maintenance", "維護"], ["mainance", "維護"], ["mainentance", "維護"],
      ["mainintance", "維護"], ["mainten", "維護"], ["mainn", "維護"], ["suzepport", "支援"],
      ["pport", "支援"], ["pports", "支援"], ["approval", "審批"], ["Service", "服務"],
      ["days", "天"], ["container", "貨櫃"], ["zones", "區域"], ["steps", "步驟"],
      ["Email", "電子郵件"], ["main", "主要"], ["Air", "氣流"], ["air", "氣流"], ["Guide", "指南"],
      ["Remote", "遠端"], ["application", "應用"], ["applications", "應用"], ["Applications", "應用場景"],
      ["design", "設計"], ["interface", "介面"], ["dashboard", "儀表板"], ["assetsassets", "資產"],
      ["assets", "資產"], ["goals", "目標"], ["areas", "區域"], ["yard", "場地"], ["processes", "製程"],
      ["Happens", "後續"], ["pilot", "試點"], ["Pilot", "試點"], ["line", "產線"], ["Line", "產線"],
      ["footprint", "佔地面積"], ["Supported", "支援"], ["upper", "上限"], ["trailer", "拖車"],
      ["tailored", "客製"], ["chain", "流程"], ["Lower", "降低"], ["engineering", "工程"],
      ["uncertainty", "不確定性"], ["ainty", "不確定性"], ["Real", "實際"], ["Independent", "獨立"],
      ["software", "軟體"], ["modules", "模組"], ["against", "對比"], ["Bottle", "瓶"], ["raised", "提升"],
      ["Haishu", "海曙"], ["Phone", "電話"], ["guide", "指南"], ["constrai", "限制"], ["ains", "限制"],
      ["恢復", "回收"], ["復原", "回收"], ["康復", "回收"], ["飼料", "給料"],
      ["放映", "篩分"], ["螢幕", "顯示屏"], ["封裝", "佔地面積"], ["遺址", "場地"],
      ["笨重", "大型"], ["示波器", "範圍"], ["科羅拉多", "CO"], ["體育", "PE"],
      ["嗯", "mm"], ["雙重", "t/h"], ["巴林", "打包"],
      ["覓食", "給料"], ["餵食", "給料"], ["開車", "驅動"], ["happens", "後續"],
    ]),
  },
};

function replaceVisibleText(value, config) {
  let result = value;
  for (const [source, target] of config.phrases) result = result.replaceAll(source, target);
  for (const [source, target] of config.words) {
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = /[A-Za-z0-9]/.test(source)
      ? result.replace(new RegExp(`\\b${escaped}\\b`, "g"), target)
      : result.replaceAll(source, target);
  }
  return result.replace(/\s+([，。；：、！？])/g, "$1");
}

function setSequentialText(root, selector, values) {
  root.querySelectorAll(selector).forEach((node, index) => {
    if (values[index]) node.set_content(values[index]);
  });
}

function restoreProtectedUiCodes(root, directory) {
  const isChinese = directory === "zh-cn" || directory === "zh-hant";
  if (!isChinese) return;

  setSequentialText(root, ".spec-group-ai .spec-card-rank", ["SYS-01", "SYS-02", "SYS-03"]);
  setSequentialText(root, ".spec-card-grid-ai .spec-card-rank", ["SYS-01", "SYS-02", "SYS-03"]);
  setSequentialText(root, ".product-page-ai .process-timeline-rank", ["SYS-01", "SYS-02", "SYS-03", "SYS-04", "SYS-05"]);
  setSequentialText(root, ".product-page-ai .product-compare-row-id", ["M-01", "M-02", "M-03", "M-04", "M-05"]);
  setSequentialText(root, ".product-page-ai .ai-faq-question span", ["Q-01", "Q-02", "Q-03", "Q-04"]);

  const aiDataCards = root.querySelectorAll(".product-page-ai .sorting-data-grid article");
  aiDataCards[1]?.querySelector("strong")?.set_content("2<small>t/h max</small>");
  aiDataCards[5]?.querySelector("strong")?.set_content("17<small>days fastest</small>");

  setSequentialText(root, ".product-page-industrial .industrial-ledger-tag", ["M-01", "M-02", "M-03", "M-04"]);
  setSequentialText(root, ".product-page-industrial .product-compare-row-id", ["M-01", "M-02", "M-03", "M-04"]);
  setSequentialText(root, ".product-page-industrial .industrial-rfq-checklist article > span", [
    "DATA-01",
    "DATA-02",
    "DATA-03",
    "DATA-04",
  ]);
}

for (const [directory, config] of Object.entries(configs)) {
  for (const fileName of await readdir(path.resolve("src/content", directory))) {
    if (!fileName.endsWith(".json")) continue;
    const filePath = path.resolve("src/content", directory, fileName);
    const content = JSON.parse(await readFile(filePath, "utf8"));
    for (const key of ["title", "description", "ogTitle", "ogDescription"]) {
      content.meta[key] = replaceVisibleText(content.meta[key] || "", config);
    }
    content.pageTitle = replaceVisibleText(content.pageTitle, config);

    const root = parse(content.bodyHtml);
    const visit = (node) => {
      if (node.nodeType === 3) {
        node.rawText = replaceVisibleText(node.rawText, config);
        return;
      }
      if (node.nodeType !== 1) return;
      for (const attribute of ["alt", "aria-label", "placeholder", "title"]) {
        const value = node.getAttribute(attribute);
        if (value) node.setAttribute(attribute, replaceVisibleText(value, config));
      }
      node.childNodes.forEach(visit);
    };
    visit(root);
    restoreProtectedUiCodes(root, directory);
    content.bodyHtml = root.toString();
    await writeFile(filePath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  }
}

console.log("Cleaned visible machine-translation residue in Simplified and Traditional Chinese content.");
