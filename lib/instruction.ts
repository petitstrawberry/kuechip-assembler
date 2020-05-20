import Parser from '@/lib/parser'
import util   from '@/lib/util'
import logger from '@/lib/logger'


const MNEMONIC_MAP: {[key: string]: number} = {
  LD : 0x60, ST : 0x70, SBC: 0x80, ADC: 0x90, SUB: 0xA0,
  ADD: 0xB0, EOR: 0xC0, OR : 0xD0, AND: 0xE0, CMP: 0xF0,
}


export interface AssembleParams {
  labels:         {[key: string]: number}
  curAddr:        number
  locAddr:        number | undefined
  onlyAddrAlloc?: boolean // true なら配置アドレスの決定のみ行う (バイナリ表現への変換はしない)
}

export interface AssembleResult {
  curAddrInc: number
  locAddrInc: number
}


export default class Instruction {
  private readonly _raw: string

  // パース後のトークン
  private _label?:            string
  private _mnemonic?:         string
  private _op1?:              string
  private _op2?:              string
  private _comment?:          string

  // バイナリ値
  private _opcode?:           number
  private _operand?:          number

  // 配置アドレス指定 (LOC-DAT 用)
  private _addr?:             number

  // ラベルの値が評価できない時に true. メモリの配置が決定した後に評価する
  // private _isSkipped:         boolean = false
  private _requireAddrWidth?: number


  // getter
  public raw()       { return this._raw }
  public label()     { return this._label }
  public mnemonic()  { return this._mnemonic }
  public op1()       { return this._op1 }
  // public isSkipped() { return this._isSkipped }


  /**
   * @param content - アセンブリ命令 (1行) の内容
   */
  constructor(content: string) {
    this._raw = content
    this.parse()
  }


  /**
   * 命令行 (ニーモニックのある行) かチェックする
   * @returns ある: true, ない: false
   */
  private hasMnemonic() {
    return ( this._mnemonic != null )
  }


  /**
   * アセンブリ命令にオペランドが 1 つあるかどうかをチェックする
   * @returns ある: true, ない: false
   */
  private hasOneOperand() {
    return ( this._op1 != null )
  }


  /**
   * アセンブリ命令にオペランドが 2 つあるかどうかをチェックする
   * @returns ある: true, ない: false
   */
  private hasTwoOperands() {
    return ( this._op1 !== null && this._op2 != null )
  }


  /**
   * パースして各トークンを記録
   */
  private parse() {
    const result = (new Parser(this._raw)).parse()
    this._label    = result.label    ? result.label.toUpperCase()    : undefined
    this._mnemonic = result.mnemonic ? result.mnemonic.toUpperCase() : undefined
    this._op1      = result.op1      ? result.op1.toUpperCase()      : undefined
    this._op2      = result.op2      ? result.op2.toUpperCase()      : undefined
    this._comment  = result.comment  ? result.comment.toUpperCase()  : undefined
  }


