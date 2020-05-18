"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = __importDefault(require("@/lib/logger"));
const MNEMONIC_MAP = {
    LD: 0x60, ST: 0x70, SBC: 0x80, ADC: 0x90, SUB: 0xA0,
    ADD: 0xB0, EOR: 0xC0, OR: 0xD0, AND: 0xE0, CMP: 0xF0,
};
class Kueasm {
    /**
     * @param asmFilePath - アセンブリファイルへのパス
     * @param mode - 'kuechip2' or 'kuechip3'
     */
    constructor(asm, mode, logLevel = 'warn') {
        this._labels = {}; // ラベルのアドレス (10進数) の対応
        this._currentAddr = 0; // メモリデータを配置するアドレス
        this._currentLineNumber = 0; // 現在処理している行番号
        this._currentLineContent = ''; // 現在処理している行の内容
        this._isEnded = false; // end 命令が見つかった
        this._asm = asm.split('\n').map((content, index) => ({ raw: content, lineNumber: index }));
        this._mode = mode;
        this._addrUnitBytes = (mode === 'kuechip3') ? 2 : 1;
        this.log = new logger_1.default(this, logLevel);
    }
    /**
     * アセンブルする
     * @returns アセンブル結果 (バイナリ表現)
     */
    exec() {
        this.log.info('start assemble');
        this.log.debug(this._asm);
        this.log.info('start parse');
        if (!this.parse()) {
            this.log.error('failed to parse assembly program');
            return;
        }
        this.log.info('start process');
        if (!this.process()) {
            this.log.error('failed to convert binary data');
            return;
        }
        this.log.info('start generate');
        if (!this.generate()) {
            this.log.error('failed to generate binary');
            return;
        }
        if (!this._isEnded) {
            this.log.warn(`'END' instruction is not found`);
        }
        return this._binary;
    }
    /**
     * アセンブリプログラムをパースする
     * @returns 成否 (true or false)
     */
    parse() {
        for (const asmLine of this._asm) {
            let buf = asmLine.raw.trim();
            buf = this.parseComment(asmLine, buf);
            buf = this.parseLabel(asmLine, buf);
            this.parseMnemonicAndOperands(asmLine, buf);
        }
        // this.log.debug(this._asm)
        return true;
    }
    /**
     * コメントを処理する
     * @param asmLine - AsmLine オブジェクト
     * @param buf - 行をパース途中の残りテキスト
     * @returns パースした残り
     */
    parseComment(asmLine, buf) {
        // コメントの処理 ('*', '#', ';;', '//' 以降)
        const regexComment = /(\*|#|;;|\/\/)(?<comment>.*)$/;
        const match = buf.match(regexComment);
        if (match) {
            asmLine.comment = match.groups.comment; // コメントを記録しておく
            return buf.replace(regexComment, '').trim(); // コメントを除去
        }
        return buf;
    }
    /**
     * ラベルを処理する
     * @param asmLine - AsmLine オブジェクト
     * @param buf - 行をパース途中の残りテキスト
     * @returns パースした残り
     */
    parseLabel(asmLine, buf) {
        // ラベルの処理
        const regexLabel = /^(?<label>[A-za-z0-9_]+)\s*:/;
        const match = buf.match(regexLabel);
        if (match) {
            asmLine.label = match.groups.label; // ラベルを記録しておく
            return buf.replace(regexLabel, '').trim(); // ラベルを除去
        }
        return buf;
    }
    /**
     * ラベルを処理する
     * @param asmLine - AsmLine オブジェクト
     * @param buf - 行をパース途中の残りテキスト
     * @returns パースした残り
     */
    parseMnemonicAndOperands(asmLine, buf) {
        // ニーモニック, オペランドの処理
        const tokens = buf.split(/ +/);
        if (tokens.length > 0) {
            asmLine.mnemonic = tokens.shift();
        }
        if (tokens.length > 0) {
            asmLine.op1 = tokens.shift().replace(/,$/, '');
        }
        if (tokens.length > 0) {
            asmLine.op2 = tokens.join(' ');
        }
    }
    /**
     * バイナリ表現を生成して _binary にセット
     * @returns 成否 (true or false)
     */
    process() {
        for (const asmLine of this._asm) {
            // this.log.debug(this._asm)                    // デバッグ用に内部データをダンプ
            this._currentLineNumber = asmLine.lineNumber; // ログ用に現在の処理行を表示
            if (asmLine.raw.trim() === '') {
                continue;
            }
            if (asmLine.label) {
                this._labels[asmLine.label] = this._currentAddr;
            }
            this.log.debug(`process ${asmLine.mnemonic}`);
            if (!asmLine.mnemonic) {
                continue;
            }
            const mnemonic = asmLine.mnemonic.toUpperCase();
            if (mnemonic.match(/^EQU$/)) {
                if (!this.processEqu(asmLine)) {
                    return false;
                }
            }
            else if (mnemonic.match(/^LOC$/)) {
                if (!this.processLoc(asmLine)) {
                    return false;
                }
            }
            else if (mnemonic.match(/^DAT$/)) {
                if (!this.processDat(asmLine)) {
                    return false;
                }
            }
            else if (mnemonic.match(/^PROG$/)) {
                if (!this.processProg(asmLine)) {
                    return false;
                }
            }
            else if (mnemonic.match(/^LD$/)) {
                if (!this.processLd(asmLine)) {
                    return false;
                }
            }
            else if (mnemonic.match(/^(ST|SBC|ADC)$/)) {
                if (!this.processStSbcAdc(asmLine)) {
                    return false;
                }
            }
            else if (mnemonic.match(/^SUB$/)) {
                if (!this.processSub(asmLine)) {
                    return false;
                }
            }
            else if (mnemonic.match(/^ADD$/)) {
                if (!this.processAdd(asmLine)) {
                    return false;
                }
            }
            else if (mnemonic.match(/^(EOR|OR|AND|CMP)$/)) {
                if (!this.processEorOrAndCmp(asmLine)) {
                    return false;
                }
            }
            else if (mnemonic.match(/^B/)) {
                if (!this.processB(asmLine)) {
                    return false;
                }
            }
            else if (mnemonic.match(/^NOP$/)) {
                if (!this.processNop(asmLine)) {
                    return false;
                }
            }
            else if (mnemonic.match(/^HLT$/)) {
                if (!this.processHlt(asmLine)) {
                    return false;
                }
            }
            else if (mnemonic.match(/^RCF$/)) {
                if (!this.processRcf(asmLine)) {
                    return false;
                }
            }
            else if (mnemonic.match(/^SCF$/)) {
                if (!this.processScf(asmLine)) {
                    return false;
                }
            }
            else if (mnemonic.match(/^END$/)) {
                if (!this.processEnd(asmLine)) {
                    return false;
                }
            }
            else if (mnemonic.match(/^INC$/)) {
                if (!this.processInc(asmLine)) {
                    return false;
                }
            }
            else if (mnemonic.match(/^DEC$/)) {
                if (!this.processDec(asmLine)) {
                    return false;
                }
            }
            else if (mnemonic.match(/^PSH$/)) {
                if (!this.processPsh(asmLine)) {
                    return false;
                }
            }
            else if (mnemonic.match(/^POP$/)) {
                if (!this.processPop(asmLine)) {
                    return false;
                }
            }
            else if (mnemonic.match(/^CAL$/)) {
                if (!this.processCal(asmLine)) {
                    return false;
                }
            }
            else if (mnemonic.match(/^RET$/)) {
                if (!this.processRet(asmLine)) {
                    return false;
                }
            }
            else if (mnemonic.match(/^[SR][RL]/)) {
                if (!this.processSrRl(asmLine)) {
                    return false;
                }
            }
            else if (mnemonic.match(/^OUT$/)) {
                if (!this.processOut(asmLine)) {
                    return false;
                }
            }
            else if (mnemonic.match(/^IN$/)) {
                if (!this.processIn(asmLine)) {
                    return false;
                }
            }
            else if (mnemonic.match(/^ST/)) {
                if (!this.processSt(asmLine)) {
                    return false;
                }
            }
            else {
                this.log.error(`invalid mnemonic '${mnemonic}`);
                return false;
            }
            if (asmLine.opcode != null) {
                // DAT 命令以外の順番にアドレスを振る命令の処理
                if (!asmLine.addr) {
                    asmLine.addr = this._currentAddr;
                    this._currentAddr += this._addrUnitBytes;
                    this.log.debug('increment addr');
                }
            }
            if (asmLine.operand != null) {
                this._currentAddr += this._addrUnitBytes;
                this.log.debug('increment addr');
            }
        }
        return true;
    }
    /**
     * 数値かどうか (string も数字として判定)
     * @param value - 判定したい値
     * @returns boolean
     */
    isNumber(value) {
        if (typeof value === 'number') {
            return isFinite(value);
        }
        else if (typeof value === 'string') {
            return !isNaN(Number(value));
        }
        else {
            return false;
        }
    }
    /**
     * 式を評価 (四則演算, ラベルを含めることができる)
     * @param expression - 評価したい式
     * @returns パディング付き 16 進数表現
     */
    evalExpression(expression) {
        if (expression.match(/[\+|\-|\*|\/]/)) {
            const terms = expression.split(/\s*([\+|\-|\*|\/])\s*/); // 各項を切り出す
            const formattedTerms = [];
            for (const term of terms) {
                // 空白なら何もしない
                if (term === '') { }
                // 四則演算子はそのまま
                else if (term === '+' || term === '-' || term === '*' || term === '/') {
                    formattedTerms.push(term);
                }
                else {
                    const value = this.evalExpression(term);
                    this.log.debug(`evaluate term: ${term} → ${value}`);
                    // 評価できない項があれば式ごと遅延評価に回す
                    if (!this.isNumber(value)) {
                        this.log.debug(`expression '${term}' in '${expression}' cannot be evaluated now. `
                            + `it will be evaluated later`);
                        return `$(${expression})`;
                    }
                    formattedTerms.push(value);
                }
            }
            // 全項評価できる値なら式全体も評価する
            const value = eval(formattedTerms.join(''));
            this.log.debug(`evaluate expression: ${formattedTerms.join('')} → ${value}`);
            return value;
        }
        // 16 進数
        else if (expression.match(/^[0-9A-F]+H$/i)) {
            return parseInt(expression.replace(/h/i, ''), 16);
        }
        // 10 進数
        else if (this.isNumber(expression)) {
            return parseInt(expression); // そのまま
        }
        // label
        else if (this._labels[expression]) {
            return this._labels[expression];
        }
        else {
            return `$(${expression})`; // $(expression) にしておいて遅延評価する
        }
    }
    /**
     * パディング済み 16 進数文字列にして返す
     * @param num - 数値 (10進数)
     * @returns パディング済み 16 進数文字列
     */
    dec2hex(num, prefix = '0x') {
        if (num < 0) {
            num = num & (this._addrUnitBytes & 0xFFFF);
        } // 補数表現
        return prefix + num.toString(16).toUpperCase().padStart(this._addrUnitBytes * 2, '0');
    }
    /**
     * 代入演算と算術演算のオペコードを取得 (規則配列のもの)
     * @param mnemonic - ニーモニック
     * @param op1 - 第 1 オペランド
     * @param op2 - 第 2 オペランド
     * @returns {opcode?: number, operand?: number | string, error?: boolean}
     */
    getOpcodeOfAssignmentAndArithmeticInst(mnemonic, op1, op2) {
        mnemonic = mnemonic.toUpperCase();
        op1 = op1.toUpperCase();
        op2 = op2.toUpperCase();
        const baseOpcode = MNEMONIC_MAP[mnemonic]; // 命令表の行を決定
        if (!baseOpcode) {
            this.log.error(`internal error: invalid mnemonic ${mnemonic}`);
            return { error: true };
        }
        const res = {};
        // op1
        if (op1 === 'ACC') {
            res.opcode = baseOpcode + 0;
        }
        else if (op1 === 'IX') {
            res.opcode = baseOpcode + 8;
        }
        else {
            this.log.error(`invalid operand '${op1}' for ${mnemonic}`);
            return { error: true };
        }
        // op2 == ACC
        if (op2 === 'ACC') {
            if (mnemonic.match(/^ST/)) {
                this.log.error(`invalid operand '${op2}' of 'ST' (use 'LD' to set registers)`);
                return { error: true };
            }
            res.opcode += 0;
        }
        // op2 == IX
        else if (op2 === 'IX') {
            if (mnemonic.match(/^ST/)) {
                this.log.error(`invalid operand '${op2}' of 'ST' (use 'LD' to set registers)`);
                return { error: true };
            }
            res.opcode += 1;
        }
        // op2 == d (ラベルを含む)
        else if (op2.match(/^([A-Z0-9_\+\-\*\/]+)$/)) {
            if (mnemonic.match(/^ST/)) {
                this.log.error(`invalid operand '${op2}' of 'ST' (use 'LD' to set registers)`);
                return { error: true };
            }
            res.opcode += 2;
            res.operand = this.evalExpression(op2);
            if (!this.isNumber(res.operand)) {
                this.log.debug(`operand ${res.operand} cannot be evaluated now. skip.`);
            }
        }
        // # op2 = [sp+d]
        // elsif ($op2 =~ /\[(SP|sp)\+*([\w\+\-]*)\]/) {
        //   $opcode += 3;
        //   $operand = parse_expression($2);
        // }
        // # op2 = [IX+d] / [IX]
        // elsif ($op2 =~ /\[(IX|ix)\+*([\w\+\-]*)\]/) {
        //   $opcode += 6;
        //   $operand = parse_expression($2);
        // }
        // op2 = [d]                         # d : decimal, hex or label
        else if (op2.match(/^\[([A-Z0-9_\+\-\*\/]+)\]$/)) {
            res.opcode += 4;
            res.operand = this.evalExpression(op2.replace(/[\[\]]/g, ''));
            if (!this.isNumber(res.operand)) {
                this.log.debug(`operand ${res.operand} cannot be evaluated now. skip.`);
            }
        }
        // # op2 = (IX+d) / (IX) (only for kuechip2)
        // elsif ($op2 =~ /\((IX|ix)\+*([\w\+\-]*)\)/) {
        //   $opcode += 7;
        //   $operand = parse_expression($2);
        // }
        // # op2 = (d) (only for kuechip2)     # d : decimal, hex or label
        // elsif ($op2 =~ /\(([\w\+\-]+)\)/) { # ラベルも含まれるので \d ではなく \w
        //   $opcode += 5;
        //   $operand = parse_expression($1);
        // }
        else {
            this.log.error(`invalid operand '${op1}/${op2}'`);
            return { error: true };
        }
        return res;
    }
    /**
     * EQU の処理 (10 進数変換してラベル表 _labels に追加)
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processEqu(asmLine) {
        if (!asmLine.label) {
            this.log.error('label not found for EQU');
            return false;
        }
        if (!asmLine.op1) {
            this.log.error('expected 1 operand for EQU');
            return false;
        }
        if (asmLine.op1.toUpperCase() === 'CA') {
            // EQU のオペランドを CA (current address) にしたら,
            // その EQU 疑似命令の存在する場所のアドレスが割り当てられる.
            // アドレスのインクリメントは行わない
            this._labels[asmLine.label] = this._currentAddr;
        }
        else {
            const value = this.evalExpression(asmLine.op1);
            this._labels[asmLine.label] = value;
        }
        // $option = {no_data => 1};   // 疑似命令行なのでアセンブリのみ出力
        this.log.debug(this._labels);
        return true;
    }
    /**
     * LOC のバイナリ表現を生成
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processLoc(asmLine) {
        if (!asmLine.op1) {
            this.log.error('expected 1 operand for LOC');
            return false;
        }
        const addr = this.evalExpression(asmLine.op1);
        if (this.isNumber(addr)) {
            this._locAddr = addr;
        }
        this.log.debug(`loc addr: ${this._locAddr}`);
        // TODO: 評価できない場合 (2pass)
        return true;
    }
    /**
     * DAT のバイナリ表現を生成
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processDat(asmLine) {
        if (!asmLine.op1) {
            this.log.error('expected 1 operand for DAT');
            return false;
        }
        if (!this._locAddr) {
            this.log.debug('loc addr is not defined now. skip.');
            asmLine.isSkipped = true;
            return true;
        }
        const op1 = asmLine.op1.toUpperCase();
        const value = this.evalExpression(op1);
        if (!this.isNumber(value)) {
            this.log.debug('data cannot be evaluated now. skip.');
            asmLine.isSkipped = true;
            return true;
        }
        asmLine.addr = this._locAddr;
        asmLine.opcode = value;
        this._locAddr += this._addrUnitBytes;
        return true;
    }
    /**
     * PROG のバイナリ表現を生成
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processProg(asmLine) {
        this.log.error('PROG is not supported');
        return false;
    }
    /**
     * LD のバイナリ表現を生成
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processLd(asmLine) {
        if (!asmLine.op1 || !asmLine.op2) {
            this.log.error('expected 2 operands for LOC');
            return false;
        }
        const op1 = asmLine.op1.toUpperCase();
        const op2 = asmLine.op2.toUpperCase();
        // LD IX SP
        if (op1 === 'IX' && op2 === 'SP') {
            asmLine.opcode = 0x01;
        }
        // LD SP IX
        else if (op1 === 'SP' && op2 === 'IX') {
            asmLine.opcode = 0x03;
        }
        // LD SP d
        else if (op1 === 'SP' && this.isNumber(op2)) {
            asmLine.opcode = 0x02;
            asmLine.operand = this.evalExpression(op2);
        }
        // その他の (規則的な割り当てになっている) 命令
        else {
            const res = this.getOpcodeOfAssignmentAndArithmeticInst(asmLine.mnemonic, asmLine.op1, asmLine.op2);
            if (res.error) {
                return false;
            }
            if (res.opcode != null) {
                asmLine.opcode = res.opcode;
            }
            if (res.operand != null) {
                asmLine.operand = res.operand;
            }
            // if ( res.isSkipped ) asmLine.isSkipped = res.isSkipped
            return true;
        }
        return true;
    }
    /**
     *  ST, SBC, ADC のバイナリ表現を生成
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processStSbcAdc(asmLine) {
        if (!asmLine.op1 || !asmLine.op2) {
            this.log.error('expected 2 operands for ${asmLine.mnemonic}');
            return false;
        }
        const res = this.getOpcodeOfAssignmentAndArithmeticInst(asmLine.mnemonic, asmLine.op1, asmLine.op2);
        if (res.error) {
            return false;
        }
        if (res.opcode) {
            asmLine.opcode = res.opcode;
        }
        if (res.operand) {
            asmLine.operand = res.operand;
        }
        // if ( res.isSkipped ) asmLine.isSkipped = res.isSkipped
        return true;
    }
    /**
     * SUB のバイナリ表現を生成
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processSub(asmLine) {
        if (!asmLine.op1 || !asmLine.op2) {
            this.log.error(`expected 2 operands for ${asmLine.mnemonic}`);
            return false;
        }
        const op1 = asmLine.op1.toUpperCase();
        if (op1 === 'SP') {
            asmLine.opcode = 0x07;
            asmLine.operand = this.evalExpression(asmLine.op2);
        }
        else {
            const res = this.getOpcodeOfAssignmentAndArithmeticInst(asmLine.mnemonic, asmLine.op1, asmLine.op2);
            if (res.error) {
                return false;
            }
            if (res.opcode) {
                asmLine.opcode = res.opcode;
            }
            if (res.operand) {
                asmLine.operand = res.operand;
            }
        }
        return true;
    }
    /**
     * ADD のバイナリ表現を生成
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processAdd(asmLine) {
        if (!asmLine.op1 || !asmLine.op2) {
            this.log.error(`expected 2 operands for ${asmLine.mnemonic}`);
            return false;
        }
        const op1 = asmLine.op1.toUpperCase();
        if (op1 === 'SP') {
            asmLine.opcode = 0x06;
            asmLine.operand = this.evalExpression(asmLine.op2);
        }
        else {
            const res = this.getOpcodeOfAssignmentAndArithmeticInst(asmLine.mnemonic, asmLine.op1, asmLine.op2);
            if (res.error) {
                return false;
            }
            if (res.opcode) {
                asmLine.opcode = res.opcode;
            }
            if (res.operand) {
                asmLine.operand = res.operand;
            }
        }
        return true;
    }
    /**
     *  のバイナリ表現を生成
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processEorOrAndCmp(asmLine) {
        this.log.error('not implemented');
        return false;
    }
    /**
     *  のバイナリ表現を生成
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processB(asmLine) {
        if (!asmLine.op1) {
            this.log.error(`expected 1 operand for ${asmLine.mnemonic}`);
            return false;
        }
        const mnemonic = asmLine.mnemonic;
        if (mnemonic === 'BA') {
            asmLine.opcode = 0x30;
        }
        else if (mnemonic === 'BVF') {
            asmLine.opcode = 0x38;
        }
        else if (mnemonic === 'BNZ') {
            asmLine.opcode = 0x31;
        }
        else if (mnemonic === 'BZP') {
            asmLine.opcode = 0x32;
        }
        else if (mnemonic === 'BP') {
            asmLine.opcode = 0x33;
        }
        else if (mnemonic === 'BNI') {
            asmLine.opcode = 0x34;
        }
        else if (mnemonic === 'BNC') {
            asmLine.opcode = 0x35;
        }
        else if (mnemonic === 'BGE') {
            asmLine.opcode = 0x36;
        }
        else if (mnemonic === 'BGT') {
            asmLine.opcode = 0x37;
        }
        else if (mnemonic === 'BZN') {
            asmLine.opcode = 0x3B;
        }
        else if (mnemonic === 'BNO') {
            asmLine.opcode = 0x3C;
        }
        else if (mnemonic === 'BZ') {
            asmLine.opcode = 0x39;
        }
        else if (mnemonic === 'BN') {
            asmLine.opcode = 0x3A;
        }
        else if (mnemonic === 'BC') {
            asmLine.opcode = 0x3D;
        }
        else if (mnemonic === 'BLT') {
            asmLine.opcode = 0x3E;
        }
        else if (mnemonic === 'BLE') {
            asmLine.opcode = 0x3F;
        }
        else {
            this.log.error(`invalid mnemonic '${mnemonic}'`);
            return false;
        }
        asmLine.operand = this.evalExpression(asmLine.op1);
        return true;
    }
    /**
     *  のバイナリ表現を生成
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processNop(asmLine) {
        this.log.error('not implemented');
        return false;
    }
    /**
     *  のバイナリ表現を生成
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processHlt(asmLine) {
        asmLine.opcode = 0x0F;
        return true;
    }
    /**
     *  のバイナリ表現を生成
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processRcf(asmLine) {
        this.log.error('not implemented');
        return false;
    }
    /**
     *  のバイナリ表現を生成
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processScf(asmLine) {
        this.log.error('not implemented');
        return false;
    }
    /**
     *  のバイナリ表現を生成
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processEnd(asmLine) {
        this._isEnded = true;
        return true;
    }
    /**
     *  のバイナリ表現を生成
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processInc(asmLine) {
        this.log.error('not implemented');
        return false;
    }
    /**
     *  のバイナリ表現を生成
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processDec(asmLine) {
        this.log.error('not implemented');
        return false;
    }
    /**
     *  のバイナリ表現を生成
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processPsh(asmLine) {
        this.log.error('not implemented');
        return false;
    }
    /**
     *  のバイナリ表現を生成
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processPop(asmLine) {
        this.log.error('not implemented');
        return false;
    }
    /**
     *  のバイナリ表現を生成
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processCal(asmLine) {
        this.log.error('not implemented');
        return false;
    }
    /**
     *  のバイナリ表現を生成
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processRet(asmLine) {
        this.log.error('not implemented');
        return false;
    }
    /**
     *  のバイナリ表現を生成
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processSrRl(asmLine) {
        this.log.error('not implemented');
        return false;
    }
    /**
     *  のバイナリ表現を生成
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processOut(asmLine) {
        this.log.error('not implemented');
        return false;
    }
    /**
     *  のバイナリ表現を生成
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processIn(asmLine) {
        this.log.error('not implemented');
        return false;
    }
    /**
     *  のバイナリ表現を生成
     * @param asmLine - AsmLine オブジェクト
     * @returns 成否 (true or false)
     */
    processSt(asmLine) {
        this.log.error('not implemented');
        return false;
    }
    /**
     * バイナリ表現のプログラムデータの生成 (内部形式から出力用形式に整形)
     * @returns 成否 (true or false)
     */
    generate() {
        const lines = [];
        for (const asmLine of this._asm) {
            const addr = asmLine.addr != null ? (this.dec2hex(asmLine.addr, '') + ':') : '';
            const opcode = asmLine.opcode != null ? this.dec2hex(asmLine.opcode, '') : '';
            const operand = asmLine.operand != null ? this.dec2hex(asmLine.operand, '') : '';
            const comment = asmLine.raw != '' ? ` ${asmLine.raw}` : '';
            lines.push(this._binary = `${addr} ${opcode} ${operand}`.padEnd(17, ' ') + `#${comment}`);
            this.log.debug(this._binary);
        }
        this._binary = lines.join('\n') + '\n';
        return true;
    }
}
exports.default = Kueasm;
