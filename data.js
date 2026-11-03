(() => {
// 全部为原创示例题，非历年真题。取得真题使用权限后可按此结构导入。
const questions = [
  {id:'R01',type:'reading',typeName:'阅读理解',passage:'A university library extended its opening hours during examination week. Staff expected the extra hours to attract more visitors, but the number of students entering the building barely changed. Interviews revealed that many students valued the option to study late, even if they rarely used it. The library therefore kept the extended schedule while adjusting staffing according to actual demand.',prompt:'Why did the library keep its extended schedule?',options:['Visitor numbers rose sharply.','Students valued having the option.','Staff requested longer shifts.','The building was usually empty.'],answer:1,analysis:'文中指出，学生重视深夜学习这一“选择权”，即使很少真正使用。'},
  {id:'R02',type:'reading',typeName:'阅读理解',passage:'A university library extended its opening hours during examination week. Staff expected the extra hours to attract more visitors, but the number of students entering the building barely changed. Interviews revealed that many students valued the option to study late, even if they rarely used it. The library therefore kept the extended schedule while adjusting staffing according to actual demand.',prompt:'What can be inferred about the library’s staffing?',options:['It was increased on every shift.','It no longer depended on opening hours.','It was matched to actual use.','It was decided by student vote.'],answer:2,analysis:'最后一句说明人员安排会依据实际需求调整。'},
  {id:'R03',type:'reading',typeName:'阅读理解',passage:'A university library extended its opening hours during examination week. Staff expected the extra hours to attract more visitors, but the number of students entering the building barely changed. Interviews revealed that many students valued the option to study late, even if they rarely used it. The library therefore kept the extended schedule while adjusting staffing according to actual demand.',prompt:'The word “barely” is closest in meaning to:',options:['hardly','rapidly','regularly','deliberately'],answer:0,analysis:'barely changed 表示“几乎没有变化”，hardly 最接近。'},
  {id:'L01',type:'language',typeName:'语言运用',prompt:'The committee’s decision was based on a careful ___ of the available evidence.',options:['assessment','assumption','assembly','attachment'],answer:0,analysis:'assessment of evidence 表示“对证据的评估”，搭配自然。'},
  {id:'L02',type:'language',typeName:'语言运用',prompt:'Had she known about the delay, she ___ an earlier train.',options:['takes','will take','would have taken','had taken'],answer:2,analysis:'Had she known 是省略 if 的过去虚拟条件句，主句用 would have done。'},
  {id:'L03',type:'language',typeName:'语言运用',prompt:'The proposal is appealing in theory; ___, its cost may be difficult to justify.',options:['therefore','however','likewise','moreover'],answer:1,analysis:'前后表达转折，应使用 however。'},
  {id:'V01',type:'vocabulary',typeName:'词汇辨析',prompt:'The speaker gave a concise account of the incident. “Concise” means:',options:['detailed and lengthy','brief but clear','highly emotional','deliberately vague'],answer:1,analysis:'concise 意为“简明扼要的”。'},
  {id:'V02',type:'vocabulary',typeName:'词汇辨析',prompt:'The new evidence helped to ___ the witness’s earlier statement.',options:['corroborate','diminish','postpone','disguise'],answer:0,analysis:'corroborate 意为“证实、印证”。'},
  {id:'T01',type:'translation',typeName:'翻译练习',passage:'城市里越来越多的公共空间开始兼顾安静阅读与社区交流。它们的价值不仅在于提供场地，也在于让不同年龄的人有机会相遇。',prompt:'请将上面的中文段落译成英文。',analysis:'开放题不自动评分。可检查“兼顾”“不仅……也……”和“有机会相遇”的表达是否准确、自然。'},
  {id:'W01',type:'writing',typeName:'写作练习',prompt:'Write an essay of about 300 words on the following topic: Should universities require students to take courses outside their major?',analysis:'开放题不自动评分。复盘时重点检查观点是否明确、论证是否充分、段落衔接及语言准确性。'}
]
const categories = [
  {id:'reading',name:'阅读理解',en:'READING',icon:'◫',desc:'抓住主旨与细节'},
  {id:'language',name:'语言运用',en:'LANGUAGE USE',icon:'✳',desc:'语法与语篇判断'},
  {id:'vocabulary',name:'词汇辨析',en:'VOCABULARY',icon:'◇',desc:'词义与语境搭配'},
  {id:'translation',name:'翻译练习',en:'TRANSLATION',icon:'↗',desc:'表达准确与自然'},
  {id:'writing',name:'写作练习',en:'WRITING',icon:'✎',desc:'组织观点与论证'}
]
window.TEM8_DATA = { questions, categories }
})();