  /**
   * アセンブルしてオペコード/オペランドのフィールドにセットする.
   * ラベルで評価できないなら _isSkipped をセットする.
   * @param params - パラメータのオブジェクト
   * @returns アドレスのインクリメントサイズオブジェクト
   */
  public assemble(params: AssembleParams): AssembleResult {
    const result: AssembleResult = { curAddrInc: 0, locAddrInc: 0 }

    const mnemonic = this.mnemonic()

    if ( mnemonic == null ) {
      throw util.error(`internal error: calling to assemble() of 'Instruction' object without mnemonic.`)
    }

    if      (mnemonic.match(/^EQU$/)             ) { /* do nothing */                 }
    else if (mnemonic.match(/^LOC$/)             ) { /* do nothing */                 }
    else if (mnemonic.match(/^DAT$/)             ) { this.assembleDat(params)         }
    else if (mnemonic.match(/^PROG$/)            ) { this.assembleProg(params)        }
    else if (mnemonic.match(/^LD$/)              ) { this.assembleLd(params)          }
    else if (mnemonic.match(/^(ST|SBC|ADC)$/)    ) { this.assembleStSbcAdc(params)    }
    else if (mnemonic.match(/^SUB$/)             ) { this.assembleSub(params)         }
    else if (mnemonic.match(/^ADD$/)             ) { this.assembleAdd(params)         }
    else if (mnemonic.match(/^(EOR|OR|AND|CMP)$/)) { this.assembleEorOrAndCmp(params) }
    else if (mnemonic.match(/^B/)                ) { this.assembleB(params)           }
    else if (mnemonic.match(/^NOP$/)             ) { this.assembleNop(params)         }
    else if (mnemonic.match(/^HLT$/)             ) { this.assembleHlt(params)         }
    else if (mnemonic.match(/^RCF$/)             ) { this.assembleRcf(params)         }
    else if (mnemonic.match(/^SCF$/)             ) { this.assembleScf(params)         }
    else if (mnemonic.match(/^END$/)             ) { /* do nothing */                 }
    else if (mnemonic.match(/^INC$/)             ) { this.assembleInc(params)         }
    else if (mnemonic.match(/^DEC$/)             ) { this.assembleDec(params)         }
    else if (mnemonic.match(/^PSH$/)             ) { this.assemblePsh(params)         }
    else if (mnemonic.match(/^POP$/)             ) { this.assemblePop(params)         }
    else if (mnemonic.match(/^CAL$/)             ) { this.assembleCal(params)         }
    else if (mnemonic.match(/^RET$/)             ) { this.assembleRet(params)         }
    else if (mnemonic.match(/^[SR][RL]/)         ) { this.assembleSrRl(params)        }
    else if (mnemonic.match(/^OUT$/)             ) { this.assembleOut(params)         }
    else if (mnemonic.match(/^IN$/)              ) { this.assembleIn(params)          }
    else if (mnemonic.match(/^ST/)               ) { this.assembleSt(params)          }
    else {
      throw util.error(`Invalid mnemonic '${this.mnemonic()}.`)
    }

    if ( this.mnemonic() === 'DAT' ) {
      result.locAddrInc++
    }
    // DAT 命令以外の順番にアドレスを振る命令の場合
    else {
      if ( params.onlyAddrAlloc ) {
        this._addr = params.curAddr // 配置アドレスを確定
      }

      if ( ! this._requireAddrWidth ) {
        // 次の配置アドレスを決定
        if ( this._opcode == null ) {
          throw util.error('internal error: Both _requiredAddrWidth and _opcode are not defined.')
        }
        else {
          result.curAddrInc++        // アドレスインクリメント回数を増加
          this._requireAddrWidth = 2
        }

        if ( this._operand != null ) {
          result.curAddrInc++        // アドレスインクリメント回数を増加
          this._requireAddrWidth = 4
        }
      }

      result.curAddrInc = this._requireAddrWidth
      logger.debug(`Increase addr ${result.curAddrInc} unit(s).`)
    }

    return result
  }


