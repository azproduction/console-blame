/*!
 * console-blame
 */

var parsetrace = require('parsetrace'),
    pad = require('pad'),
    chalk = require('chalk'),
    assign = require('object-assign'),
    EventEmitter = require('events').EventEmitter,
    format = require('util').format;

var trappedToString = function () {
    return '[object ConsoleBlame]';
};

/**
 * @example
 * ```js
 * require('console-blame')(['log']);
 *
 * console.log(123); // Will print debug message
 * console.error(123); // Will NOT print debug message
 * ```
 *
 * @example
 *
 * ```js
 * require('console-blame')(console);
 *
 * console.log(123); // Will print debug message
 * console.error(123); // Will print debug message
 * ```
 *
 * @example
 *
 * ```js
 * require('console-blame')(console, ['log', 'error']);
 *
 * console.log(123); // Will print debug message
 * console.error(123); // Will print debug message
 * ```
 *
 * @example
 *
 * ```js
 * require('console-blame')().configure({
 *    contextSize: 5,
 *    lineFormat: '%d\t%s'
 * });
 * ```
 *
 * @example
 *
 * ```js
 * var blame = require('console-blame')();
 * console.log(123); // Will print debug message
 * blame.restore();
 * console.log(123); // Will NOT print debug message
 * blame.trap();
 * console.log(123); // Will print debug message
 * ```
 *
 * @param {Object} [consoleObject=console]
 * @param {Array} [trapsList]
 * @returns {ConsoleBlame}
 * @constructor
 */
function ConsoleBlame(consoleObject, trapsList) {
    if (!(this instanceof ConsoleBlame)) {
        return new ConsoleBlame(consoleObject, trapsList);
    }
    EventEmitter.call(this);

    if (Array.isArray(consoleObject)) {
        trapsList = consoleObject;
        consoleObject = null;
    }

    this.options = {
        lineFormat: '%d | %s',
        pathFormat: '%s:%d:%d',
        contextSize: 3,
        sources: true
    };

    this.consoleObject = consoleObject || console;
    this.capturedOriginals = {};
    this.middlewares = {};

    this.trap.apply(this, trapsList);
}

