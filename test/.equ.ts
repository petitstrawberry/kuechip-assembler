import test from 'ava'
import Kueasm, {ASM_MODE} from '@/lib/kueasm'

const patterns = [
  {
    asm: 'L: EQU 12H',
    mode: 'kuechip3',
    test: (t: any, kueasm: any) => {
      kueasm.processEqu(kueasm._asm[0])
      t.is(kueasm._labels.L, 18)
    },
  },
  {
    asm: 'L: EQU 12',
    mode: 'kuechip3',
    test: (t: any, kueasm: any) => {
      kueasm.processEqu(kueasm._asm[0])
      t.is(kueasm._labels.L, 12)
    },
  },
]


test.serial('EQU', (t) => {
  for ( const p of patterns ) {
    const kueasm = new Kueasm(p.asm, p.mode as ASM_MODE) as any
    kueasm.parse()
    p.test(t, kueasm)
  }
})