  /**
   * 代入演算と算術演算のオペコードを取得 (規則配列のもの)
   * @param params - assemble() された時のパラメータ
   * @returns {opcode?: number, operand?: number | string}
   */
  private getOpcodeOfAssignmentAndArithmeticInst(params: AssembleParams)
  : {opcode?: number, operand?: number, requireAddrWidth?: number}
  {
    if ( this.mnemonic() == null ) {
      throw util.error(`internal error: calling getOpcodeOfAssignmentAndArithmeticInst() of 'Instruction' object without mnemonic.`)
    }

    if ( ! this.hasTwoOperands() ) {
      throw util.error(`Expected 2 operands for ${this.mnemonic()}`)
    }

    // チェック済みなので強制的に string として OK
    const mnemonic = this._mnemonic as string
    const op1      = this._op1      as string
    const op2      = this._op2      as string

    const baseOpcode = MNEMONIC_MAP[mnemonic] as number  // 命令表の行を決定
    if ( !baseOpcode ) {
      throw util.error(`Internal error: invalid mnemonic ${mnemonic}`)
    }

    const res: {opcode?: number, operand?: number} = {}

    // op1
    if      (op1 === 'ACC') { res.opcode = baseOpcode + 0 }
    else if (op1 === 'IX' ) { res.opcode = baseOpcode + 8 }
    else                    {
      throw util.error(`Invalid operand '${op1}' for ${mnemonic}`)
    }

    // op2 == ACC
    if (op2 === 'ACC') {
      if (mnemonic.match(/^ST/)) {
        throw util.error(`Invalid operand '${op2}' of 'ST' (use 'LD' to set registers)`)
      }
      if ( params.onlyAddrAlloc ) { return {requireAddrWidth: 1} }
      res.opcode += 0
    }
    // op2 == IX
    else if (op2 === 'IX') {
      if (mnemonic.match(/^ST/)) {
        throw util.error(`Invalid operand '${op2}' of 'ST' (use 'LD' to set registers)`)
      }
      if ( params.onlyAddrAlloc ) { return {requireAddrWidth: 1} }
      res.opcode += 1
    }
    // op2 == d (ラベルを含む)
    else if (op2.match(/^([A-Z0-9_\+\-\*\/]+)$/)) {
      if (mnemonic.match(/^ST/)) {
        throw util.error(`Invalid operand '${op2}' of 'ST' (use 'LD' to set registers)`)
      }

      if ( params.onlyAddrAlloc ) { return {requireAddrWidth: 2} }
      res.opcode += 2
      res.operand = util.evalExpression(op2, params.labels)

      if ( !util.isNumber(res.operand) ) {
        logger.debug(`Operand ${res.operand} cannot be evaluated now. skip.`)
      }
    }
    // # op2 = [sp+d]
    // elsif ($op2 =~ /\[(SP|sp)\+*([\w\+\-]*)\]/) {
    //   if ( params.onlyAddrAlloc ) { return {requireAddrWidth: 2} }
    //   $opcode += 3;
    //   $operand = parse_expression($2);
    // }
    // # op2 = [IX+d] / [IX]
    // elsif ($op2 =~ /\[(IX|ix)\+*([\w\+\-]*)\]/) {
    //   if ( params.onlyAddrAlloc ) { return {requireAddrWidth: 2} }
    //   $opcode += 6;
    //   $operand = parse_expression($2);
    // }
    // op2 = [d]                         # d : decimal, hex or label
    else if (op2.match(/^\[([A-Z0-9_\+\-\*\/]+)\]$/)) {
      if ( params.onlyAddrAlloc ) { return {requireAddrWidth: 2} }
      res.opcode += 4
      res.operand = util.evalExpression(op2.replace(/[\[\]]/g, ''), params.labels)
      if ( !util.isNumber(res.operand) ) {
        logger.debug(`Operand ${res.operand} cannot be evaluated now. skip.`)
      }
    }
    // # op2 = (IX+d) / (IX) (only for kuechip2)
    // elsif ($op2 =~ /\((IX|ix)\+*([\w\+\-]*)\)/) {
    //   if ( params.onlyAddrAlloc ) { return {requireAddrWidth: 2} }
    //   $opcode += 7;
    //   $operand = parse_expression($2);
    // }
    // # op2 = (d) (only for kuechip2)     # d : decimal, hex or label
    // elsif ($op2 =~ /\(([\w\+\-]+)\)/) { # ラベルも含まれるので \d ではなく \w
    //   if ( params.onlyAddrAlloc ) { return {requireAddrWidth: 2} }
    //   $opcode += 5;
    //   $operand = parse_expression($1);
    // }
    else {
      throw util.error(`Invalid operand '${op1}/${op2}'`)
    }

    return res
  }


  /**
   * DAT のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @todo 分類としては疑似命令になるので kueasm.ts に移したい
   */
  private assembleDat(params: AssembleParams) {
    if ( params.onlyAddrAlloc ) { this._addr = params.locAddr; return }

    if ( ! this.hasOneOperand() ) {
      throw util.error(`Expected 1 operand for ${this.mnemonic()}`)
    }

    if ( params.locAddr == null ) {
      throw util.error('Address for LOC is not defined.')
    }

    const op1    = this._op1 as string // hasOneOperand でチェックしてるので string 扱いして OK
    this._opcode = util.evalExpression(op1, params.labels)
  }


  /**
   * PROG のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   */
  private assembleProg(params: AssembleParams) {
    throw util.error(`'PROG' is not supported`)
  }


