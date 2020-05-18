import test from 'ava'
import Kueasm from '@/lib/kueasm'

test.serial('util in kuechip3 mode', (t) => {
  const kueasm = new Kueasm('', 'kuechip3') as any // any にすると private を無視できる
  t.is(kueasm.isNumber(1),   true)
  t.is(kueasm.isNumber('1'), true)
  t.is(kueasm.isNumber(-1),  true)
  t.is(kueasm.isNumber('a'), false)

  t.is(kueasm.evalExpression('1'),       1         )
  t.is(kueasm.evalExpression('121'),     121       )
  t.is(kueasm.evalExpression('-1000'),   -1000     )
  t.is(kueasm.evalExpression('1+1'),     2         )
  t.is(kueasm.evalExpression('2*1+3*3'), 11        )
  t.is(kueasm.evalExpression('FOO+1'),   '$(FOO+1)')

  t.is(kueasm.dec2hex(0),   '0x0000')
  t.is(kueasm.dec2hex(10),  '0x000A')
  t.is(kueasm.dec2hex(255), '0x00FF')
  t.is(kueasm.dec2hex(-1),  '0xFFFF')
})


test.serial('util in kuechip2 mode', (t) => {
  const kueasm = new Kueasm('', 'kuechip2') as any // any にすると private を無視できる

  t.is(kueasm.dec2hex(0),   '0x00')
  t.is(kueasm.dec2hex(10),  '0x0A')
  t.is(kueasm.dec2hex(255), '0xFF')
  t.is(kueasm.dec2hex(-1),  '0xFF')
})
