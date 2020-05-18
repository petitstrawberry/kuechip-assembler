'use strict'

const gulp    = require('gulp')
const ts      = require('gulp-typescript')
const plumber = require('gulp-plumber')
const tslint  = require('gulp-tslint')
const notify  = require('gulp-notify')

const exec = require('child_process').exec;


const sources = [
  './src/*.ts',
  './lib/*.ts',
]

const testSources = [
  './test/*.ts',
]


// lint
gulp.task("lint", () => {
  return gulp.src([...sources, ...testSources])
    .pipe(plumber({
      errorHandler: notify.onError(`Error: lint error`)
    }))
    .pipe(tslint({
      configuration: './tslint.json',
      formatter:     'verbose',
    }))
    .pipe(tslint.report());
})


// トランスパイル
gulp.task('build', () => {
  const tsProject = ts.createProject('./tsconfig.json')
  return gulp.src(sources)
    .pipe(tsProject())
    .js
    .pipe(gulp.dest('./dist'))
})

// ファイル変更を監視してトランスパイル
gulp.task('watch-and-build', () => gulp.watch(sources, gulp.series('lint', 'build')))


// テスト実行
gulp.task('test', (callback) => {
  exec('./node_modules/.bin/ava ./test/*.ts --fail-fast -v', (err, stdout, stderr) => {
    console.log(stdout)
    console.error(stderr)
    callback(0)
  })
})

// ファイル変更を監視してテストを実行
gulp.task('watch-and-test', () => gulp.watch([...sources, ...testSources], gulp.series('lint', 'test')))


// 指定なしだとビルド
gulp.task('default', gulp.series('build'))

