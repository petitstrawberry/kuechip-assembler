"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const command_line_args_1 = __importDefault(require("command-line-args"));
const command_line_usage_1 = __importDefault(require("command-line-usage"));
const log4js_1 = __importDefault(require("log4js"));
const kueasm_1 = __importDefault(require("@/lib/kueasm"));
let logger = log4js_1.default.getLogger();
logger.level = 'warn';
function main() {
    const optionDefinition = [
        { name: 'input', type: String, desc: '入力ファイル', defaultOption: true },
        { name: 'output', alias: 'o', type: String, desc: '出力ファイル' },
        { name: 'verbose', alias: 'v', type: Boolean, desc: '詳細なログを出力' },
        { name: 'help', alias: 'h', type: Boolean, desc: 'ヘルプを表示' },
    ];
    const options = command_line_args_1.default(optionDefinition);
    if (options.help || !options.input || options.command === 'help') {
        const usage = command_line_usage_1.default([
            {
                header: 'Usage',
                content: 'kueasm <input> -o <output>'
            },
            {
                header: 'Options',
                optionList: optionDefinition
            }
        ]);
        console.log(usage);
        process.exit(0);
    }
    if (options.verbose) {
        logger.level = 'debug';
    }
    const inFilePath = options.input;
    if (!inFilePath) {
        logger.error('no input file');
    }
    const outFilePath = options.output || inFilePath.replace(/^(.*\/)?([^\/]+?)(\.asm)?$/, '$2.bin');
    logger.info(`input:  ${inFilePath}`);
    logger.info(`output: ${outFilePath}`);
    const asm = fs_1.default.readFileSync(inFilePath).toString();
    const bin = (new kueasm_1.default(asm, 'kuechip3', logger.level)).exec();
    if (!bin) {
        process.exit(1);
    }
    fs_1.default.writeFileSync(outFilePath, bin);
}
main();
