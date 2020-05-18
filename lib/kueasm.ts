import KueasmLogger from '@/lib/logger'

const MNEMONIC_MAP: {[key: string]: number} = {
  LD : 0x60, ST : 0x70, SBC: 0x80, ADC: 0x90, SUB: 0xA0,
  ADD: 0xB0, EOR: 0xC0, OR : 0xD0, AND: 0xE0, CMP: 0xF0,
}


export type ASM_MODE = 'kuechip2' | 'kuechip3'
export interface AsmLine {
  lineNumber: number
  raw:        string
  label?:     string

  // パース後のトークン
  mnemonic?:  string
  op1?:       string
  op2?:       string
  comment?:   string

  // バイナリ表現
  opcode?:    number
  operand?:   number | string   // ラベルを含む式が評価できない時に string のままにしておく
  addr?:      number            // アドレスに指定がある時 (loc-dat)

  isSkipped?: boolean

  // binary?:    string
}

export default class Kueasm {
  private readonly _asm: AsmLine[]
  private readonly _mode: ASM_MODE
  private readonly _addrUnitBytes: number  // メモリのバイト単位 (kuechip2: 1, kuechip3: 2)

  private readonly log: KueasmLogger

  private _binary?: string                 // 生成されたバイナリ
  private _labels: {[key: string]: number | string} = {} // ラベルのアドレス (10進数) の対応

  private _currentAddr        = 0          // メモリデータを配置するアドレス
  private _currentLineNumber  = 0          // 現在処理している行番号
  private _currentLineContent = ''         // 現在処理している行の内容
  private _locAddr: number | undefined     // LOC (DAT で値を配置するアドレス) (for kue3)
  private _isEnded            = false      // end 命令が見つかった


  /**
   * @param asmFilePath - アセンブリファイルへのパス
   * @param mode - 'kuechip2' or 'kuechip3'
   */
  constructor(asm: string, mode: ASM_MODE, logLevel: string = 'warn') {
    this._asm  = asm.split('\n').map((content, index) => ({ raw: content, lineNumber: index }))
    this._mode = mode
    this._addrUnitBytes = (mode === 'kuechip3') ? 2 : 1

    this.log = new KueasmLogger(this, logLevel)
  }


  /**
   * アセンブルする
   * @returns アセンブル結果 (バイナリ表現)
   */
  public exec() {
    this.log.info('Start assemble')
    this.log.debug(this._asm)

    this.log.info('Start parse')
    if ( ! this.parse() ) {
      this.log.error('Failed to parse assembly program')
      return
    }

    this.log.info('Start process')
    if ( ! this.process() ) {
      this.log.error('Failed to convert binary data')
      return
    }

    this.log.info('Start generate')
    if ( ! this.generate() ) {
      this.log.error('Failed to generate binary')
      return
    }

    if ( ! this._isEnded ) {
      this.log.warn(`'END' instruction is not found`)
    }

    return this._binary
  }


  /**
   * アセンブリプログラムをパースする
   * @returns 成否 (true or false)
   */
  private parse() {
    for ( const asmLine of this._asm ) {
      let buf = asmLine.raw.trim()

      buf = this.parseComment(asmLine, buf)
      buf = this.parseLabel(asmLine, buf)
      this.parseMnemonicAndOperands(asmLine, buf)
    }

    // this.log.debug(this._asm)
    return true
  }


