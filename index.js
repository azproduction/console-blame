/*!
 * console-blame
 *
 * @example
 * ```js
 * attachTrapTo(console, ['log']);
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
 * @example
 *
 * ```js
 * attachTrapsTo(console).configure({
 *    contextSize: 5,
 *    lineFormat: '%d\t%s'
 * });
 * ```
 */

var parsetrace = require('parsetrace'),
    pad = require('pad'),
    chalk = require('chalk'),
    assign = require('object-assign');

var log = console.log;

var options = {
    lineFormat: '%d | %s',
    pathFormat: '%s:%d:%d',
    contextSize: 3,
    sources: true
};

var ALL_CONSOLE_METHODS = Object.keys(console).filter(function (method) {
    return typeof console[method] === 'function';
});

var originals = ALL_CONSOLE_METHODS.reduce(function (originals, method) {
    originals[method] = console[method];
    return originals;
}, {});

/**
 *
 * @param {Object} sources
 * @param {Number} targetLine
 */
function printSources(sources, targetLine) {
    if (!sources) {
        return;
    }

    var padding = String(targetLine + options.contextSize).length + 1;

    for (var line in sources) {
        if (!sources.hasOwnProperty(line)) {
            continue;
        }

        var format = options.lineFormat;

        // Hl line
        if (Number(line) === targetLine) {
            format = chalk.bgRed.white(format);
        }

        log(format, pad(padding, line), sources[line].code);
    }
}

/**
 * @example
 *
 * ```js
 * console.log = consoleBlameGenerator(log);
 *
 * console.log(123); // Will print debug message
 * ```
 *
 * @param {Function} oritinal oritinal console's method
 * @returns {Function}
 */
function consoleBlameGenerator(oritinal) {
    return function consoleBlame() {
        var parsetraceOptions = {
            sources: options.sources,
            contextSize: options.contextSize
        };

        var frame = parsetrace(new Error(), parsetraceOptions).object().frames[1];

        log(chalk.green(options.pathFormat), frame.file, frame.line, frame.column);
        printSources(frame.source, frame.line);

        oritinal.apply(null, arguments);
    };
}

/**
 * @example
 *
 * ```js
 * attachTrapTo(console, 'log');
 *
 * console.log(123); // Will print debug message
 * ```
 *
 * @param {Object} root
 * @param {String} methodName
 */
function attachTrapTo(root, methodName) {
    root[methodName] = consoleBlameGenerator(originals[methodName]);
}

/**
 * @example
 * ```js
 * attachTrapTo(console, ['log']);
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
 * @param {Object}   [root=console]
 * @param {String[]} [methodNames=ALL_METHODS]
 *
 * @returns {Function}
 */
function attachTrapsTo(root, methodNames) {
    root = root || console;
    methodNames = methodNames || ALL_CONSOLE_METHODS;
    methodNames.forEach(attachTrapTo.bind(null, root));

    return attachTrapsTo;
}

/**
 * @example
 *
 * ```js
 * attachTrapsTo(console).configure({
 *    contextSize: 5,
 *    lineFormat: '%d\t%s'
 * });
 * ```
 *
 * @param {Object}  [newOptions]
 * @param {String}  [newOptions.lineFormat]
 * @param {String}  [newOptions.pathFormat]
 * @param {Number}  [newOptions.contextSize] number of lines before and after target line
 * @param {Boolean} [newOptions.sources]     print source code?
*/
function configure(newOptions) {
    assign(options, newOptions || {});

    return attachTrapsTo;
}

module.exports = attachTrapsTo;
module.exports.configure = configure;
