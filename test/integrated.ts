import fs from 'fs'
import test from 'ava'
// import sinon from 'sinon'

import Kueasm from '../lib/kueasm'

// package.json があるディレクトリからの相対パスで記述
const allAsmFiles = [
  'sample/4-01.asm',
  'sample/4-02.asm',
  'sample/4-03.asm',
  'sample/4-04.asm',
  'sample/4-05.asm',
  'sample/4-06.asm',
  'sample/4-07.asm',
  'sample/4-08.asm',
  'sample/4-09.asm',
  'sample/4-10.asm',
  'sample/push_pop.asm',
]


// 指定があればその入力を使う
const asmFiles = (process.argv.length > 2 ? process.argv.slice(2) : allAsmFiles) as string[]
asmFiles.forEach((asmFile) => {
  test.serial(`pattern: ${asmFile}`, (t) => {
    const asm = fs.readFileSync(asmFile).toString()
    const exp = fs.readFileSync(asmFile.replace(/.asm$/, '.exp')).toString()
    const binary = (new Kueasm(asm, 'kuechip3')).exec()
    // const binary = (new Kueasm(asm, 'kuechip3', 'debug')).exec()  // ログレベル変更
    t.truthy(binary)
    t.deepEqual(binary?.split('\n'), exp.split('\n'))
  })
})