  /**
   * コメントを処理する
   * @param asmLine - AsmLine オブジェクト
   * @param buf - 行をパース途中の残りテキスト
   * @returns パースした残り
   */
  private parseComment(asmLine: AsmLine, buf: string) {
    // コメントの処理 ('*', '#', ';;', '//' 以降)
    const regexComment = /(\*|#|;;|\/\/)(?<comment>.*)$/

    const match = buf.match(regexComment)
    if ( match ) {
      asmLine.comment = match.groups!.comment      // コメントを記録しておく
      return buf.replace(regexComment, '').trim()  // コメントを除去
    }

    return buf
  }


  /**
   * ラベルを処理する
   * @param asmLine - AsmLine オブジェクト
   * @param buf - 行をパース途中の残りテキスト
   * @returns パースした残り
   */
  private parseLabel(asmLine: AsmLine, buf: string) {
    // ラベルの処理
    const regexLabel = /^(?<label>[A-za-z0-9_]+)\s*:/

    const match = buf.match(regexLabel)
    if ( match ) {
      asmLine.label = match.groups!.label           // ラベルを記録しておく
      return buf.replace(regexLabel, '').trim() // ラベルを除去
    }

    return buf
  }


  /**
   * ラベルを処理する
   * @param asmLine - AsmLine オブジェクト
   * @param buf - 行をパース途中の残りテキスト
   * @returns パースした残り
   */
  private parseMnemonicAndOperands(asmLine: AsmLine, buf: string) {
    // ニーモニック, オペランドの処理
    const tokens = buf.split(/ +/)
    if ( tokens.length > 0) {
      asmLine.mnemonic = tokens.shift()
    }

    if ( tokens.length > 0) {
      asmLine.op1 = tokens.shift()!.replace(/,$/, '')
    }

    if ( tokens.length > 0) {
      asmLine.op2 = tokens.join(' ')
    }
  }


  /**
   * バイナリ表現を生成して _binary にセット
   * @returns 成否 (true or false)
   */
  private process() {
    for ( const asmLine of this._asm ) {
      // this.log.debug(this._asm)                    // デバッグ用に内部データをダンプ

      this._currentLineNumber = asmLine.lineNumber // ログ用に現在の処理行を表示
      if ( asmLine.raw.trim() === '' ) { continue }

      if ( asmLine.label ) {
        this._labels[asmLine.label] = this._currentAddr
      }

      this.log.debug(`Process ${asmLine.mnemonic}`)
      if ( ! asmLine.mnemonic ) { continue }
      const mnemonic = asmLine.mnemonic.toUpperCase()

      if      (mnemonic.match(/^EQU$/)             ) { if (!this.processEqu(asmLine)        ) {return false} }
      else if (mnemonic.match(/^LOC$/)             ) { if (!this.processLoc(asmLine)        ) {return false} }
      else if (mnemonic.match(/^DAT$/)             ) { if (!this.processDat(asmLine)        ) {return false} }
      else if (mnemonic.match(/^PROG$/)            ) { if (!this.processProg(asmLine)       ) {return false} }
      else if (mnemonic.match(/^LD$/)              ) { if (!this.processLd(asmLine)         ) {return false} }
      else if (mnemonic.match(/^(ST|SBC|ADC)$/)    ) { if (!this.processStSbcAdc(asmLine)   ) {return false} }
      else if (mnemonic.match(/^SUB$/)             ) { if (!this.processSub(asmLine)        ) {return false} }
      else if (mnemonic.match(/^ADD$/)             ) { if (!this.processAdd(asmLine)        ) {return false} }
      else if (mnemonic.match(/^(EOR|OR|AND|CMP)$/)) { if (!this.processEorOrAndCmp(asmLine)) {return false} }
      else if (mnemonic.match(/^B/)                ) { if (!this.processB(asmLine)          ) {return false} }
      else if (mnemonic.match(/^NOP$/)             ) { if (!this.processNop(asmLine)        ) {return false} }
      else if (mnemonic.match(/^HLT$/)             ) { if (!this.processHlt(asmLine)        ) {return false} }
      else if (mnemonic.match(/^RCF$/)             ) { if (!this.processRcf(asmLine)        ) {return false} }
      else if (mnemonic.match(/^SCF$/)             ) { if (!this.processScf(asmLine)        ) {return false} }
      else if (mnemonic.match(/^END$/)             ) { if (!this.processEnd(asmLine)        ) {return false} }
      else if (mnemonic.match(/^INC$/)             ) { if (!this.processInc(asmLine)        ) {return false} }
      else if (mnemonic.match(/^DEC$/)             ) { if (!this.processDec(asmLine)        ) {return false} }
      else if (mnemonic.match(/^PSH$/)             ) { if (!this.processPsh(asmLine)        ) {return false} }
      else if (mnemonic.match(/^POP$/)             ) { if (!this.processPop(asmLine)        ) {return false} }
      else if (mnemonic.match(/^CAL$/)             ) { if (!this.processCal(asmLine)        ) {return false} }
      else if (mnemonic.match(/^RET$/)             ) { if (!this.processRet(asmLine)        ) {return false} }
      else if (mnemonic.match(/^[SR][RL]/)         ) { if (!this.processSrRl(asmLine)       ) {return false} }
      else if (mnemonic.match(/^OUT$/)             ) { if (!this.processOut(asmLine)        ) {return false} }
      else if (mnemonic.match(/^IN$/)              ) { if (!this.processIn(asmLine)         ) {return false} }
      else if (mnemonic.match(/^ST/)               ) { if (!this.processSt(asmLine)         ) {return false} }
      else {
        this.log.error(`Invalid mnemonic '${mnemonic}`)
        return false
      }

      if ( asmLine.opcode != null ) {
        // DAT 命令以外の順番にアドレスを振る命令の処理
        if ( !asmLine.addr ) {
          asmLine.addr = this._currentAddr
          this._currentAddr += this._addrUnitBytes
          this.log.debug('Increment addr')
        }
      }
      if ( asmLine.operand != null ) {
        this._currentAddr += this._addrUnitBytes
        this.log.debug('Increment addr')
      }
    }

    return true
  }


  /**
   * 数値かどうか (string も数字として判定)
   * @param value - 判定したい値
   * @returns boolean
   */
  protected isNumber(value: any) {
    if ( typeof value === 'number' ) {
      return isFinite(value)
    }
    else if ( typeof value === 'string' ) {
      return !isNaN(Number(value))
    }
    else {
      return false
    }
  }


  /**
   * 式を評価 (四則演算, ラベルを含めることができる)
   * @param expression - 評価したい式
   * @returns パディング付き 16 進数表現
   */
  protected evalExpression(expression: string): number | string {
    if ( expression.match(/[\+|\-|\*|\/]/) ) {
      const terms = expression.split(/\s*([\+|\-|\*|\/])\s*/) // 各項を切り出す

      const formattedTerms = []
      for( const term of terms ) {
        // 空白なら何もしない
        if ( term === '' ) {}
        // 四則演算子はそのまま
        else if ( term === '+' || term === '-' || term === '*' || term === '/' ) {
          formattedTerms.push(term)
        }
        else {
          const value = this.evalExpression(term)
          this.log.debug(`Evaluate term: ${term} → ${value}`)

          // 評価できない項があれば式ごと遅延評価に回す
          if ( !this.isNumber(value) ) {
            this.log.debug(`Expression '${term}' in '${expression}' cannot be evaluated now. `
                         + `It will be evaluated later`)
            return `$(${expression})`
          }

          formattedTerms.push(value)
        }
      }

      // 全項評価できる値なら式全体も評価する
      const value = eval(formattedTerms.join(''))

      this.log.debug(`Evaluate expression: ${formattedTerms.join('')} → ${value}`)
      return value
    }
    // 16 進数
    else if ( expression.match(/^[0-9A-F]+H$/i) ) {
      return parseInt(expression.replace(/h/i, ''), 16)
    }
    // 10 進数
    else if ( this.isNumber(expression) ) {
      return parseInt(expression) // そのまま
    }
    // label
    else if ( this._labels[expression] ) {
      return this._labels[expression]
    }
    else {
      return `$(${expression})` // $(expression) にしておいて遅延評価する
    }
  }


  /**
   * パディング済み 16 進数文字列にして返す
   * @param num - 数値 (10進数)
   * @returns パディング済み 16 進数文字列
   */
  protected dec2hex(num: number, prefix: string = '0x') {
    if ( num < 0 ) { num = num & (this._addrUnitBytes & 0xFFFF) }  // 補数表現
    return prefix + num.toString(16).toUpperCase().padStart(this._addrUnitBytes * 2, '0')
  }


  /**
   * 代入演算と算術演算のオペコードを取得 (規則配列のもの)
   * @param mnemonic - ニーモニック
   * @param op1 - 第 1 オペランド
   * @param op2 - 第 2 オペランド
   * @returns {opcode?: number, operand?: number | string, error?: boolean}
   */
  private getOpcodeOfAssignmentAndArithmeticInst(mnemonic: string, op1: string, op2: string ) {
    mnemonic = mnemonic.toUpperCase()
    op1      = op1.toUpperCase()
    op2      = op2.toUpperCase()

    const baseOpcode = MNEMONIC_MAP[mnemonic] as number  // 命令表の行を決定
    if ( !baseOpcode ) {
      this.log.error(`Internal error: invalid mnemonic ${mnemonic}`)
      return {error: true}
    }

    const res: {opcode?: number, operand?: number | string, isSkipped?: boolean, error?: boolean} = {}

    // op1
    if      (op1 === 'ACC') { res.opcode = baseOpcode + 0 }
    else if (op1 === 'IX' ) { res.opcode = baseOpcode + 8 }
    else                    {
      this.log.error(`Invalid operand '${op1}' for ${mnemonic}`)
      return {error: true}
    }

    // op2 == ACC
    if (op2 === 'ACC') {
      if (mnemonic.match(/^ST/)) {
        this.log.error(`Invalid operand '${op2}' of 'ST' (use 'LD' to set registers)`)
        return {error: true}
      }
      res.opcode += 0
    }
    // op2 == IX
    else if (op2 === 'IX') {
      if (mnemonic.match(/^ST/)) {
        this.log.error(`Invalid operand '${op2}' of 'ST' (use 'LD' to set registers)`)
        return {error: true}
      }
      res.opcode += 1
    }
    // op2 == d (ラベルを含む)
    else if (op2.match(/^([A-Z0-9_\+\-\*\/]+)$/)) {
      if (mnemonic.match(/^ST/)) {
        this.log.error(`Invalid operand '${op2}' of 'ST' (use 'LD' to set registers)`)
        return {error: true}
      }
      res.opcode += 2
      res.operand = this.evalExpression(op2)

      if ( !this.isNumber(res.operand) ) {
        this.log.debug(`Operand ${res.operand} cannot be evaluated now. skip.`)
      }
    }
    // # op2 = [sp+d]
    // elsif ($op2 =~ /\[(SP|sp)\+*([\w\+\-]*)\]/) {
    //   $opcode += 3;
    //   $operand = parse_expression($2);
    // }
    // # op2 = [IX+d] / [IX]
    // elsif ($op2 =~ /\[(IX|ix)\+*([\w\+\-]*)\]/) {
    //   $opcode += 6;
    //   $operand = parse_expression($2);
    // }
    // op2 = [d]                         # d : decimal, hex or label
    else if (op2.match(/^\[([A-Z0-9_\+\-\*\/]+)\]$/)) {
      res.opcode += 4
      res.operand = this.evalExpression(op2.replace(/[\[\]]/g, ''))
      if ( !this.isNumber(res.operand) ) {
        this.log.debug(`Operand ${res.operand} cannot be evaluated now. skip.`)
      }
    }
    // # op2 = (IX+d) / (IX) (only for kuechip2)
    // elsif ($op2 =~ /\((IX|ix)\+*([\w\+\-]*)\)/) {
    //   $opcode += 7;
    //   $operand = parse_expression($2);
    // }
    // # op2 = (d) (only for kuechip2)     # d : decimal, hex or label
    // elsif ($op2 =~ /\(([\w\+\-]+)\)/) { # ラベルも含まれるので \d ではなく \w
    //   $opcode += 5;
    //   $operand = parse_expression($1);
    // }
    else {
      this.log.error(`Invalid operand '${op1}/${op2}'`)
      return {error: true}
    }

    return res
  }


  /**
   * EQU の処理 (10 進数変換してラベル表 _labels に追加)
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processEqu(asmLine: AsmLine) {
    if ( !asmLine.label ) {
      this.log.error('Label not found for EQU')
      return false
    }
    if ( !asmLine.op1 ) {
      this.log.error('Expected 1 operand for EQU')
      return false
    }
    if ( asmLine.op1.toUpperCase() === 'CA' ) {
      // EQU のオペランドを CA (current address) にしたら,
      // その EQU 疑似命令の存在する場所のアドレスが割り当てられる.
      // アドレスのインクリメントは行わない
      this._labels[asmLine.label] = this._currentAddr
    }
    else {
      const value = this.evalExpression(asmLine.op1)
      this._labels[asmLine.label] = value
    }

    // $option = {no_data => 1};   // 疑似命令行なのでアセンブリのみ出力
    this.log.debug(this._labels)
    return true
  }


  /**
   * LOC のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processLoc(asmLine: AsmLine) {
    if ( !asmLine.op1 ) {
      this.log.error('Expected 1 operand for LOC')
      return false
    }

    const addr = this.evalExpression(asmLine.op1)
    if ( this.isNumber(addr) ) {
      this._locAddr = addr as number
    }

    this.log.debug(`LOC addr: ${this._locAddr}`)
    // TODO: 評価できない場合 (2pass)
    return true
  }


  /**
   * DAT のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processDat(asmLine: AsmLine) {
    if ( !asmLine.op1 ) {
      this.log.error('Expected 1 operand for DAT')
      return false
    }

    if ( !this._locAddr ) {
      this.log.debug('LOC addr is not defined now. skip.')
      asmLine.isSkipped = true
      return true
    }

    const op1 = asmLine.op1.toUpperCase()
    const value = this.evalExpression(op1)

    if ( !this.isNumber(value) ) {
      this.log.debug('Data cannot be evaluated now. skip.')
      asmLine.isSkipped = true
      return true
    }

    asmLine.addr = this._locAddr
    asmLine.opcode = value as number

    this._locAddr += this._addrUnitBytes

    return true
  }


  /**
   * PROG のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processProg(asmLine: AsmLine) {
    this.log.error(`'PROG' is not supported`)
    return false
  }


  /**
   * LD のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processLd(asmLine: AsmLine) {
    if (!asmLine.op1 || !asmLine.op2) {
      this.log.error('Expected 2 operands for LOC')
      return false
    }

    const op1 = asmLine.op1.toUpperCase()
    const op2 = asmLine.op2.toUpperCase()
    // LD IX SP
    if (op1 === 'IX' && op2 === 'SP') {
      asmLine.opcode = 0x01
    }
    // LD SP IX
    else if (op1 === 'SP' && op2 === 'IX') {
      asmLine.opcode = 0x03
    }
    // LD SP d
    else if (op1 === 'SP' && this.isNumber(op2)) {
      asmLine.opcode = 0x02
      asmLine.operand = this.evalExpression(op2)
    }
    // その他の (規則的な割り当てになっている) 命令
    else {
      const res = this.getOpcodeOfAssignmentAndArithmeticInst(
        asmLine.mnemonic!,
        asmLine.op1,
        asmLine.op2,
      )

      if ( res.error ) { return false }
      if ( res.opcode  != null ) { asmLine.opcode    = res.opcode }
      if ( res.operand != null ) { asmLine.operand   = res.operand }
      // if ( res.isSkipped ) asmLine.isSkipped = res.isSkipped
      return true
    }

    return true
  }


  /**
   *  ST, SBC, ADC のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processStSbcAdc(asmLine: AsmLine) {
    if (!asmLine.op1 || !asmLine.op2) {
      this.log.error('Expected 2 operands for ${asmLine.mnemonic}')
      return false
    }

    const res = this.getOpcodeOfAssignmentAndArithmeticInst(
      asmLine.mnemonic!,
      asmLine.op1,
      asmLine.op2,
    )

    if ( res.error   ) { return false }
    if ( res.opcode  ) { asmLine.opcode    = res.opcode }
    if ( res.operand ) { asmLine.operand   = res.operand }
    // if ( res.isSkipped ) asmLine.isSkipped = res.isSkipped
    return true
  }


  /**
   * SUB のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processSub(asmLine: AsmLine) {
    if (!asmLine.op1 || !asmLine.op2) {
      this.log.error(`Expected 2 operands for ${asmLine.mnemonic}`)
      return false
    }

    const op1 = asmLine.op1.toUpperCase()

    if (op1 === 'SP') {
      asmLine.opcode  = 0x07
      asmLine.operand = this.evalExpression(asmLine.op2)
    } else {
      const res = this.getOpcodeOfAssignmentAndArithmeticInst(
        asmLine.mnemonic!,
        asmLine.op1,
        asmLine.op2,
      )

      if ( res.error   ) { return false }
      if ( res.opcode  ) { asmLine.opcode    = res.opcode }
      if ( res.operand ) { asmLine.operand   = res.operand }
    }

    return true
  }


  /**
   * ADD のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processAdd(asmLine: AsmLine) {
    if (!asmLine.op1 || !asmLine.op2) {
      this.log.error(`Expected 2 operands for ${asmLine.mnemonic}`)
      return false
    }

    const op1 = asmLine.op1.toUpperCase()

    if (op1 === 'SP') {
      asmLine.opcode  = 0x06
      asmLine.operand = this.evalExpression(asmLine.op2)
    } else {
      const res = this.getOpcodeOfAssignmentAndArithmeticInst(
        asmLine.mnemonic!,
        asmLine.op1,
        asmLine.op2,
      )

      if ( res.error   ) { return false }
      if ( res.opcode  ) { asmLine.opcode    = res.opcode }
      if ( res.operand ) { asmLine.operand   = res.operand }
    }

    return true
  }


  /**
   *  のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processEorOrAndCmp(asmLine: AsmLine) {
    this.log.error('Not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processB(asmLine: AsmLine) {
    if (!asmLine.op1) {
      this.log.error(`Expected 1 operand for ${asmLine.mnemonic}`)
      return false
    }

    const mnemonic = asmLine.mnemonic
    if      (mnemonic === 'BA' ) { asmLine.opcode = 0x30 }
    else if (mnemonic === 'BVF') { asmLine.opcode = 0x38 }
    else if (mnemonic === 'BNZ') { asmLine.opcode = 0x31 }
    else if (mnemonic === 'BZP') { asmLine.opcode = 0x32 }
    else if (mnemonic === 'BP' ) { asmLine.opcode = 0x33 }
    else if (mnemonic === 'BNI') { asmLine.opcode = 0x34 }
    else if (mnemonic === 'BNC') { asmLine.opcode = 0x35 }
    else if (mnemonic === 'BGE') { asmLine.opcode = 0x36 }
    else if (mnemonic === 'BGT') { asmLine.opcode = 0x37 }
    else if (mnemonic === 'BZN') { asmLine.opcode = 0x3B }
    else if (mnemonic === 'BNO') { asmLine.opcode = 0x3C }
    else if (mnemonic === 'BZ' ) { asmLine.opcode = 0x39 }
    else if (mnemonic === 'BN' ) { asmLine.opcode = 0x3A }
    else if (mnemonic === 'BC' ) { asmLine.opcode = 0x3D }
    else if (mnemonic === 'BLT') { asmLine.opcode = 0x3E }
    else if (mnemonic === 'BLE') { asmLine.opcode = 0x3F }
    else {
      this.log.error(`Invalid mnemonic '${mnemonic}'`)
      return false
    }

    asmLine.operand = this.evalExpression(asmLine.op1);
    return true
  }


  /**
   *  のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processNop(asmLine: AsmLine) {
    this.log.error('Not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processHlt(asmLine: AsmLine) {
    asmLine.opcode = 0x0F
    return true
  }


  /**
   *  のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processRcf(asmLine: AsmLine) {
    this.log.error('not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processScf(asmLine: AsmLine) {
    this.log.error('not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processEnd(asmLine: AsmLine) {
    this._isEnded = true
    return true
  }


  /**
   *  のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processInc(asmLine: AsmLine) {
    this.log.error('not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processDec(asmLine: AsmLine) {
    this.log.error('not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processPsh(asmLine: AsmLine) {
    this.log.error('not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processPop(asmLine: AsmLine) {
    this.log.error('not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processCal(asmLine: AsmLine) {
    this.log.error('not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processRet(asmLine: AsmLine) {
    this.log.error('not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processSrRl(asmLine: AsmLine) {
    this.log.error('not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processOut(asmLine: AsmLine) {
    this.log.error('not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processIn(asmLine: AsmLine) {
    this.log.error('not implemented')
    return false
  }


  /**
   *  のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processSt(asmLine: AsmLine) {
    this.log.error('not implemented')
    return false
  }


  /**
   * バイナリ表現のプログラムデータの生成 (内部形式から出力用形式に整形)
   * @returns 成否 (true or false)
   */
  private generate() {
    const lines = []
    for ( const asmLine of this._asm ) {
      const addr    = asmLine.addr    != null ? (this.dec2hex(asmLine.addr, '') + ':')      : ''
      const opcode  = asmLine.opcode  != null ? this.dec2hex(asmLine.opcode  as number, '') : ''
      const operand = asmLine.operand != null ? this.dec2hex(asmLine.operand as number, '') : ''
      const comment = asmLine.raw     != ''   ? ` ${asmLine.raw}`                           : ''

      lines.push(this._binary = `${addr} ${opcode} ${operand}`.padEnd(17, ' ') + `#${comment}`)
      this.log.debug(this._binary)
    }

    this._binary = lines.join('\n') + '\n'

    return true
  }
}