  /**
   * LD のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   */
  private assembleLd(params: AssembleParams) {
    if ( ! this.hasTwoOperands() ) {
      throw util.error(`Expected 2 operands for ${this._mnemonic}`)
    }

    const op1 = this._op1 as string
    const op2 = this._op2 as string

    // LD IX SP
    if (op1 === 'IX' && op2 === 'SP') {
      if ( params.onlyAddrAlloc ) { this._requireAddrWidth = 1; return }
      this._opcode = 0x01
    }
    // LD SP IX
    else if (op1 === 'SP' && op2 === 'IX') {
      if ( params.onlyAddrAlloc ) { this._requireAddrWidth = 1; return }
      this._opcode = 0x03
    }
    // LD SP d
    else if (op1 === 'SP' && util.isNumber(op2)) {
      if ( params.onlyAddrAlloc ) { this._requireAddrWidth = 2; return }

      this._opcode = 0x02
      this._operand = util.evalExpression(op2, params.labels)
    }
    // その他の (規則的な割り当てになっている) 命令
    else {
      const res = this.getOpcodeOfAssignmentAndArithmeticInst(params)
      if ( params.onlyAddrAlloc ) { this._requireAddrWidth = res.requireAddrWidth; return }
      if ( res.opcode  != null ) { this._opcode  = res.opcode  }
      if ( res.operand != null ) { this._operand = res.operand }
    }
  }


  /**
   *  ST, SBC, ADC のバイナリ表現を生成
   * @param this._- AsmLine オブジェクト
   */
  private assembleStSbcAdc(params: AssembleParams) {
    if ( ! this.hasTwoOperands() ) {
      throw util.error(`Expected 2 operands for ${this._mnemonic}`)
    }

    const res = this.getOpcodeOfAssignmentAndArithmeticInst(params)
    if ( params.onlyAddrAlloc ) { this._requireAddrWidth = res.requireAddrWidth; return }
    if ( res.opcode  ) { this._opcode  = res.opcode }
    if ( res.operand ) { this._operand = res.operand }
  }


  /**
   * SUB のバイナリ表現を生成
   * @param this._- AsmLine オブジェクト
   */
  private assembleSub(params: AssembleParams) {
    if ( ! this.hasTwoOperands() ) {
      throw util.error(`Expected 2 operands for ${this._mnemonic}`)
    }

    const op1 = this._op1 as string
    const op2 = this._op2 as string

    if (op1 === 'SP') {
      if ( params.onlyAddrAlloc ) { this._requireAddrWidth = 2; return }
      this._opcode  = 0x07
      this._operand = util.evalExpression(op2, params.labels)
    } else {
      const res = this.getOpcodeOfAssignmentAndArithmeticInst(params)
      if ( params.onlyAddrAlloc ) { this._requireAddrWidth = res.requireAddrWidth; return }
      if ( res.opcode  ) { this._opcode  = res.opcode  }
      if ( res.operand ) { this._operand = res.operand }
    }
  }


  /**
   * ADD のバイナリ表現を生成
   * @param this._- AsmLine オブジェクト
   */
  private assembleAdd(params: AssembleParams) {
    if ( ! this.hasTwoOperands() ) {
      throw util.error(`Expected 2 operands for ${this._mnemonic}`)
    }

    const op1 = this._op1 as string
    const op2 = this._op2 as string

    if (op1 === 'SP') {
      if ( params.onlyAddrAlloc ) { this._requireAddrWidth = 2; return }
      this._opcode  = 0x06
      this._operand = util.evalExpression(op2, params.labels)
    } else {
      const res = this.getOpcodeOfAssignmentAndArithmeticInst(params)
      if ( params.onlyAddrAlloc ) { this._requireAddrWidth = res.requireAddrWidth; return }
      if ( res.opcode  ) { this._opcode  = res.opcode  }
      if ( res.operand ) { this._operand = res.operand }
    }
  }


  /**
   * EOR/OR/CMP のバイナリ表現を生成
   * @param this._- AsmLine オブジェクト
   */
  private assembleEorOrAndCmp(params: AssembleParams) {
    logger.error('Not implemented')
    return false
  }


