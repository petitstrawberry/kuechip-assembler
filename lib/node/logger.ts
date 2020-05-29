// ---------- CLI 用 ----------

import log4js, {Log4js, Logger} from 'log4js'

export class KueasmLoggerForNode {
  private _log4jsLogger: Logger
  private _lineNumber:   number | undefined // ログに出力するアセンブリの行番号

  constructor(logLevel: string = 'debug') {
    this._log4jsLogger = log4js.getLogger()
    this._log4jsLogger.level = logLevel
    // if ( logLevel ) { this.log4jsLogger.level = logLevel }
    // else            { this.log4jsLogger.level = 'debug'  }
  }


  // setter
  public setLineNumber(lineNumber: number | undefined) {
    this._lineNumber = lineNumber
  }

  public setLogLevel(logLevel: string) {
    this._log4jsLogger.level = logLevel
  }


  // log
  public trace(msg: any) { this._log4jsLogger.trace(msg, this.getLineNumberInfo()) }
  public debug(msg: any) { this._log4jsLogger.debug(msg, this.getLineNumberInfo()) }
  public info(msg: any)  { this._log4jsLogger.info (msg, this.getLineNumberInfo()) }
  public warn(msg: any)  { this._log4jsLogger.warn (msg, this.getLineNumberInfo()) }
  public error(msg: any) { this._log4jsLogger.error(msg, this.getLineNumberInfo()) }

  private getLineNumberInfo() {
    return this._lineNumber == null ? '' : ` (l.${this._lineNumber})`
  }
}



// ---------- 共通 ----------
const kueasmLogger = new KueasmLoggerForNode('warn')
export default kueasmLogger


