import logger from '@envlib/logger'

export class Util {
  /**
   * 数値かどうか (string も数字として判定)
   * @param value - 判定したい値
   * @returns boolean
   */
  public isNumber(value: any) {
    if ( typeof value === 'number' ) {
      return isFinite(value)
    }
    else if ( typeof value === 'string' ) {
      // string そのまま number として扱える場合
      if ( !isNaN(Number(value)) ) {
        return true
      }
      else if ( /^[0-9A-F]+H$/i.exec(value) ) {
        return true
      }
      else {
        return false
      }
    }

    return false
  }


  /**
   * パディング済み 16 進数文字列にして返す
   * @param num - 数値 (10進数)
   * @returns パディング済み 16 進数文字列
   */
  public dec2hex(num: number, digit: number, prefix: string = '0x') {
    if ( num < 0 ) { num = num & 0xFFFF }     // 補数表現
    return prefix + num.toString(16)          // 16 進数表記
                       .substr(-digit, digit) // 桁数分切り出し (1 byte の時の補数表現用)
                       .toUpperCase()         // 大文字
                       .padStart(digit, '0')  // 0 埋め
  }


  /**
   * 式を評価 (四則演算, ラベルを含めることができる)
   * @param expression - 評価したい式
   * @returns パディング付き 16 進数表現
   */
  public evalExpression(expression: string, labels: {[key: string]: number }): number {
    expression = expression.replace(/\s+/g, '')
    if ( expression.match(/[\+|\-|\*|\/]/) ) {
      const terms = expression.split(/\s*([\+|\-|\*|\/])\s*/) // 各項を切り出す

      const formattedTerms = []
      for( const term of terms ) {
        // 空白なら何もしない
        if ( term === '' ) { /* do nothing */ }
        // 四則演算子はそのまま
        else if ( term === '+' || term === '-' || term === '*' || term === '/' ) {
          formattedTerms.push(term)
        }
        else {
          const value = this.evalExpression(term, labels)
          logger.trace(`Evaluate term: ${term} → ${value}`)
          formattedTerms.push(value)
        }
      }

      // この時点でラベルの評価は完了している
      // (一部が評価できない場合は再帰呼び出しした evalExpression で例外が投げられる)
      const expressionValue = eval(formattedTerms.join(''))

      logger.trace(`Evaluate expression: ${formattedTerms.join('')} → ${expressionValue}`)
      return expressionValue
    }
    // 16 進数
    else if ( expression.match(/^[0-9A-F]+H$/i) ) {
      return parseInt(expression.replace(/h/i, ''), 16)
    }
    // 10 進数
    else if ( util.isNumber(expression) ) {
      return parseInt(expression) // そのまま
    }
    // label
    else if ( labels[expression] != null ) {
      return labels[expression]
    }
    else {
      throw util.error(`'${expression}' cannot evaluate.`)
      // return `$(${expression})` // $(expression) にしておいて遅延評価する
      // → 2pass にして遅延評価しないように変更
    }
  }

  /**
   * エラーメッセージを logger.error() してから Error オブジェクトを返す
   * @param string - エラーメッセージ
   * @returns Error オブジェクト
   */
  public error(msg: string): Error {
    logger.error(msg)
    return new Error(msg)
  }
}

const util = new Util()
export default util
