import test from 'ava'
import Kueasm, {ASM_MODE} from '@/lib/kueasm'

const patterns = [
  {
    asm: 'L: EQU 12H',
    mode: 'kuechip3',
    labels: {
      L: 18
    },
  },
  {
    asm: 'L: EQU 12',
    mode: 'kuechip3',
    labels: {
      L: 12
    },
  },
  {
    asm: `
        LOC  AFTER
        DAT  1
        DAT  2

        EOR  ACC, ACC

AFTER:  EQU  CA
        END
`,
    mode:    'kuechip3',
    labels: {
      AFTER: 2
    },
  }
]


test.serial('Process EQU and create labels list correctly', (t) => {
  for ( const p of patterns ) {
    const kueasm = new Kueasm(p.asm, p.mode as ASM_MODE) as any
    kueasm.exec()
    const labels = kueasm._labels
    t.deepEqual(labels, p.labels)
  }
})
