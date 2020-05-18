// import log4js from 'log4js'

import Kueasm from '@/lib/kueasm'

// const log4jsLogger = log4js.getLogger()


// export default class KueasmLogger {
//   private kueasm: any
//   constructor(kueasm: Kueasm, logLevel: string) {
//     this.kueasm = kueasm
//     log4jsLogger.level = 'debug'
//     if ( logLevel ) { log4jsLogger.level = logLevel }
//   }

//   public debug = (msg: any) => log4jsLogger.debug(msg, ` (l.${this.kueasm._currentLineNumber})`)
//   public info  = (msg: any) => log4jsLogger.info (msg, ` (l.${this.kueasm._currentLineNumber})`)
//   public warn  = (msg: any) => log4jsLogger.warn (msg, ` (l.${this.kueasm._currentLineNumber})`)
//   public error = (msg: any) => log4jsLogger.error(msg, ` (l.${this.kueasm._currentLineNumber})`)
// }



export default class KueasmLogger {
  private kueasm: any

  constructor(kueasm: any, logLevel: any) {
    this.kueasm = kueasm
  }

  public debug = (msg: any) => { eval(`logger.debug(msg, ' (l.'+this.kueasm._currentLineNumber+')')`) }
  public info  = (msg: any) => { eval(`logger.info(msg,  ' (l.'+this.kueasm._currentLineNumber+')')`) }
  public warn  = (msg: any) => { eval(`logger.warn(msg,  ' (l.'+this.kueasm._currentLineNumber+')')`) }
  public error = (msg: any) => { eval(`logger.error(msg, ' (l.'+this.kueasm._currentLineNumber+')')`) }
}
