// Recordings supplied for the 2015–2019 and 2021–2022 papers.
// Section boundaries follow the long pause after the lecture in each recording.
(() => {
  const tracks = {
    2015: ['mp3', 1371.51, 497.47, 679.30],
    2016: ['m4a', 1448.39, 530.80, 712.23],
    2017: ['m4a', 1464.06, 539.76, 720.83],
    2018: ['m4a', 1393.40, 545.32, 738.13],
    2019: ['m4a', 1532.47, 580.21, 760.89],
    2021: ['mp3', 1518.40, 639.13, 818.42],
    2022: ['mp3', 1527.22, 573.60, 754.61]
  }
  for (const [year, [extension, duration, sectionAEnd, sectionBStart]] of Object.entries(tracks)) {
    const collection = Number(year) < 2020 ? window.TEM8_LISTENING_ARCHIVE : window.TEM8_MID_LISTENING
    if (!collection?.[year]) continue
    Object.assign(collection[year], {
      audio: `audio/tem8-listening-${year}.${extension}`,
      audioDuration: duration,
      audioNote: `${year} 年真题听力（含 Section A、Section B）`,
      sectionAEnd,
      sectionBStart
    })
  }
})()
