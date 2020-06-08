import Kueasm from '@/lib/kueasm'


// シミュレータ (kuesim.js) のロガーを使う
const mylogger = {
  debug: (msg: any) => eval(`logger.debug("${msg}")`),
  info : (msg: any) => eval(`logger.info("${msg}")`),
  warn : (msg: any) => eval(`logger.warn("${msg}")`),
  error: (msg: any) => eval(`logger.error("${msg}")`),
}

function assemble() {
  const asm = $('#input-assembly').val()
  if ( asm == null ) {
    mylogger.error('internal error: failed to get instructions')
    return
  }

  const bin = (new Kueasm(asm as string, 'kuechip3', 'debug')).exec()

  if ( !bin ) {
    // logger.log.error('failed to assemble')
    return
  }

  console.log(bin)
  $('#output-binary').val(bin)
}

// アセンブルボタン (ts 側のコードを叩くのでこちらでイベントを設定しておく)
$('#area-assemble-button').on('click', assemble)


