'use strict';

var browserify = require('gulp-browserify');
var gulp       = require('gulp');
var mocha      = require('gulp-mocha');
var rename     = require('gulp-rename');
var uglifyjs   = require('gulp-uglifyjs');

gulp.task('default', function() {
  gulp.src('index.js')
    .pipe(browserify({ standalone: 'RestModel' }))
    .pipe(rename('rest-model.js'))
    .pipe(gulp.dest('dist'))
    .pipe(uglifyjs())
    .pipe(rename('rest-model.min.js'))
    .pipe(gulp.dest('dist'));
});

gulp.task('test', function() {
  gulp.src('test/**/*-test.js')
    .pipe(mocha({ reporter: 'nyan', timeout: 50 })).on('error', function() {
      // Do not fail on test fail.
    });
});

gulp.task('dev', function() {
  var moduleScripts = [
    'lib/*.js',
    'index.js'
  ];

  var testScripts = ['test/**/*.js'];

  gulp.watch(moduleScripts, ['default']);
  gulp.watch(moduleScripts.concat(testScripts), ['test']);
});