  /**
   * B のバイナリ表現を生成
   * @param this._- AsmLine オブジェクト
   */
  private assembleB(params: AssembleParams) {
    if ( ! this.hasOneOperand() ) {
      throw util.error(`Expected 1 operand for ${this._mnemonic}`)
    }

    if ( params.onlyAddrAlloc ) { this._requireAddrWidth = 2; return }

    if      ( this._mnemonic === 'BA'  ) { this._opcode = 0x30 }
    else if ( this._mnemonic === 'BVF' ) { this._opcode = 0x38 }
    else if ( this._mnemonic === 'BNZ' ) { this._opcode = 0x31 }
    else if ( this._mnemonic === 'BZP' ) { this._opcode = 0x32 }
    else if ( this._mnemonic === 'BP'  ) { this._opcode = 0x33 }
    else if ( this._mnemonic === 'BNI' ) { this._opcode = 0x34 }
    else if ( this._mnemonic === 'BNC' ) { this._opcode = 0x35 }
    else if ( this._mnemonic === 'BGE' ) { this._opcode = 0x36 }
    else if ( this._mnemonic === 'BGT' ) { this._opcode = 0x37 }
    else if ( this._mnemonic === 'BZN' ) { this._opcode = 0x3B }
    else if ( this._mnemonic === 'BNO' ) { this._opcode = 0x3C }
    else if ( this._mnemonic === 'BZ'  ) { this._opcode = 0x39 }
    else if ( this._mnemonic === 'BN'  ) { this._opcode = 0x3A }
    else if ( this._mnemonic === 'BC'  ) { this._opcode = 0x3D }
    else if ( this._mnemonic === 'BLT' ) { this._opcode = 0x3E }
    else if ( this._mnemonic === 'BLE' ) { this._opcode = 0x3F }
    else {
      throw util.error(`Invalid mnemonic '${this._mnemonic}'`)
    }

    const op1 = this._op1 as string
    this._operand = util.evalExpression(op1, params.labels)
  }


  /**
   *  のバイナリ表現を生成
   * @param this._- AsmLine オブジェクト
   */
  private assembleNop(params: AssembleParams) {
    logger.error('Not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param this._- AsmLine オブジェクト
   */
  private assembleHlt(params: AssembleParams) {
    if ( params.onlyAddrAlloc ) { this._requireAddrWidth = 1; return }

    this._opcode = 0x0F
    return true
  }


  /**
   *  のバイナリ表現を生成
   * @param this._- AsmLine オブジェクト
   */
  private assembleRcf(params: AssembleParams) {
    logger.error('not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param this._- AsmLine オブジェクト
   */
  private assembleScf(params: AssembleParams) {
    logger.error('not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param this._- AsmLine オブジェクト
   */
  private assembleInc(params: AssembleParams) {
    logger.error('not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param this._- AsmLine オブジェクト
   */
  private assembleDec(params: AssembleParams) {
    logger.error('not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param this._- AsmLine オブジェクト
   */
  private assemblePsh(params: AssembleParams) {
    logger.error('not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param this._- AsmLine オブジェクト
   */
  private assemblePop(params: AssembleParams) {
    logger.error('not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param this._- AsmLine オブジェクト
   */
  private assembleCal(params: AssembleParams) {
    logger.error('not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param this._- AsmLine オブジェクト
   */
  private assembleRet(params: AssembleParams) {
    logger.error('not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param this._- AsmLine オブジェクト
   */
  private assembleSrRl(params: AssembleParams) {
    logger.error('not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param this._- AsmLine オブジェクト
   */
  private assembleOut(params: AssembleParams) {
    logger.error('not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param this._- AsmLine オブジェクト
   */
  private assembleIn(params: AssembleParams) {
    logger.error('not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param this._- AsmLine オブジェクト
   */
  private assembleSt(params: AssembleParams) {
    logger.error('not implemented')
    return false
  }


  /**
   * バイナリ表現のプログラムデータの生成 (内部形式から出力用形式に整形)
   */
  public generate(addrUnitBytes: number) {
    const addr    = this._addr    != null ? (util.dec2hex(this._addr,    2 * addrUnitBytes, '') + ':') : ''
    const opcode  = this._opcode  != null ? (util.dec2hex(this._opcode,  2 * addrUnitBytes, '')      ) : ''
    const operand = this._operand != null ? (util.dec2hex(this._operand, 2 * addrUnitBytes, '')      ) : ''
    const comment = this._raw     !== ''  ? ` ${this._raw}` : ''

    const binary = `${addr} ${opcode} ${operand}`.padEnd(17, ' ') + `#${comment}`

    logger.debug(binary)
    return binary
  }
}
