const fs = require('fs')
const path = require('path')
const vm = require('vm')
const assert = require('assert')

const root = __dirname
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8')
const candidates = app.slice(app.indexOf('  function dictionaryCandidates('), app.indexOf('  function needsDictionary('))
const forms = app.slice(app.indexOf('  const wordLemmas ='), app.indexOf('  const extras ='))
const source = `const dictionary = window.TEM8_DICTIONARY; const dictionaryPrefixes = window.TEM8_DICTIONARY_PREFIXES;\n${candidates}\n${forms}\nthis.form = dictionaryForm; this.buckets = dictionaryBuckets; this.lemmas = wordLemmas;`
const original = { window: { TEM8_DICTIONARY: {}, TEM8_DICTIONARY_PREFIXES: new Set() } }

for (const file of fs.readdirSync(path.join(root, 'dictionary')).filter(name => /^[a-z]\.js$/.test(name))) {
  vm.runInNewContext(fs.readFileSync(path.join(root, 'dictionary', file), 'utf8'), original)
}
vm.runInNewContext(fs.readFileSync(path.join(root, 'dictionary', 'prefixes.js'), 'utf8'), original)
vm.runInNewContext(source, original)

const shards = new Map()
for (const file of fs.readdirSync(path.join(root, 'dictionary', 'prefix'))) {
  const context = { window: { TEM8_DICTIONARY: {} } }
  vm.runInNewContext(fs.readFileSync(path.join(root, 'dictionary', 'prefix', file), 'utf8'), context)
  shards.set(path.basename(file, '.js'), context.window.TEM8_DICTIONARY)
}
const reconstructed = Object.assign({}, ...shards.values())
assert.deepStrictEqual(JSON.parse(JSON.stringify(reconstructed)), JSON.parse(JSON.stringify(original.window.TEM8_DICTIONARY)))
assert.deepStrictEqual([...shards.keys()].sort(), [...original.window.TEM8_DICTIONARY_PREFIXES].sort())

const subset = { window: { TEM8_DICTIONARY: {}, TEM8_DICTIONARY_PREFIXES: original.window.TEM8_DICTIONARY_PREFIXES } }
vm.runInNewContext(source, subset)
const words = Object.keys(original.window.TEM8_DICTIONARY)
const samples = words.filter((_, index) => index % 29 === 0)
for (const word of Object.keys(original.lemmas)) samples.push(word)
for (const word of ['studies', 'running', 'British\'s', 'well-known', 'students\'', '123', '###']) samples.push(word)
for (const word of [...samples]) samples.push(word + 's', word + 'ed', word + 'ing')

for (const word of samples) {
  const loaded = subset.window.TEM8_DICTIONARY
  for (const key of Object.keys(loaded)) delete loaded[key]
  for (const bucket of subset.buckets(word)) Object.assign(loaded, shards.get(bucket))
  assert.strictEqual(subset.form(word), original.form(word), `Different lemma for ${word}`)
}
console.log(`Verified ${words.length} entries and ${samples.length} lookup forms across ${shards.size} shards`)
