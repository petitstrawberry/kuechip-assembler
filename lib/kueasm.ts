import logger from '@envlib/logger'
import Instruction from '@/lib/instruction'
import util from '@/lib/util'


export type ASM_MODE = 'kuechip2' | 'kuechip3'

export default class Kueasm {
  private readonly _instructions: Instruction[]
  private readonly _mode: ASM_MODE
  private readonly _addrUnitBytes: number       // メモリのバイト単位 (kuechip2: 1, kuechip3: 2)

  private _binary?: string                      // 生成されたバイナリ
  private _labels: {[key: string]: number} = {} // ラベルのアドレス (10進数) の対応

  private _currentAddr: number = 0              // メモリデータを配置するアドレス
  private _locAddr?: number    = undefined      // LOC (DAT で値を配置するアドレス) (for kue3)
  private _isEnded             = false          // end 命令が見つかった

  private _multilineLabel?: string              // ラベル単独行の場合に一時記録 (次の行に紐付け)

  /**
   * @param asm - アセンブリプログラムの内容
   * @param mode - 'kuechip2' or 'kuechip3'
   * @param logLebel - ログレベル (デフォルトは warn. debug や trace で詳細ログを確認可能)
   */
  constructor(asm: string, mode: ASM_MODE, logLevel: string = 'warn') {
    this._mode = mode
    this._addrUnitBytes = (mode === 'kuechip3') ? 2 : 1

    logger.setLogLevel(logLevel)
    logger.info('Start parse')

    try {
      this._instructions = asm.split('\n').map((content) => new Instruction(content))
    }
    catch {
      logger.error('Failed to parse assembly program')
      return
    }
  }


  /**
   * アセンブルする
   * @returns アセンブル結果 (バイナリ表現)
   */
  public exec() {
    logger.info('Start assemble')
    // logger.trace(this._instructions)

    if ( ! this.assemble() ) {
      logger.error('Failed to convert binary data')
      return
    }

    return this.generate()
  }


  /**
   * バイナリ表現を生成して binary にセット
   * @returns 成否 (true or false)
   */
  private assemble() {
    logger.debug('1st pass')
    // logger.trace(this._instructions)          // デバッグ用に内部データをダンプ

    for ( let idx = 0; idx < this._instructions.length; idx++ ) {
      logger.setLineNumber(idx + 1)               // ロガーに現在の処理行をセット
      // logger.trace(idx + 1)
      // logger.trace(this._instructions)          // デバッグ用に内部データをダンプ

      const inst = this._instructions[idx]

      // 空行はスキップ
      if ( inst.raw().trim() === '' ) { continue }

      if ( inst.mnemonic() != null && this._multilineLabel != null ) {
        inst.previousLineLabel(this._multilineLabel)
        this._multilineLabel = undefined
      }

      // 疑似命令の処理
      // - EQU, その他のラベル行の処理
      if ( inst.mnemonic() === 'EQU' ) {
        this.processEqu(inst)
      }
      else {
        const label = inst.label() || inst.previousLineLabel()
        if ( label != null ) {
          if ( inst.mnemonic() != null ) { // 命令がある行ならラベルに行番号をバインド
            this._labels[label] = this._currentAddr
          }
          else { // 命令が無い行なら (次の命令行にバインドするために) 記録しておく
            this._multilineLabel = inst.label()
          }
        }
      }

      // 命令行でなければ次へ
      if ( inst.mnemonic() == null
           || inst.mnemonic() === 'EQU'
           || inst.mnemonic() === 'LOC'
           || inst.mnemonic() === 'END'
         ) { continue }

      logger.debug(`Process ${inst.mnemonic()}.`)

      // バイナリ表現への変換
      const {curAddrInc, locAddrInc} = inst.assemble({
        labels:        this._labels,
        curAddr:       this._currentAddr,
        locAddr:       this._locAddr,
        onlyAddrAlloc: true,
      })

      // 次の命令配置アドレスを算出
      this._currentAddr += (curAddrInc * this._addrUnitBytes)
    }
    logger.setLineNumber(undefined)

    logger.debug('2nd pass')
    for ( let idx = 0; idx < this._instructions.length; idx++ ) {
      const inst = this._instructions[idx]
      logger.setLineNumber(idx + 1)               // ロガーに現在の処理行をセット
      // logger.trace(this.instructions)          // デバッグ用に内部データをダンプ

      // 空行はスキップ
      if ( inst.raw().trim() === '' ) { continue }

      // - END の処理
      if ( inst.mnemonic() === 'END' ) { break }

      // - LOC の処理
      if ( inst.mnemonic() === 'LOC' ) { this.processLoc(inst) }

      // 命令行でなければ次へ
      if (
        inst.mnemonic() == null
          || inst.mnemonic() === 'EQU'
          || inst.mnemonic() === 'LOC'
      ) { continue }

      logger.debug(`Process ${inst.mnemonic()}.`)

      // バイナリ表現への変換
      const {curAddrInc, locAddrInc} = inst.assemble({
        labels:        this._labels,
        curAddr:       this._currentAddr,
        locAddr:       this._locAddr,
        onlyAddrAlloc: false,
      })

      // 次の DAT の配置アドレスを算出
      if ( this._locAddr != null ) {
        this._locAddr += (locAddrInc * this._addrUnitBytes)
      }
    }
    logger.setLineNumber(undefined)

    return true
  }


  /**
   * EQU の処理 (10 進数変換してラベル表 labels に追加)
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processEqu(inst: Instruction) {
    const label = inst.label() || inst.previousLineLabel()
    const op1   = inst.op1()

    if ( label == null ) {
      logger.error('Label not found for EQU')
      return false
    }

    if ( op1 == null ) {
      logger.error('Expected 1 operand for EQU')
      return false
    }

    if ( op1.toUpperCase() === 'CA' ) {
      // EQU のオペランドを CA (current address) にしたら,
      // その EQU 疑似命令の存在する場所のアドレスが割り当てられる.
      // アドレスのインクリメントは行わない
      this._labels[label] = this._currentAddr
    }
    else {
      logger.debug(this._labels)
      const value = util.evalExpression(op1, this._labels)
      this._labels[label] = value
    }

    logger.trace('labels: ' + JSON.stringify(this._labels))
    return true
  }


  /**
   * LOC のバイナリ表現を生成
   * @param asmLine - AsmLine オブジェクト
   * @returns 成否 (true or false)
   */
  private processLoc(inst: Instruction) {
    const op1 = inst.op1()

    if ( op1 == null ) {
      logger.error('Expected 1 operand for LOC')
      return false
    }

    const addr = util.evalExpression(op1, this._labels)
    if ( util.isNumber(addr) ) {
      this._locAddr = addr as number
    }

    logger.trace(`LOC addr: ${this._locAddr}`)
    return true
  }


  /**
   * 出力用バイナリを生成
   * @returns 出力用バイナリ
   */
  private generate(): string {
    return this._instructions.map((inst) => inst.generate(this._addrUnitBytes)).join('\n') + '\n'
  }
}

