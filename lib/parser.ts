import Instruction from '@/lib/instruction'

export default class Parser {
  private _buf: string

  private _label?:       string
  private _mnemonic?:    string
  private _op1?:         string
  private _op2?:         string
  private _comment?:     string


  /**
   * アセンブリプログラムをパースする
   * @param パースしたい命令 (1 行)
   */
  constructor(content: string) {
    this._buf = content
  }


  /**
   * アセンブリプログラムをパースする
   * @returns パース済み Instruction オブジェクト
   * @throws パースに失敗
   */
  public parse() {
    if ( ! this.parseComment()             ) { throw new Error('Parse error') }
    if ( ! this.parseLabel()               ) { throw new Error('Parse error') }
    if ( ! this.parseMnemonicAndOperands() ) { throw new Error('Parse error') }

    return {
      label:    this._label,
      mnemonic: this._mnemonic,
      op1:      this._op1,
      op2:      this._op2,
      comment:  this._comment,
    }
  }


  /**
   * コメントの処理する
   * @returns 成功: true, 失敗: false
   */
  private parseComment() {
    // '#', ';;', '//' 以降をコメントとして扱う
    const regexComment = /(#|;;|\/\/)(?<comment>.*)$/

    const match = this._buf.match(regexComment)
    if ( match ) {
      this._comment = match.groups!.comment // コメントを記録しておく
      this._buf = this._buf.replace(regexComment, '').trim()  // コメントを除去
    }

    return true
  }


  /**
   * ラベルの処理する
   * @returns 成功: true, 失敗: false
   */
  private parseLabel() {
    const regexLabel = /^(?<label>[A-za-z0-9_]+)\s*:/

    const match = this._buf.match(regexLabel)
    if ( match ) {
      this._label = match.groups!.label  // ラベルを記録しておく
      this._buf = this._buf.replace(regexLabel, '').trim() // ラベルを除去
    }

    return true
  }


  /**
   * ニーモニック, オペランドの処理
   * @returns 成功: true, 失敗: false
   */
  private parseMnemonicAndOperands() {
    const tokens = this._buf.trim().split(/ +/)
    // 最初の空白まで
    if ( tokens.length > 0) {
        this._mnemonic = tokens.shift()
    }

    // 2 引数の場合は第 1 オペランドの後ろにコンマがあるかもしれない
    if ( tokens.length > 0) {
        this._op1 = tokens.shift()!.replace(/,$/, '')
    }

    // 第 2 オペランドはスペースを含む可能性があるので残りを join
    if ( tokens.length > 0) {
        this._op2 = tokens.join(' ')
    }

    return true
  }
}
