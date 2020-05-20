// import Kueasm from '@/lib/kueasm'

import log4js, {Log4js, Logger} from 'log4js'


export class KueasmLogger {
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

const logger = new KueasmLogger('debug')
export default logger


// export default class KueasmLogger {
//   private kueasm: any

//   constructor(kueasm: any, logLevel: any) {
//     this.kueasm = kueasm
//   }

//   public debug = (msg: any) => { eval(`logger.debug(msg, ' (l.'+this.kueasm._currentLineNumber+')')`) }
//   public info  = (msg: any) => { eval(`logger.info(msg,  ' (l.'+this.kueasm._currentLineNumber+')')`) }
//   public warn  = (msg: any) => { eval(`logger.warn(msg,  ' (l.'+this.kueasm._currentLineNumber+')')`) }
//   public error = (msg: any) => { eval(`logger.error(msg, ' (l.'+this.kueasm._currentLineNumber+')')`) }
// }
