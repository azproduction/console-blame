/*global describe, it, beforeEach, afterEach*/
/*jshint expr:true*/

var expect = require('chai').expect,
    assign = require('object-assign'),
    chalk = require('chalk'),
    fs = require('fs'),
    format = require('util').format,
    sinon = require('sinon'),
    ConsoleBlame = require('..'),
    consoleBlame = ConsoleBlame;

var TRAP_SIGNATURE = '[object ConsoleBlame]';

/**
 * It locks stdout
 *
 * @example
 * var unlock = trapStdout();
 * console.log('123');
 * expect(unlock() === '123\n');
 *
 * @returns {Function}
 */
function trapStdout() {
    // - Setup buffer
    var stdoutBuffer = '';
    // - Save process.stdout.write
    var _processStdoutWrite = process.stdout.write;

    // - Trap process.stdout.write
    process.stdout.write = function (string) {
        stdoutBuffer += string;
    };

    /**
     * Unlocks stdout
     * @returns {String[]}
     */
    return function releaseStdout() {
        // - Restore process.stdout.write
        process.stdout.write = _processStdoutWrite;
        // - Return buffer
        return stdoutBuffer.split('\n');
    };
}

describe('ConsoleBlame', function () {
    /*jshint maxstatements:50*/
    var _console = null,
        _consoleMethods = null;

    var consoleMock = null;

    var fixtures = ['error', 'log'].reduce(function (fixtures, name) {
        var file = require.resolve('./fixtures/function-with-console-' + name);
        var lines = fs.readFileSync(file, 'utf8').split('\n');
        var method = require(file);

        fixtures[name] = {
            file: file,
            lines: lines,
            method: method
        };

        return fixtures;
    }, {});

    beforeEach(function () {
        // # Create console mock
        // - Save global console
        _console = global.console;
        _consoleMethods = {};
        assign(_consoleMethods, global.console);

        // - Trap console
        consoleMock = {
            log: function () {
                process.stdout.write(format.apply(null, arguments) + '\n');
            },
            error: function () {
                process.stdout.write(format.apply(null, arguments) + '\n');
            }
        };

        // # Disable chalk
        chalk.enabled = false;
    });

    afterEach(function () {
        // # Restore console
        global.console = _console;
        assign(global.console, _consoleMethods);

        // # Enable chalk
        chalk.enabled = true;
    });

    it('returns instance of `ConsoleBlame` if called with new', function () {
        var blame = new ConsoleBlame(consoleMock);

        expect(blame).to.be.an.instanceof(ConsoleBlame);
    });

    it('returns instance of `ConsoleBlame` if called without new', function () {
        var blame = consoleBlame(consoleMock);
        expect(blame).to.be.an.instanceof(ConsoleBlame);
    });

    it('uses global `console` object if `consoleObject` is not passed', function () {
        consoleBlame(null, ['error']);

        // Checking for a trap
        expect(global.console.error.toString()).to.eql(TRAP_SIGNATURE);
    });

    it('treats first argument as `trapsList` if it is an Array', function () {
        consoleBlame(['error']);

        // Checking for a trap
        expect(global.console.error.toString()).to.eql(TRAP_SIGNATURE);
    });

    it('uses `consoleObject` if available', function () {
        consoleBlame(consoleMock, ['error', 'log']);

        // Checking for a trap
        expect(consoleMock.error.toString()).to.eql(TRAP_SIGNATURE);
        expect(consoleMock.log.toString()).to.eql(TRAP_SIGNATURE);
    });

    it('traps all console methods if `trapsList` is not passed', function () {
        consoleBlame(consoleMock);

        // Checking for a trap
        expect(consoleMock.error.toString()).to.eql(TRAP_SIGNATURE);
        expect(consoleMock.log.toString()).to.eql(TRAP_SIGNATURE);
    });

    it('traps only required methods if `trapsList` is passed', function () {
        consoleBlame(consoleMock, ['error']);

        // Checking for a trap
        expect(consoleMock.error.toString()).to.eql(TRAP_SIGNATURE);
        expect(consoleMock.log.toString()).to.not.eql(TRAP_SIGNATURE);
    });

    describe('#options', function () {

        describe('.lineFormat', function () {

            it('specifies code line format', function () {
                var lineFormat = '[%d,%s]';
                consoleBlame(consoleMock, ['log']).configure({
                    lineFormat: lineFormat
                });

                var unlock = trapStdout();
                fixtures.log.method(consoleMock);
                var lines = unlock();

                var expected = fixtures.log.lines.map(function (code, line) {
                    return format(lineFormat, line + 1, code);
                });

                var actual = lines.slice(2, 6);

                expect(actual).to.eql(expected);
            });

            it('is `%d | %s` by default', function () {
                var defaultFormat = '%d | %s';
                consoleBlame(consoleMock, ['log']);

                var unlock = trapStdout();
                fixtures.log.method(consoleMock);
                var lines = unlock();

                var expected = fixtures.log.lines.map(function (code, line) {
                    return format(defaultFormat, line + 1, code);
                });

                var actual = lines.slice(2, 6);

                expect(actual).to.eql(expected);
            });

        });

        describe('.pathFormat', function () {

            it('specifies file name, line and symbol format', function () {
                var pathFormat = '[%s,%d,%d]';
                consoleBlame(consoleMock, ['log']).configure({
                    pathFormat: pathFormat
                });

                var unlock = trapStdout();
                fixtures.log.method(consoleMock);
                var lines = unlock();

                // 2,17 is an position of console.log in `fixtureFileName` file
                expect(lines[1]).to.eql(format(pathFormat, fixtures.log.file, 2, 17));
            });

            it('is `%s:%d:%d` by default', function () {
                var defaultFormat = '%s:%d:%d';
                consoleBlame(consoleMock, ['log']);

                var unlock = trapStdout();
                fixtures.log.method(consoleMock);
                var lines = unlock();

                // 2,17 is an position of console.log in `fixtureFileName` file
                expect(lines[1]).to.eql(format(defaultFormat, fixtures.log.file, 2, 17));
            });

        });

        describe('.contextSize', function () {

            it('specifies the offset of target line', function () {
                var defaultFormat = '%d | %s';
                consoleBlame(consoleMock, ['log']).configure({
                    contextSize: 1
                });

                var unlock = trapStdout();
                fixtures.log.method(consoleMock);
                var lines = unlock();

                var expected = fixtures.log.lines.slice(1, 2).map(function (code, line) {
                    return format(defaultFormat, line + 2, code);
                });

                var actual = lines.slice(3, 4);

                expect(actual).to.eql(expected);
            });

            it('is `3` by default', function () {
                consoleBlame(consoleMock, ['log']);

                var unlock = trapStdout();
                fixtures.log.method(consoleMock);
                var lines = unlock();

                expect(lines[2]).to.eql('1 | module.exports = function (consoleMock) {');
                expect(lines[4]).to.eql('3 | };');
            });

        });

        describe('.sources', function () {

            it('does not print source code if `false`', function () {
                consoleBlame(consoleMock, ['log']).configure({
                    sources: false
                });

                var unlock = trapStdout();
                fixtures.log.method(consoleMock);
                var lines = unlock();

                // 3 = log message + file info + CR
                expect(lines.length).to.eql(3);
            });

            it('is `true` by default', function () {
                consoleBlame(consoleMock, ['log']);

                var unlock = trapStdout();
                fixtures.log.method(consoleMock);
                var lines = unlock();

                // 7 = log message + file info + CR + 4 lines of code
                expect(lines.length).to.eql(7);
            });

        });

    });

    describe('#configure(options)', function () {

        it('overrides options', function () {
            var options = {
                lineFormat: '-%d | %s',
                pathFormat: '-%s:%d:%d',
                contextSize: 4,
                sources: false,
                _extraProperty: true
            };

            var blame = consoleBlame(consoleMock, ['log']).configure(options);

            expect(blame.options).to.deep.eql(options);
        });

        it('accepts empty config object', function () {
            expect(function () {
                consoleBlame(consoleMock, ['log']).configure();
            }).to.not.throw(Error);
        });

        it('returns current `ConsoleBlame` instance', function () {
            var blame = consoleBlame(consoleMock, ['log']);

            expect(blame.configure()).to.eql(blame);
        });

    });

    describe('#trap(...methodNames)', function () {

        it('traps all passed methods names of `consoleObject`', function () {
            consoleBlame(consoleMock, ['undefined']).trap('log');

            expect(consoleMock.log.toString()).to.eql(TRAP_SIGNATURE);
            expect(consoleMock.error.toString()).to.not.eql(TRAP_SIGNATURE);
        });

        it('traps all `consoleObject` methods of `consoleObject`', function () {
            consoleBlame(consoleMock, ['undefined']).trap();

            expect(consoleMock.log.toString()).to.eql(TRAP_SIGNATURE);
            expect(consoleMock.error.toString()).to.eql(TRAP_SIGNATURE);
        });

        it('returns current `ConsoleBlame` instance', function () {
            var blame = consoleBlame(consoleMock, ['log']);

            expect(blame.trap()).to.eql(blame);
        });

        it('forces trapped method to call the original console method', function () {
            var spy = sinon.spy(consoleMock, 'log');
            consoleBlame(consoleMock, ['log']);

            var unlock = trapStdout();
            consoleMock.log('%s %s', 1, 2);
            unlock();

            expect(spy.calledOnce).to.be.eql(true);
            expect(spy.calledWith('%s %s', 1, 2)).to.be.eql(true);
        });

        it('does not trap method twice', function () {
            var blame = consoleBlame(consoleMock, ['log']);
            var expected = consoleMock.log;
            blame.trap('log');
            consoleBlame(consoleMock, ['log']);

            expect(consoleMock.log).to.eql(expected);
        });

        it('does not trap non-functions', function () {
            consoleMock.pewpew = 123;
            consoleBlame(consoleMock, ['undefined']);
            consoleBlame(consoleMock);

            expect(consoleMock.pewpew).to.eql(123);
            expect(consoleMock).to.not.have.property('undefined');
        });

    });

    describe('#restore()', function () {

        it('restores all traps', function () {
            var blame = consoleBlame(consoleMock, ['log']);
            blame.restore();

            expect(consoleMock.log.toString()).to.not.eql(TRAP_SIGNATURE);
            expect(consoleMock.error.toString()).to.not.eql(TRAP_SIGNATURE);

            var unlock = trapStdout();
            consoleMock.log('123');
            var lines = unlock();

            expect(lines).to.eql(['123', '']);
        });

        it('returns current `ConsoleBlame` instance', function () {
            var blame = consoleBlame(consoleMock, ['log']);

            expect(blame.restore()).to.eql(blame);
        });

    });

    describe('#_printSources()', function () {

        it('prints source code line by line if available', function () {
            var lineFormat = '%s,%s';
            consoleBlame(consoleMock, ['log']).configure({
                lineFormat: lineFormat
            });

            var unlock = trapStdout();
            fixtures.log.method(consoleMock);
            var lines = unlock();

            var expected = fixtures.log.lines.map(function (code, line) {
                return format(' ' + lineFormat, line + 1, code);
            });

            var actual = lines.slice(2, 6);

            expect(expected).to.eql(actual);
        });

        it('highlights target line', function () {
            consoleBlame(consoleMock, ['log']);

            chalk.enabled = true;
            var unlock = trapStdout();
            fixtures.log.method(consoleMock);
            var lines = unlock();

            expect(lines[3]).to.eql(chalk.bgRed.white('2 | ' + fixtures.log.lines[1]));
        });

    });

});
