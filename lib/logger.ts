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



// ---------- web 用 ----------
const LEVEL_TRACE = 0
const LEVEL_DEBUG = 1
const LEVEL_INFO  = 2
const LEVEL_WARN  = 3
const LEVEL_ERROR = 4
const LEVEL_FATAL = 5

export class KueasmLoggerForWeb {
  private _lineNumber:   number | undefined // ログに出力するアセンブリの行番号
  private _logLevel:     number = LEVEL_INFO

  constructor(logLevel: string = 'debug') {
    this.setLogLevel(logLevel)
  }

  // setter
  public setLineNumber(lineNumber: number | undefined) {
    this._lineNumber = lineNumber
  }

  public setLogLevel(logLevel: string) {
    this._logLevel = logLevel === 'fatal' ? LEVEL_FATAL
                   : logLevel === 'error' ? LEVEL_ERROR
                   : logLevel === 'warn'  ? LEVEL_WARN
                   : logLevel === 'info'  ? LEVEL_INFO
                   : logLevel === 'debug' ? LEVEL_DEBUG
                   : logLevel === 'trace' ? LEVEL_TRACE
                   :                        LEVEL_INFO
  }


  public trace(msg: any) {
    if ( this._logLevel <= LEVEL_TRACE ) {
      eval(`logger.trace(msg, ' (l.'+this._lineNumber+')')`)
    }
  }
  public debug(msg: any) {
    if ( this._logLevel <= LEVEL_DEBUG ) {
      eval(`logger.debug(msg, ' (l.'+this._lineNumber+')')`)
    }
  }
  public info(msg: any)  {
    if ( this._logLevel <= LEVEL_INFO ) {
      eval(`logger.info(msg,  ' (l.'+this._lineNumber+')')`)
    }
  }
  public warn(msg: any)  {
    if ( this._logLevel <= LEVEL_WARN ) {
      eval(`logger.warn(msg,  ' (l.'+this._lineNumber+')')`)
    }
  }
  public error(msg: any) {
    if ( this._logLevel <= LEVEL_ERROR ) {
      eval(`logger.error(msg, ' (l.'+this._lineNumber+')')`)
    }
  }
  public fatal(msg: any) {
    if ( this._logLevel <= LEVEL_FATAL ) {
      eval(`logger.fatal(msg, ' (l.'+this._lineNumber+')')`)
    }
  }
}



// ---------- 共通 ----------
const kueasmLogger = ( process.title === 'browser' ) ? new KueasmLoggerForWeb('warn') : new KueasmLoggerForNode('warn')
export default kueasmLogger

