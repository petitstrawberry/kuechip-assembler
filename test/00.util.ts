import test from 'ava'
import util from '@/lib/util'

test.serial('util.isNumber works correctly', (t) => {
  t.is(util.isNumber(1),     true)
  t.is(util.isNumber('1'),   true)
  t.is(util.isNumber(-1),    true)
  t.is(util.isNumber('10h'), true)
  t.is(util.isNumber('10H'), true)
  t.is(util.isNumber('FFH'), true)
  t.is(util.isNumber('a'),   false)
})

test.serial('util.evalExpression works correctly', (t) => {
  t.is(util.evalExpression('1',       {}       ),       1)
  t.is(util.evalExpression('121',     {}       ),     121)
  t.is(util.evalExpression('-1000',   {}       ),   -1000)
  t.is(util.evalExpression('1+1',     {}       ),       2)
  t.is(util.evalExpression('2*1+3*3', {}       ),      11)
  t.is(util.evalExpression('FOO+1',   {FOO: 10}),      11)
  t.is(
    util.evalExpression('FOO*_BAR+B_A_Z', {FOO: 10, _BAR: 2, B_A_Z: 5}),
    25,
  )

  t.is(util.dec2hex(  0, 4), '0x0000')
  t.is(util.dec2hex( 10, 4), '0x000A')
  t.is(util.dec2hex(255, 4), '0x00FF')
  t.is(util.dec2hex( -1, 4), '0xFFFF')

  t.is(util.dec2hex(  0, 2), '0x00')
  t.is(util.dec2hex( 10, 2), '0x0A')
  t.is(util.dec2hex(255, 2), '0xFF')
  t.is(util.dec2hex( -1, 2), '0xFF')

  t.is(util.dec2hex(  2, 4, ''), '0002')
  t.is(util.dec2hex( 16, 4, ''), '0010')
  t.is(util.dec2hex(256, 4, ''), '0100')
  t.is(util.dec2hex( -2, 4, ''), 'FFFE')

  t.is(util.dec2hex(  2, 2, ''), '02')
  t.is(util.dec2hex( 16, 2, ''), '10')
  t.is(util.dec2hex(256, 2, ''), '00')
  t.is(util.dec2hex( -2, 2, ''), 'FE')
})