ConsoleBlame.prototype = assign(Object.create(EventEmitter.prototype), {
    /**
     * @example
     *
     * ```js
     * require('console-blame')().configure({
     *    contextSize: 5,
     *    lineFormat: '%d\t%s'
     * });
     * ```
     *
     * @param {Object}  [options]
     * @param {String}  [options.lineFormat]
     * @param {String}  [options.pathFormat]
     * @param {Number}  [options.contextSize] number of lines before and after target line
     * @param {Boolean} [options.sources]     print source code?
    */
    configure: function (options) {
        assign(this.options, options || {});

        return this;
    },

    trap: function (/*'log', 'error', ...*/) {
        var trapNames = Array.prototype.slice.call(arguments);

        if (trapNames.length === 0) {
            trapNames = this._getMethodsOf(this.consoleObject);
        }

        this._attachTraps(trapNames);

        return this;
    },

    /**
     * Removes all traps
     *
     * @returns {ConsoleBlame}
     */
    restore: function () {
        var self = this;

        Object.keys(this.capturedOriginals).forEach(function (method) {
            self.consoleObject[method] = self.capturedOriginals[method];
            delete self.capturedOriginals[method];
        });

        return this;
    },

    /**
     * Middleware for ConsoleBlame
     *
     * @example
     *
     * ```js
     * // One by one
     * consoleBlame()
     * .use('console', function before(args, parent) {
     *     process.stdout.write('Before\n');
     *     // Keep parent function call
     *     parent();
     *     process.stdout.write('After\n');
     * })
     * .use('console', function after(args, parent) {
     *     parent();
     *     process.stdout.write('After\n');
     * });
     *
     * console.log(123);
     * ```
     *
     * ```
     * Before
     * 123
     * After
     * After
     * ```
     *
     * @example
     *
     * ```js
     * // Bulk
     * consoleBlame()
     * .use({
     *     console: function (args, parent) {
     *         parent();
     *         process.stdout.write('After\n');
     *     }
     * })
     * ```
     *
     * @param {String|Object} middlewareName
     * @param {Function}      [cb]
     * @returns {ConsoleBlame}
     */
    use: function (middlewareName, cb) {
        var self = this;
        var list = {};

        if (typeof middlewareName === 'string') {
            list[middlewareName] = cb;
        } else {
            list = middlewareName;
        }

        Object.keys(list).forEach(function (middlewareName) {
            self._useOne(middlewareName, list[middlewareName]);
        });

        return this;
    },

    _useOne: function (middlewareName, cb) {
        if (!this.middlewares.hasOwnProperty(middlewareName)) {
            this.middlewares[middlewareName] = [];
        }

        this.middlewares[middlewareName].push(cb);
    },

    /**
     * @example
     * ```js
     * attachTrapTo('log');
     *
     * console.log(123); // Will print debug message
     * ```
     *
     * @example
     *
     * ```js
     * attachTrapTo();
     *
     * console.log(123); // Will print debug message
     * console.error(123); // Will print debug message
     * ```
     *
     * @param {Array} trapNames
     * @returns {ConsoleBlame}
     */
    _attachTraps: function (trapNames) {
        trapNames.forEach(this._attachTrap.bind(this));

        return this;
    },

    /**
     * Returns list of functions assigned to the `object`
     *
     * @param {Object} object
     * @returns {Array}
     * @private
     */
    _getMethodsOf: function (object) {
        return Object.keys(object)
            .filter(function (method) {
                return typeof object[method] === 'function';
            });
    },

    /**
     * @example
     *
     * ```js
     * attachTrapTo(console, 'log');
     *
     * console.log(123); // Will print debug message
     * ```
     *
     * @param {String} methodName
     * @private
     */
    _attachTrap: function (methodName) {
        var originalMethod = this.consoleObject[methodName];

        // If this is a function and it was not trapped
        if (this._isOriginalMethod(originalMethod)) {
            // Keep it and continue
            this.capturedOriginals[methodName] = originalMethod;
        } else {
            // No reason to attach an extra trap
            return;
        }

        // Create trap
        var trappedMethod = this._consoleBlameGenerator(originalMethod);
        // "sign" our trapped method
        trappedMethod.toString = trappedToString;
        // Assign trap
        this.consoleObject[methodName] = trappedMethod;
    },

    /**
     * Checks if passed `method` is original function (not generated by ConsoleBlame)
     *
     * @param {*} method
     * @returns {boolean}
     * @private
     */
    _isOriginalMethod: function (method) {
        return typeof method === 'function' && method.toString() !== trappedToString();
    },

    /**
     * @example
     *
     * ```js
     * console.log = consoleBlameGenerator(log);
     *
     * console.log(123); // Will print debug message
     * ```
     *
     * @param {Function} originalMethod original console's method
     * @returns {Function}
     * @private
     */
    _consoleBlameGenerator: function (originalMethod) {
        var self = this;

        return function () {
            var args = Array.prototype.slice.call(arguments);
            self._applyMiddleware('console', args, function () {
                originalMethod.apply(null, arguments);
            });

            var parseTraceOptions = {
                sources: self.options.sources,
                contextSize: self.options.contextSize
            };

            // Getting previous frame where console.*() was called
            var frames = parsetrace(new Error(), parseTraceOptions).object().frames;

            self._applyMiddleware('file', [frames], function (frames) {
                var frame = frames[1];
                self._log(chalk.green(self.options.pathFormat), frame.file, frame.line, frame.column);
            });

            self._applyMiddleware('code', [frames], function (frames) {
                var frame = frames[1];
                self._printSources(frame.source, frame.line);
            });
        };
    },

    /**
     *
     * @param {Object} sources
     * @param {Number} targetLine
     * @private
     */
    _printSources: function (sources, targetLine) {
        if (!sources) {
            return;
        }

        var padding = String(targetLine + this.options.contextSize).length + 1;

        for (var line in sources) {
            /* istanbul ignore next */
            if (!sources.hasOwnProperty(line)) {
                continue;
            }

            var format = this.options.lineFormat;

            // Hl line
            if (Number(line) === targetLine) {
                format = chalk.bgRed.white(format);
            }

            this._log(format, pad(padding, line), sources[line].code);
        }
    },

    /**
     * Private implementation of console.log
     *
     * @private
     */
    _log: function () {
        process.stdout.write(format.apply(null, arguments) + '\n');
    },

    /**
     * Applies middleware
     *
     * @param {String}   name
     * @param {Array}    args
     * @param {Function} original
     * @private
     */
    _applyMiddleware: function (name, args, original) {
        var list = this.middlewares[name] || [];

        list.reduce(function (original, cb) {
            var wrappedOriginal = function () {
                if (arguments.length === 0) {
                    return original.apply(null, args);
                }

                return original.apply(null, arguments);
            };

            return function () {
                var args = Array.prototype.slice.call(arguments);
                cb(wrappedOriginal, args);
            };
        }, original).apply(this, args);
    }
});

module.exports = ConsoleBlame;
