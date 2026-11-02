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

// 与 R01–R03 的原创示例阅读对应；译文和讲解均为人工编写。
const segments = [
  {
    en:'A university library extended its opening hours during examination week.',
    zh:'考试周期间，一所大学图书馆延长了开放时间。',
    note:'主干是 A university library extended its opening hours；during examination week 是时间状语。',
    syntax:[['主语','A university library'],['谓语','extended'],['宾语','its opening hours'],['时间状语','during examination week']],
    focus:'extend opening hours：延长开放时间。'
  },
  {
    en:'Staff expected the extra hours to attract more visitors, but the number of students entering the building barely changed.',
    zh:'工作人员原以为增加的开放时段会吸引更多访客，但进入图书馆的学生人数几乎没有变化。',
    note:'but 连接转折关系；entering the building 修饰 students；barely 表示“几乎不”。',
    syntax:[['前半句主语','Staff'],['前半句谓语','expected'],['宾语结构','the extra hours to attract more visitors'],['转折连词','but'],['后半句主语','the number of students entering the building'],['后半句谓语','barely changed']],
    focus:'expect A to do B：预期 A 会做 B；the number of + 复数名词作主语时，谓语用单数。'
  },
  {
    en:'Interviews revealed that many students valued the option to study late, even if they rarely used it.',
    zh:'访谈显示，许多学生重视能够在深夜学习这一选择，即使他们很少真正利用它。',
    note:'that 引导宾语从句；even if 引导让步状语从句，说明“少用”和“重视”可以同时成立。',
    syntax:[['主句主语','Interviews'],['主句谓语','revealed'],['宾语从句','that many students valued the option to study late'],['让步从句','even if they rarely used it']],
    focus:'value the option to do sth.：看重做某事的选择权。'
  },
  {
    en:'The library therefore kept the extended schedule while adjusting staffing according to actual demand.',
    zh:'因此，图书馆保留了延长开放的安排，同时根据实际需求调整人员配置。',
    note:'therefore 承接上文结论；while adjusting 表示同时采取的措施；according to actual demand 说明调整依据。',
    syntax:[['主语','The library'],['连接副词','therefore'],['谓语','kept'],['宾语','the extended schedule'],['伴随状语','while adjusting staffing'],['依据状语','according to actual demand']],
    focus:'staffing：人员配置；according to：依据。'
  }
]

const meanings = {
  a:'一（个）',university:'大学',library:'图书馆',extended:'延长了；扩展的',its:'它的',opening:'开放的',hours:'时间；小时',during:'在……期间',examination:'考试',week:'周',
  staff:'工作人员',expected:'预期',the:'这；该',extra:'额外的',to:'去；用于',attract:'吸引',more:'更多',visitors:'访客',but:'但是',number:'数量',of:'……的',students:'学生',entering:'进入',building:'建筑；馆舍',barely:'几乎没有',changed:'变化',
  interviews:'访谈',revealed:'显示；揭示',that:'（引导从句）',many:'许多',valued:'重视',option:'选择；选择权',study:'学习',late:'晚；深夜',even:'甚至',if:'如果；即使',they:'他们',rarely:'很少',used:'使用',it:'它',
  therefore:'因此',kept:'保留',schedule:'安排；日程',while:'同时；当……时',adjusting:'调整',staffing:'人员配置',according:'依据',actual:'实际的',demand:'需求'
}
const details = {
  barely:'barely changed 表示“几乎没有变化”，不可理解成“变化很大”。',
  valued:'value 在这里作动词，表示“重视”，不是名词“价值”。',
  option:'the option to study late 指“可以深夜学习的选择权”，是保留延时开放的关键原因。',
  staffing:'staffing 指某项服务需要安排的工作人员数量或配置。',
  demand:'actual demand 是实际需求，与员工最初预期的访客增长形成对照。'
}
const quizTypes = { R01:'原因题', R02:'推断题', R03:'词义题' }

function tokenize(text) {
  return (text.match(/[A-Za-z]+(?:[’'][A-Za-z]+)?|[^A-Za-z\s]+|\s+/g) || []).map((part, i) => ({
    text:part, index:i, key:part.toLowerCase().replace(/[’']/g, "'"), isWord:/^[A-Za-z]/.test(part)
  }))
}
window.TEM8_READING = { segments, meanings, details, quizTypes, tokenize }

})();
