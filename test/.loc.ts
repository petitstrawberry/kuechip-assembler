import test from 'ava'
import Kueasm, {ASM_MODE} from '@/lib/kueasm'

const patterns = [
  {
    asm: '  LOC 10H',
    mode: 'kuechip3',
    test: (t: any, kueasm: any) => {
      kueasm.processLoc(kueasm._asm[0])
      t.is(kueasm._locAddr, 16)
    },
  },
  {
    asm: 'LOC 120',
    mode: 'kuechip3',
    test: (t: any, kueasm: any) => {
      kueasm.processLoc(kueasm._asm[0])
      t.is(kueasm._locAddr, 120)
    },
  },
  {
    asm: `        LOC  AFTER
                  DAT  1
                  DAT  2

                  EOR  ACC, ACC

          AFTER:  EQU  CA
                  END
         `,
    mode: 'kuechip3',
    test: (t: any, kueasm: any) => {
      kueasm.processLoc(kueasm._asm[0])
      t.is(kueasm._locAddr, undefined)
    },
  }
]


test.serial('LOC', (t) => {
  for ( const p of patterns ) {
    const kueasm = new Kueasm(p.asm, p.mode as ASM_MODE) as any
    kueasm.parse()
    p.test(t, kueasm)
  }
})
