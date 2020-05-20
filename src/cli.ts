import fs from 'fs'
import commandLineArgs from 'command-line-args'
import commandLineUsage from 'command-line-usage'
import log4js from 'log4js'
import Kueasm from '@/lib/kueasm'

const logger = log4js.getLogger()
logger.level = 'warn'


function main() {
  const optionDefinition = [
    {name: 'input',                     type: String,  desc: '入力ファイル', defaultOption: true},
    {name: 'output',        alias: 'o', type: String,  desc: '出力ファイル'},
    {name: 'verbose',       alias: 'v', type: Boolean, desc: '詳細なログを出力'},
    {name: 'help',          alias: 'h', type: Boolean, desc: 'ヘルプを表示'},
  ]
  const options = commandLineArgs(optionDefinition)

  if ( options.help || !options.input || options.command === 'help' ) {
    const usage = commandLineUsage([
      {
        header: 'Usage',
        content: 'kueasm <input> -o <output>'
      },
      {
        header: 'Options',
        optionList: optionDefinition
      }
    ])
    console.log(usage)
    process.exit(0)
  }

  if ( options.verbose ) {
    logger.level = 'debug'
  }

  const inFilePath = options.input
  if ( !inFilePath ) {
    logger.error('no input file')
  }

  const outFilePath = options.output || inFilePath.replace(/^(.*\/)?([^\/]+?)(\.asm)?$/, '$2.bin')
  logger.info(`input:  ${inFilePath}`)
  logger.info(`output: ${outFilePath}`)

  const asm = fs.readFileSync(inFilePath).toString()
  const bin = (new Kueasm(asm, 'kuechip3', logger.level)).exec()

  if ( !bin ) { process.exit(1) }

  fs.writeFileSync(outFilePath, bin)
}


main()

